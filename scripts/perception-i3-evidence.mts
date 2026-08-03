/**
 * I3 evidence: sensitive-region redaction, ambiguity refusal, and post-action
 * verification that catches BOTH a real success and a planted failure.
 *
 * THREE THINGS, EACH PROVEN BY ITS OPPOSITE
 * -----------------------------------------
 * REDACTION is proven by reading the evidence back. The window shows a real
 * secret in a field named "Password". OCR is run on the raw capture and on the
 * retained (redacted) image: the secret must be legible in the first and absent
 * from the second. Asserting only that a redaction rectangle was recorded would
 * prove nothing about the pixels anyone actually keeps.
 *
 * REFUSAL is proven against a control. Two independently clickable controls are
 * both accessibly named "Remove", so that description must be refused with both
 * candidates named. A uniquely named control must still resolve, or "refuses"
 * would just mean "broken".
 *
 * VERIFICATION is proven by planting a failure. A real click on Save must come
 * back completed_verified. Then an action is executed that deliberately clicks
 * the DISABLED Archive button instead of its target — the executor reports
 * success, and verification has to catch that the screen never changed. If that
 * came back verified, every other verified result in this series would be
 * worthless.
 *
 * Usage: node --experimental-strip-types is NOT enough here (perception.ts uses
 * extensionless imports); run with vite-node:
 *   npx vite-node scripts/perception-i3-evidence.mts -- [--write]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  executeMarkedTarget,
  fusePerceptionFrame,
  selectMarkerByDescription,
  type PerceptionFrame,
  type RawPerceptionElement,
  type SetOfMarkPlan,
} from "../src/lib/control/perception.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_I3_REDACTION_REFUSAL_VERIFICATION.json";
const HOST = "scripts/perception/capture-host.ps1";
const UIA = "scripts/perception/uia-host.ps1";
const DRAW = "scripts/perception/draw-marks.ps1";
const WIN = "scripts/perception/interactive-window.ps1";
const HANDLE = join(tmpdir(), "ocade-interactive-window.json");
const SECRET = "hunter2-SECRET-9781";

const ps = (a: string[]): Record<string, unknown> => {
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...a], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse((out.trim().split("\n").filter(Boolean).pop() ?? "{}").replace(/^﻿/, ""));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));

function closeWindows() {
  try {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-Process powershell -EA SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'OCADE-*' } | Stop-Process -Force",
    ]);
  } catch {
    /* nothing running */
  }
}

async function launch() {
  closeWindows();
  rmSync(HANDLE, { force: true });
  execFileSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${WIN}'`,
  ]);
  for (let i = 0; i < 80 && !existsSync(HANDLE); i++) await sleep(300);
  if (!existsSync(HANDLE)) throw new Error("the interactive window never started");
  await sleep(1500);
  return readJson(HANDLE) as { hwnd: number };
}

let observeCount = 0;
function observe(hwnd: number, tag = "obs"): { cap: Record<string, unknown>; frame: PerceptionFrame } {
  const path = join(tmpdir(), `ocade-i3-${tag}-${observeCount++}.png`);
  const cap = ps(["-File", HOST, "-Mode", "capture", "-Hwnd", String(hwnd), "-Path", path]);
  const uia = ps(["-File", UIA, "-Mode", "elements", "-Hwnd", String(hwnd)]);
  const w = cap.window as { visibleRect: { x: number; y: number; w: number; h: number }; monitorScalePercent: number };
  const img = cap.image as { width: number; height: number };
  const scale = w.monitorScalePercent / 100;
  const frame: PerceptionFrame = {
    observedAt: new Date().toISOString(),
    display: { displayId: "DISPLAY1", boundsPhysical: { x: 0, y: 0, width: 1920, height: 1080 }, scale, rotation: 0 },
    window: {
      appId: "ocade.perception.testwindow",
      windowId: String(hwnd),
      title: "OCADE-INTERACTIVE",
      boundsPhysical: { x: w.visibleRect.x, y: w.visibleRect.y, width: w.visibleRect.w, height: w.visibleRect.h },
      displayId: "DISPLAY1",
      displayScale: scale,
    },
    screenshot: {
      sha256: String(cap.sha256),
      perceptualHash: String(cap.perceptualHash),
      width: img.width,
      height: img.height,
      protectedRegions: [],
    },
    accessibility: (uia.elements as RawPerceptionElement[]).map((e) => ({ ...e })),
    ocr: [],
    icons: [],
    vision: [],
  };
  return { cap, frame };
}

