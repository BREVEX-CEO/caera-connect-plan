/**
 * THE FLOW BANDS, DRAWN FOR REAL, ON A CANVAS.
 *
 * `visual-performance.mjs` measures the backdrop as the APP configures it — and
 * on this machine the app correctly decides to hold still, because the
 * low-performance detector fires on a four-core box with no GPU. That is the
 * right product behaviour and the wrong way to find out whether the new layer
 * draws anything.
 *
 * So this drives the scene directly with a moving tuning: it renders frames,
 * compares pixels, and moves a pointer to check the parallax reaches the
 * canvas. Nothing here asserts what the app chooses; it asserts that the code
 * the app would run does what it claims.
 */
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["src/components/visual/living-backdrop-scene.ts"],
  bundle: true,
  format: "esm",
  write: false,
  target: "es2022",
  alias: { "@": "./src" },
});
const code = bundled.outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><title>flow</title>
<style>html,body{margin:0;background:#05070c}canvas{display:block;width:640px;height:360px}</style>
<canvas id="c"></canvas>
<script type="module">
const scene = await import("data:text/javascript;base64,${Buffer.from(code).toString("base64")}");
const canvas = document.getElementById("c");
const tuning = scene.tuningFor("cinematic", { still: false, highContrast: false });
window.__tuning = tuning;
const handle = scene.createScene(canvas, { intensity: "cinematic", tuning });
handle.resize(640, 360);
window.__frame = (t) => handle.frame(t);
window.__pointer = (x, y) => handle.setPointer(x, y);
window.__shot = () => canvas.toDataURL("image/png");
window.__ready = true;
</script>`;

const server = createServer((_q, s) => {
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  s.end(PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.OCADE_BROWSER_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 180)));
  await page.goto(ORIGIN, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 20000 });
  check("the scene module loads and builds a scene", errors.length === 0, errors.join("; "));

  const tuning = await page.evaluate(() => window.__tuning);
  check(
    "a moving tuning asks for flow bands",
    tuning.waveLayers > 0,
    `${tuning.waveLayers} bands, amplitude ${tuning.waveAmplitude}, speed ${tuning.waveSpeed}`,
  );

  // Two frames at different times must differ: the bands travel.
  const [a, b] = await page.evaluate(async () => {
    window.__frame(0);
    const first = window.__shot();
    window.__frame(1.7);
    const second = window.__shot();
    return [first, second];
  });
  check("the canvas has something on it", a.length > 3000, `${a.length} bytes of PNG data URL`);
  check("the bands move between two moments in time", a !== b);

  // The pointer must reach the canvas — and easing means it takes a few frames.
  const [rest, leaned] = await page.evaluate(async () => {
    window.__pointer(0, 0);
    for (let i = 0; i < 30; i += 1) window.__frame(4 + i * 0.016);
    const centred = window.__shot();
    window.__pointer(1, 1);
    for (let i = 0; i < 30; i += 1) window.__frame(4 + i * 0.016);
    const pulled = window.__shot();
    return [centred, pulled];
  });
  check(
    "moving the pointer changes what is drawn",
    rest !== leaned,
    rest === leaned ? "identical — the parallax never reached the canvas" : "parallax applied",
  );

  /*
   * The still case is NOT re-asserted here. `backdrop-flow-wave.test.ts` proves
   * a still tuning yields zero bands and a frozen shape, and an assertion here
   * that compared nothing would only look like coverage.
   */
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} flow-wave render checks passed`);
if (failed.length) process.exitCode = 1;
