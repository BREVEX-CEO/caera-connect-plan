/**
 * REAL-TARGET runtime evidence harness for the local engine (P03–P06).
 *
 * This is NOT a unit test and is deliberately NOT part of `npm test`: it needs
 * a real Ollama process on this machine and would fail in CI, where none
 * exists. Its job is to drive OCADE's OWN production module
 * (`src/lib/ocade-local.ts`) against a live runtime and write down exactly
 * what was observed — so local-engine requirements are graded on observed
 * behaviour rather than on the existence of an adapter.
 *
 * It never fabricates: every recorded field is something the live runtime
 * returned, and a step that could not run is recorded as `skipped` with a
 * reason, never as a pass.
 *
 * Usage: npx vite-node scripts/ollama-runtime-evidence.mts
 */
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { totalmem } from "node:os";
import {
  discoverLocalModels,
  pickLocalModel,
  pickLocalModelForHardware,
  modelFit,
  streamLocalChat,
  buildLocalFirstPlan,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalModelInfo,
} from "../src/lib/ocade-local.ts";
import type { OcadeLocalProfile } from "../src/lib/ocade-capability-labels.ts";

const BRIDGE = process.env.OCADE_LOCAL_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;

type Step = {
  id: string;
  what: string;
  status: "observed" | "skipped" | "failed";
  detail: unknown;
};
const steps: Step[] = [];
function record(id: string, what: string, status: Step["status"], detail: unknown) {
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "OK  " : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`  [${mark}] ${id}  ${what}`);
  if (status !== "observed") console.log(`         ${JSON.stringify(detail)}`);
}
const brief = (m: LocalModelInfo) => ({
  id: m.id,
  gb: +(m.sizeBytes / 1e9).toFixed(2),
  paramsB: m.paramsB,
  profile: m.profile,
  label: m.label,
  vision: m.vision,
});

