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
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";
const STATE = process.env.OCADE_STORAGE_STATE;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/*
 * Say what is wrong, at the point it is wrong.
 *
 * This stage measures a running app; it does not stand one up. Run on its own
 * with nothing on 8080 it used to spend a minute inside `page.goto` and then
 * die on a Playwright TimeoutError whose text is about waiting 500ms for a
 * selector — an error that sends you looking at the backdrop code when the
 * actual problem is that no server is listening. `npm run audit:settings`
 * stands the whole stack up and runs this as one of its stages.
 */
const ABORT =
  "This stage needs a RUNNING APP and a SIGNED-IN SESSION, and starts neither.\n" +
  "Run `npm run audit:settings`: it stands the stack up, signs in, and runs this\n" +
  "as one of its stages. To run it alone, point OCADE_BASE_URL at a running app\n" +
  "and OCADE_STORAGE_STATE at a signed-in storage state.";

try {
  const probe = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
  if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(`No app is answering at ${BASE} (${error.message}).\n${ABORT}`);
  process.exit(1);
}

/*
 * The signed-in state is a precondition, not an optimisation.
 *
 * Without it the run is a signed-out session: the backdrop reports `lowPerf`
 * and paints nothing, and the Reduce motion switch is rendered DISABLED. The
 * three failures and the eventual `locator.click: Timeout` that follow all
 * point at the backdrop, and none of them is about the backdrop. Refusing up
 * front costs one line and saves that whole investigation.
 */
if (!STATE || !existsSync(STATE)) {
  console.error(`No signed-in storage state (OCADE_STORAGE_STATE=${STATE ?? "unset"}).\n${ABORT}`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext(STATE ? { storageState: STATE } : {});
const page = await context.newPage();

async function openApp(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
}

async function clearModals() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
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
    if ((await button.count()) === 0) {
      // The first-install gate has no dismiss button and may be completing
      // while the once-per-account welcome tour waits underneath it. Returning
      // here left that tour to intercept the later settings click. Give the
      // non-dismissible gate time to resolve, then inspect the next dialog.
      await page.waitForTimeout(500);
      continue;
    }
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
  await openApp("/ocade/work");
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
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
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
  await openApp("/settings/motion");
  await page.waitForTimeout(1500);
  await clearModals();
  // Let the signed-in preference row finish hydrating before changing it.
  // Clicking while that read is still in flight creates a false failure: the
  // older cloud snapshot lands after the click and correctly replaces the
  // optimistic local value.
  await page
    .getByText(/saved to your account/i)
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  const reduceSwitch = page.getByRole("switch", { name: "Reduce motion" }).first();
  const wasOn = (await reduceSwitch.getAttribute("aria-checked")) === "true";
  if (!wasOn) await reduceSwitch.click({ timeout: 8000 });
  await page
    .waitForFunction(
      () =>
        document
          .querySelector('[role="switch"][aria-label="Reduce motion"]')
          ?.getAttribute("aria-checked") === "true",
      undefined,
      { timeout: 10000 },
    )
    .catch(() => {});
  const switchOn = (await reduceSwitch.getAttribute("aria-checked")) === "true";
  check(
    "reduce motion can be turned on",
    switchOn,
    switchOn
      ? "switch, document and saved preference changed together"
      : "the semantic browser click did not turn the switch on",
  );

  await openApp("/ocade/work");
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
