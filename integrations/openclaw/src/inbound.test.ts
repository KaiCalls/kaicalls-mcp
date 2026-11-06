import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveKaiCallsAccount } from "./config.js";
import { INJECTION_NOTICE, buildInboundTurnFields, dispatchKaiCallsInbound, type KaiCallsChannelRuntime } from "./inbound.js";
import { clearPeerRoutes } from "./send.js";
import { parseKaiCallsEvent, type KaiCallsInboundText } from "./webhook.js";
import { smsReceivedEvent } from "./__fixtures__/events.js";

function inboundFrom(event: unknown): KaiCallsInboundText {
  const parsed = parseKaiCallsEvent(event);
  if (parsed.kind !== "inbound") throw new Error("expected inbound");
  return parsed.message;
}

const cfg = {
  channels: {
    kaicalls: {
      apiKey: "kc_live_test",
      baseUrl: "https://kaicalls.example",
      agentId: "agent-uuid",
      webhookSecret: "secret",
      dmPolicy: "allowlist",
      allowFrom: ["+15551230000"],
    },
  },
} as never;

afterEach(() => {
  clearPeerRoutes();
  vi.unstubAllGlobals();
});

describe("buildInboundTurnFields", () => {
  it("maps a KaiCalls text to the turn context", () => {
    const fields = buildInboundTurnFields(inboundFrom(smsReceivedEvent()));
    expect(fields).toMatchObject({
      id: "sms_1",
      timestamp: Date.parse("2026-11-06T12:00:00.000Z"),
      rawText: "Do you have a table at 7?",
      textForAgent: "Do you have a table at 7?",
      from: "kaicalls:+15551230000",
      sender: { id: "+15551230000", name: "Dana" },
      peer: { kind: "direct", id: "+15551230000" },
      conversation: { kind: "direct", id: "conv_1", label: "Dana (+15551230000)" },
      replyTo: "sms:+15551230000",
      extra: { MessageSid: "sms_1", SenderE164: "+15551230000", To: "+15559870000", KaiCallsChannel: "sms" },
    });
  });

  it("marks suspected injections and media for the agent only", () => {
    const fields = buildInboundTurnFields(
      inboundFrom(
        smsReceivedEvent(
          { content_annotations: { "data.content": { injection_suspected: true } } },
          { channel: "whatsapp", media_count: 2 },
        ),
      ),
    );
    expect(fields.rawText).toBe("Do you have a table at 7?");
    expect(fields.textForAgent.startsWith(INJECTION_NOTICE)).toBe(true);
    expect(fields.textForAgent).toMatch(/2 attachments not shown/);
    expect(fields.replyTo).toBe("whatsapp:+15551230000");
  });
});

function fakeRuntime(allowed: boolean, decision = allowed ? "allow" : "block") {
  const captured: { context?: Record<string, unknown>; turn?: Record<string, unknown> } = {};
  const access = {
    senderAccess: { allowed, decision },
    commandAccess: { requested: false, authorized: false },
  };
  const runtime = {
    commands: {
      shouldComputeCommandAuthorized: () => false,
      isControlCommandMessage: () => false,
    },
    pairing: {
      readAllowFromStore: vi.fn(async () => []),
      upsertPairingRequest: vi.fn(async () => ({ code: "123456", created: true })),
    },
    routing: {
      resolveAgentRoute: vi.fn(() => ({ agentId: "main", sessionKey: "agent:main:kaicalls:direct:+15551230000" })),
    },
    inbound: {
      ingress: { resolveStable: vi.fn(async () => access) },
      buildContext: vi.fn((params: Record<string, unknown>) => {
        captured.context = params;
        return { ctx: true };
      }),
      run: vi.fn(async (params: { adapter: { ingest: (raw: unknown) => Record<string, unknown>; resolveTurn: (input: unknown) => Promise<Record<string, unknown>> } }) => {
        const input = params.adapter.ingest(undefined);
        captured.turn = await params.adapter.resolveTurn(input);
      }),
    },
  };
  return { runtime: runtime as unknown as KaiCallsChannelRuntime, raw: runtime, captured };
}

describe("dispatchKaiCallsInbound", () => {
  it("runs a turn for an allowed sender and texts the reply back", async () => {
    const { runtime, raw, captured } = fakeRuntime(true);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_9" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const message = inboundFrom(smsReceivedEvent());
    await dispatchKaiCallsInbound({ cfg, account: resolveKaiCallsAccount(cfg), channelRuntime: runtime, message });

    expect(raw.inbound.run).toHaveBeenCalledTimes(1);
    expect(raw.routing.resolveAgentRoute).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "kaicalls", peer: { kind: "direct", id: "+15551230000" } }),
    );
    expect(captured.context).toMatchObject({
      channel: "kaicalls",
      from: "kaicalls:+15551230000",
      conversation: { kind: "direct", id: "conv_1" },
      reply: { to: "sms:+15551230000" },
      message: { rawBody: "Do you have a table at 7?", bodyForAgent: "Do you have a table at 7?" },
    });
    const delivery = captured.turn!.delivery as {
      durable: () => unknown;
      deliver: (payload: { text?: string }) => Promise<{ visibleReplySent: boolean }>;
    };
    expect(delivery.durable()).toEqual({ to: "sms:+15551230000" });
    await expect(delivery.deliver({ text: "Yes, we have a table at 7." })).resolves.toEqual({ visibleReplySent: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kaicalls.example/api/v1/messages");
    expect(JSON.parse(String(init.body))).toMatchObject({
      channel: "sms",
      to: "+15551230000",
      body: "Yes, we have a table at 7.",
      from_agent_id: "agent-uuid",
    });
    await expect(delivery.deliver({})).resolves.toEqual({ visibleReplySent: false });
  });

  it("does not run a turn for a blocked sender", async () => {
    const { runtime, raw } = fakeRuntime(false);
    await dispatchKaiCallsInbound({
      cfg,
      account: resolveKaiCallsAccount(cfg),
      channelRuntime: runtime,
      message: inboundFrom(smsReceivedEvent()),
    });
    expect(raw.inbound.run).not.toHaveBeenCalled();
  });

  it("sends a pairing challenge instead of a turn when pairing is required", async () => {
    const { runtime, raw } = fakeRuntime(false, "pairing");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_p" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await dispatchKaiCallsInbound({
      cfg,
      account: resolveKaiCallsAccount(cfg),
      channelRuntime: runtime,
      message: inboundFrom(smsReceivedEvent()),
    });
    expect(raw.inbound.run).not.toHaveBeenCalled();
    expect(raw.pairing.upsertPairingRequest).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ channel: "sms", to: "+15551230000" });
    expect(JSON.parse(String(init.body)).body).toContain("123456");
  });
});
