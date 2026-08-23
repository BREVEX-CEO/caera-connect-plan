/**
 * Break each safety-critical guarantee on purpose, and require the suite to notice.
 *
 * WHY THIS EXISTS. A passing test suite proves the tests pass. It does not prove
 * they would fail if the code were wrong — and the difference is not academic.
 * While writing the service-worker tests, all eighteen passed on the first run;
 * deleting the entire `/api/` cache exclusion, the rule that stops a signed-out
 * user being served somebody's cached chat reply, left all eighteen still green.
 * The test fired `/api/chat`, which has no file extension, so the asset check
 * skipped it whether or not the exclusion existed. It passed for the wrong
 * reason and verified nothing about the property it claimed to cover.
 *
 * That is the failure this script hunts. Each mutation below removes one
 * guarantee the product actually rests on. A mutation that SURVIVES means
 * nothing in 5,000-odd tests would catch that guarantee being deleted.
 *
 * WHAT IT IS NOT. Not exhaustive mutation coverage — that would take hours and
 * mostly produce noise about branches nobody depends on. This is a hand-picked
 * set of the properties where a silent regression would be worst: privacy
 * routing, provenance honesty, credential detection, tamper evidence, network
 * sealing, and deletion ordering.
 *
 * Usage:  node scripts/mutation-safety.mjs
 * Exits non-zero if any mutation survives.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

/**
 * Each entry deletes ONE guarantee.
 *
 * `find` must be an exact substring of the file. A mutation whose target has
 * moved is reported as a SKIP and fails the run — silently not applying a
 * mutation and calling it caught would be the same dishonesty the script exists
 * to detect.
 */
