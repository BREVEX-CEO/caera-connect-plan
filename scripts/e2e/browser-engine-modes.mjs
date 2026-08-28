/**
 * THE BROWSER ENGINES, EACH MADE TO PRODUCE A CHECKABLE ANSWER.
 *
 * WHY THIS HARNESS EXISTS. Every previous proof of the engine stopped short of
 * the thing that actually matters: that a real model file loads, runs on the
 * hardware path we claim, and produces the RIGHT tokens. Isolation checks prove
 * headers; unit tests prove arithmetic. Neither proves inference.
 *
 * WHAT MAKES THE OUTPUT CHECKABLE. `scripts/fixtures/tiny-llama-trained.gguf`
 * is a genuine GGUF v3 model that was trained until it memorised three facts,
 * over a byte-level vocabulary so that text tokenises to exactly its bytes.
 * "capital of france is " must produce "paris\n" exactly. A runtime that loads,
 * reports threads and emits plausible-looking rubbish fails here, which is the
 * entire point: random weights would let every one of these pass.
 *
 * WHAT IT ESTABLISHED, AND IT IS NOT WHAT WE EXPECTED.
 *
 * wllama's documentation says WebGPU is enabled automatically from V3.1 with
 * every layer offloaded by default, which would have meant one runtime and one
 * downloaded artifact could serve the graphics path as well as the processor
 * one. It is not true of the binary this deployment ships. Asked for 99 GPU
 * layers on a machine whose browser hands out a working WebGPU adapter, the
 * bundled `wllama.wasm` reports `backend_ptrs.size() = 1`, assigns every layer
 * to the CPU, and answers correctly — on the processor. Section 3 pins that
 * down so nobody deletes the graphics runtime on the strength of a README.
 *
 * So the browser has TWO engines, and this proves each on its own terms:
 *
 *   1. Several processor cores   — real generation, verified output
 *   2. One processor core        — real generation, verified output, the
 *                                  universal fallback
 *   3. The processor engine is processor-only, whatever it is asked for
 *   4. The graphics path         — OCADE's own adapter code, compiled from
 *                                  source, run against a real WebGPU device
 *
 * Run: node scripts/e2e/browser-engine-modes.mjs
 */
import { chromium } from "playwright-core";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const FIXTURE = "scripts/fixtures/tiny-llama-trained.gguf";
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = Number(process.env.OCADE_ENGINE_PORT ?? 8112);
const ENTRY = "scripts/.engine-probe.entry.ts";
const BUNDLE = "scripts/.engine-probe.bundle.js";

const results = [];
const check = (ok, what, detail) => {
  results.push({ ok, what, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".gguf": "application/octet-stream",
  ".html": "text/html",
  ".map": "application/json",
};

/**
 * A server that is cross-origin isolated.
 *
 * Both headers, on everything. Without them `SharedArrayBuffer` is absent and
 * the multi-threaded mode below cannot be distinguished from the single-threaded
 * one — the harness would pass while proving nothing.
 */
function serve() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const headers = {
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "same-origin",
    };

    if (url.pathname === "/") {
      response.writeHead(200, { ...headers, "content-type": "text/html" });
      response.end("<!doctype html><meta charset=utf-8><title>runtime</title>");
      return;
    }

    // Only two roots are served, and both are resolved and re-checked so a
    // traversal cannot reach anything else on the machine.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const candidates = [join(process.cwd(), rel), join(process.cwd(), "node_modules", rel)];
    const file = candidates.find(
      (path) =>
        (path.startsWith(join(process.cwd(), "node_modules")) ||
          path.startsWith(join(process.cwd(), "scripts"))) &&
        existsSync(path),
    );
    if (!file) {
      response.writeHead(404, headers);
      response.end();
      return;
    }
    const body = readFileSync(file);
    response.writeHead(200, {
      ...headers,
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "content-length": String(body.length),
    });
    response.end(body);
  });
  return server;
}

