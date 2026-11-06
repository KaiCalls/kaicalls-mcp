import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import entry from "./index.js";
import { kaiCallsChannelPlugin } from "./channel.js";
import { isKaiCallsAccountConfigured, resolveKaiCallsAccount } from "./config.js";
import { KAICALLS_TOOL_NAMES } from "./tools.js";

const manifest = JSON.parse(readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("plugin wiring", () => {
  it("declares every registered tool in contracts.tools", () => {
    expect(manifest.contracts.tools).toEqual(KAICALLS_TOOL_NAMES);
  });

  it("registers the channel, tools and CLI in full mode", () => {
    const api = {
      registrationMode: "full",
      runtime: {},
      config: {},
      pluginConfig: {},
      registerChannel: vi.fn(),
      registerTool: vi.fn(),
      registerCli: vi.fn(),
    };
    entry.register!(api as never);
    expect(api.registerChannel).toHaveBeenCalledWith({ plugin: kaiCallsChannelPlugin });
    expect(api.registerTool.mock.calls.map((call) => (call[0] as { name: string }).name)).toEqual(KAICALLS_TOOL_NAMES);
    expect(api.registerCli).toHaveBeenCalledTimes(1);
  });

  it("registers only tools during tool discovery", () => {
    const api = { registrationMode: "tool-discovery", registerChannel: vi.fn(), registerTool: vi.fn(), registerCli: vi.fn() };
    entry.register!(api as never);
    expect(api.registerChannel).not.toHaveBeenCalled();
    expect(api.registerTool).toHaveBeenCalledTimes(KAICALLS_TOOL_NAMES.length);
  });

  it("keeps ids and versions aligned", () => {
    expect(manifest.id).toBe("kaicalls");
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.channels).toEqual(["kaicalls"]);
    expect(pkg.openclaw.channel.id).toBe("kaicalls");
    expect(pkg.openclaw.channel.configuredState.env.anyOf).toEqual(["KAICALLS_API_KEY", "KAICALLS_WEBHOOK_SECRET"]);
  });

  it("never names the voice runtime vendor", () => {
    const pattern = new RegExp(["v", "a", "p", "i"].join(""), "i");
    for (const file of ["../README.md", "../skills/kaicalls/SKILL.md", "../openclaw.plugin.json", "./tools.ts", "./channel.ts"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toMatch(pattern);
    }
  });
});

describe("account resolution", () => {
  it("falls back to plugin config and env", () => {
    const cfg = {
      channels: { kaicalls: { dmPolicy: "allowlist", allowFrom: ["(555) 123-0000"] } },
      plugins: { entries: { kaicalls: { config: { agentId: "agent-uuid", baseUrl: "https://kc.example/" } } } },
    } as never;
    const account = resolveKaiCallsAccount(cfg, undefined, { KAICALLS_API_KEY: "kc_live_env", KAICALLS_WEBHOOK_SECRET: "whsec" });
    expect(account).toMatchObject({
      apiKey: "kc_live_env",
      webhookSecret: "whsec",
      agentId: "agent-uuid",
      baseUrl: "https://kc.example",
      webhookPath: "/webhooks/kaicalls",
      dmPolicy: "allowlist",
      allowFrom: ["+15551230000"],
    });
    expect(isKaiCallsAccountConfigured(account)).toBe(true);
  });

  it("defaults dmPolicy to pairing", () => {
    expect(resolveKaiCallsAccount({ channels: { kaicalls: {} } } as never, undefined, {}).dmPolicy).toBe("pairing");
  });
});
