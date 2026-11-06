import { API_KEY_HELP, DEFAULT_BASE_URL } from "./config.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface KaiCallsClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Per-request timeout. KaiCalls tool calls are short; a call itself runs asynchronously. */
  timeoutMs?: number;
}

/** A KaiCalls error carrying the HTTP status and the API's own error code when present. */
export class KaiCallsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "KaiCallsApiError";
    this.status = status;
    if (code !== undefined) {
      this.code = code;
    }
  }
}

export type McpContent = { type: string; text?: string; [key: string]: unknown };
export type McpToolResult = {
  content?: McpContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

export type SendMessageInput = {
  channel: "sms" | "whatsapp";
  to: string;
  body: string;
  fromAgentId?: string;
  from?: string;
  businessId?: string;
  idempotencyKey?: string;
};

export type SendMessageResult = {
  id?: string | null;
  channel?: string | null;
  status?: string | null;
  to?: string | null;
  from?: string | null;
  provider?: string | null;
  replayed?: boolean | null;
};

const USER_AGENT = "kaicalls-openclaw-plugin/0.1.0";

function apiErrorMessage(status: number, payload: unknown, fallback: string): KaiCallsApiError {
  if (status === 401) {
    return new KaiCallsApiError(`KaiCalls rejected the API key (401). ${API_KEY_HELP}`, 401);
  }
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const error = record.error;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const message = typeof e.message === "string" ? e.message : fallback;
    const code = typeof e.code === "string" ? e.code : undefined;
    return new KaiCallsApiError(`KaiCalls error ${status}: ${message}`, status, code);
  }
  if (typeof error === "string") {
    return new KaiCallsApiError(`KaiCalls error ${status}: ${error}`, status);
  }
  return new KaiCallsApiError(`KaiCalls error ${status}: ${fallback}`, status);
}

/** Thin client over the KaiCalls MCP endpoint and the few REST routes the channel needs. */
export class KaiCallsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private rpcId = 0;

  constructor(options: KaiCallsClientOptions) {
    if (!options.apiKey) {
      throw new KaiCallsApiError(`No KaiCalls API key configured. ${API_KEY_HELP}`, 401);
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private async request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; payload: unknown }> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    return { status: response.status, payload };
  }

  /** Calls one KaiCalls MCP tool (`tools/call`) and returns its result. */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const id = ++this.rpcId;
    const { status, payload } = await this.request("POST", "/api/mcp", {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    });
    const rpc = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const rpcError = rpc.error as { code?: number; message?: string } | undefined;
    if (status === 401) {
      throw new KaiCallsApiError(`KaiCalls rejected the API key (401). ${API_KEY_HELP}`, 401);
    }
    if (rpcError) {
      const scopeHint =
        status === 403 ? " Create a key with the needed scope in Settings → API Keys." : "";
      throw new KaiCallsApiError(
        `KaiCalls ${name} failed: ${rpcError.message ?? "unknown error"}${scopeHint}`,
        status,
        rpcError.code !== undefined ? String(rpcError.code) : undefined,
      );
    }
    if (status < 200 || status >= 300 || !rpc.result) {
      throw apiErrorMessage(status, payload, `unexpected response from ${name}`);
    }
    return rpc.result as McpToolResult;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { status, payload } = await this.request(
      "POST",
      "/api/v1/messages",
      buildSendMessageBody(input),
      input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {},
    );
    if (status < 200 || status >= 300) {
      throw apiErrorMessage(status, payload, "message was not sent");
    }
    return (payload ?? {}) as SendMessageResult;
  }

  async connectAgent(
    body: {
      business_id?: string;
      agent_id: string;
      external_agent_id: string;
      webhook_url: string;
      expected_revision: number;
      external_reply_timeout_seconds: number | null;
    },
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const { status, payload } = await this.request(
      "POST",
      "/api/v1/agent-connections",
      { ...body, idempotency_key: idempotencyKey },
      { "Idempotency-Key": idempotencyKey },
    );
    if (status < 200 || status >= 300) {
      throw apiErrorMessage(status, payload, "connection failed");
    }
    return (payload ?? {}) as Record<string, unknown>;
  }

  async getAgentConnection(businessId?: string): Promise<Record<string, unknown>> {
    const query = businessId ? `?business_id=${encodeURIComponent(businessId)}` : "";
    const { status, payload } = await this.request("GET", `/api/v1/agent-connections${query}`);
    if (status < 200 || status >= 300) {
      throw apiErrorMessage(status, payload, "could not read the connection");
    }
    return (payload ?? {}) as Record<string, unknown>;
  }

  async disconnectAgent(body: {
    business_id?: string;
    expected_revision: number;
  }): Promise<Record<string, unknown>> {
    const { status, payload } = await this.request("DELETE", "/api/v1/agent-connections", body);
    if (status < 200 || status >= 300) {
      throw apiErrorMessage(status, payload, "disconnect failed");
    }
    return (payload ?? {}) as Record<string, unknown>;
  }
}

/** The exact JSON body POSTed to /api/v1/messages. */
export function buildSendMessageBody(input: SendMessageInput): Record<string, unknown> {
  return {
    channel: input.channel,
    to: input.to,
    body: input.body,
    ...(input.channel === "sms" && input.fromAgentId ? { from_agent_id: input.fromAgentId } : {}),
    ...(input.channel === "whatsapp" && input.from ? { from: input.from } : {}),
    ...(input.businessId ? { business_id: input.businessId } : {}),
    ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
  };
}

/** Joins the text parts of an MCP tool result for the agent. */
export function mcpResultText(result: McpToolResult): string {
  const texts = (result.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);
  if (texts.length > 0) {
    return texts.join("\n");
  }
  if (result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent);
  }
  return "";
}
