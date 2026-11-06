import { createSimpleChannelSecretContract } from "openclaw/plugin-sdk/channel-secret-basic-runtime";

// Lets `openclaw secrets audit` and runtime preparation resolve SecretRefs in channels.kaicalls.
const channelSecrets = createSimpleChannelSecretContract({
  channelKey: "kaicalls",
  label: "KaiCalls",
  accountFields: [],
  channelFields: ["apiKey", "webhookSecret"],
  mode: "channel-only",
});

export const { secretTargetRegistryEntries, collectRuntimeConfigAssignments } = channelSecrets;
