import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  EventDeduper,
  createKaiCallsWebhookHandler,
  parseKaiCallsEvent,
  verifyKaiCallsSignature,
} from "./webhook.js";
import { smsReceivedEvent } from "./__fixtures__/events.js";

const SECRET = "a".repeat(64);
const NOW = 1_780_000_000;

function sign(body: string, t = NOW, secret = SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyKaiCallsSignature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a valid signature", () => {
    expect(verifyKaiCallsSignature({ secret: SECRET, header: sign(body), rawBody: body, nowSeconds: NOW })).toEqual({ ok: true });
  });

  it("rejects a signature made with another secret", () => {
    const check = verifyKaiCallsSignature({
      secret: SECRET,
      header: sign(body, NOW, "b".repeat(64)),
      rawBody: body,
      nowSeconds: NOW,
    });
    expect(check).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a tampered body", () => {
    const check = verifyKaiCallsSignature({ secret: SECRET, header: sign(body), rawBody: `${body} `, nowSeconds: NOW });
    expect(check).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects timestamps older or newer than five minutes", () => {
    expect(verifyKaiCallsSignature({ secret: SECRET, header: sign(body, NOW - 301), rawBody: body, nowSeconds: NOW })).toEqual({ ok: false, reason: "expired" });
    expect(verifyKaiCallsSignature({ secret: SECRET, header: sign(body, NOW + 301), rawBody: body, nowSeconds: NOW })).toEqual({ ok: false, reason: "expired" });
    expect(verifyKaiCallsSignature({ secret: SECRET, header: sign(body, NOW - 299), rawBody: body, nowSeconds: NOW }).ok).toBe(true);
  });

  it("rejects missing and malformed headers", () => {
    expect(verifyKaiCallsSignature({ secret: SECRET, header: undefined, rawBody: body, nowSeconds: NOW })).toEqual({ ok: false, reason: "missing" });
    expect(verifyKaiCallsSignature({ secret: SECRET, header: "v1=abc", rawBody: body, nowSeconds: NOW })).toEqual({ ok: false, reason: "malformed" });
    expect(verifyKaiCallsSignature({ secret: SECRET, header: `t=${NOW},v1=zz`, rawBody: body, nowSeconds: NOW })).toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("parseKaiCallsEvent", () => {
  it("accepts an inbound sms.received owned by the external agent", () => {
    const parsed = parseKaiCallsEvent(smsReceivedEvent());
    expect(parsed.kind).toBe("inbound");
    if (parsed.kind !== "inbound") return;
    expect(parsed.message).toMatchObject({
      eventId: "evt_1",
      channel: "sms",
      from: "+15551230000",
      to: "+15559870000",
      content: "Do you have a table at 7?",
      conversationId: "conv_1",
      smsMessageId: "sms_1",
      leadName: "Dana",
      agentId: "22222222-2222-4222-8222-222222222222",
      injectionSuspected: false,
    });
  });

  it("ignores other event types, outbound texts and conversations Kai owns", () => {
    expect(parseKaiCallsEvent(smsReceivedEvent({ event: "call.completed", event_type: "call.completed" })).kind).toBe("ignored");
    expect(parseKaiCallsEvent(smsReceivedEvent({}, { direction: "outbound" })).kind).toBe("ignored");
    expect(parseKaiCallsEvent(smsReceivedEvent({}, { conversation_owner: "ai" })).kind).toBe("ignored");
    expect(parseKaiCallsEvent(smsReceivedEvent({}, { conversation_owner: undefined })).kind).toBe("ignored");
    expect(parseKaiCallsEvent(smsReceivedEvent({}, { content: "", media_count: 0 })).kind).toBe("ignored");
    expect(parseKaiCallsEvent(null).kind).toBe("ignored");
  });

  it("maps WhatsApp senders and the injection flag", () => {
    const parsed = parseKaiCallsEvent(
      smsReceivedEvent(
        { content_annotations: { "data.content": { injection_suspected: true } } },
        { channel: "whatsapp", from_phone: "whatsapp:+15551230000" },
      ),
    );
    expect(parsed.kind === "inbound" && parsed.message).toMatchObject({
      channel: "whatsapp",
      from: "+15551230000",
      injectionSuspected: true,
    });
  });
});

describe("EventDeduper", () => {
  it("claims an id once within the TTL", () => {
    const deduper = new EventDeduper(1000);
    expect(deduper.claim("a", 0)).toBe(true);
    expect(deduper.claim("a", 500)).toBe(false);
    expect(deduper.claim("a", 1500)).toBe(true);
  });

  it("stays bounded", () => {
    const deduper = new EventDeduper(60_000, 3);
    for (const id of ["a", "b", "c", "d"]) deduper.claim(id, 1);
    expect(deduper.claim("a", 2)).toBe(true);
    expect(deduper.claim("d", 2)).toBe(false);
  });
});

function fakeRequest(body: string, headers: Record<string, string>, method = "POST"): IncomingMessage {
  const req = Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
  req.method = method;
  req.headers = headers;
  Object.defineProperty(req, "socket", { value: { destroyed: false, writable: true, readable: true } });
  return req;
}

function fakeResponse() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(body?: string) {
      this.body = body ?? "";
    },
  };
  return res;
}

describe("createKaiCallsWebhookHandler", () => {
  const makeHandler = () => {
    const dispatch = vi.fn(async (_message: unknown) => undefined);
    const handler = createKaiCallsWebhookHandler({
      webhookSecret: SECRET,
      deduper: new EventDeduper(),
      dispatch,
      now: () => NOW * 1000,
    });
    return { dispatch, handler };
  };

  it("verifies, acknowledges and dispatches once per event id", async () => {
    const { dispatch, handler } = makeHandler();
    const body = JSON.stringify(smsReceivedEvent());
    const headers = { "x-kaicalls-signature": sign(body), "x-kaicalls-event": "sms.received" };
    const res1 = fakeResponse();
    await handler(fakeRequest(body, headers), res1 as unknown as ServerResponse);
    const res2 = fakeResponse();
    await handler(fakeRequest(body, headers), res2 as unknown as ServerResponse);
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ eventId: "evt_1", from: "+15551230000" });
  });

  it("rejects a bad signature with 401 and does not dispatch", async () => {
    const { dispatch, handler } = makeHandler();
    const body = JSON.stringify(smsReceivedEvent());
    const res = fakeResponse();
    await handler(fakeRequest(body, { "x-kaicalls-signature": sign(body, NOW, "x") }), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("acknowledges ignored events with 200", async () => {
    const { dispatch, handler } = makeHandler();
    const body = JSON.stringify(smsReceivedEvent({ event: "sms.sent", event_type: "sms.sent" }));
    const res = fakeResponse();
    await handler(fakeRequest(body, { "x-kaicalls-signature": sign(body) }), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(200);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects non-POST requests", async () => {
    const { handler } = makeHandler();
    const res = fakeResponse();
    await handler(fakeRequest("", {}, "GET"), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(405);
  });
});