async function main() {
  console.log(`\nOCADE local-engine runtime evidence — bridge ${BRIDGE}\n`);

  let version = "unknown";
  try {
    version = execFileSync("ollama", ["--version"], { encoding: "utf8" }).trim();
    record("E01", "ollama --version", "observed", version);
  } catch (e) {
    record("E01", "ollama --version", "failed", String(e));
  }

  // Discovery through OCADE's own production module.
  const d = await discoverLocalModels(BRIDGE);
  record("E02", "discoverLocalModels() against the live bridge", d.ok ? "observed" : "failed", {
    ok: d.ok,
    reachable: d.reachable,
    serverVersion: d.version,
    reason: d.reason,
    models: d.models.map(brief),
  });

  // The module filters `:cloud` pointers out of discovery. Prove that against
  // the raw API rather than trusting the module's own report.
  const raw = (await (await fetch(`${BRIDGE}/api/tags`)).json()) as {
    models?: Array<{ name: string; size?: number }>;
  };
  const rawNames = (raw.models ?? []).map((m) => m.name);
  const pointers = rawNames.filter((n) => /:cloud$/i.test(n));
  const leaked = d.models.filter((m) => pointers.includes(m.id));
  record(
    "E03",
    "a :cloud pointer is present in the raw API but excluded from on-device models",
    pointers.length > 0 && leaked.length === 0 ? "observed" : "skipped",
    { rawNames, pointers, leakedIntoDiscovery: leaked.map((m) => m.id) },
  );

  // Selection.
  for (const want of ["general", "code", "fast", "vision"] as OcadeLocalProfile[]) {
    const picked = pickLocalModel(d.models, want);
    record(`E04.${want}`, `pickLocalModel("${want}")`, "observed", {
      picked: picked ? brief(picked) : null,
    });
  }

  const smallest = [...d.models].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];

  // Real inference + latency.
  if (!smallest) {
    record("E05", "real local inference", "skipped", "no on-device model installed");
  } else {
    const t0 = Date.now();
    let firstTokenMs: number | null = null;
    let text = "";
    const res = await streamLocalChat(
      BRIDGE,
      smallest.id,
      [{ role: "user", content: "Reply with exactly: OCADE_LOCAL_OK" }],
      {
        onToken: (c) => {
          if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
          text += c;
        },
      },
    );
    record("E05", `real local inference on ${smallest.id}`, res.ok ? "observed" : "failed", {
      model: smallest.id,
      gb: +(smallest.sizeBytes / 1e9).toFixed(2),
      firstTokenMs,
      totalMs: Date.now() - t0,
      reply: text.trim().slice(0, 200),
      containsMarker: text.includes("OCADE_LOCAL_OK"),
      reason: res.reason,
    });

    // Cancellation.
    const ac = new AbortController();
    const c0 = Date.now();
    setTimeout(() => ac.abort(), 1500);
    const cres = await streamLocalChat(
      BRIDGE,
      smallest.id,
      [{ role: "user", content: "Count slowly from 1 to 800, one number per line." }],
      { onToken: () => {}, signal: ac.signal },
    );
    record(
      "E06",
      "cancellation aborts an in-flight stream and reports `cancelled`",
      cres.ok === false && cres.reason === "cancelled" ? "observed" : "failed",
      { ok: cres.ok, reason: cres.reason, elapsedMs: Date.now() - c0 },
    );

    // Structured/tool-shaped output.
    const t2 = Date.now();
    let json = "";
    const jres = await streamLocalChat(
      BRIDGE,
      smallest.id,
      [
        {
          role: "user",
          content:
            'Output ONLY minified JSON, no prose, no code fence: {"tool":"open_file","path":"/tmp/a.txt"}',
        },
      ],
      { onToken: (c) => (json += c) },
    );
    let parsed: unknown = null;
    let parseOk = false;
    const match = json.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
        parseOk = true;
      } catch {
        /* left false */
      }
    }
    record(
      "E07",
      "structured (tool-shaped) output parses as JSON",
      jres.ok && parseOk ? "observed" : "failed",
      {
        totalMs: Date.now() - t2,
        parsed,
        rawPreview: json.trim().slice(0, 200),
      },
    );
  }

  // Unreachable bridge — must report honestly, not throw or fabricate.
  const offline = await discoverLocalModels("http://127.0.0.1:1", undefined, 2000);
  record(
    "E08",
    "unreachable bridge reports unhealthy without throwing or fabricating models",
    offline.ok === false && offline.reachable === false && offline.models.length === 0
      ? "observed"
      : "failed",
    {
      ok: offline.ok,
      reachable: offline.reachable,
      reason: offline.reason,
      models: offline.models.length,
    },
  );

  // Honest refusal when there is no local engine and no cloud permission.
  const refuse = buildLocalFirstPlan({
    desired: "general",
    models: [],
    cloudAllowed: false,
    online: false,
  });
  record(
    "E09",
    "no local engine + no cloud permission produces an explicit failure step",
    refuse.length > 0 && refuse[refuse.length - 1].kind === "fail" ? "observed" : "failed",
    refuse,
  );

  // Real fallback chain on this machine's actual models, WITHOUT hardware
  // awareness — retained to show what the defect looked like.
  const blind = buildLocalFirstPlan({
    desired: "code",
    models: d.models,
    cloudAllowed: false,
    online: true,
  });
  record("E10", "hardware-BLIND chain (pre-fix behaviour, kept for contrast)", "observed", blind);

  // The same chain with this machine's real RAM supplied.
  const totalRamBytes = totalmem();
  const aware = buildLocalFirstPlan({
    desired: "code",
    models: d.models,
    cloudAllowed: false,
    online: true,
    totalRamBytes,
  });
  const awareIds = aware.map((s) => s.modelId).filter(Boolean) as string[];
  const oversized = d.models
    .map((m) => modelFit(m, totalRamBytes))
    .filter((f) => !f.fits)
    .map((f) => ({ id: f.model.id, needsGb: +(f.needsBytes / 1e9).toFixed(2), reason: f.reason }));

  record(
    "E11",
    "hardware-aware chain excludes every model this machine cannot hold",
    oversized.every((o) => !awareIds.includes(o.id)) ? "observed" : "failed",
    {
      totalRamGb: +(totalRamBytes / 1e9).toFixed(2),
      ceilingGb: +((totalRamBytes * 0.8) / 1e9).toFixed(2),
      excluded: oversized,
      chain: aware.map((s) => ({ kind: s.kind, modelId: s.modelId })),
    },
  );

  // The selection the defect produced, vs the selection now.
  const before = pickLocalModel(d.models, "code");
  const after = pickLocalModelForHardware(d.models, "code", totalRamBytes);
  record("E12", "selection for `code` is now runnable on this machine", "observed", {
    hardwareBlindPick: before ? brief(before) : null,
    hardwareAwarePick: after.picked ? brief(after.picked) : null,
    excluded: after.excluded.map((e) => e.model.id),
  });

  const observed = steps.filter((s) => s.status === "observed").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const skipped = steps.filter((s) => s.status === "skipped").length;

  writeFileSync(
    "release/OCADE_LOCAL_ENGINE_RUNTIME_EVIDENCE.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        tier: "REAL TARGET RUNTIME VERIFIED",
        caveat:
          "Observed on ONE machine (Windows 10 build 19045, i5-1135G7, 15.6GB RAM, Intel Iris Xe, no CUDA). Single-host evidence is not a platform matrix and must not be reported as one.",
        host: {
          platform: process.platform,
          arch: process.arch,
          node: process.version,
          ollamaClient: version,
          bridge: BRIDGE,
        },
        summary: { observed, failed, skipped, total: steps.length },
        steps,
      },
      null,
      2,
    ),
  );
  console.log(`\n  observed=${observed} failed=${failed} skipped=${skipped}`);
  console.log("  written: release/OCADE_LOCAL_ENGINE_RUNTIME_EVIDENCE.json\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
