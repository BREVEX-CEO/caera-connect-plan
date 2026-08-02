/**
 * I2 evidence: Set-of-Mark over real interactive elements, selection by number,
 * and keyboard reachability of the same target.
 *
 * This is where the capture/UIA host from I1 is finally WIRED to
 * src/lib/control/perception.ts. Real UI Automation observations are fed into
 * `fusePerceptionFrame`, and the markers it returns are what gets drawn. The
 * module has always described itself as accepting "bounded observations from an
 * approved capture/UIA/OCR/icon/vision host"; until now nothing supplied them.
 *
 * WHAT THIS HAS TO AVOID PROVING BY ACCIDENT
 * ------------------------------------------
 * The numbers are assigned in reading order, and the layout used to be fixed —
 * so anyone who had read the window's source could name "the number of the Save
 * button" without ever looking at the image. The window now shuffles its four
 * buttons on every launch, so the mapping is different each run and the only
 * way to answer is to read the labels in the picture.
 *
 * Ground truth is written to a SEPARATE file from the labelled image, and the
 * selection is checked with `--claim`, so the answer is recorded before it is
 * marked rather than after.
 *
 * Usage:
 *   node --experimental-strip-types scripts/perception-i2-evidence.mts            # plan + draw
 *   node --experimental-strip-types scripts/perception-i2-evidence.mts --claim 5 --target Save [--write]
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fusePerceptionFrame,
  resolveSetOfMarkTarget,
  type PerceptionFrame,
  type RawPerceptionElement,
} from "../src/lib/control/perception.ts";

const args = process.argv.slice(2);
const write = args.includes("--write");
const claimIdx = args.indexOf("--claim");
const claim = claimIdx >= 0 ? Number(args[claimIdx + 1]) : null;
const targetIdx = args.indexOf("--target");
const targetName = targetIdx >= 0 ? args[targetIdx + 1] : "Save";

const OUT = "release/OCADE_I2_SET_OF_MARK.json";
const HOST = "scripts/perception/capture-host.ps1";
const UIA = "scripts/perception/uia-host.ps1";
const DRAW = "scripts/perception/draw-marks.ps1";
const WIN = "scripts/perception/interactive-window.ps1";
const HANDLE = join(tmpdir(), "ocade-interactive-window.json");
const PLAN_FOR_DRAW = join(tmpdir(), "ocade-i2-plan.json");
const SHOT = join(tmpdir(), "ocade-i2-shot.png");
const LABELLED = join(tmpdir(), "ocade-i2-labelled.png");
const TRUTH = "release/OCADE_I2_GROUND_TRUTH.json";

const ps = (a: string[]): Record<string, unknown> => {
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...a], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = out.trim().split("\n").filter(Boolean).pop() ?? "{}";
  return JSON.parse(line.replace(/^﻿/, ""));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));

function closeWindows() {
  try {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'OCADE-*' } | Stop-Process -Force",
    ]);
  } catch {
    /* nothing running */
  }
}

async function launch(): Promise<{ hwnd: number; tabOrder: string[]; buttonOrderLeftToRight: string[] }> {
  closeWindows();
  rmSync(HANDLE, { force: true });
  /*
   * Start-Process, not a direct spawn.
   *
   * The observing run has to leave the window ALIVE for the claiming run to
   * score against. A child spawned directly stays in this shell's process group
   * and is killed the moment the invocation ends — which is exactly what
   * happened: the second run found no window at all and hung trying to capture a
   * dead handle. Start-Process detaches it from the group so it outlives us.
   */
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
  return readJson(HANDLE);
}

/** Build a PerceptionFrame from the live capture + UI Automation tree. */
function buildFrame(
  cap: Record<string, unknown>,
  uiaElements: RawPerceptionElement[],
  title: string,
): PerceptionFrame {
  const w = cap.window as {
    visibleRect: { x: number; y: number; w: number; h: number };
    monitorScalePercent: number;
  };
  const img = cap.image as { width: number; height: number };
  const bounds = { x: w.visibleRect.x, y: w.visibleRect.y, width: w.visibleRect.w, height: w.visibleRect.h };
  const scale = w.monitorScalePercent / 100;
  return {
    observedAt: new Date().toISOString(),
    display: {
      displayId: "DISPLAY1",
      boundsPhysical: { x: 0, y: 0, width: 1920, height: 1080 },
      scale,
      rotation: 0,
    },
    window: {
      appId: "ocade.perception.testwindow",
      windowId: String(cap.hwnd ?? title),
      title,
      boundsPhysical: bounds,
      displayId: "DISPLAY1",
      displayScale: scale,
    },
    screenshot: {
      sha256: String(cap.sha256),
      /*
       * A REAL perceptual hash, from the capture host.
       *
       * This used to be `sha256.slice(0, 16)` — something shaped like a
       * perceptual hash that behaved like a cryptographic one. The fingerprint
       * then moved whenever any pixel moved, so the blinking caret in the
       * focused text box made the executor refuse to act at random, depending
       * on which half of the blink cycle the capture caught. The host now
       * computes a dHash; see the note there.
       */
      perceptualHash: String(cap.perceptualHash),
      width: img.width,
      height: img.height,
      protectedRegions: [],
    },
    accessibility: uiaElements,
    ocr: [],
    icons: [],
    vision: [],
  };
}

