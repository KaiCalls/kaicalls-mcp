import { hostname } from "node:os";
import type { OpenClawConfig, OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { KaiCallsClient, type FetchLike } from "./client.js";
import { DEFAULT_WEBHOOK_PATH, WEBHOOK_SECRET_ENV } from "./config.js";
import { sha256Hex } from "./send.js";
import { resolveToolCredentials } from "./tools.js";

type Print = (line: string) => void;

export type ConnectOptions = {
  webhookUrl: string;
  agentId: string;
  businessId?: string;
  externalAgentId?: string;
};

/** Stable across retries of the same connect, so a retry never creates a second connection. */
export function connectIdempotencyKey(input: {
  businessId?: string;
  agentId: string;
  externalAgentId: string;
  webhookUrl: string;
}): string {
  const seed = JSON.stringify([
    input.businessId ?? "",
    input.agentId,
    input.externalAgentId,
    input.webhookUrl,
  ]);
  return `openclaw-connect-${sha256Hex(seed).slice(0, 40)}`;
}

export function defaultExternalAgentId(): string {
  const host = hostname().replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120) || "gateway";
  return `openclaw:${host}`;
}

function validateWebhookUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("--webhook-url must be a full https:// URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("--webhook-url must be HTTPS, without credentials or a #fragment");
  }
  return url.href;
}

function currentRevision(payload: Record<string, unknown>): number {
  const connection = payload.connection as { revision?: unknown } | null | undefined;
  return typeof connection?.revision === "number" ? connection.revision : 0;
}

export async function runConnect(
  options: ConnectOptions,
  deps: { client: KaiCallsClient; businessId?: string; print: Print },
): Promise<void> {
  const webhookUrl = validateWebhookUrl(options.webhookUrl);
  const businessId = options.businessId || deps.businessId;
  const externalAgentId = options.externalAgentId || defaultExternalAgentId();
  let expectedRevision = 0;
  try {
    expectedRevision = currentRevision(await deps.client.getAgentConnection(businessId));
  } catch {
    // No read access or no connection yet: a first connect uses revision 0.
  }
  const idempotencyKey = connectIdempotencyKey({
    ...(businessId ? { businessId } : {}),
    agentId: options.agentId,
    externalAgentId,
    webhookUrl,
  });
  const result = await deps.client.connectAgent(
    {
      ...(businessId ? { business_id: businessId } : {}),
      agent_id: options.agentId,
      external_agent_id: externalAgentId,
      webhook_url: webhookUrl,
      expected_revision: expectedRevision,
      external_reply_timeout_seconds: null,
    },
    idempotencyKey,
  );
  const connection = (result.connection ?? {}) as Record<string, unknown>;
  deps.print(
    `Connected: texts to agent ${String(connection.agent_id ?? options.agentId)} now go to ${webhookUrl}`,
  );
  deps.print(`Connection revision: ${String(connection.revision ?? "?")}`);
  const secret = typeof result.webhook_secret === "string" ? result.webhook_secret : "";
  if (secret) {
    deps.print("");
    deps.print("Webhook signing secret (shown once). Add this line to ~/.openclaw/.env:");
    deps.print("");
    deps.print(`${WEBHOOK_SECRET_ENV}=${secret}`);
    deps.print("");
    deps.print(
      `Then set channels.kaicalls.agentId to ${options.agentId} and restart the Gateway.`,
    );
  } else if (result.replayed === true) {
    deps.print(
      "This connect was already applied, so the secret is not shown again. Use the secret from the first run, or reconnect with a different --webhook-url or --external-agent-id to get a new one.",
    );
  }
}

export async function runStatus(deps: {
  client: KaiCallsClient;
  businessId?: string;
  print: Print;
}): Promise<void> {
  const result = await deps.client.getAgentConnection(deps.businessId);
  const connection = result.connection as Record<string, unknown> | null | undefined;
  if (!connection) {
    deps.print("No agent connection. Run `openclaw kaicalls connect --webhook-url <url> --agent-id <uuid>`.");
    return;
  }
  const delivery = (result.delivery ?? {}) as Record<string, unknown>;
  deps.print(`Status: ${String(connection.status)}`);
  deps.print(`Business: ${String(connection.business_id)}`);
  deps.print(`KaiCalls agent: ${String(connection.agent_id)}`);
  deps.print(`External agent: ${String(connection.external_agent_id)}`);
  deps.print(`Revision: ${String(connection.revision)}`);
  if (delivery.url) {
    deps.print(`Webhook: ${String(delivery.url)} (configured: ${String(delivery.configured)})`);
  }
  if (typeof delivery.failure_count === "number" && delivery.failure_count > 0) {
    deps.print(`Recent delivery failures: ${delivery.failure_count}`);
  }
}

