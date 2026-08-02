/**
 * L2 evidence: one genuine long task — live progress, pause, resume, cancel,
 * restart-without-repeating-a-step, and a final receipt.
 *
 * THE RESTART IS A REAL KILL
 * --------------------------
 * The worker runs in a separate process and is killed with SIGKILL partway
 * through. Nothing gets a chance to tidy up. Resumption is then a second
 * process claiming the same durable run off disk. A test that "restarted" by
 * calling a function again would prove nothing about surviving a crash.
 *
 * THE NO-REPEAT PROOF IS A SIDE-EFFECT LEDGER, NOT A STATUS FIELD
 * --------------------------------------------------------------
 * Every executed step appends one line to a ledger file. If a completed step
 * were ever re-executed after the restart, its operation id would appear twice.
 * Checking `nextStepIndex` alone would only prove the worker's bookkeeping
 * agrees with itself; the ledger records what actually HAPPENED.
 *
 * ON THE MOBILE CLAUSE
 * --------------------
 * The requirement also asks to confirm the mobile app showed accurate progress
 * throughout. There is no paired device (see
 * release/OCADE_K_MOBILE_PREREQUISITES.json — 3 of 10 prerequisites present, no
 * adb, no connected device), so that clause is NOT proven and is not claimed.
 * Everything else here is.
 *
 * Usage: npx vite-node scripts/automation-l2-evidence.mts -- [--write]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileAutomationStore } from "./automation/file-store.mts";
import type { RunStep } from "../src/lib/ocade-automations.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_L2_LONG_TASK.json";
const WORK = join(tmpdir(), "ocade-l2");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Eight real files to hash: a genuinely long task built from genuine work.
 *
 * Every one is checked to exist at startup. A first version included
 * `index.html`, which this project does not have, so step 5 failed with ENOENT
 * and the run deferred — a broken fixture wearing the costume of a product bug.
 */
const TARGETS = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "eslint.config.js",
  "vitest.config.ts",
  "src/lib/automation-worker.ts",
  "src/lib/ocade-automations.ts",
  "src/lib/control/perception.ts",
];
for (const t of TARGETS) {
  if (!existsSync(t)) throw new Error(`fixture error: target ${t} does not exist`);
}

/**
 * Wait for the run on disk to satisfy a condition.
 *
 * Fixed sleeps were wrong here: `npx vite-node` takes ~3.5s to boot, so a
 * 2600ms sleep fired before the worker had executed anything, and pause and
 * kill both landed on a run that had not started. Every phase below now waits
 * for observed progress instead of guessing at a duration.
 */
async function waitFor(
  storePath: string,
  predicate: (run: { status: string; nextStepIndex: number; receipts: unknown[] }) => boolean,
  timeoutMs = 90_000,
): Promise<{ status: string; nextStepIndex: number; receipts: unknown[] } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const run = JSON.parse(readFileSync(storePath, "utf8"));
      if (predicate(run)) return run;
    } catch {
      /* mid-rename */
    }
    await sleep(200);
  }
  return null;
}

function steps(): RunStep[] {
  return TARGETS.map((path, i) => ({
    action: { kind: "file.open", path } as unknown as RunStep["action"],
    risk: "confirm",
    summary: `Hash ${path} (step ${i + 1} of ${TARGETS.length})`,
    requiresConfirmation: false,
  }));
}

function newRun(tag: string) {
  const storePath = join(WORK, `${tag}-run.json`);
  const ledgerPath = join(WORK, `${tag}-ledger.txt`);
  rmSync(storePath, { force: true });
  rmSync(ledgerPath, { force: true });
  const store = FileAutomationStore.create(storePath, steps());
  return { store, storePath, ledgerPath };
}

function startWorker(storePath: string, ledgerPath: string, workerId: string) {
  return spawn(
    "npx",
    ["vite-node", "scripts/automation/run-worker.mts", "--", storePath, ledgerPath, workerId],
    { stdio: ["ignore", "pipe", "pipe"], shell: true },
  );
}

/**
 * Kill the whole process TREE, not just the handle we hold.
 *
 * `shell: true` means the child is cmd.exe and the worker is its grandchild.
 * `child.kill("SIGKILL")` therefore killed the shell and left the worker
 * running — and it quietly finished the entire task. The restart phase reported
 * "5 steps executed by the second process" while every line in the effect
 * ledger said `by=worker-before-crash`, which is what gave it away. The ledger
 * caught a test that was lying about having restarted anything.
 */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8" });
}