const MUTATIONS = [
  {
    name: "privacy: cloud approval is reported as a possible inference path",
    file: "src/lib/engine/resolve.ts",
    tests: [
      "src/lib/__tests__/engine-resolve.test.ts",
      "src/lib/__tests__/engine-routing-single-policy.test.ts",
    ],
    find: "export function cloudWouldWorkAfterApproval(_context: EngineContext): false {\n  return false;\n}",
    replace:
      "export function cloudWouldWorkAfterApproval(_context: EngineContext): false {\n  return true as false;\n}",
  },
  {
    name: "privacy: on-device inference is treated as consuming paid allowance",
    file: "src/lib/engine/resolve.ts",
    tests: [
      "src/lib/__tests__/engine-resolve.test.ts",
      "src/lib/__tests__/engine-routing-single-policy.test.ts",
    ],
    find: "// The rule the whole product rests on: your own hardware is not metered.\n    consumesAllowance: false,",
    replace:
      "// Mutated: local work is incorrectly treated as paid usage.\n    consumesAllowance: true as false,",
  },
  {
    name: "provenance: privacy reported from the setting, not the measurement",
    file: "src/lib/provenance/receipt.ts",
    tests: [
      "src/lib/__tests__/answer-provenance.test.ts",
      "src/lib/__tests__/measurable-properties.test.ts",
    ],
    find: "const leftDevice =\n    explicitContacts.length > 0 ? true : input.observation.measured ? revealing.length > 0 : null;",
    replace: 'const leftDevice = input.producedOn !== "this_device";',
  },
  {
    name: "provenance: an unmeasured window is reported as private",
    file: "src/lib/provenance/receipt.ts",
    tests: [
      "src/lib/__tests__/answer-provenance.test.ts",
      "src/lib/__tests__/measurable-properties.test.ts",
    ],
    find: "const leftDevice =\n    explicitContacts.length > 0 ? true : input.observation.measured ? revealing.length > 0 : null;",
    replace: "const leftDevice = revealing.length > 0;",
  },
  {
    name: "preflight: AWS access keys are no longer detected",
    file: "src/lib/edge/preflight.ts",
    tests: ["src/lib/__tests__/preflight.test.ts"],
    find: "(?:AKIA|ASIA)[0-9A-Z]{16}",
    replace: "(?:ZZZZ|YYYY)[0-9A-Z]{16}",
  },
  {
    name: "preflight: the Luhn check is dropped, so any digit run is a card",
    file: "src/lib/edge/preflight.ts",
    tests: ["src/lib/__tests__/preflight.test.ts"],
    find: "confirm: luhnValid,",
    replace: "confirm: () => true,",
  },
  {
    name: "ledger: entries no longer link to the one before them",
    file: "src/lib/edge/ledger.ts",
    tests: ["src/lib/__tests__/ledger.test.ts"],
    find: "const previous = chain.length === 0 ? GENESIS : chain[chain.length - 1].hash;",
    replace: "const previous = GENESIS;",
  },
  {
    name: "sealed mode: sendBeacon is allowed through the seal",
    file: "src/lib/edge/sealed-mode.ts",
    tests: ["src/lib/__tests__/sealed-mode.test.ts"],
    find: 'record("beacon", url);\n        return false;',
    replace: "return true;",
  },
  /*
   * SEALED MODE, THE WIRING RATHER THAN THE MECHANISM.
   *
   * The `Seal` class was already covered here, and the coverage was real — the
   * sendBeacon mutation below has always been caught. It still missed the worst
   * version of the bug, because the class was never wrong: nothing installed it
   * outside a send, so both chat surfaces displayed "Sealed" over a page whose
   * `fetch`, `XMLHttpRequest`, `WebSocket` and `sendBeacon` were all native.
   * Found by pressing the button in the browser and reading the primitives back.
   *
   * These two mutate the DECISION instead of the barrier.
   */
  {
    name: "sealed mode: a sealed conversation never installs its barrier",
    file: "src/lib/edge/seal-policy.ts",
    tests: ["src/lib/__tests__/seal-policy.test.ts"],
    find: "if (!sealed || !origin) return undefined;",
    replace: "if (true) return undefined;",
  },
  {
    name: "sealed mode: the page seal lets any origin through",
    file: "src/lib/edge/seal-policy.ts",
    tests: ["src/lib/__tests__/seal-policy.test.ts"],
    find: "if (url.origin !== origin) return false;",
    replace: "if (false) return false;",
  },
  {
    name: "sealed mode: overlapping seals take the loosest policy, not the strictest",
    file: "src/lib/edge/sealed-mode.ts",
    tests: ["src/lib/__tests__/sealed-mode.test.ts"],
    find: "for (const seal of active) if (!seal.allow(request)) return false;\n  return true;",
    replace: "for (const seal of active) if (seal.allow(request)) return true;\n  return false;",
  },
  {
    name: "deletion: the database row is dropped before the stored object",
    file: "src/lib/attachments/deletion.ts",
    tests: ["src/lib/__tests__/attachment-deletion.test.ts"],
    find: 'return ["remote_object", "remote_row"];',
    replace: 'return ["remote_row", "remote_object"];',
  },
  {
    name: "service worker: the /api/ cache exclusion is removed",
    file: "public/sw.js",
    tests: [
      "src/lib/__tests__/service-worker-rules.test.ts",
      "src/lib/__tests__/service-worker-runtime.test.ts",
    ],
    find: 'url.pathname.startsWith("/api/") ||',
    replace: "false ||",
  },

  /*
   * THE DATABASE POLICIES.
   *
   * Everything above protects data on the way out of the browser. These are
   * what stop one tenant reading another's rows once it has arrived, and they
   * are the last line: a broken policy is not mitigated by anything on the
   * client, because the client is what the attacker controls.
   *
   * Mutating SQL is worth the awkwardness precisely because the cross-tenant
   * tests are so easy to write in a way that passes regardless — they run as a
   * superuser by default, and Postgres superusers bypass RLS entirely. The twin
   * sets `SET ROLE authenticated` for exactly that reason, and these mutations
   * are what prove it took effect.
   */
  {
    name: "RLS: any authenticated user may read any conversation",
    file: "supabase/migrations/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3.sql",
    tests: ["src/lib/__tests__/db-twin.test.ts"],
    find: 'CREATE POLICY "own_conversations" ON public.ocade_conversations FOR ALL\n  TO authenticated\n  USING (auth.uid() = user_id)',
    replace:
      'CREATE POLICY "own_conversations" ON public.ocade_conversations FOR ALL\n  TO authenticated\n  USING (true)',
  },
  {
    name: "RLS: row-level security is disabled on conversations",
    file: "supabase/migrations/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02.sql",
    tests: ["src/lib/__tests__/db-twin.test.ts"],
    find: "ALTER TABLE public.ocade_conversations ENABLE ROW LEVEL SECURITY;",
    replace: "-- disabled by mutation",
  },
];