export async function runDisconnect(deps: {
  client: KaiCallsClient;
  businessId?: string;
  print: Print;
}): Promise<void> {
  const current = await deps.client.getAgentConnection(deps.businessId);
  const connection = current.connection as Record<string, unknown> | null | undefined;
  if (!connection || connection.status !== "active") {
    deps.print("No active agent connection to disconnect.");
    return;
  }
  await deps.client.disconnectAgent({
    business_id: String(connection.business_id),
    expected_revision: currentRevision(current),
  });
  deps.print("Disconnected. Texts go back to Kai.");
}

async function clientFromConfig(
  config: OpenClawConfig,
  pluginConfig: unknown,
  fetchImpl?: FetchLike,
) {
  const credentials = await resolveToolCredentials(config, pluginConfig);
  return {
    client: new KaiCallsClient({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      ...(fetchImpl ? { fetchImpl } : {}),
    }),
    businessId: credentials.businessId,
    agentId: credentials.agentId,
  };
}

async function runAction(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export function registerKaiCallsCli(api: OpenClawPluginApi): void {
  api.registerCli(
    ({ program, config }) => {
      const print: Print = (line) => console.log(line);
      const root = program
        .command("kaicalls")
        .description("Connect KaiCalls texts to this OpenClaw Gateway");
      root
        .command("connect")
        .description("Send texts for a KaiCalls agent's number to this Gateway's webhook")
        .requiredOption(
          "--webhook-url <url>",
          `Public HTTPS URL of this Gateway's KaiCalls route (path ${DEFAULT_WEBHOOK_PATH} by default)`,
        )
        .option("--agent-id <uuid>", "KaiCalls agent whose line receives the texts")
        .option("--business-id <uuid>", "KaiCalls business (needed when the key reaches several)")
        .option("--external-agent-id <id>", "Stable name for this Gateway (default openclaw:<hostname>)")
        .action(async (opts: Record<string, string | undefined>) =>
          runAction(async () => {
            const ctx = await clientFromConfig(config, api.pluginConfig);
            const agentId = opts.agentId || ctx.agentId;
            if (!agentId) {
              throw new Error("--agent-id is required (or set plugins.entries.kaicalls.config.agentId)");
            }
            await runConnect(
              {
                webhookUrl: opts.webhookUrl ?? "",
                agentId,
                ...(opts.businessId ? { businessId: opts.businessId } : {}),
                ...(opts.externalAgentId ? { externalAgentId: opts.externalAgentId } : {}),
              },
              { client: ctx.client, ...(ctx.businessId ? { businessId: ctx.businessId } : {}), print },
            );
          }),
        );
      root
        .command("status")
        .description("Show the KaiCalls agent connection")
        .option("--business-id <uuid>", "KaiCalls business")
        .action(async (opts: Record<string, string | undefined>) =>
          runAction(async () => {
            const ctx = await clientFromConfig(config, api.pluginConfig);
            const businessId = opts.businessId || ctx.businessId;
            await runStatus({ client: ctx.client, ...(businessId ? { businessId } : {}), print });
          }),
        );
      root
        .command("disconnect")
        .description("Stop sending texts to this Gateway; Kai answers them again")
        .option("--business-id <uuid>", "KaiCalls business")
        .action(async (opts: Record<string, string | undefined>) =>
          runAction(async () => {
            const ctx = await clientFromConfig(config, api.pluginConfig);
            const businessId = opts.businessId || ctx.businessId;
            await runDisconnect({ client: ctx.client, ...(businessId ? { businessId } : {}), print });
          }),
        );
    },
    {
      descriptors: [
        {
          name: "kaicalls",
          description: "Connect KaiCalls texts to this OpenClaw Gateway",
          hasSubcommands: true,
        },
      ],
    },
  );
}
