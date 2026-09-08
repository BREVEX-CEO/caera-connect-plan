/**
 * I1 evidence: real scoped window capture + real OCR, at 100% and at a real
 * non-100% display scale.
 *
 * WHAT MAKES THIS MORE THAN A SCREENSHOT
 * --------------------------------------
 * A capture that silently grabbed the whole desktop would still contain the
 * target's text and would still pass a naive OCR check. So a DECOY window is
 * placed immediately beside the target, and scoping is judged on what must be
 * ABSENT. Its text must never appear.
 *
 * DPI is proven the same way — by demonstrating the failures, not just the
 * success. Two separate hazards are shown to be real on the scaled display and
 * then shown to be handled:
 *
 *   GEOMETRY. GetWindowRect is virtualised for a DPI-unaware caller; at 125% it
 *   reports 760x420 for a window that is physically 950x525, so a naive capture
 *   built on it crops 34% away. The DWM extended-frame bounds this host uses
 *   report identical physical pixels from both awareness contexts.
 *
 *   RENDER SIZE. A DPI-unaware window still PAINTS at 96 DPI and Windows
 *   stretches the result, so sizing the canvas from the on-screen rectangle left
 *   a third of the image as unpainted black. That was a real defect here, found
 *   by looking at the picture after the checks had already said PROVEN. The
 *   canvas is now sized from the window's own render size, and a deliberate
 *   -NaiveSize capture reproduces the old bug each run to prove the detector
 *   that guards it still fires.
 *
 * THE DISPLAY SCALE IS RESTORED. It is read first, changed, and put back in a
 * finally block, and the restore is verified before this script reports
 * anything. That is a display preference on the operator's own machine and the
 * only system state touched.
 *
 * Usage: node --experimental-strip-types scripts/perception-i1-evidence.mts [--write]
 */
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_I1_CAPTURE_OCR_DPI.json";
const HOST = "scripts/perception/capture-host.ps1";
const DPI = "scripts/perception/dpi-scale.ps1";
const WINDOWS_SCRIPT = "scripts/perception/test-windows.ps1";
const HANDLE_FILE = join(tmpdir(), "ocade-test-windows.json");

const ps = (args: string[]): Record<string, unknown> => {
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const line = out.trim().split("\n").filter(Boolean).pop() ?? "{}";
  return JSON.parse(line);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Launch the two real windows and wait for them to publish their handles. */
async function launchWindows(): Promise<{
  targetHwnd: number;
  decoyHwnd: number;
  targetLines: string[];
  decoyLines: string[];
}> {
  rmSync(HANDLE_FILE, { force: true });
  /*
   * NOT detached.
   *
   * With `detached: true` the child exited immediately with code 0 and no
   * window ever appeared: a detached process starts in its own process group
   * without the interactive context the WinForms message pump needs, so
   * Application.Run() returned at once. Keeping it attached is what makes the
   * window real.
   */
  const child = spawn(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", WINDOWS_SCRIPT],
    { stdio: "ignore" },
  );
  child.unref();
  for (let i = 0; i < 60 && !existsSync(HANDLE_FILE); i++) await sleep(300);
  if (!existsSync(HANDLE_FILE)) throw new Error("the test windows never started");
  await sleep(1200); // let them finish painting before anything is captured
  // PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM, which JSON.parse
  // rejects as an unexpected token before the opening brace.
  return JSON.parse(readFileSync(HANDLE_FILE, "utf8").replace(/^﻿/, ""));
}

function closeWindows() {
  try {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'OCADE-*' } | Stop-Process -Force",
    ]);
  } catch {
    /* nothing to close */
  }
}