function runWorkerSync(storePath: string, ledgerPath: string, workerId: string) {
  const r = spawnSync(
    "npx",
    ["vite-node", "scripts/automation/run-worker.mts", "--", storePath, ledgerPath, workerId],
    { encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024 },
  );
  const line = (r.stdout ?? "").trim().split("\n").filter(Boolean).pop() ?? "{}";
  try {
    return JSON.parse(line);
  } catch {
    return { parseError: line.slice(0, 300), stderr: (r.stderr ?? "").slice(-300) };
  }
}

const ledgerLines = (p: string) =>
  existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean) : [];
/** Every execute() invocation, including replays. */
const attemptLines = (p: string) => ledgerLines(`${p}.attempts.txt`);
const opIds = (lines: string[]) => lines.map((l) => l.split(" ")[0]);
const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

let failed = false;
const results: Record<string, unknown> = {};

// ---------------------------------------------------------------- 1. progress

/*
 * Live progress is observed from OUTSIDE the worker: a second reader polls the
 * durable run while the task is in flight. Progress the worker only reports at
 * the end is not live progress.
 */
{
  const { storePath, ledgerPath } = newRun("progress");
  const child = startWorker(storePath, ledgerPath, "worker-progress");
  const samples: { ms: number; nextStepIndex: number; receipts: number; status: string }[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try {
      const run = JSON.parse(readFileSync(storePath, "utf8"));
      samples.push({
        ms: Date.now() - t0,
        nextStepIndex: run.nextStepIndex,
        receipts: run.receipts.length,
        status: run.status,
      });
      if (run.status === "succeeded" || run.status === "failed") break;
    } catch {
      /* mid-rename */
    }
  }
  killTree(child.pid);
  const advanced = samples.filter((s, i) => i > 0 && s.nextStepIndex > samples[i - 1].nextStepIndex).length;
  const finalRun = JSON.parse(readFileSync(storePath, "utf8"));
  // Progress must be observed advancing WHILE running, over several samples.
  const liveProgress = advanced >= 3 && samples.some((s) => s.status === "running" && s.nextStepIndex > 0);
  results.liveProgress = {
    samples,
    distinctAdvances: advanced,
    finalStatus: finalRun.status,
    receipts: finalRun.receipts.length,
    ledgerLines: ledgerLines(ledgerPath).length,
    proven: liveProgress,
    note: "Observed by a separate reader polling the durable run while the worker was still executing, so this is progress visible to an outside observer rather than a summary printed at the end.",
  };
  if (!liveProgress) failed = true;
}

// ------------------------------------------------------- 2. pause then resume

{
  const { store, storePath, ledgerPath } = newRun("pause");
  const child = startWorker(storePath, ledgerPath, "worker-pause");
  // Wait for REAL progress before pausing, rather than guessing at a duration.
  const before = await waitFor(storePath, (r) => r.nextStepIndex >= 2);
  if (!before) throw new Error("the worker never reached step 2 before the pause");
  // Request pause out-of-band, the way a supervisor (or a phone) would.
  const run = store.read();
  run.control = "pause";
  store.write(run);
  const paused = await waitFor(storePath, (r) => r.status !== "running" && r.status !== "pending");
  killTree(child.pid);
  const ledgerAtPause = ledgerLines(ledgerPath).length;

  // RESUME: clear the control flag and start a new worker on the same run.
  const resumeRun = store.read();
  resumeRun.control = "run";
  store.write(resumeRun);
  const resumedOutcome = runWorkerSync(storePath, ledgerPath, "worker-resume");
  const afterResume = JSON.parse(readFileSync(storePath, "utf8"));
  const effects = ledgerLines(ledgerPath);
  const attempts = attemptLines(ledgerPath);
  const duplicateEffects = dupes(opIds(effects));

  /*
   * Pause mid-step is allowed to land in either of two honest states.
   *
   * If the abort arrives between steps the run suspends as "paused". If it
   * arrives while a step is in flight, the worker cannot prove whether the
   * effect landed, and it refuses automatic replay rather than guessing —
   * which is the safe direction and is why the effect ledger is keyed on the
   * operation id. Both are accepted here; silently completing the whole task
   * as though nothing was requested would not be.
   */
  const stoppedOnRequest = paused !== null && paused.status !== "succeeded";
  const pausedBeforeTheEnd = (paused?.nextStepIndex ?? 0) < TARGETS.length;
  const pausedCleanly = stoppedOnRequest && pausedBeforeTheEnd;
  const resumedFromWhereItStopped = duplicateEffects.length === 0;
  results.pauseResume = {
    stepsDoneBeforePause: before.nextStepIndex,
    pausedStatus: paused?.status,
    pausedAtStep: paused?.nextStepIndex,
    pauseReason: paused ? (paused as unknown as { error: string }).error : null,
    effectsAtPause: ledgerAtPause,
    resumeOutcome: resumedOutcome,
    finalStatus: afterResume.status,
    totalEffects: effects.length,
    totalAttempts: attempts.length,
    replaysObserved: attempts.length - effects.length,
    duplicateEffects,
    pausedCleanly,
    resumedWithoutRepeatingWork: resumedFromWhereItStopped,
    note: "Pause is requested out-of-band while the worker is mid-run, exactly as a supervisor or phone would. Resume is a NEW worker claiming the same durable run. Correctness is judged on the EFFECT ledger having no operation id twice — replays in the attempts log are expected and fine, because execution is at-least-once and the operation id is the idempotency key that makes the effect exactly-once.",
  };
  if (!pausedCleanly || !resumedFromWhereItStopped) failed = true;
}

