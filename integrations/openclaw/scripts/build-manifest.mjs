// Generates openclaw.plugin.json from the built config schemas and tool list, so the manifest,
// the runtime schemas and contracts.tools cannot drift apart.
//
//   node scripts/build-manifest.mjs           # write openclaw.plugin.json (run after `npm run build`)
//   node scripts/build-manifest.mjs --check   # fail if the on-disk manifest is out of date
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KaiCallsChannelConfigSchema, KaiCallsPluginConfigSchema } from "../dist/config.js";
import { KAICALLS_TOOL_NAMES } from "../dist/tools.js";

const MANIFEST_PATH = fileURLToPath(new URL("../openclaw.plugin.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function withoutDraft(schema) {
  const { $schema: _ignored, ...rest } = schema;
  return rest;
}

const manifest = {
  id: "kaicalls",
  name: "KaiCalls",
  description: packageJson.description,
  version: packageJson.version,
  categories: ["channels"],
  configSchema: withoutDraft(KaiCallsPluginConfigSchema.schema),
  uiHints: KaiCallsPluginConfigSchema.uiHints,
  configContracts: {
    secretInputs: { paths: [{ path: "apiKey", expected: "string" }] },
  },
  activation: { onStartup: true, onCommands: ["kaicalls"] },
  channels: ["kaicalls"],
  skills: ["./skills"],
  cliCommands: [
    {
      name: "kaicalls",
      description: "Connect KaiCalls texts to this OpenClaw Gateway",
      hasSubcommands: true,
    },
  ],
  contracts: { tools: KAICALLS_TOOL_NAMES },
  channelConfigs: {
    kaicalls: {
      schema: KaiCallsChannelConfigSchema.schema,
      label: "KaiCalls",
      description: packageJson.description,
      uiHints: KaiCallsChannelConfigSchema.uiHints,
    },
  },
};

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(MANIFEST_PATH, "utf8");
  } catch {}
  if (current !== serialized) {
    console.error("openclaw.plugin.json is out of date. Run: npm run build && npm run manifest");
    process.exit(1);
  }
  console.log("openclaw.plugin.json is up to date.");
} else {
  writeFileSync(MANIFEST_PATH, serialized);
  console.log(`Wrote ${MANIFEST_PATH}`);
}
