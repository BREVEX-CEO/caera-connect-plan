#!/usr/bin/env node
/**
 * PROVE THAT THIS EXACT ARTIFACT ANSWERS A QUESTION AND READS AN IMAGE.
 *
 * The release is one opaque artifact holding two GGUF parts back to back: the
 * language weights, then the vision projector. The manifest names where the
 * first part ends. This loads both parts in the same browser/wllama runtime
 * OCADE uses, asks a text question, then shows it a picture drawn in the page
 * and asks what it shows. The manifest's `vision` flag may be set only from a
 * PASS here.
 *
 * It deliberately bypasses download/cache plumbing: delivery is proved
 * separately against the real authorized endpoint.
 *
 * Usage: node scripts/prove-offline-artifact.mjs [path/to/artifact.bin] [--cpu-only] [--record]
 *   --record  on a full PASS, set `vision: true` in the manifest.
 */
import { createReadStream, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = process.cwd();
// The first argument that is not a flag (F-021: --cpu-only was read as the path).
const ARTIFACT = path.resolve(
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
    path.join(ROOT, ".artifact", "artifact.bin"),
);
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const PORT = 8799;
const PROOF_TIMEOUT_MS = 600_000;
const ARTIFACT_SIZE = statSync(ARTIFACT).size;
/** Reproduce processor-only conditions deliberately rather than by accident. */
const CPU_ONLY = process.argv.includes("--cpu-only");

const MANIFEST_PATH = path.join(ROOT, "release", "OCADE_OFFLINE_RELEASE.json");
const MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const RECORD = process.argv.includes("--record");
const PARTS = Array.isArray(MANIFEST.parts) ? MANIFEST.parts : [];
if (PARTS.length !== 2 || PARTS[0].bytes + PARTS[1].bytes !== ARTIFACT_SIZE) {
  process.stderr.write(
    "The manifest must describe exactly two parts whose sizes add up to this artifact.\n",
  );
  process.exit(2);
}
const SPLIT = PARTS[0].bytes;

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".html": "text/html; charset=utf-8",
  ".gguf": "application/octet-stream",
};

const ISOLATION_HEADERS = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-resource-policy": "same-origin",
  "cache-control": "no-store",
};

const PAGE = `<!doctype html><meta charset="utf-8"><title>OCADE offline proof</title><script type="module">
import { Wllama } from "/node_modules/@wllama/wllama/esm/index.js";

const GPU_LAYERS = ${CPU_ONLY ? 0 : 99};

const supportsMemory64 = () => {
  try {
    new WebAssembly.Memory({ initial: 1n, address: "i64" });
    return true;
  } catch {
    return false;
  }
};

/* A picture whose content is known: a red page with a large blue square. */
async function knownPicture() {
  const canvas = new OffscreenCanvas(256, 256);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ff0000";
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = "#0000ff";
  context.fillRect(64, 64, 128, 128);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return png.arrayBuffer();
}

window.__prove = async () => {
  const diagnostics = {
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    jspi: typeof WebAssembly.Suspending === "function",
    memory64: supportsMemory64(),
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
  };

  if (!diagnostics.jspi || !diagnostics.memory64) {
    throw new Error(
      "This Chromium runtime lacks the modern WebAssembly features required for the local OCADE proof " +
      "(JSPI=" + diagnostics.jspi + ", Memory64=" + diagnostics.memory64 + ").",
    );
  }

  const modelResponse = await fetch("/artifact.gguf", { cache: "no-store" });
  if (!modelResponse.ok) {
    throw new Error("Artifact fetch failed with HTTP " + modelResponse.status + ".");
  }
  const whole = await modelResponse.blob();
  if (whole.size !== ${ARTIFACT_SIZE}) {
    throw new Error(
      "Artifact byte count changed: expected ${ARTIFACT_SIZE}, received " + whole.size + ".",
    );
  }
  diagnostics.modelBytes = whole.size;
  const parts = [whole.slice(0, ${SPLIT}), whole.slice(${SPLIT})];

  const wasm = "/node_modules/@wllama/wllama/esm/wasm/wllama.wasm";
  const engine = new Wllama(
    { default: wasm },
    { allowOffline: true, suppressNativeLog: false },
  );

  // Never fetch compatibility runtime code from an external CDN during proof.
  engine.setCompat(null);

  const threads = diagnostics.crossOriginIsolated && diagnostics.sharedArrayBuffer ? 2 : 1;
  diagnostics.threads = threads;

  diagnostics.gpuRequested = !GPU_LAYERS ? 0 : GPU_LAYERS;
  diagnostics.gpuAdapter = false;
  try {
    diagnostics.gpuAdapter = navigator.gpu ? (await navigator.gpu.requestAdapter()) !== null : false;
  } catch (error) {
    diagnostics.gpuAdapterError = String(error);
  }

  try {
    await engine.loadModel(parts, {
      // The product's own load parameters (browser-wasm.ts loadParams).
      n_ctx: 2048,
      n_batch: 256,
      n_ubatch: 256,
      image_max_tokens: 256,
      n_threads: threads,
      n_gpu_layers: diagnostics.gpuAdapter ? GPU_LAYERS : 0,
      n_parallel: 1,
      warmup: false,
      jinja: true,
      seed: 42,
    });

    diagnostics.hasChatTemplate = Boolean(engine.getChatTemplate());
    if (!diagnostics.hasChatTemplate) {
      throw new Error("The GGUF has no embedded chat template; refusing to treat raw generation as a chat proof.");
    }
    diagnostics.imageInput = engine.supportInputModality("image");

    const response = await engine.createChatCompletion({
      messages: [{ role: "user", content: "What is 2 + 2? Answer with the number only." }],
      max_tokens: 16,
      // The product's sampler (src/lib/brain/sampler-settings.ts).
      temperature: 0.1,
      top_p: 1,
      top_k: 0,
      min_p: 0.15,
      repeat_penalty: 1.05,
      seed: 42,
      stream: false,
    });
    const answer = String(response?.choices?.[0]?.message?.content ?? "").trim();

    let imageAnswer = "";
    if (diagnostics.imageInput) {
      const startedAt = Date.now();
      const seen = await engine.createChatCompletion({
        messages: [
          {
            role: "user",
            content: [
              { type: "image", data: await knownPicture() },
              {
                type: "text",
                text: "Name the colours in this image in one short sentence.",
              },
            ],
          },
        ],
        max_tokens: 40,
        temperature: 0.1,
        top_p: 1,
        top_k: 0,
        min_p: 0.15,
        repeat_penalty: 1.05,
        seed: 42,
        stream: false,
      });
      diagnostics.imageMs = Date.now() - startedAt;
      imageAnswer = String(seen?.choices?.[0]?.message?.content ?? "").trim();
    }

    return { answer, imageAnswer, diagnostics };
  } finally {
    await engine.exit();
  }
};
</script>`;

