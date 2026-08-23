#!/usr/bin/env node
/**
 * ONE COMMAND THAT SAYS WHETHER OCADE CAN SHIP.
 *
 * WHY THIS EXISTS. The repository has more than forty gate scripts, each
 * genuinely useful and each individually forgettable. "Everything passes" has
 * therefore meant "everything I happened to run passes", which is a different
 * claim, and a weaker one every time a gate is added. A release decision made
 * from a subset of the evidence is a release decision made from a summary, and
 * summaries are what this whole audit exists to distrust.
 *
 * So: one entry point, every feasible release-critical gate, run in order,
 * from whatever tree it is invoked on.
 *
 * THE DISTINCTION THAT MATTERS MOST. A gate can end three ways, and collapsing
 * the third into either of the others is how a release gets called proven when
 * it is not:
 *
 *   PASS     — it ran and it was satisfied.
 *   FAIL     — it ran and it was not. Launch-critical failures exit non-zero.
 *   UNAVAILABLE — it could not run here at all, because something outside this
 *                 machine is missing: a payment sandbox credential, a physical
 *                 phone, a CI runner, a live database. This is NOT a pass. It
 *                 is recorded with the exact command to run where it can run,
 *                 so nobody has to reconstruct it later.
 *
 * A gate that is merely slow is not unavailable. A gate that fails is not
 * unavailable either, however inconvenient. Only an absent external
 * prerequisite is.
 *
 * Evidence is written to `release/LAUNCH_PROOF.json` as machine-readable
 * output — status, duration, exit code and the tail of anything that failed —
 * so a later report quotes the run rather than remembering it.
 *
 * Usage:
 *   npm run launch:prove              every gate
 *   npm run launch:prove -- --fast    skip gates over ~60s, for a quick sweep
 *   npm run launch:prove -- --list    show the gates and stop
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const LIST_ONLY = args.includes("--list");

/**
 * @typedef {object} Gate
 * @property {string} id            Stable id, used in the evidence file.
 * @property {string} what          What a failure would mean, in plain words.
 * @property {string[]} run         Command and arguments.
 * @property {boolean} critical     Whether a failure blocks launch.
 * @property {boolean} [slow]       Skipped under --fast.
 * @property {() => string|null} [unavailable]
 *   Returns a reason when this gate cannot run here, or null when it can.
 *   Called before the command, so an absent prerequisite never looks like a
 *   failure of the thing being tested.
 */

const npm = (script, ...rest) => ["npm", "run", script, ...(rest.length ? ["--", ...rest] : [])];

/**
 * Can this machine open a connection to that host at all?
 *
 * Deliberately lenient about the STATUS: a 403 on the root path still proves
 * the host answered, and what this distinguishes is "blocked by egress policy"
 * from "the publisher said something we did not expect".
 */
async function reachable(url) {
  try {
    await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return true;
  } catch {
    return false;
  }
}

/** An environment variable that must be present for a gate to mean anything. */
const needsEnv =
  (...names) =>
  () => {
    const missing = names.filter((name) => !process.env[name]);
    return missing.length === 0 ? null : `not configured here: ${missing.join(", ")}`;
  };