/*
 * THE BASELINE MUST BE GREEN, OR EVERY RESULT BELOW IS A LIE.
 *
 * This script reads "the suite failed" as "the mutation was caught". If the
 * suite is ALREADY failing for an unrelated reason, every mutation is reported
 * as caught without any of them being detected — a clean 15/15 that proves
 * nothing whatsoever.
 *
 * That is not hypothetical. Adding a devDependency changed `package-lock.json`,
 * which drifted the readiness gate's evidence binding and left one test red;
 * run in that state, this script would have congratulated itself on full
 * coverage. The whole point of the file is to catch tests that pass for the
 * wrong reason, so it has no business doing the same thing.
 */
const runFocusedTests = (files) =>
  execFileSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "--silent=true", ...files],
    {
      stdio: "pipe",
    },
  );

// A force-killed process cannot execute `finally`. Repair the exact backup it
// created before judging the baseline, so an interrupted run cannot poison
// every later result or leave a planted security defect in the worktree.
for (const file of new Set(MUTATIONS.map((mutation) => mutation.file))) {
  const backup = `${file}.mutbak`;
  if (!existsSync(backup)) continue;
  copyFileSync(backup, file);
  unlinkSync(backup);
  console.warn(`restored interrupted mutation backup: ${file}`);
}

const baselineTests = [...new Set(MUTATIONS.flatMap((mutation) => mutation.tests))];
try {
  runFocusedTests(baselineTests);
} catch {
  console.error(
    "BASELINE IS RED. The suite fails before any mutation is applied, so every\n" +
      "mutation would be reported as 'caught' without being detected. Fix the\n" +
      "failing test first — a mutation run against a red baseline proves nothing.",
  );
  process.exit(2);
}

const survived = [];
const skipped = [];

for (const mutation of MUTATIONS) {
  if (!existsSync(mutation.file)) {
    skipped.push(`${mutation.name} (file missing: ${mutation.file})`);
    continue;
  }
  const original = readFileSync(mutation.file, "utf8");

  /*
   * Line endings are normalised before matching.
   *
   * A multi-line `find` written with `\n` does not match a CRLF file, and git
   * checks these out with CRLF on Windows. That produced a SKIP for the
   * conversation-policy mutation — a guarantee reported as untested for a
   * reason that had nothing to do with the guarantee. The file is restored from
   * a byte-exact backup afterwards, so normalising here changes nothing on
   * disk beyond the mutation itself.
   */
  const normalised = original.replace(/\r\n/g, "\n");
  if (!normalised.includes(mutation.find)) {
    skipped.push(`${mutation.name} (target text has moved)`);
    continue;
  }

  const backup = `${mutation.file}.mutbak`;
  copyFileSync(mutation.file, backup);
  writeFileSync(mutation.file, normalised.replace(mutation.find, mutation.replace));

  let caught = false;
  try {
    runFocusedTests(mutation.tests);
  } catch {
    caught = true;
  } finally {
    // Restored in `finally` so an interrupted run cannot leave a deliberately
    // broken guarantee in the working tree.
    copyFileSync(backup, mutation.file);
    unlinkSync(backup);
  }

  console.log(`${caught ? "caught   " : "SURVIVED "} ${mutation.name}`);
  if (!caught) survived.push(mutation.name);
}

console.log(`\n${MUTATIONS.length - survived.length - skipped.length}/${MUTATIONS.length} caught`);

if (skipped.length > 0) {
  console.error("\nSKIPPED — these guarantees were NOT tested:");
  for (const s of skipped) console.error(`  - ${s}`);
}
if (survived.length > 0) {
  console.error("\nSURVIVED — nothing in the suite catches these being deleted:");
  for (const s of survived) console.error(`  - ${s}`);
}

process.exit(survived.length + skipped.length === 0 ? 0 : 1);