const fuse = (frame: PerceptionFrame): SetOfMarkPlan => {
  const r = fusePerceptionFrame(frame);
  if (!r.ok) throw new Error(`fusePerceptionFrame refused: ${r.reason}`);
  return r.data;
};

const ocrOf = (path: string) => String(ps(["-File", HOST, "-Mode", "ocr", "-Path", path]).text ?? "");

// ------------------------------------------------------------------- run

const win = await launch();
const first = observe(win.hwnd, "plan");
const plan = fuse(first.frame);
let failed = false;

// ---- 1. REDACTION -------------------------------------------------------

const rawPath = String((first.cap as { path: string }).path);
const redactedPath = join(tmpdir(), "ocade-i3-redacted.png");
const capWin = first.cap.window as { visibleRect: { x: number; y: number }; renderScale: number };
const planForDraw = join(tmpdir(), "ocade-i3-plan.json");
writeFileSync(
  planForDraw,
  JSON.stringify({
    originX: capWin.visibleRect.x,
    originY: capWin.visibleRect.y,
    renderScale: capWin.renderScale,
    markers: plan.markers,
    redactions: plan.redactions,
  }),
);
const drawn = ps(["-File", DRAW, "-ImagePath", rawPath, "-OutPath", redactedPath, "-PlanPath", planForDraw]);

const ocrRaw = ocrOf(rawPath);
const ocrRedacted = ocrOf(redactedPath);
const secretInRaw = ocrRaw.includes(SECRET);
const secretInRedacted = ocrRedacted.includes(SECRET);
// The plan itself must never carry the secret either.
const secretInPlan = JSON.stringify(plan).includes(SECRET) || JSON.stringify(plan).toLowerCase().includes("password");
const redactionProven = secretInRaw && !secretInRedacted && !secretInPlan;
if (!redactionProven) failed = true;

// ---- 2. AMBIGUITY REFUSAL ----------------------------------------------

const ambiguous = selectMarkerByDescription(plan, "Remove");
const unique = selectMarkerByDescription(plan, "Save");
const refusalProven =
  !ambiguous.ok && ambiguous.candidateNumbers.length === 2 && unique.ok === true;
if (!refusalProven) failed = true;

// ---- 3. POST-ACTION VERIFICATION ---------------------------------------

const saveMarker = unique.ok ? unique.target : null;
if (!saveMarker) throw new Error("could not resolve the Save marker for the action test");

/** Verify by reading the status line out of a fresh capture with OCR. */
async function verifyStatus(expected: string, hwnd: number) {
  const shot = join(tmpdir(), `ocade-i3-verify-${observeCount}.png`);
  ps(["-File", HOST, "-Mode", "capture", "-Hwnd", String(hwnd), "-Path", shot]);
  const text = ocrOf(shot);
  return { verified: text.includes(expected), evidence: `status line read back: ${JSON.stringify(text.slice(0, 160))}` };
}

// --- 3a. a REAL action that genuinely succeeds
const realBefore = observe(win.hwnd, "real-before");
const realOutcome = await executeMarkedTarget({
  planned: fuse(realBefore.frame),
  markerId: saveMarker.markerId,
  current: realBefore.frame,
  async execute(target) {
    const p = target.physicalPoint;
    ps(["-File", UIA, "-Mode", "click", "-Hwnd", String(win.hwnd), "-X", String(p.x), "-Y", String(p.y)]);
    return { ok: true, evidence: `clicked ${p.x},${p.y}` };
  },
  async reobserve() {
    await sleep(700);
    return observe(win.hwnd, "real-after").frame;
  },
  async verify() {
    return verifyStatus("Saved quarterly-report", win.hwnd);
  },
});

