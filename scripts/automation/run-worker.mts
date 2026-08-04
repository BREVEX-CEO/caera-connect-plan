/**
 * Runs ONE claim of the real automation worker against the durable file store.
 *
 * This is a separate process on purpose: L2 asks for OCADE to be restarted
 * mid-task, and "restart" has to mean a process that is actually killed, not a
 * loop that pretends. The parent kills this and starts it again.
 *
 * Each step does REAL work — it hashes a real file on disk — and appends a line
 * to a side-effect ledger. The ledger is the proof that survives a kill: if a
 * completed step were ever re-executed, its line would appear twice, and no
 * amount of tidy status reporting could hide that.
 *
 * Usage: npx vite-node scripts/automation/run-worker.mts -- <storePath> <ledgerPath> <workerId>
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runAutomationWorker } from "../../src/lib/automation-worker.ts";
import { FileAutomationStore, appendAttempt, applyEffectOnce } from "./file-store.mts";

const [storePath, ledgerPath, workerId] = process.argv.slice(2).filter((a) => a !== "--");
if (!storePath || !ledgerPath || !workerId) {
  console.error("usage: run-worker.mts <storePath> <ledgerPath> <workerId>");
  process.exit(2);
}
// Two records, deliberately. `attempts` logs every invocation including
// replays; `effects` is deduplicated on operationId. Keeping both is what makes
// it possible to show that a replay HAPPENED and still did not do the work twice.
const attemptsPath = `${ledgerPath}.attempts.txt`;

const store = new FileAutomationStore(storePath);
const run = store.read();

const outcome = await runAutomationWorker({
  runId: run.id,
  workerId,
  store,
  executor: {
    async execute(action, opts) {
      /*
       * Genuine work: read a real file and hash it, with a deliberate dwell so
       * the task is long enough to be paused, cancelled and killed partway
       * through. The dwell is honest padding around real I/O, not a substitute
       * for it.
       */
      const target = (action as unknown as { path?: string }).path ?? "package.json";
      const started = Date.now();
      let digest = "";
      try {
        digest = createHash("sha256").update(readFileSync(target)).digest("hex").slice(0, 16);
      } catch (error) {
        return { ok: false, detail: `could not read ${target}: ${String(error)}` };
      }
      appendAttempt(attemptsPath, `${opts.operationId} attempt by=${workerId}`);
      await new Promise((r) => setTimeout(r, 900));
      // The side effect, applied at most once per operation id.
      const applied = applyEffectOnce(
        ledgerPath,
        opts.operationId,
        `${opts.operationId} sha256=${digest} by=${workerId}`,
      );
      return {
        ok: true,
        detail: `hashed ${target} -> ${digest} in ${Date.now() - started}ms (${applied ? "effect applied" : "effect already present, skipped"})`,
      };
    },
    async cancel() {
      /* nothing external to unwind: the work is a pure read */
    },
  },
  verifier: {
    async verify({ executionDetail }) {
      // Verification re-reads the ledger rather than trusting the executor's
      // own report that it wrote a line.
      const ledger = (() => {
        try {
          return readFileSync(ledgerPath, "utf8");
        } catch {
          return "";
        }
      })();
      const hash = executionDetail.match(/-> ([a-f0-9]{16})/)?.[1] ?? "";
      return {
        verified: hash.length > 0 && ledger.includes(hash),
        evidence: `ledger contains ${hash || "(no hash)"}`,
      };
    },
  },
});

console.log(JSON.stringify({ workerId, outcome }));
process.exitCode = outcome.status === "succeeded" ? 0 : 1;
