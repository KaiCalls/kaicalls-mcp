import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import type { OpenClawPluginDefinition } from "openclaw/plugin-sdk/plugin-entry";
import { kaiCallsChannelPlugin } from "./channel.js";
import { registerKaiCallsCli } from "./cli.js";
import { KaiCallsPluginConfigSchema } from "./config.js";
import { setKaiCallsRuntime } from "./runtime.js";
import { registerKaiCallsTools } from "./tools.js";

// One entry owns the channel, the tools and the CLI (see AgentMail: separate entries get separate
// runtime identities). The annotation keeps emitted declarations portable.
const entry: OpenClawPluginDefinition = defineChannelPluginEntry({
  id: "kaicalls",
  name: "KaiCalls",
  description:
    "KaiCalls for OpenClaw: give your agent a real phone number. Errand calls to businesses, texting, and a text channel.",
  plugin: kaiCallsChannelPlugin,
  configSchema: KaiCallsPluginConfigSchema,
  setRuntime: setKaiCallsRuntime,
  registerCliMetadata: registerKaiCallsCli,
  registerFull: registerKaiCallsTools,
});

export default entry;
