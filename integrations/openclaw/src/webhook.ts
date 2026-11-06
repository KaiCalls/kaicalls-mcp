import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "openclaw/plugin-sdk/webhook-ingress";
import { normalizePhone } from "./config.js";

export const SIGNATURE_HEADER = "x-kaicalls-signature";
export const EVENT_HEADER = "x-kaicalls-event";
export const SIGNATURE_TOLERANCE_SECONDS = 300;
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export type KaiCallsLog = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

/**
 * Verifies `X-KaiCalls-Signature: t=<unix>,v1=<hex>` where v1 = HMAC-SHA256(secret, "<t>.<rawBody>").
 * The body must be the exact bytes received; re-serialized JSON will not verify.
 */
export function verifyKaiCallsSignature(params: {
  secret: string;
  header: string | undefined;
  rawBody: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): SignatureCheck {
  if (!params.header || !params.secret) {
    return { ok: false, reason: "missing" };
  }
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of params.header.split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) {
    return { ok: false, reason: "malformed" };
  }
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  if (Math.abs(now - Number(timestamp)) > tolerance) {
    return { ok: false, reason: "expired" };
  }
  const expected = createHmac("sha256", params.secret)
    .update(`${timestamp}.${params.rawBody}`)
    .digest();
  for (const candidate of signatures) {
    if (!/^[0-9a-f]+$/i.test(candidate) || candidate.length !== expected.length * 2) {
      continue;
    }
    if (timingSafeEqual(Buffer.from(candidate, "hex"), expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "mismatch" };
}

/** The fields of an inbound `sms.received` event the channel uses. */
export type KaiCallsInboundText = {
  eventId: string;
  businessId: string;
  occurredAt: number;
  channel: "sms" | "whatsapp";
  from: string;
  to: string;
  content: string;
  smsMessageId: string;
  conversationId: string;
  leadId?: string;
  leadName?: string;
  mediaCount: number;
  agentId?: string;
  externalAgentId?: string;
  injectionSuspected: boolean;
};

export type ParsedEvent =
  | { kind: "inbound"; message: KaiCallsInboundText }
  | { kind: "ignored"; reason: string; eventId?: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Accepts only `sms.received` with direction=inbound that this receiver is meant to answer
 * (conversation_owner "external"). Everything else is acknowledged and ignored, so KaiCalls
 * does not retry it.
 */
export function parseKaiCallsEvent(payload: unknown): ParsedEvent {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { kind: "ignored", reason: "not an object" };
  }
  const event = payload as Record<string, unknown>;
  const eventId = str(event.event_id);
  const eventType = str(event.event) || str(event.event_type);
  if (eventType !== "sms.received") {
    return { kind: "ignored", reason: `event ${eventType || "(none)"}`, ...(eventId ? { eventId } : {}) };
  }
  const data =
    event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : {};
  if (str(data.direction) !== "inbound") {
    return { kind: "ignored", reason: "not inbound", ...(eventId ? { eventId } : {}) };
  }
  const owner = str(data.conversation_owner);
  if (owner !== "external") {
    // Kai or a human owns this conversation; replying too would double-text the customer.
    return {
      kind: "ignored",
      reason: `conversation owned by ${owner || "KaiCalls"}`,
      ...(eventId ? { eventId } : {}),
    };
  }
  const from = normalizePhone(str(data.from_phone));
  const content = typeof data.content === "string" ? data.content : "";
  const mediaCount = typeof data.media_count === "number" ? data.media_count : 0;
  if (!eventId || !from || (!content.trim() && mediaCount === 0)) {
    return { kind: "ignored", reason: "missing event_id, sender or content", ...(eventId ? { eventId } : {}) };
  }
  const occurred = Date.parse(str(event.occurred_at));
  const correlation =
    event.correlation && typeof event.correlation === "object"
      ? (event.correlation as Record<string, unknown>)
      : {};
  const annotations =
    event.content_annotations && typeof event.content_annotations === "object"
      ? (event.content_annotations as Record<string, { injection_suspected?: unknown }>)
      : {};
  const leadId = str(data.lead_id);
  const leadName = str(data.lead_name);
  const agentId = str(correlation.agent_id);
  const externalAgentId = str(data.external_agent_id);
  return {
    kind: "inbound",
    message: {
      eventId,
      businessId: str(event.business_id),
      occurredAt: Number.isFinite(occurred) ? occurred : Date.now(),
      channel: str(data.channel) === "whatsapp" ? "whatsapp" : "sms",
      from,
      to: normalizePhone(str(data.to_phone)),
      content,
      smsMessageId: str(data.sms_message_id) || eventId,
      conversationId: str(data.conversation_id) || from,
      ...(leadId ? { leadId } : {}),
      ...(leadName ? { leadName } : {}),
      mediaCount,
      ...(agentId ? { agentId } : {}),
      ...(externalAgentId ? { externalAgentId } : {}),
      injectionSuspected: annotations["data.content"]?.injection_suspected === true,
    },
  };
}

/** In-memory event dedupe (v1). KaiCalls retries until it gets a 2xx; a restart forgets. */
export class EventDeduper {
  private readonly seen = new Map<string, number>();
  constructor(
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly maxEntries = 10_000,
  ) {}

  /** Returns true the first time an id is seen within the TTL. */
  claim(id: string, now = Date.now()): boolean {
    const previous = this.seen.get(id);
    if (previous !== undefined && now - previous < this.ttlMs) {
      return false;
    }
    this.seen.delete(id);
    this.seen.set(id, now);
    if (this.seen.size > this.maxEntries) {
      for (const [key, at] of this.seen) {
        if (this.seen.size <= this.maxEntries && now - at < this.ttlMs) {
          break;
        }
        this.seen.delete(key);
      }
    }
    return true;
  }

  release(id: string): void {
    this.seen.delete(id);
  }
}

function respond(res: ServerResponse, status: number, body = ""): true {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(body);
  return true;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The Gateway route handler: verify, filter, dedupe, answer 200, then dispatch in the background.
 * A dispatch failure is logged; KaiCalls already has its 200, so it will not retry.
 */
export function createKaiCallsWebhookHandler(params: {
  webhookSecret: string;
  deduper: EventDeduper;
  dispatch: (message: KaiCallsInboundText) => Promise<void>;
  log?: KaiCallsLog;
  now?: () => number;
}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      return respond(res, 405, "Method not allowed");
    }
    let rawBody: string;
    try {
      rawBody = await readRequestBodyWithLimit(req, { maxBytes: MAX_WEBHOOK_BODY_BYTES });
    } catch (error) {
      return respond(res, isRequestBodyLimitError(error) ? 413 : 400, "Invalid request body");
    }
    const check = verifyKaiCallsSignature({
      secret: params.webhookSecret,
      header: header(req, SIGNATURE_HEADER),
      rawBody,
      nowSeconds: Math.floor((params.now?.() ?? Date.now()) / 1000),
    });
    if (!check.ok) {
      params.log?.warn?.(`KaiCalls webhook rejected a request (${check.reason} signature)`);
      return respond(res, 401, "Invalid signature");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Signed but unparseable: retrying cannot fix it.
      params.log?.warn?.("KaiCalls webhook ignored a signed body that is not JSON");
      return respond(res, 200);
    }
    const parsed = parseKaiCallsEvent(payload);
    if (parsed.kind === "ignored") {
      params.log?.info?.(`KaiCalls webhook ignored event: ${parsed.reason}`);
      return respond(res, 200);
    }
    const message = parsed.message;
    if (!params.deduper.claim(message.eventId)) {
      params.log?.info?.(`KaiCalls webhook ignored duplicate event ${message.eventId}`);
      return respond(res, 200);
    }
    respond(res, 200);
    void params.dispatch(message).catch((error: unknown) => {
      params.log?.error?.(
        `KaiCalls inbound dispatch failed for event ${message.eventId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return true;
  };
}
