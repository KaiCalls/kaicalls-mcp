import type { OpenClawConfig } from "openclaw/plugin-sdk/account-resolution";
import { waitUntilAbort } from "openclaw/plugin-sdk/channel-outbound";
import { registerPluginHttpRoute } from "openclaw/plugin-sdk/webhook-ingress";
import {
  CHANNEL_ID,
  collectKaiCallsStartupWarnings,
  isKaiCallsAccountConfigured,
  type ResolvedKaiCallsAccount,
} from "./config.js";
import { dispatchKaiCallsInbound, type KaiCallsChannelRuntime } from "./inbound.js";
import { createKaiCallsWebhookHandler, EventDeduper, type KaiCallsLog } from "./webhook.js";

// Survives an account restart inside one Gateway process so a retried event is not replayed.
const deduper = new EventDeduper();

/** Registers the signed webhook route and holds it until the account stops. */
export async function startKaiCallsGatewayAccount(params: {
  cfg: OpenClawConfig;
  account: ResolvedKaiCallsAccount;
  channelRuntime: KaiCallsChannelRuntime;
  abortSignal: AbortSignal;
  log?: KaiCallsLog;
}): Promise<void> {
  const { account, log } = params;
  if (!account.enabled) {
    log?.info?.(`KaiCalls account ${account.accountId} is disabled`);
    return await waitUntilAbort(params.abortSignal);
  }
  for (const warning of collectKaiCallsStartupWarnings(account)) {
    log?.warn?.(warning);
  }
  if (!isKaiCallsAccountConfigured(account)) {
    return await waitUntilAbort(params.abortSignal);
  }
  const unregister = registerPluginHttpRoute({
    path: account.webhookPath,
    auth: "plugin",
    pluginId: CHANNEL_ID,
    accountId: account.accountId,
    replaceExisting: true,
    log: (message) => log?.info?.(message),
    handler: createKaiCallsWebhookHandler({
      webhookSecret: account.webhookSecret,
      deduper,
      ...(log ? { log } : {}),
      dispatch: async (message) =>
        await dispatchKaiCallsInbound({
          cfg: params.cfg,
          account,
          channelRuntime: params.channelRuntime,
          message,
          ...(log ? { log } : {}),
        }),
    }),
  });
  log?.info?.(`Registered KaiCalls webhook route ${account.webhookPath}`);
  await waitUntilAbort(params.abortSignal, () => unregister());
}