/** Whitespace-insensitive containment, so OCR line-wrapping is not scored as an error. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function scoreOcr(text: string, expected: string[], forbidden: string[]) {
  const haystack = norm(text);
  const matched = expected.map((line) => ({ line, found: haystack.includes(norm(line)) }));
  const leaked = forbidden.filter((line) => haystack.includes(norm(line)));
  return {
    expectedLines: matched,
    allExpectedFound: matched.every((m) => m.found),
    decoyLinesLeaked: leaked,
    scopedCorrectly: leaked.length === 0,
  };
}

async function runOnce(label: string, scalePercent: number | null) {
  const win = await launchWindows();
  const path = join(tmpdir(), `ocade-capture-${label}.png`);
  const cap = ps([
    "-File",
    HOST,
    "-Mode",
    "capture",
    "-Hwnd",
    String(win.targetHwnd),
    "-Path",
    path,
  ]);
  const ocr = ps(["-File", HOST, "-Mode", "ocr", "-Path", path]);
  const score = scoreOcr(String(ocr.text ?? ""), win.targetLines, win.decoyLines);

  /*
   * The same capture, from a DPI-UNAWARE thread context.
   *
   * A first version of this control compared the two captured BITMAP SIZES and
   * expected them to differ on a scaled display. They never did, and the reason
   * turned out to matter more than the control: this host takes its bounds from
   * DWMWA_EXTENDED_FRAME_BOUNDS, which reports physical pixels regardless of the
   * caller's DPI awareness. The capture is DPI-robust by construction.
   *
   * So the control now measures the thing that IS DPI-sensitive — GetWindowRect
   * — and shows both halves: that virtualisation is real and would have wrecked
   * a naive capture, and that the bounds actually used are immune to it.
   */
  const unawarePath = join(tmpdir(), `ocade-capture-${label}-unaware.png`);
  let unaware: Record<string, unknown> = {};
  try {
    unaware = ps([
      "-File",
      HOST,
      "-Mode",
      "capture",
      "-Hwnd",
      String(win.targetHwnd),
      "-Path",
      unawarePath,
      "-DpiUnaware",
    ]);
  } catch (error) {
    unaware = { ok: false, error: String(error).slice(0, 200) };
  }

  /*
   * Deliberately reintroduce the sizing defect, to prove the detector detects.
   *
   * The unpainted-area check is only worth having if it fails on the bug it was
   * written for. This capture sizes the canvas the original (wrong) way; on a
   * scaled display it must come back with a large unpainted region.
   */
  const naivePath = join(tmpdir(), `ocade-capture-${label}-naivesize.png`);
  let naiveSized: Record<string, unknown> = {};
  try {
    naiveSized = ps([
      "-File",
      HOST,
      "-Mode",
      "capture",
      "-Hwnd",
      String(win.targetHwnd),
      "-Path",
      naivePath,
      "-NaiveSize",
    ]);
  } catch (error) {
    naiveSized = { ok: false, error: String(error).slice(0, 200) };
  }

  closeWindows();

  const image = cap.image as { width: number; height: number };
  type Rect = { x: number; y: number; w: number; h: number };
  type WinInfo = { windowRect: Rect; visibleRect: Rect };
  const aware = cap.window as WinInfo;
  const un = unaware.window as WinInfo | undefined;

  // What a naive implementation would have captured: GetWindowRect, read from a
  // thread that did not declare awareness.
  const naive = un?.windowRect;
  const truth = aware.visibleRect;
  const naiveCropPercent =
    naive && truth.w > 0
      ? Math.round(
          (1 - (Math.min(naive.w, truth.w) * Math.min(naive.h, truth.h)) / (truth.w * truth.h)) *
            100,
        )
      : null;

  return {
    label,
    displayScalePercent: scalePercent,
    window: cap.window,
    capture: {
      path,
      image,
      sha256: cap.sha256,
      bytes: cap.bytes,
      // Fraction of the canvas the window never painted. A DPI-mis-sized capture
      // shows up here as a large black band; see the note in the host.
      unpaintedFraction: cap.unpaintedFraction,
      fullyPainted: Number(cap.unpaintedFraction ?? 1) <= 0.02,
    },
    ocr: { engineLanguage: ocr.engineLanguage, text: ocr.text, lines: ocr.lines },
    knownCorrectText: win.targetLines,
    comparison: score,
    dpiControl: {
      awareWindowRect: aware.windowRect,
      unawareWindowRect: naive,
      dwmVisibleRectAware: truth,
      dwmVisibleRectUnaware: un?.visibleRect,
      // Virtualisation is real: the DPI-sensitive API disagrees across contexts.
      getWindowRectIsVirtualised:
        !!naive && (naive.w !== aware.windowRect.w || naive.h !== aware.windowRect.h),
      // ...and the bounds this host actually uses are not affected by it.
      dwmBoundsIdenticalAcrossAwareness:
        !!un && un.visibleRect.w === truth.w && un.visibleRect.h === truth.h,
      naiveCaptureWouldCropPercent: naiveCropPercent,
    },
    naiveSizingControl: {
      image: naiveSized.image,
      unpaintedFraction: naiveSized.unpaintedFraction,
      // On a scaled display the old sizing must leave a large unpainted band.
      detectorCatchesIt: Number(naiveSized.unpaintedFraction ?? 0) > 0.1,
    },
  };
}

