import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest config — intentionally does NOT extend vite.config.ts so
 * unit tests run without the TanStack Start / Nitro SSR plugin chain. Pure
 * logic tests use the "node" environment; add jsdom + a separate project later
 * for component tests.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".output", ".vinxi", "dist"],
    clearMocks: true,
  },
});