// ------------------------------------------------------------------ 3. cancel

{
  const { store, storePath, ledgerPath } = newRun("cancel");
  const child = startWorker(storePath, ledgerPath, "worker-cancel");
  const reached = await waitFor(storePath, (r) => r.nextStepIndex >= 2);
  if (!reached) throw new Error("the worker never reached step 2 before the cancel");
  const run = store.read();
  run.control = "cancel";
  store.write(run);
  await waitFor(storePath, (r) => r.status !== "running" && r.status !== "pending");
  killTree(child.pid);
  const cancelled = JSON.parse(readFileSync(storePath, "utf8"));
  const linesAfter = ledgerLines(ledgerPath).length;
  await sleep(1200);
  const linesLater = ledgerLines(ledgerPath).length;
  const stoppedDoingWork = linesLater === linesAfter;
  const cancelledCleanly = cancelled.status === "cancelled" && cancelled.nextStepIndex < TARGETS.length;
  results.cancel = {
    status: cancelled.status,
    stoppedAtStep: cancelled.nextStepIndex,
    totalSteps: TARGETS.length,
    ledgerLinesAtCancel: linesAfter,
    ledgerLinesAfterWaiting: linesLater,
    stoppedDoingWork,
    cancelledCleanly,
    note: "Cancellation is judged on the run reaching a terminal cancelled state BEFORE the last step and on the side-effect ledger not growing afterwards. A status flag alone would not show whether work actually stopped.",
  };
  if (!cancelledCleanly || !stoppedDoingWork) failed = true;
}

// --------------------------------------- 4. restart mid-task, no repeated step

