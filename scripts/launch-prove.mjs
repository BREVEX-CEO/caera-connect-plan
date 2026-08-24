/**
 * One launch-critical proof command, with external blockers kept visible.
 *
 * This command never deploys, publishes, signs, applies migrations, charges a
 * payment method, or changes an external account. It executes every proof that
 * can run locally, reads the external-blocker ledger, writes one receipt, and
 * exits non-zero unless both the local proof and the external launch evidence
 * are green.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUTPUT = join(ROOT, "release", "OCADE_LAUNCH_PROOF.json");
const DEFER_WINDOWS = process.argv.includes("--defer-windows");
const npmCli =
  process.env.npm_execpath ??
  join(process.execPath, "..", "node_modules", "npm", "bin", "npm-cli.js");

const npmRun = (id, description, script, args = []) => ({
  id,
  description,
  command: process.execPath,
  args: [npmCli, "run", script, ...args],
});

const gates = [
  npmRun("typecheck", "TypeScript and generated routes", "typecheck"),
  npmRun("lint", "Lint with zero errors", "lint"),
  npmRun("tests", "Full unit, integration, auth, payment and PostgreSQL-twin suite", "test"),
  npmRun("test-isolation", "Shuffled-file isolation stress", "test:isolation"),
  npmRun("build", "Production web and Worker build", "build"),
  npmRun("performance", "Production asset budgets", "performance:budget"),
  npmRun("dead-controls", "Rendered-control dead-path scan", "controls:check"),
  npmRun("mutation", "Safety mutation campaign", "test:mutation"),
  npmRun("ocade-77", "OCADE 77-item and production-wiring source gate", "ocade:77-check"),
  npmRun("release-source", "Release source and blocker-honesty gate", "release:source-check"),
  npmRun("model-distribution", "Fixed local-model distribution gate", "model:distribution-check"),
  npmRun("licences", "Generated third-party notices are current", "licences:check"),
  npmRun("supabase-types", "Database types match the migration surface", "supabase:types-check"),
  npmRun("launch-authority", "Launch authority remains fail-closed", "launch-authority:check"),
  ...(process.platform === "win32" && !DEFER_WINDOWS
    ? [npmRun("windows-runtime", "Native, desktop and browser real-target proof", "windows:prove")]
    : []),
  {
    id: "production-dependencies",
    description: "Production dependency vulnerability audit",
    command: process.execPath,
    args: [npmCli, "audit", "--omit=dev"],
  },
];

function tail(value, limit = 500) {
  const normalized = String(value ?? "").trim();
  return normalized.length <= limit ? normalized : normalized.slice(-limit);
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${tail(result.stderr)}`);
  return String(result.stdout ?? "").trim();
}

export function runLaunchProof() {
  const results = [];
  const testedCommit = gitOutput(["rev-parse", "HEAD"]);
  const startingChanges = gitOutput(["status", "--short"])
    .split(/\r?\n/)
    .filter(Boolean);
  console.log("OCADE launch proof (local execution plus external authority)\n");

  for (const gate of gates) {
    const started = Date.now();
    console.log(`-- ${gate.id}: ${gate.description}`);
    const run = spawnSync(gate.command, gate.args, {
      cwd: ROOT,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    const passed = run.status === 0 && run.error === undefined;
    const result = {
      id: gate.id,
      description: gate.description,
      status: passed ? "executed_pass" : "executed_fail",
      exitCode: run.status,
      durationMs: Date.now() - started,
      evidence: {
        stdoutTail: tail(run.stdout, 1_200),
        stderrTail: tail(run.stderr, 1_200),
      },
    };
    results.push(result);
    console.log(`${passed ? "PASS" : "FAIL"} ${gate.id} (${result.durationMs} ms)\n`);
  }

  const blockerLedger = JSON.parse(
    readFileSync(join(ROOT, "release", "OCADE_RELEASE_BLOCKERS.json"), "utf8"),
  );
  const distribution = JSON.parse(
    readFileSync(join(ROOT, "release", "OCADE_MODEL_DISTRIBUTION_PROOF.json"), "utf8"),
  );
  const authority = JSON.parse(
    readFileSync(join(ROOT, "release", "OCADE_LAUNCH_AUTHORITY_POLICY.json"), "utf8"),
  );

  const sourceFailures = results.filter((item) => item.status === "executed_fail");
  const deferredGates = DEFER_WINDOWS
    ? [
        {
          id: "windows-runtime",
          status: "deferred_not_executed",
          classification: "DEFERRED / NOT FINAL-PROVEN",
          reason:
            "The release owner explicitly deferred disruptive real Windows UI and Notepad execution for this run.",
          mergePolicy:
            "This deferral does not block source merge; it remains a production-proof debt and cannot be reported as passed.",
        },
      ]
    : [];
  const externalBlockers = blockerLedger.blockers.map((item) => ({
    id: item.id,
    area: item.area,
    requiredEvidence: item.requiredEvidence,
  }));
  const authorityBlocked = Object.entries(authority.currentAuthority)
    .filter(([, ready]) => ready !== true)
    .map(([id]) => id);
  // A verified source merge and a production launch are different authority
  // boundaries. External credentials, signing, publication and launch-owner
  // approvals must keep launch closed, but they must not trap otherwise-green
  // engineering work on a continuation branch. An explicitly deferred Windows
  // proof is visible debt, never a fabricated pass.
  const readyToMerge = sourceFailures.length === 0;
  const readyToLaunch =
    readyToMerge &&
    deferredGates.length === 0 &&
    externalBlockers.length === 0 &&
    authorityBlocked.length === 0;
  const classification =
    sourceFailures.length > 0
      ? "EXECUTED WITH SOURCE FAILURES; LAUNCH BLOCKED"
      : readyToLaunch
        ? "LAUNCH-CRITICAL PROOF GREEN"
        : deferredGates.length > 0
          ? "SOURCE-FIXED AND EXECUTED; WINDOWS DEFERRED / NOT FINAL-PROVEN; LAUNCH EXTERNALLY BLOCKED"
        : "SOURCE-FIXED AND EXECUTED; LAUNCH EXTERNALLY BLOCKED";

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testedCommit,
    startingChanges,
    classification,
    readyToMerge,
    readyToLaunch,
    deferredGates,
    localProof: {
      passed: results.length - sourceFailures.length,
      failed: sourceFailures.length,
      results,
    },
    distribution: {
      classification: distribution.classification,
      externalBlocked: distribution.externalBlocked,
    },
    externalBlockers,
    authorityBlocked,
    sideEffects: {
      deployed: false,
      migrationsAppliedToLiveProject: false,
      chargedPaymentMethod: false,
      publishedOrSigned: false,
      merged: false,
    },
  };
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);

  console.log(classification);
  console.log(
    `${report.localProof.passed}/${results.length} local gates passed; ` +
      `${externalBlockers.length} external blocker areas; ${authorityBlocked.length} authority gates open.`,
  );
  console.log(`Evidence: ${OUTPUT}`);
  if (!readyToMerge) console.log("MERGE REFUSED: local source proof has failures.");
  else if (!readyToLaunch) {
    console.log("SOURCE MERGE READY; LAUNCH REFUSED: external or deferred proof remains open.");
  }
  return report;
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  const report = runLaunchProof();
  // The explicit deferral command is the owner-authorized source-merge gate.
  // The ordinary launch proof remains fail-closed until launch itself is ready.
  process.exitCode = (DEFER_WINDOWS ? report.readyToMerge : report.readyToLaunch) ? 0 : 1;
}