/*
 * THE PAGE MUST SURVIVE THE LITERAL THAT CARRIES IT.
 *
 * `PAGE` is a template literal, so the browser receives it with every escape
 * already processed: a backslash here is a backslash the browser never sees.
 * That silently broke a regex into something unparseable, and the failure
 * surfaced ten minutes later as "window.__prove is not a function" — a
 * confusing symptom a long way from its cause.
 *
 * Checked at startup rather than discovered in a browser. If a backslash is
 * ever genuinely needed, escape it as \\ and exempt it deliberately.
 */
const backslashes = (PAGE.match(/\\/g) ?? []).length;
if (backslashes > 0) {
  process.stderr.write(
    `The embedded proof page contains ${backslashes} backslash(es). The template literal eats ` +
      "them before the browser parses the script, which breaks regular expressions and string " +
      "escapes in ways that surface far from the cause. Rewrite without them.\n",
  );
  process.exit(2);
}

function sendError(response, status, message, extraHeaders = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    ...ISOLATION_HEADERS,
    ...extraHeaders,
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match || (!match[1] && !match[2])) return null;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

function isCorrectArithmeticAnswer(answer) {
  const normalized = String(answer ?? "")
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!]+$/g, "")
    .trim();

  // Accept only clearly correct forms. This deliberately rejects answers that
  // merely contain the digit 4 somewhere in unrelated or contradictory text.
  return (
    /^(?:4|four)$/.test(normalized) ||
    /^2\s*\+\s*2\s*=\s*(?:4|four)$/.test(normalized) ||
    /^(?:the\s+)?answer\s+(?:is|=)\s*(?:4|four)$/.test(normalized)
  );
}

/** Both colours the picture really holds, and no colour it does not. */
function isCorrectColourAnswer(answer) {
  const named = (colour) => new RegExp(`\\b${colour}\\b`).test(answer);
  const wrong = ["green", "yellow", "purple", "orange", "pink", "black", "white"].some(named);
  return named("red") && named("blue") && !wrong;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/") {
    const body = Buffer.from(PAGE);
    response.writeHead(200, {
      ...ISOLATION_HEADERS,
      "content-type": TYPES[".html"],
      "content-length": body.length,
    });
    response.end(body);
    return;
  }

  const file =
    url.pathname === "/artifact.gguf"
      ? ARTIFACT
      : path.resolve(ROOT, url.pathname.replace(/^\/+/, ""));
  const insideRoot = file === ROOT || file.startsWith(`${ROOT}${path.sep}`);
  if (file !== ARTIFACT && !insideRoot) {
    sendError(response, 403, "Forbidden");
    return;
  }

  let size;
  try {
    size = statSync(file).size;
  } catch {
    sendError(response, 404, "Not found");
    return;
  }

  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const baseHeaders = {
    ...ISOLATION_HEADERS,
    "content-type": type,
    "accept-ranges": "bytes",
  };

  if (request.method === "HEAD") {
    response.writeHead(200, { ...baseHeaders, "content-length": size });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405, { ...ISOLATION_HEADERS, allow: "GET, HEAD" });
    response.end();
    return;
  }

  if (request.headers.range) {
    const range = parseRange(request.headers.range, size);
    if (!range) {
      response.writeHead(416, {
        ...baseHeaders,
        "content-range": `bytes */${size}`,
        "content-length": 0,
      });
      response.end();
      return;
    }

    response.writeHead(206, {
      ...baseHeaders,
      "content-range": `bytes ${range.start}-${range.end}/${size}`,
      "content-length": range.end - range.start + 1,
    });
    createReadStream(file, { start: range.start, end: range.end }).pipe(response);
    return;
  }

  response.writeHead(200, { ...baseHeaders, "content-length": size });
  createReadStream(file).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(PORT, "127.0.0.1", resolve);
});