{
  const { storePath, ledgerPath } = newRun("restart");
  const child = startWorker(storePath, ledgerPath, "worker-before-crash");
  // Kill only once real work is on disk, so the restart has something to skip.
  const beforeKill = await waitFor(storePath, (r) => r.nextStepIndex >= 3);
  if (!beforeKill) throw new Error("the worker never reached step 3 before the kill");
  const effectsBefore = ledgerLines(ledgerPath);
  const attemptsBefore = attemptLines(ledgerPath);
  // SIGKILL: no cleanup, no graceful shutdown, nothing gets to tidy up.
  killTree(child.pid);
  await sleep(800);

  const restarted = runWorkerSync(storePath, ledgerPath, "worker-after-crash");
  const afterRestart = JSON.parse(readFileSync(storePath, "utf8"));
  const effectsAfter = ledgerLines(ledgerPath);
  const attemptsAfter = attemptLines(ledgerPath);
  const duplicateEffects = dupes(opIds(effectsAfter));
  const completed = afterRestart.status === "succeeded";
  const byFirst = effectsBefore.length;
  const bySecond = effectsAfter.length - effectsBefore.length;
  // The decisive check: the steps the first process completed must NOT be
  // re-executed by the second.
  const firstIds = new Set(opIds(effectsBefore));
  const reAttemptedBySecond = opIds(attemptsAfter.slice(attemptsBefore.length)).filter((id) =>
    firstIds.has(id),
  );

  results.restartRecovery = {
    stepsCompletedBeforeKill: beforeKill.nextStepIndex,
    effectsBeforeKill: byFirst,
    killSignal: "SIGKILL",
    restartOutcome: restarted,
    finalStatus: afterRestart.status,
    totalSteps: TARGETS.length,
    effectsAfterRestart: effectsAfter.length,
    stepsExecutedByFirstProcess: byFirst,
    stepsExecutedBySecondProcess: bySecond,
    completedStepsReAttemptedBySecondProcess: reAttemptedBySecond,
    duplicateEffects,
    repeatedACompletedStep: reAttemptedBySecond.length > 0 || duplicateEffects.length > 0,
    completedAfterRestart: completed,
    /*
     * The kill must actually have killed something.
     *
     * Attribution is taken from the ledger lines themselves, because the first
     * version of this test killed a shell wrapper and left the real worker
     * alive: it reported five steps "executed by the second process" while
     * every ledger line was still stamped `by=worker-before-crash`. Requiring
     * the second worker's name to appear is what makes a faked restart fail.
     */
    effectsStampedByFirstWorker: effectsAfter.filter((l) => l.includes("by=worker-before-crash")).length,
    effectsStampedBySecondWorker: effectsAfter.filter((l) => l.includes("by=worker-after-crash")).length,
    effectLedger: effectsAfter,
    note: "The first process is SIGKILLed with no chance to tidy up; a second process claims the same durable run. Two things are checked: the second process never even ATTEMPTS an operation the first completed, and no operation id appears twice in the effect ledger. Neither is the worker's own bookkeeping — both are records of what happened.",
  };
  const stampedBySecond = effectsAfter.filter((l) => l.includes("by=worker-after-crash")).length;
  if (
    reAttemptedBySecond.length > 0 ||
    duplicateEffects.length > 0 ||
    !completed ||
    byFirst === 0 ||
    bySecond === 0 ||
    // The restart must have done real work under its OWN name.
    stampedBySecond === 0
  ) {
    failed = true;
  }
}

// ---------------------------------------------------------------- 5. receipt

const receiptRun = JSON.parse(readFileSync(join(WORK, "restart-run.json"), "utf8"));
const receipts = receiptRun.receipts as {
  stepIndex: number;
  operationId: string;
  status: string;
  verified: boolean;
  detail: string;
  startedAt: string;
  finishedAt: string;
}[];
const allVerified = receipts.length > 0 && receipts.every((r) => r.verified && r.status === "succeeded");
const oneReceiptPerStep = new Set(receipts.map((r) => r.stepIndex)).size === TARGETS.length;
results.receipt = {
  count: receipts.length,
  coversEveryStepExactlyOnce: oneReceiptPerStep,
  allStepsVerified: allVerified,
  receipts,
  note: "The final receipt is the run's own retained record: one verified receipt per step, each naming the operation id, the outcome and the timestamps. Verification re-reads the ledger rather than trusting the executor's report.",
};
if (!allVerified || !oneReceiptPerStep) failed = true;

const doc = {
  schemaVersion: 1,
  item: "L2 - long task: live progress, pause, resume, cancel, restart recovery, receipt",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  task: {
    description: `Hash ${TARGETS.length} real files, one per step`,
    targets: TARGETS,
    note: "Each step reads a real file and hashes it, then appends one line to a side-effect ledger. Real work, and a real trace that a repeated step could not hide from.",
  },
  mobileClauseNotProven:
    "The requirement also asks to confirm the mobile app showed accurate progress throughout. There is no paired device — see release/OCADE_K_MOBILE_PREREQUISITES.json, 3 of 10 prerequisites present, no adb and no connected device — so that clause is NOT claimed.",
  ...results,
};

const show = (label: string, value: unknown) => console.log(`${label.padEnd(20)}: ${JSON.stringify(value)}`);
show("live progress", (results.liveProgress as { proven: boolean; distinctAdvances: number }));
show("pause/resume", (results.pauseResume as { pausedCleanly: boolean; resumedWithoutRepeatingWork: boolean; duplicateEffects: string[]; replaysObserved: number }));
show("cancel", (results.cancel as { cancelledCleanly: boolean; stoppedAtStep: number; stoppedDoingWork: boolean }));
show("restart recovery", {
  ...(results.restartRecovery as Record<string, unknown>),
  ledger: undefined,
  restartOutcome: undefined,
});
show("receipt", { count: (results.receipt as { count: number }).count, allVerified, oneReceiptPerStep });
console.log(`L2: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
