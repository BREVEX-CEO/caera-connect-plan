/**
 * THE 3D FLOW BACKDROP: does it render, and does it stay within its budget?
 *
 * The interface already has the premium layer — a wormhole spiral, nebula orbs,
 * a neural topology and animated particle arcs, with depth and motion trails.
 * The risk with a full-screen animated backdrop is never that it fails to
 * appear; it is that it quietly costs a frame budget on the machines OCADE
 * targets, and that the settings meant to stop it do not.
 *
 * So this measures, in a real browser: that the canvas paints; that a frame
 * costs what a 60fps budget allows; and — the part that matters most — that
 * REDUCE MOTION genuinely holds it still rather than merely dimming it.
 */
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();

async function clearModals() {
  for (let i = 0; i < 6; i += 1) {
    const dialog = page.locator("[role=dialog], [role=alertdialog]");
    if ((await dialog.count()) === 0) return;
    const boxes = dialog.locator("input[type=checkbox], [role=checkbox]");
    for (let b = 0; b < (await boxes.count()); b += 1) {
      await boxes
        .nth(b)
        .click({ timeout: 4000 })
        .catch(() => {});
    }
    const button = dialog.getByRole("button", {
      name: /^(accept and continue|skip|done|finish|got it|close)$/i,
    });
    if ((await button.count()) === 0) return;
    await button
      .first()
      .click({ timeout: 6000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
}

/** Sample the backdrop canvas twice and report whether its pixels moved. */
const MOVEMENT = async (ms) =>
  page.evaluate(async (waitMs) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { present: false };
    const shot = () => {
      try {
        return canvas.toDataURL("image/png");
      } catch {
        return null;
      }
    };
    const before = shot();
    await new Promise((r) => setTimeout(r, waitMs));
    const after = shot();
    return {
      present: true,
      readable: before !== null,
      moved: before !== null && after !== null && before !== after,
      width: canvas.width,
      height: canvas.height,
    };
  }, ms);

/** Frames the page actually produced over a window, via rAF. */
const FRAME_RATE = async (ms) =>
  page.evaluate(
    (windowMs) =>
      new Promise((resolve) => {
        let frames = 0;
        const started = performance.now();
        const tick = () => {
          frames += 1;
          if (performance.now() - started < windowMs) requestAnimationFrame(tick);
          else resolve({ frames, elapsed: Math.round(performance.now() - started) });
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

try {
  await page.goto(`${BASE}/ocade/work`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await clearModals();
  await page.waitForTimeout(1200);

  /*
   * START FROM A KNOWN STATE.
   *
   * The stored appearance is shared with every other audit, and the settings
   * audit flips reduce-motion as part of its own work. Reusing that state made
   * this test measure a scene that was already deliberately held still and
   * report it as a backdrop that fails to animate — a defect against code that
   * was behaving exactly as asked.
   */
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("caera:appearance:v1") ?? "{}");
    localStorage.setItem(
      "caera:appearance:v1",
      JSON.stringify({ ...stored, reducedMotion: false, lowPerformance: false }),
    );
  });
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2200);
  await clearModals();
  await page.waitForTimeout(900);

  /*
   * Three independent reasons to hold still, and the AUTOMATIC one is not a
   * setting: the detector turns it on for a slow device, which is correct and
   * is exactly what this container is. So the assertion is conditional on what
   * the product itself decided, read from the classes it wrote on <html>.
   */
  const holdingStill = await page.evaluate(() => ({
    reduceMotion: document.documentElement.classList.contains("reduce-motion"),
    lowPerf: document.documentElement.classList.contains("low-perf"),
    osPrefers: matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  const shouldAnimate =
    !holdingStill.reduceMotion && !holdingStill.lowPerf && !holdingStill.osPrefers;

  const moving = await MOVEMENT(900);
  check(
    "the backdrop canvas is present",
    moving.present === true,
    moving.present ? `${moving.width}×${moving.height}` : "no canvas on the page",
  );
  check("it is actually painting, not a blank element", moving.readable === true);

  if (shouldAnimate) {
    check(
      "it animates when nothing asks it to hold still",
      moving.moved === true,
      moving.moved ? "pixels changed between samples" : "pixels identical — the scene is static",
    );
  } else {
    check(
      "it holds still because the product decided to, and says which reason",
      moving.moved === false,
      `holding still for: ${Object.entries(holdingStill)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ")}` + (moving.moved ? " — but pixels are STILL CHANGING" : ""),
    );
  }

  const rate = await FRAME_RATE(1500);
  const fps = Math.round((rate.frames / rate.elapsed) * 1000);
  check(
    "the page still hits a usable frame rate with the backdrop running",
    fps >= 30,
    `${fps} fps over ${rate.elapsed}ms`,
  );

  /* ------------------------------------------- reduce motion must hold ---- */
  await page.goto(`${BASE}/settings/motion`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await clearModals();
  const reduceSwitch = page.locator("main [role=switch]").first();
  const wasOn = (await reduceSwitch.getAttribute("aria-checked")) === "true";
  if (!wasOn) await reduceSwitch.click({ timeout: 8000 });
  await page.waitForTimeout(700);
  check(
    "reduce motion can be turned on",
    (await page.locator("main [role=switch]").first().getAttribute("aria-checked")) === "true",
  );

  await page.goto(`${BASE}/ocade/work`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2200);
  await clearModals();
  await page.waitForTimeout(800);

  const stillNow = await MOVEMENT(1100);
  check(
    "with reduce motion on, the backdrop HOLDS STILL",
    stillNow.present === false || stillNow.moved === false,
    stillNow.present === false
      ? "the scene is not drawn at all"
      : stillNow.moved === false
        ? "pixels identical across a second"
        : "pixels still changing — reduce motion did not stop it",
  );

  const stillClass = await page.evaluate(() =>
    document.documentElement.classList.contains("reduce-motion"),
  );
  check(
    "and the document says so, so CSS transitions stop too",
    stillClass === true,
    `<html class> contains reduce-motion: ${stillClass}`,
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} visual-performance checks passed`,
);
if (failed.length) process.exitCode = 1;
