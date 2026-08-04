/**
 * Tier benchmark: does the engine OCADE picks actually stay out of the user's way?
 *
 * "Lag-free" is not a design intention, it is a number, and the number differs
 * per machine. This measures the installed tiers through the SAME
 * `streamLocalChat` the chat screen calls, so the figures describe the shipped
 * path rather than a benchmark harness's own request.
 *
 * TWO THINGS IT DELIBERATELY MEASURES SEPARATELY
 *
 *  - COLD (first message after the weights are evicted) and WARM (every message
 *    after). Reporting only the warm figure flatters the product: the cold one
 *    is what a user meets when they open the app, and on a CPU-only machine it
 *    is dominated by reading gigabytes off disk.
 *  - VISIBLE output only. `streamLocalChat` disables the hidden reasoning pass;
 *    if a tier leaks its reasoning into the visible answer anyway, that is a
 *    quality failure regardless of speed, and it is checked here rather than
 *    assumed away.
 *
 * WHAT IT CANNOT SAY: anything about a machine other than this one. Free memory
 * at the time of the run is recorded because it materially changes the cold
 * figure, and a run taken while the machine is busy is not comparable to one
 * taken while it is idle.
 *
 * Usage: vite-node scripts/ocade-tier-benchmark.mts -- [--write] [--tags a,b,c]
 */
