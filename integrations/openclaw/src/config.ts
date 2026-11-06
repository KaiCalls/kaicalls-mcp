import type { OpenClawConfig } from "openclaw/plugin-sdk/account-resolution";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/account-id";
import {
  AllowFromListSchema,
  DmPolicySchema,
  buildChannelConfigSchema,
  requireOpenAllowFrom,
} from "openclaw/plugin-sdk/channel-config-schema";
import { requireChannelOpenAllowFrom } from "openclaw/plugin-sdk/extension-shared";
import {
  buildSecretInputSchema,
  normalizeResolvedSecretInputString,
  type SecretInput,
} from "openclaw/plugin-sdk/secret-input";
import { z } from "zod";

export const PLUGIN_ID = "kaicalls";
export const CHANNEL_ID = "kaicalls";
export const DEFAULT_BASE_URL = "https://www.kaicalls.com";
export const DEFAULT_WEBHOOK_PATH = "/webhooks/kaicalls";
export const API_KEY_ENV = "KAICALLS_API_KEY";
export const WEBHOOK_SECRET_ENV = "KAICALLS_WEBHOOK_SECRET";
export const API_KEY_HELP =
  "Set your KaiCalls API key: Settings → API Keys at kaicalls.com, then put it in KAICALLS_API_KEY or plugins.entries.kaicalls.config.apiKey.";

export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";

const SecretInputSchema = buildSecretInputSchema();

/** `plugins.entries.kaicalls.config`: what the agent tools and the CLI use. */
export const PluginConfigZod = z
  .object({
    apiKey: SecretInputSchema.optional(),
    baseUrl: z.string().url().optional(),
    agentId: z.string().min(1).optional(),
    businessId: z.string().min(1).optional(),
  })
  .strict();

/** `channels.kaicalls`: the text channel. Credentials fall back to the plugin config and env. */
export const ChannelConfigZod = z
  .object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    apiKey: SecretInputSchema.optional(),
    baseUrl: z.string().url().optional(),
    agentId: z.string().min(1).optional(),
    businessId: z.string().min(1).optional(),
    webhookSecret: SecretInputSchema.optional(),
    webhookPath: z.string().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: AllowFromListSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    requireChannelOpenAllowFrom({
      channel: CHANNEL_ID,
      policy: value.dmPolicy,
      allowFrom: value.allowFrom,
      ctx,
      requireOpenAllowFrom,
    });
  });

const uiHints = {
  "": {
    label: "KaiCalls",
    help: "Texts to your agent's KaiCalls number start an agent turn; replies are texted back.",
  },
  apiKey: { label: "KaiCalls API Key", sensitive: true },
  baseUrl: { label: "KaiCalls Base URL" },
  agentId: {
    label: "KaiCalls Agent ID",
    help: "UUID of the KaiCalls agent whose phone line sends replies.",
  },
  businessId: { label: "KaiCalls Business ID" },
  webhookSecret: {
    label: "KaiCalls Webhook Secret",
    help: "Printed once by `openclaw kaicalls connect`.",
    sensitive: true,
  },
  webhookPath: { label: "KaiCalls Webhook Path" },
  dmPolicy: {
    label: "KaiCalls DM Policy",
    help: 'Who may text the agent ("pairing" recommended). "open" requires allowFrom=["*"].',
  },
  allowFrom: {
    label: "KaiCalls Allow From",
    help: "Allowed sender phone numbers in E.164 format, or * when dmPolicy is open.",
    presentation: "phone-number",
  },
} as const;

export const KaiCallsChannelConfigSchema: ReturnType<typeof buildChannelConfigSchema> =
  buildChannelConfigSchema(ChannelConfigZod, { uiHints });

export const KaiCallsPluginConfigSchema: ReturnType<typeof buildChannelConfigSchema> =
  buildChannelConfigSchema(PluginConfigZod, {
    uiHints: {
      apiKey: uiHints.apiKey,
      baseUrl: uiHints.baseUrl,
      agentId: uiHints.agentId,
      businessId: uiHints.businessId,
    },
  });

type RawConfigFields = {
  apiKey?: SecretInput;
  baseUrl?: string;
  agentId?: string;
  businessId?: string;
};

type RawChannelConfig = RawConfigFields & {
  enabled?: boolean;
  webhookSecret?: SecretInput;
  webhookPath?: string;
  dmPolicy?: DmPolicy;
  allowFrom?: string | Array<string | number>;
};

export interface ResolvedKaiCallsAccount {
  accountId: string;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  agentId: string;
  businessId: string;
  webhookSecret: string;
  webhookPath: string;
  dmPolicy: DmPolicy;
  allowFrom: string[];
}