function observe(hwnd: number, title: string) {
  const cap = ps(["-File", HOST, "-Mode", "capture", "-Hwnd", String(hwnd), "-Path", SHOT]);
  const uia = ps(["-File", UIA, "-Mode", "elements", "-Hwnd", String(hwnd)]);
  const elements = (uia.elements as RawPerceptionElement[]).map((e) => ({ ...e }));
  return { cap, elements, frame: buildFrame({ ...cap, hwnd }, elements, title) };
}

// ------------------------------------------------------------------ run

/*
 * The plan is persisted between the two invocations, and that is not a
 * convenience.
 *
 * A first version relaunched the window on every run. So the claim "Save is 4",
 * made by looking at one labelled image, was then scored against a SECOND
 * window that had reshuffled its buttons — the answer was marked against a
 * picture nobody had seen. It scored the claim wrong and the executor refused
 * with "the accessibility tree changed", both correctly, for a question that
 * should never have been asked.
 *
 * Now the observing run leaves the window open and writes its plan here, and
 * the claiming run scores against exactly that plan and that live window.
 */
const SESSION = join(tmpdir(), "ocade-i2-session.json");

let win: { hwnd: number; tabOrder: string[]; buttonOrderLeftToRight: string[] };
let cap: Record<string, unknown>;
let elements: RawPerceptionElement[];
let plan: import("../src/lib/control/perception.ts").SetOfMarkPlan;

if (claim !== null && existsSync(SESSION)) {
  const session = readJson(SESSION);
  win = session.win;
  cap = session.cap;
  elements = session.elements;
  plan = session.plan;
  console.log(`resuming the observed session (hwnd ${win.hwnd}) — window NOT relaunched`);
  /*
   * Cheap Win32 liveness probe, deliberately NOT a UI Automation call.
   *
   * Probing a dead handle through UIA does not fail — it blocks, for minutes,
   * with no output. Two runs stalled that way before the cause was clear.
   * IsWindow answers immediately and cannot hang.
   */
  const alive = ps([
    "-Command",
    `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport("user32.dll")]public static extern bool IsWindow(IntPtr h);}';` +
      `@{ alive = [W]::IsWindow([IntPtr]${win.hwnd}) } | ConvertTo-Json -Compress`,
  ]);
  if (alive.alive !== true) {
    throw new Error(`the observed window (hwnd ${win.hwnd}) is gone; re-run without --claim first`);
  }
} else {
  win = await launch();
  const observed = observe(win.hwnd, "OCADE-INTERACTIVE");
  cap = observed.cap;
  elements = observed.elements;
  const fused = fusePerceptionFrame(observed.frame);
  if (!fused.ok) {
    console.error(`fusePerceptionFrame refused: ${fused.reason}`);
    process.exit(1);
  }
  plan = fused.data;
  writeFileSync(SESSION, JSON.stringify({ win, cap, elements, plan }));
}

// Draw the marks the fusion produced onto the real screenshot.
const capWindow = cap.window as {
  visibleRect: { x: number; y: number };
  renderScale: number;
};
writeFileSync(
  PLAN_FOR_DRAW,
  JSON.stringify({
    originX: capWindow.visibleRect.x,
    originY: capWindow.visibleRect.y,
    renderScale: capWindow.renderScale,
    markers: plan.markers,
  }),
);
const drawn = ps(["-File", DRAW, "-ImagePath", SHOT, "-OutPath", LABELLED, "-PlanPath", PLAN_FOR_DRAW]);

/*
 * The drawn badges and the SVG must describe the same set.
 *
 * They are rendered by different code — GDI here, a string of <g> elements in
 * perception.ts — so if they ever disagree, a model would be looking at one
 * overlay while the executor resolved against another.
 */
const svgGroups = (plan.overlaySvg.match(/<g data-marker=/g) ?? []).length;
const drawnCount = Number(drawn.drawn ?? 0);
const overlayAgrees = svgGroups === drawnCount && drawnCount === plan.markers.length;

const truth = {
  generatedAt: new Date().toISOString(),
  labelledImage: LABELLED,
  buttonOrderLeftToRight: win.buttonOrderLeftToRight,
  markers: plan.markers.map((m) => ({ number: m.number, name: m.name, role: m.role })),
};
writeFileSync(TRUTH, JSON.stringify(truth, null, 2) + "\n");