import { writeFileSync } from "node:fs";
import { freemem, totalmem, cpus } from "node:os";
import { discoverLocalModels, streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "../src/lib/ocade-local";

const args = process.argv.slice(2).filter((a) => a !== "--");
const write = args.includes("--write");
const tagArg = args.find((a) => a.startsWith("--tags="));
const BRIDGE = process.env.OCADE_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;
const OUT = "release/OCADE_TIER_BENCHMARK.json";

/**
 * A question with a short, checkable answer. Short on purpose: this measures
 * how long OCADE takes to START being useful, and a prompt that demands 400
 * tokens measures throughput instead, which is not what makes a chat feel
 * broken.
 */
const PROMPT = "Name the largest planet in our solar system. Answer with just the name.";
const GROUND_TRUTH = /jupiter/i;

/**
 * Markers of a model narrating its own reasoning into the visible answer.
 * Drawn from the observed failure, not invented: the quarantined tier produced
 * "Okay, the user wants... Hmm, they're probably..." in place of an answer.
 */
const LEAK_MARKERS = [
  /<think>/i,
  /\bokay,? the user\b/i,
  /\bhmm\b/i,
  /\blet me think\b/i,
  /\bfirst,? i need to\b/i,
  /\bthe user (?:is asking|wants)\b/i,
];

/** A short answer that stays short. Anything longer is padding the user reads. */
const EXPECTED_MAX_CHARS = 120;

interface RunResult {
  firstTokenMs: number | null;
  totalMs: number;
  chars: number;
  reply: string;
  ok: boolean;
  reason?: string;
}

async function runOnce(modelId: string): Promise<RunResult> {
  const t0 = Date.now();
  let firstTokenMs: number | null = null;
  let reply = "";
  const result = await streamLocalChat(
    BRIDGE,
    modelId,
    [{ role: "user", content: PROMPT }],
    {
      onToken: (chunk) => {
        if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
        reply += chunk;
      },
    },
  );
  return {
    firstTokenMs,
    totalMs: Date.now() - t0,
    chars: reply.length,
    reply: reply.trim(),
    ok: result.ok,
    reason: result.reason,
  };
}

/** Evict the weights so the next run genuinely measures a cold start. */
async function unload(modelId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE.replace(/\/+$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // keep_alive: 0 asks the runtime to drop the model immediately.
      body: JSON.stringify({ model: modelId, messages: [], keep_alive: 0 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const discovery = await discoverLocalModels(BRIDGE);
if (!discovery.ok) {
  console.error(`No local engine to benchmark: ${discovery.reason ?? "unreachable"}`);
  process.exit(1);
}

const requested = tagArg
  ? tagArg.slice("--tags=".length).split(",").map((t) => t.trim()).filter(Boolean)
  : ["qwen3:1.7b", "qwen3:4b", "qwen3:8b"];
const installed = new Set(discovery.models.map((m) => m.id));
const tags = requested.filter((t) => installed.has(t));
const missing = requested.filter((t) => !installed.has(t));

const machine = {
  cpu: cpus()[0]?.model?.trim() ?? "unknown",
  logicalCores: cpus().length,
  totalRamGib: +(totalmem() / 1024 ** 3).toFixed(2),
  freeRamGibAtStart: +(freemem() / 1024 ** 3).toFixed(2),
  engineVersion: discovery.version ?? "unknown",
};

console.log(
  `${machine.cpu} · ${machine.logicalCores} cores · ${machine.freeRamGibAtStart} GiB free of ${machine.totalRamGib}\n`,
);
if (missing.length > 0) console.log(`not installed, skipped: ${missing.join(", ")}\n`);

const results = [];
for (const tag of tags) {
  await unload(tag);
  const cold = await runOnce(tag);
  const warm1 = await runOnce(tag);
  const warm2 = await runOnce(tag);
  const warmRuns = [warm1, warm2];
  const warmFirstToken = warmRuns
    .map((r) => r.firstTokenMs)
    .filter((v): v is number => typeof v === "number");
  const medianWarmFirstToken =
    warmFirstToken.length > 0
      ? Math.round(warmFirstToken.reduce((a, b) => a + b, 0) / warmFirstToken.length)
      : null;

  const answeredCorrectly = warmRuns.every((r) => GROUND_TRUTH.test(r.reply));
  const leaked = [cold, ...warmRuns].some((r) => LEAK_MARKERS.some((re) => re.test(r.reply)));
  const verbose = warmRuns.some((r) => r.chars > EXPECTED_MAX_CHARS);

  const row = {
    tag,
    coldFirstTokenMs: cold.firstTokenMs,
    coldTotalMs: cold.totalMs,
    warmFirstTokenMs: warmRuns.map((r) => r.firstTokenMs),
    medianWarmFirstTokenMs: medianWarmFirstToken,
    warmTotalMs: warmRuns.map((r) => r.totalMs),
    visibleChars: warmRuns.map((r) => r.chars),
    answeredCorrectly,
    /** Reasoning narrated into the visible answer despite it being disabled. */
    leakedReasoning: leaked,
    /** Far more output than the question asked for. */
    overlongForTheQuestion: verbose,
    replySample: warm1.reply.slice(0, 160),
    freeRamGibAfter: +(freemem() / 1024 ** 3).toFixed(2),
  };
  results.push(row);

  console.log(
    `${tag.padEnd(12)} cold ${String(cold.firstTokenMs).padStart(6)}ms · warm ${String(
      medianWarmFirstToken,
    ).padStart(6)}ms · ${row.answeredCorrectly ? "correct" : "WRONG"}${
      leaked ? " · LEAKS REASONING" : ""
    }${verbose ? " · overlong" : ""}`,
  );
  console.log(`             "${row.replySample}"`);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  tier: "REAL TARGET RUNTIME VERIFIED",
  caveat:
    "One machine, one engine build, one point in time. Free memory at the start is recorded because it dominates the cold figure; a run taken on a busy machine is not comparable to one taken on an idle one. This is not a platform matrix.",
  method: {
    prompt: PROMPT,
    groundTruth: "Jupiter",
    runsPerTier: "1 cold (after an explicit unload) + 2 warm",
    through: "src/lib/ocade-local.ts streamLocalChat — the same call the chat screen makes",
    hiddenReasoning: "disabled, as in ordinary chat",
  },
  machine,
  skipped: missing,
  results,
};

if (write) {
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nwrote ${OUT}`);
}
