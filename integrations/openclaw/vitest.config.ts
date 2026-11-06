import { defineConfig } from "vitest/config";

// openclaw's dist uses `using` declarations, which Node 22 cannot parse. Vitest inlines the
// openclaw package and lowers it with esbuild (target node22), so the unit suite runs on
// Node 22 and on Node 24 against the real SDK. The plugin itself still needs Node >= 24.16
// at runtime (see package.json engines).
export default defineConfig({
  esbuild: {
    include: /\.(m?[jt]s|tsx)$/,
    target: "node22",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        inline: [/node_modules\/openclaw\//],
      },
    },
  },
});