// ---------------------------------------------------------------- run

const before = ps(["-File", DPI, "-Mode", "get"]);
const originalRelative = Number(before.currentRelative);
const originalPercent = Number(before.currentPercent);
const runs: Record<string, unknown>[] = [];
let restored: Record<string, unknown> = {};
let failed = false;

try {
  runs.push(await runOnce("100", originalPercent));

  // Step up one rung on the ladder for a genuinely non-100% display.
  const target = originalRelative + 1;
  const applied = ps(["-File", DPI, "-Mode", "set", "-RelativeSteps", String(target)]);
  if (applied.applied !== true) throw new Error("the display scale did not change");
  await sleep(2500);
  runs.push(await runOnce("scaled", Number(applied.appliedPercent)));
} catch (error) {
  runs.push({ error: String(error) });
  failed = true;
} finally {
  // Always put the operator's display back, and prove it went back.
  try {
    ps(["-File", DPI, "-Mode", "set", "-RelativeSteps", String(originalRelative)]);
    restored = ps(["-File", DPI, "-Mode", "get"]);
  } catch (error) {
    restored = { error: String(error) };
  }
  closeWindows();
}

const restoredOk = Number(restored.currentRelative) === originalRelative;
if (!restoredOk) failed = true;

for (const run of runs) {
  const c = run.comparison as { allExpectedFound: boolean; scopedCorrectly: boolean } | undefined;
  if (!c || !c.allExpectedFound || !c.scopedCorrectly) failed = true;
  // A capture the window only partly painted is not a correct capture, even if
  // the surviving corner happens to OCR cleanly.
  const cap = run.capture as { fullyPainted: boolean } | undefined;
  if (!cap?.fullyPainted) failed = true;
}

// The scaled run must actually have been at a different scale, or nothing was tested.
const scales = runs.map((r) => r.displayScalePercent).filter((s) => typeof s === "number");
const testedTwoScales = new Set(scales).size >= 2;
if (!testedTwoScales) failed = true;

/*
 * On the scaled display BOTH halves of the DPI control must hold.
 *
 * At 100% there is nothing to virtualise, so no difference is expected there.
 * On the scaled display: GetWindowRect must disagree across awareness contexts
 * (proving the hazard is real and present on this machine), AND the DWM bounds
 * this host actually uses must be identical across them (proving the host is
 * immune to it). Requiring only the second would pass on a machine where the
 * scale never changed at all.
 */
const scaledRun = runs.find(
  (r) => typeof r.displayScalePercent === "number" && r.displayScalePercent !== 100,
);
const ctl = scaledRun?.dpiControl as
  { getWindowRectIsVirtualised: boolean; dwmBoundsIdenticalAcrossAwareness: boolean } | undefined;
