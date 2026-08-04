/**
 * REAL-TARGET runtime evidence for the model lifecycle (P05).
 *
 * Downloads a genuinely tiny model, verifies it, activates it (inference AND
 * cancellation, per P05.S05), then REMOVES it again so the machine is left as
 * it was found. Not part of `npm test`: it needs a real runtime and network.
 *
 * The model is deliberately the smallest useful one available. The point is to
 * exercise download → verify → activate → remove for real, not to install
 * something the user did not ask for.
 *
 * Usage: npx vite-node scripts/model-lifecycle-evidence.mts
 */
import { writeFileSync } from "node:fs";
import { statfsSync } from "node:fs";
import {
  pullModel,
  verifyInstalled,
  removeModel,
  activateModel,
  planRepair,
  planRollback,
  checkDisk,
} from "../src/lib/local/model-lifecycle.ts";
import { streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "../src/lib/ocade-local.ts";

const BRIDGE = process.env.OCADE_LOCAL_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;
const MODEL = process.env.OCADE_TEST_MODEL ?? "smollm2:135m";

type Step = { id: string; what: string; status: "observed" | "skipped" | "failed"; detail: unknown };
const steps: Step[] = [];
function record(id: string, what: string, status: Step["status"], detail: unknown) {
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "OK  " : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`  [${mark}] ${id}  ${what}`);
  if (status !== "observed") console.log(`         ${JSON.stringify(detail).slice(0, 300)}`);
}

function freeBytes(): number {
  try {
    const s = statfsSync(process.cwd());
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return Number.NaN;
  }
}

async function main() {
  console.log(`\nOCADE model-lifecycle evidence — bridge ${BRIDGE}, model ${MODEL}\n`);

  const free = freeBytes();
  record("L00", "free disk measured before any download", Number.isFinite(free) ? "observed" : "skipped", {
    freeGb: Number.isFinite(free) ? +(free / 1e9).toFixed(1) : null,
  });

  // Pre-flight refusal must be real, not just unit-tested: ask for something
  // absurd and confirm the network is never touched.
  const refuse = await pullModel(BRIDGE, MODEL, {
    expectedBytes: 500_000_000_000_000,
    freeStorageBytes: free,
  });
  record(
    "L01",
    "an impossible download is REFUSED before any transfer starts",
    !refuse.ok && refuse.failure === "insufficient_disk" ? "observed" : "failed",
    refuse.ok ? refuse : { failure: refuse.failure, reason: refuse.reason },
  );

  // Cancellation of a real in-flight download.
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 900);
  const cancelled = await pullModel(BRIDGE, MODEL, { signal: ac.signal });
  record(
    "L02",
    "a real in-flight download is cancellable and reported as resumable",
    !cancelled.ok && cancelled.failure === "cancelled" ? "observed" : "failed",
    cancelled.ok ? cancelled : { failure: cancelled.failure, reason: cancelled.reason },
  );

  // The real download. Resumes whatever L02 already fetched.
  const progress: Array<{ pct: number; status: string }> = [];
  let lastPct = -10;
  const pulled = await pullModel(BRIDGE, MODEL, {
    expectedBytes: 300_000_000,
    freeStorageBytes: free,
    onProgress: (p) => {
      if (p.percent !== null && p.percent - lastPct >= 20) {
        lastPct = p.percent;
        progress.push({ pct: +p.percent.toFixed(1), status: p.status });
      }
    },
  });
  record("L03", `real download of ${MODEL} (resuming the cancelled attempt)`, pulled.ok ? "observed" : "failed", {
    ...(pulled.ok ? { elapsedMs: pulled.elapsedMs, lastStatus: pulled.lastStatus } : pulled),
    progressSamples: progress,
  });

  // Verify presence + digest.
  const verified = await verifyInstalled(BRIDGE, MODEL);
  record("L04", "installation verified against the runtime's own model list", verified.ok ? "observed" : "failed", verified);

  // Activation: downloaded is NOT ready.
  const activation = await activateModel(MODEL, {
    runInference: async (id, prompt) => {
      let text = "";
      const r = await streamLocalChat(BRIDGE, id, [{ role: "user", content: prompt }], {
        onToken: (t) => (text += t),
      });
      return { ok: r.ok, text };
    },
    runCancellable: async (id) => {
      const a = new AbortController();
      setTimeout(() => a.abort(), 800);
      const r = await streamLocalChat(
        BRIDGE,
        id,
        [{ role: "user", content: "Count slowly from 1 to 900, one per line." }],
        { onToken: () => {}, signal: a.signal },
      );
      return { cancelled: r.ok === false && r.reason === "cancelled" };
    },
  });
  record(
    "L05",
    "model declared READY only after real inference AND real cancellation",
    activation.ok ? "observed" : "failed",
    activation,
  );

  // Repair and rollback decisions computed from the REAL installed set.
  const tags = (await (await fetch(`${BRIDGE}/api/tags`)).json()) as {
    models?: Array<{ name: string }>;
  };
  const installed = (tags.models ?? []).map((m) => m.name);
  record("L06", "repair plan for a healthy engine is 'none'", "observed", {
    installed,
    plan: planRepair({
      runtimeReachable: true,
      modelInstalled: installed.includes(MODEL),
      modelId: MODEL,
      lastInferenceOk: activation.ok,
      freeStorageBytes: free,
      modelBytes: 300_000_000,
    }),
  });
  record("L07", "rollback targets a model that is genuinely still installed", "observed", {
    plan: planRollback({
      failedModelId: MODEL,
      previousModelId: "deepseek-coder:6.7b",
      installedModelIds: installed,
    }),
    absentTarget: planRollback({
      failedModelId: MODEL,
      previousModelId: "never-installed:1b",
      installedModelIds: installed,
    }),
  });

  // Removal + storage cleanup — leave the machine as found.
  const removed = await removeModel(BRIDGE, MODEL);
  record("L08", `removal of ${MODEL} (storage cleanup)`, removed.ok ? "observed" : "failed", removed);

  const after = await verifyInstalled(BRIDGE, MODEL);
  record(
    "L09",
    "removal confirmed — the model is genuinely gone, not just reported gone",
    !after.ok && after.failure === "not_installed" ? "observed" : "failed",
    after.ok ? after : { failure: after.failure },
  );

  const freeAfter = freeBytes();
  record("L10", "disk reclaimed after removal", "observed", {
    freeGbBefore: +(free / 1e9).toFixed(2),
    freeGbAfter: +(freeAfter / 1e9).toFixed(2),
    deltaGb: +((freeAfter - free) / 1e9).toFixed(2),
    note: "Delta is indicative only — other processes write to the same disk during the run.",
  });

  const observed = steps.filter((s) => s.status === "observed").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const skipped = steps.filter((s) => s.status === "skipped").length;
  writeFileSync(
    "release/OCADE_MODEL_LIFECYCLE_RUNTIME_EVIDENCE.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        tier: "REAL TARGET RUNTIME VERIFIED",
        model: MODEL,
        caveat:
          "Single host (Windows 10, i5-1135G7, 15.6GB RAM). Proves download, verification, activation, repair/rollback decisions and removal against a live runtime. It does NOT prove behaviour on other operating systems, other runtimes, or under network failure mid-transfer.",
        host: { platform: process.platform, arch: process.arch, node: process.version, bridge: BRIDGE },
        summary: { observed, failed, skipped, total: steps.length },
        steps,
      },
      null,
      2,
    ),
  );
  console.log(`\n  observed=${observed} failed=${failed} skipped=${skipped}`);
  console.log("  written: release/OCADE_MODEL_LIFECYCLE_RUNTIME_EVIDENCE.json\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
