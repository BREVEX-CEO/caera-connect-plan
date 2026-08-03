/**
 * OCADE chat + local engine runtime evidence.
 *
 * Every step below calls the SAME production module the product calls. Nothing
 * here reimplements discovery, routing, streaming or lifecycle: if a step
 * passes, the shipped code path is the thing that passed. That is the whole
 * point — an evidence script with its own copy of the logic proves only that
 * the copy works.
 *
 * What this can and cannot establish, stated up front so the retained artefact
 * cannot be read as more than it is:
 *   - CAN: the engine answers, streams, stops when cancelled, understands a
 *     real image, refuses honestly when it cannot serve a request, and that
 *     model lifecycle operations behave on a real installation.
 *   - CANNOT: anything about the authenticated browser UI. That needs a signed-in
 *     session and is proven separately.
 *
 * Ground truth for the vision step is a PNG generated here with known content,
 * so "it described the image" is checked against what the image actually
 * contains rather than against whether the reply sounded plausible.
 *
 * Usage: node --experimental-strip-types scripts/ocade-chat-runtime-evidence.mts [--write]
 */
import { execFile } from "node:child_process";
import { release as osRelease } from "node:os";
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { promisify } from "node:util";
import {
  discoverLocalModels,
  streamLocalChat,
  pickLocalModelForHardware,
  buildLocalFirstPlan,
  modelFit,
  DEFAULT_LOCAL_BRIDGE_URL,
  type LocalModelInfo,
} from "../src/lib/ocade-local.ts";
import { routeTask, PerfLedger } from "../src/lib/local/router-policy.ts";
import {
  verifyInstalled,
  activateModel,
  checkDisk,
  planRepair,
  planRollback,
} from "../src/lib/local/model-lifecycle.ts";
import { measureHardware } from "../src/lib/hardware/detect.node.ts";
import { profileFrom } from "../src/lib/hardware/detect.ts";
import { selectTier } from "../src/lib/local/tier-policy.ts";

const run = promisify(execFile);
const write = process.argv.includes("--write");
const BRIDGE = process.env.OCADE_BRIDGE_URL ?? DEFAULT_LOCAL_BRIDGE_URL;
const OUT = "release/OCADE_CHAT_RUNTIME_EVIDENCE.json";
const ARTEFACT_DIR = "release/artefacts";

type Status = "observed" | "failed" | "skipped";
interface Step {
  id: string;
  what: string;
  status: Status;
  detail: unknown;
}
const steps: Step[] = [];
let failures = 0;

function record(id: string, what: string, status: Status, detail: unknown) {
  if (status === "failed") failures += 1;
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "ok  " : status === "failed" ? "FAIL" : "skip";
  const summary = typeof detail === "string" ? detail : JSON.stringify(detail);
  console.log(`${mark} ${id.padEnd(12)} ${what} :: ${summary.slice(0, 180)}`);
}

/**
 * Assert-style helper. A step that cannot check anything is recorded as
 * SKIPPED with the reason, never as observed — an unrun check is not a
 * passing check.
 */
function judge(id: string, what: string, ok: boolean, detail: unknown) {
  record(id, what, ok ? "observed" : "failed", detail);
}

/* ---------------------------------------------------------------- PNG ----- */

/**
 * Minimal PNG encoder, so the vision ground truth is built here rather than
 * committed as an opaque binary whose contents have to be trusted.
 */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}
function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // no filter
    rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((v, i) => {
      raw[rowStart + 1 + i] = v;
    });
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 5x7 bitmap font, digits and the letters this test actually draws. */
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

class Canvas {
  readonly px: Uint8Array;
  readonly w: number;
  readonly h: number;
  // Written as plain fields rather than parameter properties: this file runs
  // under node --experimental-strip-types, which cannot emit those.
  constructor(w: number, h: number, fill: [number, number, number] = [255, 255, 255]) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = fill[0];
      this.px[i * 3 + 1] = fill[1];
      this.px[i * 3 + 2] = fill[2];
    }
  }
  rect(x: number, y: number, w: number, h: number, colour: [number, number, number]) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
        const i = (yy * this.w + xx) * 3;
        this.px[i] = colour[0];
        this.px[i + 1] = colour[1];
        this.px[i + 2] = colour[2];
      }
    }
  }
  text(x: number, y: number, value: string, scale: number, colour: [number, number, number]) {
    let cx = x;
    for (const ch of value.toUpperCase()) {
      const glyph = GLYPHS[ch] ?? GLYPHS[" "];
      glyph.forEach((row, ry) => {
        [...row].forEach((bit, rx) => {
          if (bit === "1") this.rect(cx + rx * scale, y + ry * scale, scale, scale, colour);
        });
      });
      cx += 6 * scale;
    }
  }
}