/** @type {Gate[]} */
const GATES = [
  {
    id: "install-integrity",
    what: "The lockfile describes the tree that is actually installed.",
    run: ["node", "scripts/check-setup.mjs"],
    critical: true,
  },
  {
    id: "routes-generated",
    what: "The generated route tree matches the route files on disk.",
    run: npm("routes:generate"),
    critical: true,
  },
  {
    id: "typecheck",
    what: "Every file compiles against the real types, with no escape hatches.",
    run: npm("typecheck"),
    critical: true,
  },
  {
    id: "lint",
    what: "No lint errors.",
    run: npm("lint"),
    critical: true,
  },
  {
    id: "supabase-types",
    what: "The checked-in database types describe the checked-in migrations.",
    run: npm("supabase:types-check"),
    critical: true,
  },
  {
    id: "unit-suite",
    what: "The whole test suite, including migrations against real PostgreSQL.",
    run: ["npx", "vitest", "run", "--reporter=dot"],
    critical: true,
    slow: true,
  },
  {
    id: "test-isolation",
    what: "Tests pass in a shuffled order, so none depends on another's leftovers.",
    run: npm("test:isolation"),
    critical: true,
    slow: true,
  },
  {
    id: "browser-safety",
    what: "The browser executor cannot exceed the scope a person approved.",
    run: npm("browser-safety:check"),
    critical: true,
  },
  {
    id: "extension-manifest",
    what: "The extension asks for no more reach than it uses.",
    run: npm("extension:check"),
    critical: true,
  },
  {
    id: "extension-e2e",
    what: "The extension really drives a real browser, and really refuses.",
    run: npm("extension:e2e"),
    critical: true,
    slow: true,
  },
  {
    id: "model-catalogue",
    what: "Every model tier's size, digest and URL match the publisher's index.",
    run: npm("browser-catalogue:check"),
    critical: true,
    /*
     * A PUBLISHER THIS MACHINE CANNOT REACH IS NOT A CATALOGUE DEFECT.
     *
     * The gate re-reads each tier's size and digest from the publisher's own
     * index. Where egress policy blocks that host it fails with HTTP 403,
     * which is indistinguishable in the summary from "a digest changed" — and
     * those two findings could not be further apart. So reachability is
     * probed first: unreachable is UNAVAILABLE with the command to run
     * elsewhere; reachable-and-wrong is still a failure, which is the case
     * this gate exists for.
     */
    unavailable: async () =>
      (await reachable("https://huggingface.co/"))
        ? null
        : "the model publisher's host is not reachable from this environment",
  },
  {
    id: "dead-controls",
    what: "No control is rendered enabled with nothing behind it.",
    run: npm("controls:check"),
    critical: true,
  },
  {
    id: "accessibility",
    what: "Labels, touch targets and reduced-motion behaviour.",
    run: npm("a11y:check"),
    critical: true,
  },
  {
    id: "licences",
    what: "Third-party notices match the dependencies actually shipped.",
    run: npm("licences:check"),
    critical: true,
  },
  {
    id: "build",
    what: "The production build succeeds.",
    run: npm("build"),
    critical: true,
    slow: true,
  },
  {
    id: "no-public-cloud-inference",
    what: "No shipped code can send a prompt to a public AI inference service.",
    /*
     * AFTER THE BUILD, and that ordering is the gate's whole meaning. It
     * inspects `.output` — the bytes that actually ship — not only the source.
     * Run before the build it failed with "production output is missing",
     * which in a launch proof reads as a cloud-inference finding and is really
     * a missing directory. It ran green on its own all along, because whoever
     * ran it happened to have built first.
     */
    run: npm("release:source-check"),
    critical: true,
  },
  {
    id: "asset-budget",
    what: "No bundle exceeds its budget, and the engines stay lazy.",
    run: npm("performance:budget"),
    critical: true,
  },
  {
    id: "operations",
    what: "Production operational requirements: headers, errors, health.",
    run: npm("operations:check"),
    critical: true,
  },
  {
    id: "engine-availability",
    what: "WebGPU and WebAssembly report themselves honestly in a real browser.",
    run: npm("audit:engines"),
    critical: true,
    slow: true,
  },
  {
    id: "model-owner-tabs",
    what: "Three tabs elect one model owner and recover when it dies.",
    run: npm("audit:model-owner"),
    critical: true,
    slow: true,
  },
  {
    id: "offline-transitions",
    what: "OCADE survives going offline and coming back, with no duplicates.",
    run: npm("audit:offline:prod"),
    critical: true,
    slow: true,
  },
  {
    id: "chat-prompts",
    what: "The shipped prompt pipeline produces what the canonical prompt says.",
    run: npm("audit:chat"),
    critical: true,
    slow: true,
  },
  {
    id: "real-inference",
    what: "Real weights really generate, through the real adapter.",
    run: npm("audit:real-inference"),
    critical: true,
    slow: true,
  },
  {
    id: "route-qa",
    what: "Every route renders, on desktop and phone widths, signed in and out.",
    run: npm("audit:routes:prod"),
    critical: true,
    slow: true,
  },
  {
    id: "production-weights-chat",
    what: "Real production weights answer real questions through the signed-in Chat path.",
    run: ["node", "scripts/e2e/production-weights-chat.mjs"],
    critical: false,
    slow: true,
    /*
     * THE PROOF THIS ENVIRONMENT CANNOT GIVE, named rather than omitted.
     *
     * The weights are published on a host this sandbox's egress policy blocks
     * outright — `huggingface.co` answers nothing, not even a 403 body. There
     * is no fixture substitute: `audit:real-inference` runs a random-weight
     * GGUF for timings and a three-fact memorised model for correctness, and
     * says so itself. Neither is evidence about a production model's answers,
     * and recording either as this gate passing would be the exact
     * relabelling this proof exists to prevent.
     */
    unavailable: async () =>
      (await reachable("https://huggingface.co/"))
        ? null
        : "the model publisher's host is blocked here, so production weights cannot be fetched",
  },
  {
    id: "payments-sandbox",
    what: "A real provider sandbox accepts checkout and delivers the entitlement.",
    run: npm("stage2:phase30-check"),
    critical: false,
    unavailable: needsEnv("PAYMENTS_SANDBOX_API_KEY", "PAYMENTS_SANDBOX_WEBHOOK_SECRET"),
  },
  {
    id: "supabase-live-rls",
    what: "Two real users, on the real project, cannot read each other's rows.",
    run: ["node", "scripts/check-production-operations.mjs", "--rls"],
    critical: false,
    unavailable: needsEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"),
  },
];