export function readChannelConfig(cfg: OpenClawConfig): RawChannelConfig | undefined {
  return (cfg.channels as Record<string, unknown> | undefined)?.[CHANNEL_ID] as
    | RawChannelConfig
    | undefined;
}

export function readPluginConfig(cfg: OpenClawConfig): RawConfigFields | undefined {
  const entries = (cfg as { plugins?: { entries?: Record<string, { config?: unknown }> } })
    .plugins?.entries;
  return entries?.[PLUGIN_ID]?.config as RawConfigFields | undefined;
}

function present(value: unknown): boolean {
  return !(value === undefined || value === null || (typeof value === "string" && !value.trim()));
}

function secretString(value: unknown, path: string, fallback?: string): string {
  const chosen = present(value) ? value : fallback;
  if (!present(chosen)) {
    return "";
  }
  try {
    return normalizeResolvedSecretInputString({ value: chosen, path })?.trim() ?? "";
  } catch {
    // An unresolved SecretRef reads as "not configured" rather than crashing account listing.
    return "";
  }
}

function trimmed(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

/** Strip formatting so `(555) 123-4567` and `+1 555 123 4567` compare equal. */
export function normalizePhone(raw: string | number | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) {
    return "";
  }
  if (value === "*") {
    return "*";
  }
  const stripped = value.replace(/^(?:whatsapp|sms|kaicalls):/i, "");
  const digits = stripped.replace(/[^\d+]/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("+")) {
    return `+${digits.slice(1).replace(/\+/g, "")}`;
  }
  // Ten bare digits are a US/Canada number; anything else keeps its digits with a plus.
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export function looksLikePhone(value: string): boolean {
  return /^\+\d{8,15}$/.test(value);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveKaiCallsAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedKaiCallsAccount {
  const channel = readChannelConfig(cfg) ?? {};
  const plugin = readPluginConfig(cfg) ?? {};
  const allowFromRaw = Array.isArray(channel.allowFrom)
    ? channel.allowFrom
    : typeof channel.allowFrom === "string"
      ? channel.allowFrom.split(",")
      : [];
  const configuredPath = channel.webhookPath?.trim();
  return {
    accountId: accountId?.trim() || DEFAULT_ACCOUNT_ID,
    enabled: channel.enabled !== false,
    apiKey:
      secretString(channel.apiKey, "channels.kaicalls.apiKey") ||
      secretString(plugin.apiKey, "plugins.entries.kaicalls.config.apiKey", env[API_KEY_ENV]),
    baseUrl: normalizeBaseUrl(trimmed(channel.baseUrl, plugin.baseUrl) || DEFAULT_BASE_URL),
    agentId: trimmed(channel.agentId, plugin.agentId),
    businessId: trimmed(channel.businessId, plugin.businessId),
    webhookSecret: secretString(
      channel.webhookSecret,
      "channels.kaicalls.webhookSecret",
      env[WEBHOOK_SECRET_ENV],
    ),
    webhookPath: configuredPath
      ? configuredPath.startsWith("/")
        ? configuredPath
        : `/${configuredPath}`
      : DEFAULT_WEBHOOK_PATH,
    dmPolicy: channel.dmPolicy ?? "pairing",
    allowFrom: allowFromRaw.map((entry) => normalizePhone(entry)).filter(Boolean),
  };
}

/** The channel can receive texts (webhook secret) and reply (API key + agent). */
export function isKaiCallsAccountConfigured(account: ResolvedKaiCallsAccount): boolean {
  return Boolean(account.apiKey && account.webhookSecret && account.agentId);
}

export function listKaiCallsAccountIds(cfg: OpenClawConfig): string[] {
  // A bare KAICALLS_API_KEY configures the tools, not a channel account.
  return readChannelConfig(cfg) ? [DEFAULT_ACCOUNT_ID] : [];
}

export function collectKaiCallsStartupWarnings(account: ResolvedKaiCallsAccount): string[] {
  const warnings: string[] = [];
  if (!account.apiKey) {
    warnings.push(`- KaiCalls: apiKey is required (${API_KEY_ENV}).`);
  }
  if (!account.webhookSecret) {
    warnings.push(
      `- KaiCalls: webhookSecret is required (${WEBHOOK_SECRET_ENV}); run \`openclaw kaicalls connect\` to get one.`,
    );
  }
  if (!account.agentId) {
    warnings.push("- KaiCalls: agentId is required (the KaiCalls agent whose line replies).");
  }
  if (account.dmPolicy === "allowlist" && account.allowFrom.length === 0) {
    warnings.push("- KaiCalls: dmPolicy=allowlist with empty allowFrom rejects every sender.");
  }
  if (account.dmPolicy === "open" && !account.allowFrom.includes("*")) {
    warnings.push('- KaiCalls: dmPolicy=open requires allowFrom=["*"].');
  }
  return warnings;
}
