import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSendMessageBody } from "./client.js";
import { resolveKaiCallsAccount } from "./config.js";
import {
  buildOutboundMessage,
  clearPeerRoutes,
  normalizeKaiCallsTarget,
  parseKaiCallsTarget,
  rememberPeerRoute,
  sendKaiCallsText,
} from "./send.js";

const cfg = {
  channels: {
    kaicalls: {
      apiKey: "kc_live_test",
      baseUrl: "https://kaicalls.example",
      agentId: "agent-uuid",
      businessId: "biz-uuid",
      webhookSecret: "secret",
    },
  },
} as never;

afterEach(() => clearPeerRoutes());

describe("targets", () => {
  it("parses phone targets with optional channel prefixes", () => {
    expect(parseKaiCallsTarget("+15551230000")).toEqual({ channel: "sms", phone: "+15551230000" });
    expect(parseKaiCallsTarget("sms:+1 (555) 123-0000")).toEqual({ channel: "sms", phone: "+15551230000" });
    expect(parseKaiCallsTarget("kaicalls:whatsapp:+15551230000")).toEqual({ channel: "whatsapp", phone: "+15551230000" });
    expect(parseKaiCallsTarget("5551230000")).toEqual({ channel: "sms", phone: "+15551230000" });
    expect(parseKaiCallsTarget("message:abc")).toBeNull();
    expect(parseKaiCallsTarget("")).toBeNull();
    expect(normalizeKaiCallsTarget("whatsapp:+15551230000")).toBe("whatsapp:+15551230000");
  });
});

describe("outbound request", () => {
  it("texts from the configured agent line with the business and idempotency key", () => {
    const account = resolveKaiCallsAccount(cfg);
    const input = buildOutboundMessage({ account, channel: "sms", to: "+15551230000", text: "Yes, 7pm works.", idempotencyKey: "k" });
    expect(buildSendMessageBody(input)).toEqual({
      channel: "sms",
      to: "+15551230000",
      body: "Yes, 7pm works.",
      from_agent_id: "agent-uuid",
      business_id: "biz-uuid",
      idempotency_key: "k",
    });
  });

  it("replies on WhatsApp from the number the sender texted", () => {
    rememberPeerRoute({ channel: "whatsapp", from: "+15551230000", to: "+15559870000" });
    const account = resolveKaiCallsAccount(cfg);
    const input = buildOutboundMessage({ account, channel: "whatsapp", to: "+15551230000", text: "hi", idempotencyKey: "k" });
    expect(buildSendMessageBody(input)).toEqual({
      channel: "whatsapp",
      to: "+15551230000",
      body: "hi",
      from: "+15559870000",
      business_id: "biz-uuid",
      idempotency_key: "k",
    });
  });

  it("refuses an sms reply with no agent line", () => {
    const account = { ...resolveKaiCallsAccount(cfg), agentId: "" };
    expect(() => buildOutboundMessage({ account, channel: "sms", to: "+15551230000", text: "x", idempotencyKey: "k" })).toThrow(/agentId/);
  });

  it("POSTs /api/v1/messages with a queue-stable Idempotency-Key", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} });
      return new Response(JSON.stringify({ id: "msg_1", channel: "sms", status: "queued" }), { status: 200 });
    });
    const ctx = { cfg, to: "sms:+15551230000", text: "On my way", deliveryQueueId: "q-1" };
    const first = await sendKaiCallsText(ctx, { fetchImpl });
    await sendKaiCallsText(ctx, { fetchImpl });
    expect(calls[0]!.url).toBe("https://kaicalls.example/api/v1/messages");
    expect(calls[0]!.init.method).toBe("POST");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer kc_live_test");
    expect(headers["Idempotency-Key"]).toMatch(/^openclaw-kaicalls-[0-9a-f]{48}$/);
    expect((calls[1]!.init.headers as Record<string, string>)["Idempotency-Key"]).toBe(headers["Idempotency-Key"]);
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      channel: "sms",
      to: "+15551230000",
      body: "On my way",
      from_agent_id: "agent-uuid",
      business_id: "biz-uuid",
      idempotency_key: headers["Idempotency-Key"],
    });
    expect(first).toMatchObject({ channel: "kaicalls", messageId: "msg_1", chatId: "+15551230000" });
    expect(first.receipt.platformMessageIds).toEqual(["msg_1"]);
  });

  it("reports the API's refusal", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "quiet_hours", message: "Outside allowed hours" } }), { status: 409 }),
    );
    await expect(sendKaiCallsText({ cfg, to: "+15551230000", text: "x" }, { fetchImpl })).rejects.toThrow(
      "KaiCalls error 409: Outside allowed hours",
    );
  });

  it("rejects an invalid target", async () => {
    await expect(sendKaiCallsText({ cfg, to: "nobody", text: "x" })).rejects.toThrow(/Invalid KaiCalls target/);
  });
});