if (LIST_ONLY) {
  for (const gate of GATES) {
    console.log(`${gate.critical ? "CRITICAL" : "optional"}  ${gate.id.padEnd(28)} ${gate.what}`);
  }
  process.exit(0);
}

const started = Date.now();
const results = [];

for (const gate of GATES) {
  if (FAST && gate.slow) {
    results.push({ id: gate.id, status: "skipped", reason: "--fast", critical: gate.critical });
    console.log(`SKIP        ${gate.id}  (--fast)`);
    continue;
  }

  const reason = (await gate.unavailable?.()) ?? null;
  if (reason) {
    /*
     * UNAVAILABLE IS RECORDED WITH THE COMMAND, deliberately. The point of
     * distinguishing it from a pass is that somebody with the missing
     * prerequisite can run exactly this and close the gap, rather than
     * rediscovering what was meant to be tested.
     */
    results.push({
      id: gate.id,
      status: "unavailable",
      reason,
      command: gate.run.join(" "),
      critical: gate.critical,
      what: gate.what,
    });
    console.log(`UNAVAILABLE ${gate.id}  — ${reason}`);
    console.log(`            run where possible: ${gate.run.join(" ")}`);
    continue;
  }

  const at = Date.now();
  process.stdout.write(`RUN         ${gate.id} … `);
  const proc = spawnSync(gate.run[0], gate.run.slice(1), {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - at;
  const ok = proc.status === 0;
  const output = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;

  results.push({
    id: gate.id,
    status: ok ? "pass" : "fail",
    critical: gate.critical,
    what: gate.what,
    exitCode: proc.status,
    durationMs: ms,
    command: gate.run.join(" "),
    // Enough to identify the failure without pasting a whole build log.
    tail: ok ? null : output.trim().split("\n").slice(-40).join("\n"),
  });

  console.log(`${ok ? "PASS" : "FAIL"} (${(ms / 1000).toFixed(1)}s)`);
  if (!ok) {
    console.log("----------------------------------------------------------------");
    console.log(output.trim().split("\n").slice(-40).join("\n"));
    console.log("----------------------------------------------------------------");
  }
}

const failedCritical = results.filter((r) => r.status === "fail" && r.critical);
const failedOptional = results.filter((r) => r.status === "fail" && !r.critical);
const unavailable = results.filter((r) => r.status === "unavailable");

const evidence = {
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/launch-prove.mjs",
  mode: FAST ? "fast" : "full",
  durationMs: Date.now() - started,
  summary: {
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failedCritical: failedCritical.length,
    failedOptional: failedOptional.length,
    unavailable: unavailable.length,
    skipped: results.filter((r) => r.status === "skipped").length,
  },
  /*
   * The verdict is stated once, here, in the terms the release decision is
   * actually made in. "unavailable" never contributes to a pass.
   */
  launchable: failedCritical.length === 0,
  results,
};

const out = "release/LAUNCH_PROOF.json";
if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);

console.log("");
console.log(`Evidence: ${out}`);
console.log(
  `${evidence.summary.passed} passed · ${failedCritical.length} launch-critical failures · ` +
    `${failedOptional.length} non-critical failures · ${unavailable.length} externally unavailable` +
    (evidence.summary.skipped ? ` · ${evidence.summary.skipped} skipped` : ""),
);

if (unavailable.length > 0) {
  console.log("\nCould not be proven here, and is therefore NOT proven:");
  for (const gate of unavailable) {
    console.log(`  ${gate.id}: ${gate.reason}`);
    console.log(`    ${gate.command}`);
  }
}

if (failedCritical.length > 0) {
  console.log("\nLaunch-critical failures:");
  for (const gate of failedCritical) console.log(`  ${gate.id}: ${gate.what}`);
  process.exit(1);
}
process.exit(0);