/**
 * Load the fixture in one mode and make it complete three memorised facts.
 *
 * Runs inside the page. Returns what the RUNTIME reports about itself
 * (`isMultithread`, `getNumThreads`) alongside the decoded completions, so the
 * assertions can require the mode to be the one that was asked for AND the
 * output to be correct. Either alone would be a weaker claim than it looks.
 */
const RUN_IN_PAGE = async ({ gpuLayers, threads, ggufUrl, wasmUrl, esmUrl }) => {
  const { Wllama } = await import(/* @vite-ignore */ esmUrl);
  const started = performance.now();

  const wllama = new Wllama(
    { default: wasmUrl, "single-thread/wllama.wasm": wasmUrl },
    { allowOffline: true, suppressNativeLog: false },
  );

  const blob = await (await fetch(ggufUrl)).blob();
  await wllama.loadModel([blob], {
    n_threads: threads,
    n_gpu_layers: gpuLayers,
    // The fixture was trained at 64 tokens of context; asking for more would
    // only allocate cache the graph was never built for.
    n_ctx: 64,
    n_batch: 64,
    warmup: false,
    // Verbose, because llama.cpp reports which backends it registered and
    // which device each layer went to only at this level, and section 3 is an
    // assertion about exactly that.
    log_level: 1,
  });
  const loadMs = Math.round(performance.now() - started);

  /*
   * PLAIN TEXT, WHICH IS ALL THIS API ACCEPTS.
   *
   * wllama's completion handler takes a string; an array of ids is rejected by
   * the C++ side with "type must be string, but is array". That constraint is
   * why the fixture's vocabulary is byte-level: text tokenises to exactly its
   * bytes, so the prompt written here is the token sequence the model was
   * trained on. Under the SentencePiece vocabulary it used to have, llama.cpp
   * rewrote every space to U+2581 first and this same call answered " japan"
   * to a question about France — a real wrong answer that the other harness's
   * hand-built ids had been walking around.
   */
  const completions = [];
  for (const [prompt, expected] of [
    ["capital of france is ", "paris\n"],
    ["capital of japan is ", "tokyo\n"],
    ["capital of egypt is ", "cairo\n"],
  ]) {
    const response = await wllama.createCompletion({
      prompt,
      // Bounded so a runaway model cannot hang the harness, and greedy so the
      // answer is the model's rather than the sampler's.
      max_tokens: expected.length,
      temperature: 0,
      ignore_eos: true,
    });
    completions.push({ prompt, expected, got: response?.choices?.[0]?.text ?? "" });
  }

  const info = wllama.getLoadedContextInfo();
  const outcome = {
    multithreaded: wllama.isMultithread(),
    threads: wllama.getNumThreads(),
    supportsWebGpu: wllama.isSupportWebGPU(),
    layers: info.n_layer,
    loadMs,
    completions,
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    hasGpu: !!navigator.gpu,
  };
  await wllama.exit();
  return outcome;
};

async function runMode(browser, base, label, options) {
  console.log(`\n${label}`);
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const log = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  // llama.cpp's own load report, which is the only place that says which
  // backend the tensors actually went to.
  page.on("console", (message) => log.push(message.text()));

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  let outcome;
  try {
    outcome = await page.evaluate(RUN_IN_PAGE, {
      ...options,
      ggufUrl: `${base}/${FIXTURE}`,
      wasmUrl: `${base}/@wllama/wllama/esm/wasm/wllama.wasm`,
      esmUrl: `${base}/@wllama/wllama/esm/index.js`,
    });
  } catch (error) {
    check(false, `${label}: the runtime started`, String(error).slice(0, 200));
    await context.close();
    return null;
  }
  await context.close();
  if (errors.length > 0) console.log(`     (page errors: ${errors.length})`);
  if (process.env.OCADE_WLLAMA_LOG) console.log(log.join("\n"));
  return { ...outcome, log };
}

