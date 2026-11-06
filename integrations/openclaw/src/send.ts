import { createHash } from "node:crypto";
import type { OpenClawConfig } from "openclaw/plugin-sdk/account-resolution";
import { createMessageReceiptFromOutboundResults } from "openclaw/plugin-sdk/channel-outbound";
import { KaiCallsClient, type FetchLike, type SendMessageInput } from "./client.js";
import {
  CHANNEL_ID,
  looksLikePhone,
  normalizePhone,
  resolveKaiCallsAccount,
  type ResolvedKaiCallsAccount,
} from "./config.js";
import type { KaiCallsInboundText } from "./webhook.js";

export type KaiCallsMessageChannel = "sms" | "whatsapp";
export type KaiCallsTarget = { channel: KaiCallsMessageChannel; phone: string };

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** `sms:+15551234567` or `whatsapp:+15551234567`; the channel id itself is never part of it. */
export function buildKaiCallsTarget(channel: KaiCallsMessageChannel, phone: string): string {
  return `${channel}:${phone}`;
}

/**
 * Accepts `+15551234567`, `sms:+1...`, `whatsapp:+1...`, optionally prefixed with `kaicalls:`.
 * A bare number means sms.
 */
export function parseKaiCallsTarget(raw: string | null | undefined): KaiCallsTarget | null {
  let value = String(raw ?? "").trim();
  if (value.toLowerCase().startsWith(`${CHANNEL_ID}:`)) {
    value = value.slice(CHANNEL_ID.length + 1).trim();
  }
  let channel: KaiCallsMessageChannel = "sms";
  const prefix = /^(sms|whatsapp):/i.exec(value);
  if (prefix) {
    channel = prefix[1]!.toLowerCase() as KaiCallsMessageChannel;
    value = value.slice(prefix[0].length);
  }
  const phone = normalizePhone(value);
  return looksLikePhone(phone) ? { channel, phone } : null;
}

export function normalizeKaiCallsTarget(raw: string | null | undefined): string | undefined {
  const target = parseKaiCallsTarget(raw);
  return target ? buildKaiCallsTarget(target.channel, target.phone) : undefined;
}

/**
 * What the last inbound text from a peer told us: which KaiCalls number they texted (needed as
 * `from` for WhatsApp when a business has several) and which agent line owns the thread.
 * In memory only; a send without it still works with the configured agentId.
 */
const peerRoutes = new Map<string, { to: string; agentId?: string }>();
const MAX_PEER_ROUTES = 5_000;

export function rememberPeerRoute(message: Pick<KaiCallsInboundText, "channel" | "from" | "to" | "agentId">): void {
  const key = buildKaiCallsTarget(message.channel, message.from);
  peerRoutes.delete(key);
  peerRoutes.set(key, { to: message.to, ...(message.agentId ? { agentId: message.agentId } : {}) });
  if (peerRoutes.size > MAX_PEER_ROUTES) {
    const oldest = peerRoutes.keys().next().value;
    if (oldest !== undefined) {
      peerRoutes.delete(oldest);
    }
  }
}

export function clearPeerRoutes(): void {
  peerRoutes.clear();
}

/** Builds the /api/v1/messages input for one text to one peer. */
export function buildOutboundMessage(params: {
  account: ResolvedKaiCallsAccount;
  channel: KaiCallsMessageChannel;
  to: string;
  text: string;
  idempotencyKey: string;
}): SendMessageInput {
  const remembered = peerRoutes.get(buildKaiCallsTarget(params.channel, params.to));
  const fromAgentId = params.account.agentId || remembered?.agentId || "";
  if (params.channel === "sms" && !fromAgentId) {
    throw new Error(
      "KaiCalls replies need channels.kaicalls.agentId (the KaiCalls agent whose line sends the text).",
    );
  }
  return {
    channel: params.channel,
    to: params.to,
    body: params.text,
    ...(params.channel === "sms" ? { fromAgentId } : {}),
    ...(params.channel === "whatsapp" && remembered?.to ? { from: remembered.to } : {}),
    ...(params.account.businessId ? { businessId: params.account.businessId } : {}),
    idempotencyKey: params.idempotencyKey,
  };
}

export async function sendKaiCallsTextNow(params: {
  account: ResolvedKaiCallsAccount;
  channel: KaiCallsMessageChannel;
  to: string;
  text: string;
  idempotencyKey: string;
  fetchImpl?: FetchLike;
}) {
  const client = new KaiCallsClient({
    apiKey: params.account.apiKey,
    baseUrl: params.account.baseUrl,
    ...(params.fetchImpl ? { fetchImpl: params.fetchImpl } : {}),
  });
  return await client.sendMessage(buildOutboundMessage(params));
}

/** Keys stay under the API's 200-character limit and are stable for one queued delivery. */
export function outboundIdempotencyKey(seed: string): string {
  return `openclaw-kaicalls-${sha256Hex(seed).slice(0, 48)}`;
}

/** Outbound adapter `sendText`: core chunks long replies; each chunk is one KaiCalls send. */
export async function sendKaiCallsText(
  ctx: {
    cfg: OpenClawConfig;
    to: string;
    text: string;
    accountId?: string | null;
    deliveryQueueId?: string;
    onPlatformSendDispatch?: () => void | Promise<void>;
  },
  options: { fetchImpl?: FetchLike } = {},
) {
  const target = parseKaiCallsTarget(ctx.to);
  if (!target) {
    throw new Error(`Invalid KaiCalls target: ${ctx.to}`);
  }
  const text = ctx.text?.trim();
  if (!text) {
    throw new Error("KaiCalls message text is empty.");
  }
  const account = resolveKaiCallsAccount(ctx.cfg, ctx.accountId);
  // A queue id makes retries of one delivery reuse a key; without one, each text is its own send.
  const seed = ctx.deliveryQueueId
    ? `${ctx.deliveryQueueId}\n${target.channel}\n${target.phone}\n${text}`
    : `${Date.now()}\n${Math.random()}\n${target.phone}\n${text}`;
  await ctx.onPlatformSendDispatch?.();
  const result = await sendKaiCallsTextNow({
    account,
    channel: target.channel,
    to: target.phone,
    text,
    idempotencyKey: outboundIdempotencyKey(seed),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  const messageId = result.id ?? "";
  return {
    channel: CHANNEL_ID,
    messageId,
    chatId: target.phone,
    receipt: createMessageReceiptFromOutboundResults({
      results: [
        {
          channel: CHANNEL_ID,
          messageId,
          chatId: target.phone,
          conversationId: target.phone,
          meta: {
            kaicallsChannel: target.channel,
            ...(result.status ? { status: result.status } : {}),
          },
        },
      ],
      kind: "text",
    }),
  };
}