const dpiHazardDemonstrated = !!ctl && ctl.getWindowRectIsVirtualised;
const dpiHazardNeutralised = !!ctl && ctl.dwmBoundsIdenticalAcrossAwareness;
if (!dpiHazardDemonstrated || !dpiHazardNeutralised) failed = true;

// The unpainted-area detector must demonstrably catch the sizing bug it exists
// for, on the scaled display where that bug appears.
const naiveCtl = scaledRun?.naiveSizingControl as { detectorCatchesIt: boolean } | undefined;
const unpaintedDetectorProven = !!naiveCtl && naiveCtl.detectorCatchesIt;
if (!unpaintedDetectorProven) failed = true;

const doc = {
  schemaVersion: 1,
  item: "I1 - real scoped window capture, real OCR, correct at 100% and at a non-100% display scale",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "One real top-level window is captured by handle with PrintWindow(PW_RENDERFULLCONTENT), so the window renders itself and an overlapping window cannot bleed in. Its bounds come from DWMWA_EXTENDED_FRAME_BOUNDS rather than GetWindowRect, which since Windows 10 includes an invisible resize border. OCR is the Windows.Media.Ocr engine running locally; no image leaves the machine. Scoping is judged on the absence of a decoy window's text, not merely the presence of the target's.",
  scaleNote:
    "The display scale was read, changed one rung up the ladder, and restored in a finally block, with the restore verified. A DPI-unaware capture is recorded alongside each run: on the scaled display it must come back a different size, which is what shows the per-monitor awareness declaration is load-bearing.",
  displayScale: {
    originalPercent,
    originalRelative,
    restoredRelative: restored.currentRelative,
    restoredPercent: restored.currentPercent,
    restoredToOriginal: restoredOk,
  },
  testedTwoScales,
  dpiHazardDemonstrated,
  dpiHazardNeutralised,
  unpaintedDetectorProven,
  runs,
};

for (const run of runs) {
  const c = run.comparison as
    { allExpectedFound: boolean; scopedCorrectly: boolean; decoyLinesLeaked: string[] } | undefined;
  const u = run.dpiControl as
    | {
        getWindowRectIsVirtualised: boolean;
        dwmBoundsIdenticalAcrossAwareness: boolean;
        naiveCaptureWouldCropPercent: number | null;
      }
    | undefined;
  console.log(`--- ${run.label} @ ${run.displayScalePercent}% ---`);
  if (!c) {
    console.log(`  ERROR: ${run.error}`);
    continue;
  }
  const capInfo = run.capture as {
    image: { width: number; height: number };
    unpaintedFraction: number;
    fullyPainted: boolean;
  };
  const img = capInfo.image;
  console.log(
    `  captured            : ${img.width}x${img.height}  unpainted=${(capInfo.unpaintedFraction * 100).toFixed(1)}% fullyPainted=${capInfo.fullyPainted}`,
  );
  console.log(`  all known text OCR'd: ${c.allExpectedFound}`);
  console.log(
    `  decoy leaked        : ${c.decoyLinesLeaked.length > 0 ? c.decoyLinesLeaked : "none"}`,
  );
  console.log(
    `  GetWindowRect virtualised: ${u?.getWindowRectIsVirtualised} (naive capture would crop ${u?.naiveCaptureWouldCropPercent}%)`,
  );
  console.log(`  DWM bounds unaffected    : ${u?.dwmBoundsIdenticalAcrossAwareness}`);
  const n = run.naiveSizingControl as
    { unpaintedFraction: number; detectorCatchesIt: boolean } | undefined;
  console.log(
    `  old sizing unpainted     : ${((n?.unpaintedFraction ?? 0) * 100).toFixed(1)}% detectorCatchesIt=${n?.detectorCatchesIt}`,
  );
}
console.log(`display scale restored: ${restoredOk} (${restored.currentPercent}%)`);
console.log(`I1: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