console.log(`labelled image : ${LABELLED}`);
console.log(`markers drawn  : ${drawnCount} (svg groups ${svgGroups}, agree=${overlayAgrees})`);
console.log(`elements fused : ${plan.elements.length}`);

if (claim === null) {
  console.log("\nNo --claim given. Look at the labelled image, then re-run with:");
  console.log("  --claim <number> --target <element name>");
  process.exit(0);
}

// ---------------------------------------------------- selection by number

const claimed = plan.markers.find((m) => m.number === claim);
const expected = plan.markers.find((m) => m.name === targetName);
const selectionCorrect = !!claimed && !!expected && claimed.markerId === expected.markerId;

// Resolve the claimed marker through the real executor path: it re-observes and
// refuses a stale or changed screen rather than trusting the plan.
const current = observe(win.hwnd, "OCADE-INTERACTIVE");
const resolution = resolveSetOfMarkTarget({
  planned: plan,
  markerId: claimed?.markerId ?? "mark-none",
  current: current.frame,
});

// ---------------------------------------------------- keyboard reachability

const kbd = ps(["-File", UIA, "-Mode", "tab", "-Hwnd", String(win.hwnd), "-Name", targetName]);
const uiaTarget = elements.find(
  (e) => e.name === targetName && (e as unknown as { keyboardFocusable: boolean }).keyboardFocusable,
);

const keyboardReached = kbd.reached === true;
const sameElementByKeyboard =
  keyboardReached &&
  !!expected &&
  !!uiaTarget &&
  uiaTarget.bounds.x === expected.boundsPhysical.x &&
  uiaTarget.bounds.y === expected.boundsPhysical.y;

// Only tear down on the final (--write) run. Closing after every claim meant a
// follow-up control run found a dead window, which is how the hang above
// started.
if (write) closeWindows();

const failed =
  !overlayAgrees ||
  !selectionCorrect ||
  !resolution.ok ||
  !keyboardReached ||
  !sameElementByKeyboard ||
  plan.markers.length < 5;

const doc = {
  schemaVersion: 1,
  item: "I2 - Set-of-Mark overlay, selection by number, keyboard reachability",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "Live UI Automation observations are fed into fusePerceptionFrame in src/lib/control/perception.ts, and the markers it returns are drawn onto a real scoped screenshot of the same window. Only elements the OS reports as interactive AND enabled are marked, so a disabled control is left unmarked. The selection is recorded as a claim before it is checked, and the same element is then reached with real Tab keystrokes.",
  antiCheatNote:
    "The four buttons are shuffled into their four slots on every launch, so the number that lands on a given label changes between runs and cannot be inferred from the window's source. Ground truth is written to a separate file from the labelled image.",
  overlay: {
    labelledImage: LABELLED,
    labelledSha256: drawn.sha256,
    markersDrawn: drawnCount,
    svgMarkerGroups: svgGroups,
    drawnMatchesSvg: overlayAgrees,
    markers: plan.markers.map((m) => ({ number: m.number, name: m.name, role: m.role })),
  },
  unmarkedButPresent: plan.elements
    .filter((e) => !plan.markers.some((m) => m.targetKey === e.targetKey))
    .map((e) => ({ name: e.name, role: e.role, interactive: e.interactive, enabled: e.enabled })),
  selection: {
    targetAskedFor: targetName,
    numberClaimed: claim,
    claimedElement: claimed ? { name: claimed.name, role: claimed.role } : null,
    expectedNumber: expected?.number ?? null,
    correct: selectionCorrect,
    resolvedThroughExecutor: resolution.ok,
    resolution: resolution.ok
      ? { physicalPoint: resolution.physicalPoint, evidence: resolution.evidence }
      : { reason: resolution.reason, stale: resolution.stale },
  },
  keyboard: {
    target: targetName,
    reached: keyboardReached,
    tabPresses: kbd.tabPresses,
    trail: kbd.trail,
    focusedAtEnd: kbd.focusedAtEnd,
    uiaReportsKeyboardFocusable: !!uiaTarget,
    sameElementAsMarked: sameElementByKeyboard,
  },
};

console.log(`\nselection: claimed ${claim} -> ${claimed?.name ?? "(none)"}; expected ${targetName} = ${expected?.number}; correct=${selectionCorrect}`);
console.log(`executor resolve: ${resolution.ok ? "ok" : "REFUSED — " + resolution.reason}`);
console.log(`keyboard: reached=${keyboardReached} in ${kbd.tabPresses} tabs; sameElement=${sameElementByKeyboard}`);
console.log(`I2: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
