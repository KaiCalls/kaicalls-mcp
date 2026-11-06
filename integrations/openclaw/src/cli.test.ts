import { describe, expect, it, vi } from "vitest";
import { KaiCallsClient } from "./client.js";
import { connectIdempotencyKey, runConnect, runDisconnect, runStatus } from "./cli.js";

function routedFetch(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Array<{ method: string; url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, init: init ?? {} });
    const route = routes[`${method} ${new URL(url).pathname}`] ?? { status: 404, body: { error: { code: "not_found", message: "nope" } } };
    return new Response(JSON.stringify(route.body), { status: route.status });
  });
  return { calls, client: new KaiCallsClient({ apiKey: "kc_live_test", baseUrl: "https://kaicalls.example", fetchImpl }) };
}

const AGENT = "22222222-2222-4222-8222-222222222222";
const BIZ = "11111111-1111-4111-8111-111111111111";

describe("openclaw kaicalls connect", () => {
  it("connects with a stable idempotency key and prints the secret once", async () => {
    const { calls, client } = routedFetch({
      "GET /api/v1/agent-connections": { status: 200, body: { connection: null } },
      "POST /api/v1/agent-connections": {
        status: 200,
        body: { connection: { agent_id: AGENT, revision: 1, business_id: BIZ }, replayed: false, webhook_secret: "s3cret" },
      },
    });
    const lines: string[] = [];
    await runConnect(
      { webhookUrl: "https://gw.example.ts.net/webhooks/kaicalls", agentId: AGENT, businessId: BIZ, externalAgentId: "openclaw:test" },
      { client, print: (line) => lines.push(line) },
    );
    const post = calls.find((call) => call.method === "POST")!;
    const key = connectIdempotencyKey({
      businessId: BIZ,
      agentId: AGENT,
      externalAgentId: "openclaw:test",
      webhookUrl: "https://gw.example.ts.net/webhooks/kaicalls",
    });
    expect((post.init.headers as Record<string, string>)["Idempotency-Key"]).toBe(key);
    expect(JSON.parse(String(post.init.body))).toEqual({
      business_id: BIZ,
      agent_id: AGENT,
      external_agent_id: "openclaw:test",
      webhook_url: "https://gw.example.ts.net/webhooks/kaicalls",
      expected_revision: 0,
      external_reply_timeout_seconds: null,
      idempotency_key: key,
    });
    expect(lines).toContain("KAICALLS_WEBHOOK_SECRET=s3cret");
  });

  it("replaces an existing connection at its current revision", async () => {
    const { calls, client } = routedFetch({
      "GET /api/v1/agent-connections": { status: 200, body: { connection: { revision: 4, status: "active" } } },
      "POST /api/v1/agent-connections": { status: 200, body: { connection: { revision: 5 }, replayed: true } },
    });
    const lines: string[] = [];
    await runConnect({ webhookUrl: "https://gw.example/webhooks/kaicalls", agentId: AGENT }, { client, print: (l) => lines.push(l) });
    const post = calls.find((call) => call.method === "POST")!;
    expect(JSON.parse(String(post.init.body)).expected_revision).toBe(4);
    expect(lines.join("\n")).toMatch(/secret is not shown again/);
  });

  it("rejects non-HTTPS webhook URLs before calling KaiCalls", async () => {
    const { calls, client } = routedFetch({});
    await expect(
      runConnect({ webhookUrl: "http://gw.example/webhooks/kaicalls", agentId: AGENT }, { client, print: () => {} }),
    ).rejects.toThrow(/HTTPS/);
    expect(calls).toHaveLength(0);
  });

  it("keeps the idempotency key stable for identical input", () => {
    const input = { agentId: AGENT, externalAgentId: "x", webhookUrl: "https://a/b" };
    expect(connectIdempotencyKey(input)).toBe(connectIdempotencyKey({ ...input }));
    expect(connectIdempotencyKey(input)).not.toBe(connectIdempotencyKey({ ...input, webhookUrl: "https://a/c" }));
    expect(connectIdempotencyKey(input).length).toBeLessThanOrEqual(200);
  });
});

describe("status and disconnect", () => {
  it("prints the connection", async () => {
    const { client } = routedFetch({
      "GET /api/v1/agent-connections": {
        status: 200,
        body: {
          connection: { status: "active", business_id: BIZ, agent_id: AGENT, external_agent_id: "openclaw:test", revision: 2 },
          delivery: { url: "https://gw/webhooks/kaicalls", configured: true, failure_count: 0 },
        },
      },
    });
    const lines: string[] = [];
    await runStatus({ client, print: (l) => lines.push(l) });
    expect(lines).toContain("Status: active");
    expect(lines).toContain("Webhook: https://gw/webhooks/kaicalls (configured: true)");
  });

  it("disconnects with the current revision", async () => {
    const { calls, client } = routedFetch({
      "GET /api/v1/agent-connections": { status: 200, body: { connection: { status: "active", business_id: BIZ, revision: 3 } } },
      "DELETE /api/v1/agent-connections": { status: 200, body: { connection: { status: "disconnected", revision: 4 } } },
    });
    await runDisconnect({ client, print: () => {} });
    const del = calls.find((call) => call.method === "DELETE")!;
    expect(JSON.parse(String(del.init.body))).toEqual({ business_id: BIZ, expected_revision: 3 });
  });
});
