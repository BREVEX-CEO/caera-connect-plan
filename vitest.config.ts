import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest config — intentionally does NOT extend vite.config.ts so
 * unit tests run without the TanStack Start / Nitro SSR plugin chain. Pure
 * logic tests use the "node" environment; add jsdom + a separate project later
 * for component tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig path alias so tested modules can use "@/...".
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".output", ".vinxi", "dist"],
    clearMocks: true,
  },
});