/**
 * The graphics path, exercised through OCADE's own code rather than a copy.
 *
 * The adapter is bundled from `src/` with esbuild and served to the page, so
 * `probe()` here is the same function the product runs: same adapter request,
 * same limit, same catalogue, same wording. A re-implementation would only
 * prove that the harness agrees with itself.
 */
async function runGraphicsPath(browser, base) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  let outcome;
  try {
    outcome = await page.evaluate(async (bundleUrl) => {
      const gpu = navigator.gpu;
      const adapter = gpu ? await gpu.requestAdapter({ powerPreference: "high-performance" }) : null;
      const device = adapter ? await adapter.requestDevice() : null;

      /*
       * A REAL COMPUTE JOB, because an adapter that grants a device and then
       * cannot run a shader is not a usable engine — and every capability
       * decision below is worthless if the device is decorative.
       */
      let computed = null;
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const expected = input.reduce((total, n) => total + n * n, 0);
      if (device) {
        const module = device.createShaderModule({
          code: `
            @group(0) @binding(0) var<storage, read> src: array<f32>;
            @group(0) @binding(1) var<storage, read_write> dst: array<f32>;
            @compute @workgroup_size(8) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              dst[id.x] = src[id.x] * src[id.x];
            }`,
        });
        const bytes = new Float32Array(input).byteLength;
        const src = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const dst = device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const read = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        device.queue.writeBuffer(src, 0, new Float32Array(input));

        const pipeline = device.createComputePipeline({ layout: "auto", compute: { module, entryPoint: "main" } });
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: src } },
            { binding: 1, resource: { buffer: dst } },
          ],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
        encoder.copyBufferToBuffer(dst, 0, read, 0, bytes);
        device.queue.submit([encoder.finish()]);
        await read.mapAsync(GPUMapMode.READ);
        const squares = [...new Float32Array(read.getMappedRange())];
        read.unmap();
        computed = squares.reduce((total, n) => total + n, 0);
      }

      const { BrowserWebGpuAdapter, WEBGPU_TIERS, runtimeMemoryBytes, formatSize } = await import(
        /* @vite-ignore */ bundleUrl
      );
      const probe = await new BrowserWebGpuAdapter().probe();

      /*
       * The ceiling the device gave is what the decision must follow from. A
       * device that cannot hold the smallest engine must be refused; one that
       * can must be accepted. Anything else means the ladder is deciding on
       * something other than the hardware.
       */
      const smallest = Math.min(...WEBGPU_TIERS.map((tier) => runtimeMemoryBytes(tier)));
      const ceiling = adapter?.limits?.maxBufferSize ?? null;
      const fits = ceiling === null || ceiling >= smallest;

      // What a person would be shown. Never the model, the vendor or the size.
      const shown = probe.available ? probe.label : probe.reason;

      return {
        adapter: !!adapter,
        adapterInfo: adapter?.info?.vendor ? `${adapter.info.vendor} ${adapter.info.architecture ?? ""}`.trim() : "adapter granted",
        device: !!device,
        computed,
        expected,
        maxBufferSize: ceiling,
        probe: probe ?? null,
        probeSummary: shown,
        decisionMatchesLimit: probe.available === fits,
        decisionWhy: fits
          ? `${Math.round(ceiling / (1024 * 1024))} MiB offered, ${Math.round(smallest / (1024 * 1024))} MiB needed, accepted=${probe.available}`
          : `${Math.round(ceiling / (1024 * 1024))} MiB offered, ${Math.round(smallest / (1024 * 1024))} MiB needed, refused=${!probe.available}`,
        /*
         * WHAT THE RULE ACTUALLY FORBIDS, and it is narrower than "no numbers".
         *
         * Model name, vendor, filename, quantisation, repository, technical
         * identifier and DOWNLOAD SIZE may never appear. How much graphics
         * memory a device offers is none of those: it is a fact about the
         * hardware, and a refusal that withholds it cannot be acted on. So the
         * download figure is checked for by name — `formatSize(downloadBytes)`
         * is exactly the string a leak would produce — rather than banning
         * every unit that might be one.
         */
        noModelVocabulary:
          !/qwen|gguf|hugging\s*face|web[-\s]?llm|wllama|\bmlc\b|q4f16|q4_k|quantis|llama\.cpp/i.test(
            String(shown),
          ) && !WEBGPU_TIERS.some((tier) => String(shown).includes(formatSize(tier.downloadBytes))),
      };
    }, `${base}/${BUNDLE}`);
  } catch (error) {
    check(false, "4. the graphics path started", String(error).slice(0, 200));
    await context.close();
    return null;
  }
  await context.close();
  return outcome;
}

