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
 * Every suite here builds a `DatabaseTwin` — real PostgreSQL 18.3 compiled to
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
 *
 * THE LIST IS THE LANE, so a suite missing from it does not opt out of the
 * database — it opts out of the protection. `library-schema` was missing and
 * ran in the parallel pool, one memory spike away from the silent skip above.
 * `database-suites-are-serialised.test.ts` fails if that happens again.
 */

const DATABASE_BACKED = [
  "src/lib/__tests__/closed-paths-against-postgres.test.ts",
  "src/lib/__tests__/one-account-cannot-see-another.test.ts",
  "src/lib/__tests__/security-definer.test.ts",
  "src/lib/account/__tests__/a-deletion-leaves-a-record.test.ts",
  "src/lib/account/__tests__/data-rights-map.test.ts",
  "src/lib/admin/__tests__/admin-operations-schema.test.ts",
  "src/lib/chat/__tests__/regenerate-drops-turns-atomically.test.ts",
  "src/lib/commercial/__tests__/device-registration-against-postgres.test.ts",
  "src/lib/commercial/__tests__/gate-against-postgres.test.ts",
  "src/lib/commercial/__tests__/ledger-against-postgres.test.ts",
  "src/lib/commercial/__tests__/offline-capacity-against-postgres.test.ts",
  "src/lib/commercial/__tests__/service-role-authority.test.ts",
  "src/lib/library/__tests__/library-schema.test.ts",
  "src/lib/notifications/__tests__/notification-schema.test.ts",
  "src/jarvis/__tests__/jarvis-schema-against-postgres.test.ts",
  "src/jarvis/__tests__/device-exchange.test.ts",
  "src/jarvis/__tests__/carry-on.test.ts",
  "src/jarvis/__tests__/schedules.test.ts",
  "src/lib/admin/__tests__/jarvis-execution-control.test.ts",
  "src/lib/admin/__tests__/admin-device-removal.test.ts",
  "src/lib/security/__tests__/second-factor-enforced.test.ts",
  "src/lib/admin/__tests__/staff-authority.test.ts",
  "src/lib/admin/__tests__/console-sessions.test.ts",
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
           * One WASM Postgres at a time, in one worker,
           * so a finished twin's memory is reclaimed before the next starts.
           */
          fileParallelism: false,
          pool: "forks",
          maxWorkers: 1,
          testTimeout: 120_000,
          hookTimeout: 120_000,
          clearMocks: true,
        },
      },
    ],
  },
});
