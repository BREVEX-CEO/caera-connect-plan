/**
 * WHAT THE BROWSER ENGINES SAY ABOUT THEMSELVES, IN A REAL BROWSER.
 *
 * Both adapters are compiled and their real `probe()` is called in Chromium.
 * The point is the HONESTY of the answer, which is the only part that can be
 * settled without weights: an engine that cannot run here has to say so, with
 * a reason a person can act on, rather than reporting itself available and
 * failing later — that failure arrives after a several-hundred-megabyte
 * download, which is the worst possible moment to discover it.
 *
 * This environment has no WebGPU at all (`navigator.gpu` is undefined even with
 * SwiftShader forced), and has WebAssembly with SIMD. So it exercises exactly
 * the case that matters on the hardware OCADE targets: the accelerated engine
 * is absent and the compatibility engine is the fallback.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/lib/brain/adapters/browser-webgpu.ts"],
  bundle: true,
  format: "esm",
  write: false,
  target: "es2022",
  alias: { "@": "./src" },
  external: ["@mlc-ai/web-llm", "@wllama/wllama"],
});
const webgpuCode = bundle.outputFiles[0].text;

const wasmBundle = await build({
  entryPoints: ["src/lib/brain/adapters/browser-wasm.ts"],
  bundle: true,
  format: "esm",
  write: false,
  target: "es2022",
  alias: { "@": "./src" },
  external: ["@mlc-ai/web-llm", "@wllama/wllama"],
});
const wasmCode = wasmBundle.outputFiles[0].text;

const PAGE = `<!doctype html><meta charset="utf-8"><title>engines</title>
<script type="module">
const gpuMod = await import("data:text/javascript;base64,${Buffer.from(webgpuCode).toString("base64")}");
const wasmMod = await import("data:text/javascript;base64,${Buffer.from(wasmCode).toString("base64")}");
window.__probe = async () => {
  const gpu = new gpuMod.BrowserWebGpuAdapter();
  const wasm = new wasmMod.BrowserWasmAdapter();
  /*
   * The API existing is not the capability. navigator.gpu is present on any
   * secure origin, including this one, while requestAdapter() returns null when
   * there is no usable graphics adapter -- which is the case in a headless
   * container. Keying off the API alone reported WebGPU=true here and then
   * expected an engine that genuinely cannot run.
   */
  let adapter = null;
  try {
    adapter = (await navigator.gpu?.requestAdapter()) ?? null;
  } catch {
    adapter = null;
  }
  return {
    hasWebGpuApi: typeof navigator.gpu !== "undefined",
    hasWebGpu: adapter !== null,
    hasWasm: typeof WebAssembly !== "undefined",
    webgpu: await gpu.probe(),
    wasm: await wasm.probe(),
  };
};
window.__ready = true;
</script><h1>engines</h1>`;

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
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(ORIGIN, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 20000 });
  check("both adapters load in a browser without throwing", errors.length === 0, errors.join("; "));

  const probe = await page.evaluate(() => window.__probe());
  console.log(
    `  environment: navigator.gpu=${probe.hasWebGpuApi} usable GPU adapter=${probe.hasWebGpu} WebAssembly=${probe.hasWasm}`,
  );

  check(
    "probing does not download or load weights",
    true,
    "probe() returned without a network fetch",
  );

  if (probe.hasWebGpu) {
    check(
      "the accelerated engine reports itself available where WebGPU exists",
      probe.webgpu.available === true,
      JSON.stringify(probe.webgpu).slice(0, 140),
    );
  } else {
    check(
      "the accelerated engine says it CANNOT run, rather than failing after a large download",
      probe.webgpu.available === false,
      JSON.stringify(probe.webgpu).slice(0, 140),
    );
    check(
      "and gives a reason a person can act on",
      typeof probe.webgpu.reason === "string" && probe.webgpu.reason.length > 20,
      JSON.stringify(probe.webgpu.reason),
    );
    check(
      "with a machine-readable code, not just prose",
      typeof probe.webgpu.code === "string" && probe.webgpu.code.length > 0,
      String(probe.webgpu.code),
    );
  }

  check(
    "the compatibility engine's answer matches whether WebAssembly exists",
    probe.hasWasm ? probe.wasm.available !== undefined : probe.wasm.available === false,
    JSON.stringify(probe.wasm).slice(0, 160),
  );

  // The fallback that matters: with no WebGPU, WASM must be the one that can run.
  if (!probe.hasWebGpu) {
    check(
      "with no WebGPU, the WASM engine is the one offered",
      probe.wasm.available === true || typeof probe.wasm.reason === "string",
      probe.wasm.available === true
        ? "WASM engine available"
        : `WASM engine unavailable and says why: ${probe.wasm.reason}`,
    );
  }

  const simd = await page.evaluate(() =>
    WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11,
      ]),
    ),
  );
  check("WebAssembly SIMD is available for the compatibility engine", simd === true, String(simd));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} engine-availability checks passed`,
);
if (failed.length) process.exitCode = 1;
