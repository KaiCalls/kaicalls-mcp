import { describe, expect, it, vi } from "vitest";
import { KaiCallsClient } from "./client.js";
import {
  KAICALLS_TOOLS,
  KAICALLS_TOOL_NAMES,
  applyToolDefaults,
  executeKaiCallsTool,
  resolveToolCredentials,
} from "./tools.js";

type Captured = { url: string; init: RequestInit };

function mockFetch(status: number, payload: unknown) {
  const calls: Captured[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { calls, fetchImpl };
}

const spec = (name: string) => KAICALLS_TOOLS.find((tool) => tool.name === name)!;
const creds = { apiKey: "kc_live_test", baseUrl: "https://kaicalls.example", agentId: "agent-uuid" };

describe("KaiCalls MCP tools/call", () => {
  it("sends a JSON-RPC tools/call with the bearer key and returns the text", async () => {
    const { calls, fetchImpl } = mockFetch(200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: "Call queued: call_123" }],
        structuredContent: { call: { id: "call_123", status: "queued" } },
      },
    });
    const result = await executeKaiCallsTool(
      spec("kaicalls_make_call"),
      { to: "+19085551234", context: "Ask if they have oat milk", idempotency_key: "k1" },
      creds,
      fetchImpl,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://kaicalls.example/api/mcp");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer kc_live_test");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "make_call",
        arguments: {
          agent_id: "agent-uuid",
          to: "+19085551234",
          context: "Ask if they have oat milk",
          idempotency_key: "k1",
        },
      },
    });
    expect(result.content[0]!.text).toBe("Call queued: call_123");
    expect(result.details).toMatchObject({ ok: true, tool: "make_call" });
  });

  it("maps every tool to its KaiCalls MCP tool name", () => {
    expect(Object.fromEntries(KAICALLS_TOOLS.map((tool) => [tool.name, tool.kaicallsTool]))).toEqual({
      kaicalls_make_call: "make_call",
      kaicalls_call_status: "check_call_status",
      kaicalls_answer_call_question: "answer_call_question",
      kaicalls_send_text: "send_message",
      kaicalls_list_texts: "list_sms_messages",
      kaicalls_list_calls: "list_recent_calls",
      kaicalls_get_transcript: "get_transcript",
      kaicalls_list_numbers: "list_numbers",
    });
    expect(new Set(KAICALLS_TOOL_NAMES).size).toBe(KAICALLS_TOOL_NAMES.length);
  });

  it("explains how to fix a 401", async () => {
    const { fetchImpl } = mockFetch(401, { jsonrpc: "2.0", id: 1, error: { code: -32001, message: "Invalid API key" } });
    const result = await executeKaiCallsTool(spec("kaicalls_list_numbers"), {}, creds, fetchImpl);
    expect(result.content[0]!.text).toMatch(/Settings → API Keys at kaicalls\.com/);
    expect(result.details).toMatchObject({ ok: false, status: 401 });
  });

  it("surfaces JSON-RPC errors", async () => {
    const { fetchImpl } = mockFetch(200, { jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Unknown tool: nope" } });
    const result = await executeKaiCallsTool(spec("kaicalls_call_status"), { call_id: "c1" }, creds, fetchImpl);
    expect(result.content[0]!.text).toBe("Error: KaiCalls check_call_status failed: Unknown tool: nope");
    expect(result.details.ok).toBe(false);
  });

  it("surfaces in-band tool errors (isError)", async () => {
    const { fetchImpl } = mockFetch(200, {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "Error: quiet hours" }], isError: true },
    });
    const result = await executeKaiCallsTool(spec("kaicalls_send_text"), { to: "+15551230000", body: "hi" }, creds, fetchImpl);
    expect(result.content[0]!.text).toBe("Error: quiet hours");
    expect(result.details.ok).toBe(false);
  });

  it("refuses without an API key and without calling KaiCalls", async () => {
    const { calls, fetchImpl } = mockFetch(200, {});
    const result = await executeKaiCallsTool(spec("kaicalls_list_calls"), {}, { apiKey: "", baseUrl: "https://x" }, fetchImpl);
    expect(calls).toHaveLength(0);
    expect(result.content[0]!.text).toMatch(/KAICALLS_API_KEY/);
  });

  it("requires an agent for make_call", async () => {
    const { calls, fetchImpl } = mockFetch(200, {});
    const result = await executeKaiCallsTool(spec("kaicalls_make_call"), { to: "+19085551234" }, { apiKey: "k", baseUrl: "https://x" }, fetchImpl);
    expect(calls).toHaveLength(0);
    expect(result.content[0]!.text).toMatch(/agent_id is required/);
  });

  it("handles a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const result = await executeKaiCallsTool(spec("kaicalls_list_numbers"), {}, creds, fetchImpl);
    expect(result.content[0]!.text).toBe("Error: ECONNRESET");
  });
});

describe("applyToolDefaults", () => {
  it("fills sms sender, channel and business without overriding the model", () => {
    expect(applyToolDefaults(spec("kaicalls_send_text"), { to: "+1", body: "x" }, { agentId: "a", businessId: "b" })).toEqual({
      to: "+1",
      body: "x",
      channel: "sms",
      from_agent_id: "a",
      business_id: "b",
    });
    expect(
      applyToolDefaults(spec("kaicalls_send_text"), { to: "+1", body: "x", channel: "whatsapp" }, { agentId: "a" }),
    ).toEqual({ to: "+1", body: "x", channel: "whatsapp" });
    expect(applyToolDefaults(spec("kaicalls_make_call"), { to: "+1", agent_id: "mine" }, { agentId: "a" })).toEqual({
      to: "+1",
      agent_id: "mine",
    });
  });
});

describe("resolveToolCredentials", () => {
  it("prefers plugin config, then channel config, then env", async () => {
    const cfg = { channels: { kaicalls: { apiKey: "kc_live_channel", agentId: "chan-agent" } } } as never;
    expect(await resolveToolCredentials(cfg, { apiKey: "kc_live_plugin" }, {})).toMatchObject({
      apiKey: "kc_live_plugin",
      agentId: "chan-agent",
      baseUrl: "https://www.kaicalls.com",
    });
    expect(await resolveToolCredentials(cfg, {}, {})).toMatchObject({ apiKey: "kc_live_channel" });
    expect(await resolveToolCredentials({} as never, {}, { KAICALLS_API_KEY: "kc_live_env" })).toMatchObject({
      apiKey: "kc_live_env",
    });
  });

  it("resolves an env SecretRef in plugin config", async () => {
    const ref = { source: "env", provider: "default", id: "MY_KAICALLS_KEY" };
    expect(
      await resolveToolCredentials({} as never, { apiKey: ref }, { MY_KAICALLS_KEY: "kc_live_ref" }),
    ).toMatchObject({ apiKey: "kc_live_ref" });
  });
});

describe("KaiCallsClient", () => {
  it("rejects construction without a key", () => {
    expect(() => new KaiCallsClient({ apiKey: "" })).toThrow(/API key/);
  });
});