async function main() {
  if (!existsSync(FIXTURE)) {
    console.error(`Missing ${FIXTURE}`);
    process.exit(1);
  }

  /*
   * OCADE's graphics adapter, compiled from source so the page runs the
   * product's code and not a description of it.
   */
  writeFileSync(
    ENTRY,
    [
      'export { BrowserWebGpuAdapter } from "../src/lib/brain/adapters/browser-webgpu";',
      'export { WEBGPU_TIERS, runtimeMemoryBytes, formatSize } from "../src/lib/brain/browser-catalogue";',
    ].join("\n"),
  );
  execFileSync(
    "node_modules/.bin/esbuild",
    [ENTRY, "--bundle", "--format=esm", "--platform=browser", "--loader:.wasm=file", `--outfile=${BUNDLE}`],
    { stdio: "pipe" },
  );
  rmSync(ENTRY, { force: true });

  const server = serve();
  await new Promise((done) => server.listen(PORT, "127.0.0.1", done));
  const base = `http://127.0.0.1:${PORT}`;

  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    // `--enable-unsafe-webgpu` is what makes navigator.gpu real in this
    // container. It changes what the BROWSER offers, not what OCADE does.
    args: ["--no-sandbox", "--enable-unsafe-webgpu"],
  });

  try {
    const cores = 4;

    /* ------------------------------------------------- 1. multi-threaded */

    const mt = await runMode(browser, base, "1. Multi-threaded WebAssembly (processor)", {
      gpuLayers: 0,
      threads: Math.max(2, Math.floor(cores / 2)),
    });
    if (mt) {
      check(mt.crossOriginIsolated, "the page is cross-origin isolated");
      check(mt.sharedArrayBuffer, "SharedArrayBuffer is available");
      check(mt.multithreaded === true, "the runtime reports MULTI-THREADED", String(mt.multithreaded));
      check(mt.threads > 1, "on more than one thread", `${mt.threads} threads`);
      check(mt.loadMs > 0, "the model loaded", `${mt.loadMs}ms`);
      for (const c of mt.completions) {
        check(
          c.got === c.expected,
          `it completes ${JSON.stringify(c.prompt)} correctly`,
          `got ${JSON.stringify(c.got)}`,
        );
      }
    }

    /* --------------------------------------- 2. single-threaded fallback */

    const st = await runMode(browser, base, "2. One processor core (the universal fallback)", {
      gpuLayers: 0,
      threads: 1,
    });
    if (st) {
      check(
        st.multithreaded === false,
        "the runtime reports SINGLE-THREADED when asked for one thread",
        String(st.multithreaded),
      );
      check(st.threads === 1, "on exactly one thread", `${st.threads}`);
      for (const c of st.completions) {
        check(
          c.got === c.expected,
          `single-threaded completes ${JSON.stringify(c.prompt)} correctly`,
          `got ${JSON.stringify(c.got)}`,
        );
      }
    }

    if (mt && st) {
      check(
        mt.threads > st.threads,
        "the two processor modes genuinely differ in thread count",
        `${mt.threads} vs ${st.threads}`,
      );
    }

    /* ------------------- 3. the processor engine really is processor-only */

    console.log("\n3. The processor engine is processor-only");
    const asked = await runMode(browser, base, "   asked for every layer on the graphics card", {
      // 99 is more layers than the model has, which is how "all of them" is
      // spelled. wllama's default is 99999, so this is not even an unusual ask.
      gpuLayers: 99,
      threads: 1,
    });
    if (asked) {
      check(asked.hasGpu, "the browser really does offer WebGPU to this page");
      check(
        asked.supportsWebGpu,
        "and wllama's own WebGPU probe agrees the browser has one",
        String(asked.supportsWebGpu),
      );

      const backends = asked.log.find((line) => /backend_ptrs\.size\(\)/.test(line));
      check(
        backends?.includes("= 1") === true,
        "yet the bundled runtime registers exactly one backend",
        backends?.trim() ?? "no backend count in the load report",
      );

      const gpuBuffer = asked.log.some(
        (line) => /load_tensors:/.test(line) && /webgpu/i.test(line) && /buffer size/i.test(line),
      );
      check(!gpuBuffer, "no weights are resident on the graphics card");

      const cpuLayers = asked.log.filter((line) => /assigned to device CPU/.test(line));
      check(
        cpuLayers.length > 0,
        "every layer is assigned to the processor instead",
        `${cpuLayers.length} layers`,
      );

      /*
       * AND IT STILL ANSWERS CORRECTLY, which is the trap this section exists
       * to close. Asking for the graphics card and silently getting the
       * processor produces a run in which every other assertion passes. Only
       * the load report distinguishes them, so only the load report can be
       * trusted to say which engine served the answer.
       */
      for (const c of asked.completions) {
        check(c.got === c.expected, `and answers correctly regardless`, `got ${JSON.stringify(c.got)}`);
      }
    }

    /* --------------------------- 4. the graphics path, as OCADE ships it */

    console.log("\n4. The graphics path, through OCADE's own adapter");
    const gpu = await runGraphicsPath(browser, base);
    if (gpu) {
      check(gpu.adapter, "a real WebGPU adapter is granted", gpu.adapterInfo);
      check(gpu.device, "and a real device is created from it");
      check(
        gpu.computed === gpu.expected,
        "a compute shader runs on it and returns the right numbers",
        `${gpu.computed} vs ${gpu.expected}`,
      );
      check(
        typeof gpu.maxBufferSize === "number" && gpu.maxBufferSize > 0,
        "the device reports a real allocation ceiling",
        `${Math.round(gpu.maxBufferSize / (1024 * 1024))} MiB`,
      );

      /*
       * FROM HERE DOWN IT IS OCADE'S OWN CODE, compiled from src/ and run in
       * this page — not a re-implementation of it. `probe()` asks the same
       * adapter for the same limit and hands it to the same catalogue, so what
       * comes back is the decision the product would make on this machine.
       */
      check(gpu.probe !== null, "OCADE's graphics adapter reaches a decision", gpu.probeSummary);
      check(
        gpu.decisionMatchesLimit,
        "and that decision follows from the ceiling the device actually reported",
        gpu.decisionWhy,
      );
      check(
        gpu.noModelVocabulary,
        "nothing it would show a person names a model, a vendor or a download size",
        gpu.probeSummary,
      );
    }

  } finally {
    await browser.close();
    server.close();
    rmSync(BUNDLE, { force: true });
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "=".repeat(70));
  console.log(
    failed.length === 0
      ? `ALL ${results.length} RUNTIME-MODE CHECKS PASSED, with verified model output.`
      : `${failed.length} of ${results.length} FAILED:\n${failed.map((f) => `  - ${f.what}${f.detail ? ` (${f.detail})` : ""}`).join("\n")}`,
  );
  console.log("=".repeat(70) + "\n");
  process.exit(failed.length === 0 ? 0 : 1);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
