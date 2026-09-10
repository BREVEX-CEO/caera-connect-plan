import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest config — intentionally does NOT extend vite.config.ts so
 * unit tests run without the TanStack Start / Nitro SSR plugin chain. Pure
 * logic tests use the "node" environment; add jsdom + a separate project later
 * for component tests.
 *
 * TWO PROJECTS, BECAUSE ONE OF THEM RUNS A DATABASE.
 *
 * Seven suites build a `DatabaseTwin` — real PostgreSQL 18.3 compiled to
 * WebAssembly, one instance per file, each holding its own heap. Run in
 * parallel they exhausted memory on this machine and the failure did not look
 * like memory: PGlite's wire parser threw mid-handshake and Vitest reported
 * every test in the file as SKIPPED, so a suite that proves cross-tenant
 * isolation quietly contributed nothing to the run while still reporting
 * green-ish. A security suite that can be skipped by resource pressure is a
 * security suite nobody is running.
 *
 * So they get their own lane with file parallelism off. They run one after
 * another — about a minute in total — while everything else keeps the full
 * pool. The alternative, a single shared twin, would let one suite's writes
 * reach another's assertions, which is a worse trade than a minute.
 */

const DATABASE_BACKED = [
  "src/lib/__tests__/db-twin.test.ts",
  "src/lib/__tests__/security-definer.test.ts",
  "src/lib/__tests__/user-isolation.test.ts",
  "src/lib/account/__tests__/data-rights-map.test.ts",
  "src/lib/commercial/__tests__/gate-against-postgres.test.ts",
  "src/lib/commercial/__tests__/ledger-against-postgres.test.ts",
  "src/lib/commercial/__tests__/offline-capacity-against-postgres.test.ts",
  "src/lib/notifications/__tests__/notification-schema.test.ts",
  "src/lib/admin/__tests__/admin-operations-schema.test.ts",
  "src/lib/support/__tests__/support-publishing-schema.test.ts",
  "src/lib/status/__tests__/status-incident-schema.test.ts",
  "src/lib/organizations/__tests__/organization-assurance.test.ts",
  "src/lib/organizations/__tests__/organization-schema.test.ts",
  "src/lib/chat/__tests__/conversation-share-schema.test.ts",
  "src/lib/chat/__tests__/conversation-trash-schema.test.ts",
];

const alias = {
  // Mirror the tsconfig path alias so tested modules can use "@/...".
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["node_modules", ".output", ".vinxi", "dist", ...DATABASE_BACKED],
          clearMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "database",
          environment: "node",
          include: DATABASE_BACKED,
          /*
           * One WASM Postgres at a time. `singleFork` keeps them in one worker
           * so a finished twin's memory is reclaimed before the next starts.
           */
          fileParallelism: false,
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 120_000,
          hookTimeout: 120_000,
          clearMocks: true,
        },
      },
    ],
  },
});