// --- 3b. a PLANTED failure: the executor clicks the DISABLED control instead
const plantedBefore = observe(win.hwnd, "planted-before");
const plantedPlan = fuse(plantedBefore.frame);
const archive = plantedBefore.frame.accessibility.find(
  (e) => e.name === "Archive" && e.role === "Button",
);
const exportMarker = selectMarkerByDescription(plantedPlan, "Export");
const plantedOutcome = await executeMarkedTarget({
  planned: plantedPlan,
  markerId: exportMarker.ok ? exportMarker.target.markerId : "mark-none",
  current: plantedBefore.frame,
  async execute() {
    // Deliberately wrong: click the disabled Archive button. A real click that
    // lands on a control which cannot act — the executor still reports success.
    const x = Math.round(archive!.bounds.x + archive!.bounds.width / 2);
    const y = Math.round(archive!.bounds.y + archive!.bounds.height / 2);
    ps(["-File", UIA, "-Mode", "click", "-Hwnd", String(win.hwnd), "-X", String(x), "-Y", String(y)]);
    return { ok: true, evidence: `clicked the disabled Archive control at ${x},${y}` };
  },
  async reobserve() {
    await sleep(700);
    return observe(win.hwnd, "planted-after").frame;
  },
  async verify() {
    return verifyStatus("Exported quarterly-report", win.hwnd);
  },
});

const realVerified = realOutcome.status === "completed_verified";
const plantedCaught = plantedOutcome.status !== "completed_verified";
if (!realVerified || !plantedCaught) failed = true;

closeWindows();

const doc = {
  schemaVersion: 1,
  item: "I3 - sensitive-region redaction, ambiguity refusal, post-action verification",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  redaction: {
    secretShownOnScreen: SECRET,
    rawCapture: rawPath,
    retainedRedactedImage: redactedPath,
    redactedRegionsPainted: drawn.redacted,
    secretLegibleInRawCapture: secretInRaw,
    secretPresentInRetainedEvidence: secretInRedacted,
    secretOrFieldNamePresentInPlan: secretInPlan,
    proven: redactionProven,
    note:
      "Proven by reading the evidence back with OCR, not by trusting that a rectangle was recorded. The secret is legible in the raw capture and absent from the retained image, and the fused plan carries neither the secret nor the field name — perception.ts replaces a protected element's name with [protected] before any overlay or structured output exists.",
  },
  ambiguityRefusal: {
    description: "Remove",
    refused: !ambiguous.ok,
    reason: ambiguous.ok ? null : ambiguous.reason,
    candidateNumbers: ambiguous.ok ? [] : ambiguous.candidateNumbers,
    selectedAnything: ambiguous.ok,
    uniqueControlStillResolves: unique.ok,
    proven: refusalProven,
    note:
      "Two independently clickable controls are both named Remove. The refusal names both candidates so the caller can disambiguate by number, and a uniquely named control still resolves — so this is a refusal, not a broken selector.",
  },
  postActionVerification: {
    realAction: {
      target: saveMarker.name,
      status: realOutcome.status,
      evidence: "evidence" in realOutcome ? realOutcome.evidence : [],
      reason: "reason" in realOutcome ? realOutcome.reason : null,
      correctlyVerified: realVerified,
    },
    plantedFailure: {
      intendedTarget: exportMarker.ok ? exportMarker.target.name : null,
      whatTheExecutorActuallyDid: "clicked the disabled Archive control",
      status: plantedOutcome.status,
      reason: "reason" in plantedOutcome ? plantedOutcome.reason : null,
      correctlyCaught: plantedCaught,
    },
    note:
      "The click is a real mouse press at a real screen coordinate, not a UIA Invoke — Invoke would activate the control directly and could never miss, which is exactly the failure verification exists to catch. In the planted case the executor reports success and the screen does not change, and the outcome is not completed_verified.",
  },
};

console.log(`redaction : secret in raw=${secretInRaw} in retained=${secretInRedacted} inPlan=${secretInPlan} -> ${redactionProven}`);
console.log(`refusal   : refused=${!ambiguous.ok} candidates=${ambiguous.ok ? "-" : ambiguous.candidateNumbers.join(",")} uniqueStillWorks=${unique.ok}`);
console.log(`real      : ${realOutcome.status} (correct=${realVerified})`);
console.log(`planted   : ${plantedOutcome.status} (caught=${plantedCaught})`);
console.log(`I3: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
