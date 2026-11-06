import { createPluginRuntimeStore, type PluginRuntime } from "openclaw/plugin-sdk/runtime-store";

const { setRuntime: setKaiCallsRuntime, getRuntime: getKaiCallsRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "kaicalls",
    errorMessage: "KaiCalls runtime not initialized - plugin not registered",
  });

export { getKaiCallsRuntime, setKaiCallsRuntime };