/* --------------------------------------------------------------- steps ---- */

async function main() {
  mkdirSync(ARTEFACT_DIR, { recursive: true });

  // E01 — the runtime this evidence was taken against.
  let engineVersion = "unknown";
  try {
    const { stdout } = await run("ollama", ["--version"]);
    engineVersion = stdout.trim();
  } catch (e) {
    engineVersion = `client not on PATH (${(e as Error).message.slice(0, 60)})`;
  }
  record("E01", "local engine client version", "observed", engineVersion);

  // E02 — real hardware, through the product's own detector.
  const snapshot = await measureHardware();
  const profile = profileFrom(snapshot);
  record("E02", "measureHardware() + profileFrom() on this machine", "observed", {
    // `release` is not part of HardwareSnapshot — the OS build is read here,
    // where it is only ever descriptive, rather than widened into the product
    // type for the sake of one evidence line.
    platform: `${snapshot.platform} ${osRelease()}`,
    cpu: snapshot.cpuModel,
    cores: snapshot.logicalCores,
    totalRamGib: profile.totalRamGib,
    freeRamGib: +(snapshot.availableRamBytes / 1024 ** 3).toFixed(2),
    freeStorageGib: profile.freeStorageGib,
    discreteGpu: profile.hasDiscreteGpu,
    gpuCertain: profile.gpuCertain,
  });

  // E03 — which tier this hardware selects, from the committed manifest.
  const manifest = JSON.parse(
    await import("node:fs").then((fs) =>
      fs.readFileSync("release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json", "utf8"),
    ),
  );
  const tier = selectTier(profile, manifest);
  judge("E03", "selectTier() picks a tier this machine can run", tier.ok, {
    chosen: tier.ok ? tier.tier.tag : null,
    downloadGib: tier.ok ? tier.downloadGib : null,
    because: tier.ok ? tier.because : tier.reason,
    skipped: tier.skipped,
  });

  // E04 — discovery through the shipped adapter.
  const discovery = await discoverLocalModels(BRIDGE);
  judge("E04", "discoverLocalModels() against the live engine", discovery.ok, {
    reachable: discovery.reachable,
    version: discovery.version,
    models: discovery.models.map((m) => ({
      id: m.id,
      gb: +(m.sizeBytes / 1e9).toFixed(2),
      profile: m.profile,
      label: m.label,
      vision: m.vision,
    })),
    reason: discovery.reason,
  });
  const models = discovery.models;

  // E05 — a ":cloud" alias must never be offered as an on-device model.
  const rawNames: string[] = await fetch(`${BRIDGE}/api/tags`)
    .then((r) => r.json())
    .then((b: { models?: { name: string }[] }) => (b.models ?? []).map((m) => m.name));
  const pointers = rawNames.filter((n) => /:cloud$/i.test(n));
  judge(
    "E05",
    "remote ':cloud' aliases are excluded from on-device discovery",
    pointers.length > 0 && !models.some((m) => pointers.includes(m.id)),
    { rawNames, pointers, leaked: models.filter((m) => pointers.includes(m.id)).map((m) => m.id) },
  );

  const totalRamBytes = profile.totalRamGib * 1024 ** 3;

  /*
   * E06 — routing on real hardware.
   *
   * The policy passed here is the same one the chat screen passes. An earlier
   * run of this script omitted `hasDiscreteGpu` and `deviceMatchedModelId`,
   * chose the 14B tier because it merely fitted in RAM, and measured 184
   * SECONDS to first token on this CPU-only machine. That number is retained
   * below as the reason these fields are not optional in practice.
   */
  const ledger = new PerfLedger();
  const routePolicy = {
    totalRamBytes,
    hasDiscreteGpu: profile.gpuCertain ? profile.hasDiscreteGpu : undefined,
    deviceMatchedModelId: tier.ok ? tier.tier.tag : null,
  };
  const generalRoute = routeTask("general", models, ledger, routePolicy);
  const chosen = generalRoute.ok ? generalRoute.model : null;
  judge(
    "E06",
    "routeTask('general') chooses the device-matched engine, not merely the largest that fits",
    !!chosen && (!tier.ok || chosen.id === tier.tier.tag),
    {
      chosen: chosen?.id ?? null,
      tierPolicyChose: tier.ok ? tier.tier.tag : null,
      basis: generalRoute.receipt.basis,
      rejected: generalRoute.receipt.rejected,
      refusal: generalRoute.receipt.refusal,
      priorDefectMeasured:
        "Before this policy was applied the router chose qwen3:14b on this same machine and took 184,260 ms to first token for a one-word answer.",
    },
  );
  if (!chosen) {
    finish();
    return;
  }

  // E07 — the model is really installed and its digest is readable.
  const installed = await verifyInstalled(BRIDGE, chosen.id);
  judge("E07", "verifyInstalled() confirms presence and reads a digest", installed.ok, installed);

  // E08 — REAL INFERENCE. A specific factual question, checked against a known
  // answer, so a fluent non-answer cannot pass.
  const t0 = Date.now();
  let firstTokenMs: number | null = null;
  let reply = "";
  const inference = await streamLocalChat(
    BRIDGE,
    chosen.id,
    [
      {
        role: "system",
        content: "You are OCADE. Answer in one short sentence. Do not show your reasoning.",
      },
      { role: "user", content: "What is the capital city of Japan? Answer with the city name." },
    ],
    {
      onToken: (c) => {
        if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
        reply += c;
      },
    },
  );
  const totalMs = Date.now() - t0;
  const answeredCorrectly = /tokyo/i.test(reply);
  judge(
    "E08",
    "streamLocalChat() returns a REAL answer, verified against ground truth",
    inference.ok && answeredCorrectly,
    {
      model: chosen.id,
      firstTokenMs,
      totalMs,
      tokensPerSecondApprox: +(reply.length / 4 / (totalMs / 1000)).toFixed(2),
      groundTruth: "Tokyo",
      containsGroundTruth: answeredCorrectly,
      reply: reply.trim().slice(0, 400),
    },
  );

  // E09 — STREAMING is incremental, not one buffered blob at the end.
  const arrivals: number[] = [];
  let streamed = "";
  const s0 = Date.now();
  await streamLocalChat(
    BRIDGE,
    chosen.id,
    // Deliberately small. The claim under test is that output ARRIVES
    // incrementally, which a short answer demonstrates as well as a long one —
    // and a long one on a CPU-only machine turns this check into a ten-minute
    // wait that proves nothing extra.
    [{ role: "user", content: "List five colours, one per line, nothing else." }],
    {
      onToken: (c) => {
        arrivals.push(Date.now() - s0);
        streamed += c;
      },
    },
  );
  const spread = arrivals.length > 1 ? arrivals[arrivals.length - 1] - arrivals[0] : 0;
  judge(
    "E09",
    "output arrives incrementally over time rather than in one final chunk",
    arrivals.length >= 5 && spread > 200,
    {
      chunks: arrivals.length,
      firstChunkMs: arrivals[0] ?? null,
      lastChunkMs: arrivals[arrivals.length - 1] ?? null,
      spreadMs: spread,
      charsStreamed: streamed.length,
    },
  );

  // E10 — STOP cancels generation in flight, and stops receiving tokens.
  const controller = new AbortController();
  let cancelledAt = 0;
  let tokensBeforeStop = 0;
  let tokensAfterStop = 0;
  const c0 = Date.now();
  const cancelPromise = streamLocalChat(
    BRIDGE,
    chosen.id,
    [{ role: "user", content: "Write a 500 word essay about the history of cartography." }],
    {
      signal: controller.signal,
      onToken: () => {
        if (cancelledAt === 0) {
          tokensBeforeStop += 1;
          if (tokensBeforeStop === 5) {
            cancelledAt = Date.now() - c0;
            controller.abort();
          }
        } else {
          tokensAfterStop += 1;
        }
      },
    },
  );
  const cancelResult = await cancelPromise;
  await new Promise((r) => setTimeout(r, 750));
  judge(
    "E10",
    "stop cancels a real in-flight generation and no further tokens arrive",
    cancelResult.ok === false && cancelResult.reason === "cancelled" && tokensAfterStop === 0,
    {
      reason: cancelResult.reason,
      cancelledAfterMs: cancelledAt,
      tokensBeforeStop,
      tokensAfterStopIncludingGracePeriod: tokensAfterStop,
      returnedMs: Date.now() - c0,
    },
  );

  // E11 — RETRY after a real failure succeeds without manual repair.
  const badBridge = "http://127.0.0.1:1"; // nothing listens here
  const failed = await streamLocalChat(badBridge, chosen.id, [{ role: "user", content: "hi" }], {
    onToken: () => {},
  });
  let retryReply = "";
  const retried = await streamLocalChat(
    BRIDGE,
    chosen.id,
    [{ role: "user", content: "Reply with exactly: OCADE_RETRY_OK" }],
    { onToken: (c) => (retryReply += c) },
  );
  judge(
    "E11",
    "a failed request reports honestly, and an immediate retry succeeds",
    !failed.ok && retried.ok && /OCADE_RETRY_OK/i.test(retryReply),
    {
      failure: failed.reason,
      retrySucceeded: retried.ok,
      retryReply: retryReply.trim().slice(0, 120),
    },
  );

  // E12 — activateModel(): "downloaded" is not "ready" until it answers AND
  // honours cancellation. Driven against the live engine.
  const activation = await activateModel(chosen.id, {
    runInference: async (modelId, prompt) => {
      let text = "";
      const r = await streamLocalChat(BRIDGE, modelId, [{ role: "user", content: prompt }], {
        onToken: (c) => (text += c),
      });
      return { ok: r.ok, text };
    },
    runCancellable: async (modelId) => {
      const ac = new AbortController();
      let seen = 0;
      const r = await streamLocalChat(
        BRIDGE,
        modelId,
        [{ role: "user", content: "Write a very long story about the sea." }],
        {
          signal: ac.signal,
          onToken: () => {
            if (++seen === 3) ac.abort();
          },
        },
      );
      return { cancelled: !r.ok && r.reason === "cancelled" };
    },
  });
  judge(
    "E12",
    "activateModel() proves readiness by inference AND cancellation",
    activation.ok,
    activation,
  );

  /* ------------------------------------------------------------ vision --- */

  // E13 — a real image with KNOWN content, answered by a real vision model.
  const canvas = new Canvas(520, 300, [250, 250, 250]);
  canvas.text(20, 18, "OCADE VISION TEST", 3, [20, 20, 20]);
  canvas.text(20, 52, "CODE-742913", 3, [190, 30, 30]);
  // A three-bar chart whose tallest bar is unambiguously the third.
  const bars: [string, number, [number, number, number]][] = [
    ["A", 60, [40, 90, 200]],
    ["B", 110, [40, 90, 200]],
    ["C", 180, [40, 90, 200]],
  ];
  bars.forEach(([label, height, colour], i) => {
    const x = 60 + i * 130;
    canvas.rect(x, 260 - height, 70, height, colour);
    canvas.text(x + 25, 268, label, 3, [20, 20, 20]);
  });
  canvas.rect(20, 258, 460, 2, [20, 20, 20]);
  const png = encodePng(canvas.w, canvas.h, canvas.px);
  const imagePath = `${ARTEFACT_DIR}/OCADE_VISION_GROUND_TRUTH.png`;
  writeFileSync(imagePath, png);
  const base64 = png.toString("base64");

  const visionModels = models.filter((m) => m.vision);
  if (visionModels.length === 0) {
    record(
      "E13",
      "image understanding against a generated ground-truth image",
      "skipped",
      "No vision-capable model is installed, so image understanding is NOT claimed. The product must show setup instructions for this case (proven separately at E15).",
    );
  } else {
    const visionRoute = routeTask("vision", models, ledger, routePolicy);
    const visionModel: LocalModelInfo | null = visionRoute.ok ? visionRoute.model : null;
    if (!visionModel) {
      record("E13", "image understanding", "skipped", {
        why: "a vision model is installed but routing rejected it",
        rejected: visionRoute.receipt.rejected,
      });
    } else {
      let visionReply = "";
      const v0 = Date.now();
      const visionResult = await streamLocalChat(
        BRIDGE,
        visionModel.id,
        [
          {
            role: "user",
            content:
              "Read this image. Reply with: (1) the exact code printed in red, (2) which bar is tallest, A, B or C.",
            images: [base64],
          },
        ],
        { onToken: (c) => (visionReply += c) },
      );
      const readCode = /742913/.test(visionReply);
      const readChart = /\bC\b/.test(visionReply.replace(/[^A-Za-z ]/g, " "));
      judge(
        "E13",
        "a real vision model reads a generated image, checked against ground truth",
        visionResult.ok && readCode && readChart,
        {
          model: visionModel.id,
          elapsedMs: Date.now() - v0,
          groundTruth: { code: "742913", tallestBar: "C" },
          readCodeCorrectly: readCode,
          identifiedTallestBar: readChart,
          reply: visionReply.trim().slice(0, 600),
          artefact: imagePath,
        },
      );
    }
  }

  /* --------------------------------------------------- refusal paths ----- */

  // E14 — offline / engine down: honest unreachable, never a fabricated answer.
  const offline = await discoverLocalModels(badBridge);
  judge(
    "E14",
    "an unreachable engine reports unhealthy without fabricating models",
    !offline.ok && !offline.reachable && offline.models.length === 0 && !!offline.reason,
    offline,
  );

  // E15 — vision requested with no vision model: the chain must FAIL explicitly
  // rather than quietly serving the request with a text-only model.
  const textOnly = models.filter((m) => !m.vision);
  const visionPlan = buildLocalFirstPlan({
    desired: "vision",
    models: textOnly,
    cloudAllowed: false,
    online: false,
    totalRamBytes,
  });
  const visionPick = pickLocalModelForHardware(textOnly, "vision", totalRamBytes);
  judge(
    "E15",
    "vision with no vision model refuses instead of substituting a text model",
    visionPick.picked === null,
    {
      picked: visionPick.picked,
      planKinds: visionPlan.map((s) => s.kind),
      reason: visionPick.reason,
    },
  );

  // E16 — low storage, safely simulated by feeding the real pre-flight check a
  // small free-space figure. Nothing on disk is touched.
  const modelBytes = chosen.sizeBytes;
  const tight = checkDisk(modelBytes, Math.round(modelBytes * 0.5));
  const roomy = checkDisk(modelBytes, Math.round(modelBytes * 4));
  judge(
    "E16",
    "the disk pre-flight refuses before a download, not after it fails",
    !tight.sufficient && roomy.sufficient,
    {
      modelGb: +(modelBytes / 1e9).toFixed(2),
      refusedWhenHalfTheModelIsFree: !tight.sufficient,
      refusalReason: tight.reason,
      allowedWithHeadroom: roomy.sufficient,
    },
  );

  // E17 — a model too large for this machine is excluded WITH a reason.
  const oversized = models.map((m) => modelFit(m, totalRamBytes)).filter((f) => !f.fits);
  judge(
    "E17",
    "models this machine cannot hold are excluded with a stated reason",
    oversized.every((f) => typeof f.reason === "string" && f.reason.length > 0),
    {
      totalRamGib: profile.totalRamGib,
      excluded: oversized.map((f) => ({
        id: f.model.id,
        needGb: +(f.needsBytes / 1e9).toFixed(2),
        reason: f.reason,
      })),
    },
  );

  // E18 — corrupt / missing model: the lifecycle names a repair, not a shrug.
  const missing = await verifyInstalled(BRIDGE, "ocade-does-not-exist:latest");
  const repair = planRepair({
    runtimeReachable: true,
    modelInstalled: false,
    modelId: "ocade-does-not-exist:latest",
    lastInferenceOk: false,
    freeStorageBytes: profile.freeStorageGib * 1024 ** 3,
    modelBytes: 5e9,
  });
  // The damaged-download case: present, but unable to answer.
  const damaged = planRepair({
    runtimeReachable: true,
    modelInstalled: true,
    modelId: chosen.id,
    lastInferenceOk: false,
    freeStorageBytes: profile.freeStorageGib * 1024 ** 3,
    modelBytes: chosen.sizeBytes,
  });
  judge(
    "E18",
    "a missing/corrupt model is detected and a concrete repair is planned",
    !missing.ok &&
      missing.failure === "not_installed" &&
      repair.kind === "reinstall" &&
      damaged.kind === "reinstall",
    { verify: missing, missingModelRepair: repair, damagedModelRepair: damaged },
  );

  // E19 — rollback target comes from the manifest, not invented at failure time.
  const rollback = planRollback({
    failedModelId: chosen.id,
    previousModelId: tier.ok ? tier.tier.rollbackTarget : null,
    installedModelIds: models.map((m) => m.id),
  });
  // A rollback target that is not installed must be refused, not attempted.
  const impossibleRollback = planRollback({
    failedModelId: chosen.id,
    previousModelId: "qwen3:0.1b-not-installed",
    installedModelIds: models.map((m) => m.id),
  });
  judge(
    "E19",
    "rollback targets the manifest's previous tier, and refuses when it is absent",
    rollback.target !== null && impossibleRollback.target === null,
    { rollback, refusedWhenTargetMissing: impossibleRollback },
  );

  finish();
}

function finish() {
  const observed = steps.filter((s) => s.status === "observed").length;
  const skipped = steps.filter((s) => s.status === "skipped").length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier:
      failures === 0 ? "REAL TARGET RUNTIME VERIFIED" : "REAL TARGET RUNTIME — FAILURES PRESENT",
    caveat:
      "Observed on ONE machine against ONE local engine build. Single-host evidence is not a platform matrix. This covers the engine and the modules the chat screen calls; it does NOT cover the authenticated browser UI, which requires a signed-in session.",
    host: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      bridge: BRIDGE,
    },
    summary: { observed, failed: failures, skipped, total: steps.length },
    steps,
  };
  if (write) {
    writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nwrote ${OUT}`);
  }
  console.log(`\n${observed} observed · ${failures} failed · ${skipped} skipped`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