/*
 * --disable-gpu WOULD MAKE THE GRAPHICS VERDICT MEANINGLESS.
 *
 * This proof answers whether the artifact runs on the graphics card, so the
 * browser has to be allowed one. Pass --cpu-only to reproduce the old
 * processor-only conditions deliberately rather than by accident.
 */
const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: CPU_ONLY
    ? ["--no-sandbox", "--disable-gpu"]
    : ["--no-sandbox", "--enable-unsafe-webgpu", "--enable-features=Vulkan"],
});
let failed = false;
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    process.stderr.write(`page error: ${error}\n`);
  });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });

  const result = await Promise.race([
    page.evaluate(() => window.__prove()),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Offline browser proof timed out after 10 minutes.")),
        PROOF_TIMEOUT_MS,
      ),
    ),
  ]);

  const text = String(result?.answer ?? "").trim();
  const d = result?.diagnostics ?? {};
  process.stdout.write(
    `runtime: JSPI=${Boolean(d.jspi)} Memory64=${Boolean(d.memory64)} isolated=${Boolean(d.crossOriginIsolated)} threads=${d.threads ?? "?"} chatTemplate=${Boolean(d.hasChatTemplate)} modelBytes=${d.modelBytes ?? "?"}\n`,
  );
  process.stdout.write(`answer: ${JSON.stringify(text.slice(0, 200))}\n`);

  if (!text) {
    failed = true;
    process.stderr.write("The engine loaded the artifact and produced nothing.\n");
  } else if (!isCorrectArithmeticAnswer(text)) {
    failed = true;
    process.stderr.write(
      "The engine loaded and generated, but the basic arithmetic answer was not correct.\n",
    );
  } else {
    process.stdout.write("PASS  the artifact loads and answers correctly\n");
  }

  /*
   * VISION IS A SEPARATE CLAIM AND GETS A SEPARATE VERDICT. The manifest's
   * `vision` flag may be set only on the strength of this line.
   */
  const seen = String(result?.imageAnswer ?? "").toLowerCase();
  process.stdout.write(
    `vision: imageInput=${Boolean(d.imageInput)} ms=${d.imageMs ?? "?"} answer=${JSON.stringify(seen.slice(0, 200))}\n`,
  );
  if (!d.imageInput) {
    failed = true;
    process.stderr.write(
      "The runtime did not accept the projector: no image input. Do not set vision.\n",
    );
  } else if (!isCorrectColourAnswer(seen)) {
    failed = true;
    process.stderr.write(
      "The engine read the picture but named the wrong colours. Do not set vision.\n",
    );
  } else {
    process.stdout.write("PASS  the same artifact reads a known picture correctly\n");
  }

  /*
   * THE GRAPHICS VERDICT — PLAN.md Phase 7.
   *
   * "Capability detection alone is not proof." So this reports what was asked
   * for, what the browser handed over, and whether the run that used it
   * answered correctly. A machine with no adapter is not a failure: it is the
   * processor rung, which is the fallback working.
   */
  process.stdout.write(
    `graphics: requested=${d.gpuRequested ?? 0} adapter=${Boolean(d.gpuAdapter)}` +
      `${d.gpuAdapterError ? ` error=${JSON.stringify(d.gpuAdapterError)}` : ""}\n`,
  );
  // The runtime reports what was requested, not how many layers really ran on the
  // card, so the line says exactly that, and only after a correct answer (F-131).
  if (d.gpuAdapter && (d.gpuRequested ?? 0) > 0) {
    process.stdout.write(
      isCorrectArithmeticAnswer(text)
        ? `NOTE  answered correctly with ${d.gpuRequested} layers requested on the graphics card; the offloaded count is not observable here\n`
        : "FAIL  graphics layers were requested and the answer was not correct\n",
    );
  } else {
    process.stdout.write(
      "NOTE  no graphics adapter here; the processor rung answered instead, which is the " +
        "fallback behaving correctly. Re-run on GPU hardware for the graphics verdict.\n",
    );
  }
} catch (error) {
  failed = true;
  process.stderr.write(`${error}\n`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (!failed && RECORD) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify({ ...MANIFEST, vision: true }, null, 2)}\n`);
  process.stdout.write("Recorded vision: true in the manifest.\n");
}

process.exit(failed ? 1 : 0);
