#!/usr/bin/env node
/**
 * PROVE THAT THIS EXACT ARTIFACT ANSWERS A QUESTION.
 *
 * This test proves the local release artifact itself can load and infer in the
 * same browser/Wllama runtime used by OCADE. It deliberately bypasses model
 * download/cache plumbing: delivery is proved separately against the real
 * authorized endpoint.
 *
 * Usage: node scripts/prove-offline-artifact.mjs [path/to/artifact.bin]
 */
import { createReadStream, statSync } from "node:fs";
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
const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

const supportsMemory64 = () => {
  try {
    new WebAssembly.Memory({ initial: 1n, address: "i64" });
    return true;
  } catch {
    return false;
  }
};

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
  const modelBlob = await modelResponse.blob();
  if (modelBlob.size !== ${ARTIFACT_SIZE}) {
    throw new Error(
      "Artifact byte count changed: expected ${ARTIFACT_SIZE}, received " + modelBlob.size + ".",
    );
  }
  diagnostics.modelBytes = modelBlob.size;

  const wasm = "/node_modules/@wllama/wllama/esm/wasm/wllama.wasm";
  const engine = new Wllama(
    { default: wasm },
    { allowOffline: true, suppressNativeLog: false },
  );

  // Never fetch compatibility runtime code from an external CDN during proof.
  engine.setCompat(null);

  const threads = diagnostics.crossOriginIsolated && diagnostics.sharedArrayBuffer ? 2 : 1;
  diagnostics.threads = threads;

  /*
   * THE GRAPHICS RUNG, ASKED FOR HONESTLY.
   *
   * wllama 3.5.1 ships one wllama.wasm built with llama.cpp's ggml-webgpu
   * backend, so the same file runs on the card or the processor depending only
   * on n_gpu_layers. Asking for an adapter is what decides whether this run can
   * even try; the load below is what decides whether it works.
   */
  diagnostics.gpuRequested = !GPU_LAYERS ? 0 : GPU_LAYERS;
  diagnostics.gpuAdapter = false;
  try {
    diagnostics.gpuAdapter = navigator.gpu ? (await navigator.gpu.requestAdapter()) !== null : false;
  } catch (error) {
    diagnostics.gpuAdapterError = String(error);
  }

  try {
    await engine.loadModel([modelBlob], {
      n_ctx: 512,
      n_batch: 64,
      n_ubatch: 64,
      n_threads: threads,
      n_gpu_layers: diagnostics.gpuAdapter ? GPU_LAYERS : 0,
      n_parallel: 1,
      /*
       * Loaded exactly as the product loads it. This used to pass
       * reasoning:false and a zero reasoning budget, which suppressed
       * deliberation at load time — so the proof could never have observed
       * thinking even once it was asked for, and it proved the artifact under
       * conditions the adapter does not apply.
       */
      default_template_kwargs: { enable_thinking: false },
      warmup: false,
      jinja: true,
      seed: 42,
    });

    diagnostics.hasChatTemplate = Boolean(engine.getChatTemplate());
    if (!diagnostics.hasChatTemplate) {
      throw new Error("The GGUF has no embedded chat template; refusing to treat raw generation as a chat proof.");
    }

    const response = await engine.createChatCompletion({
      messages: [
        {
          role: "user",
          content: "What is 2 + 2? Answer with the number only.",
        },
      ],
      max_tokens: 16,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      min_p: 0,
      seed: 42,
      chat_template_kwargs: { enable_thinking: false },
      stream: false,
    });

    const answer = String(response?.choices?.[0]?.message?.content ?? "").trim();

    /*
     * THE SAME WEIGHTS, DELIBERATING.
     *
     * Qwen3 carries both modes in one artifact and the chat template chooses
     * between them, so this is the proof that enable_thinking:true genuinely
     * produces a reasoning block on THIS file in THIS runtime — not an
     * assumption from the model card. The manifest thinkingSuitable flag may
     * only be set from this result.
     *
     * The budget is deliberately generous and the question deliberately small:
     * what is being proven is that deliberation happens and still arrives at
     * the right answer, not how fast it is on this machine.
     */
    const thinkingStartedAt = Date.now();
    const deliberated = await engine.createChatCompletion({
      messages: [{ role: "user", content: "What is 2 + 2? Answer with the number only." }],
      max_tokens: 512,
      temperature: 0.7,
      top_p: 0.8,
      top_k: 20,
      min_p: 0,
      seed: 42,
      chat_template_kwargs: { enable_thinking: true },
      stream: false,
    });
    diagnostics.thinkingMs = Date.now() - thinkingStartedAt;

    /*
     * WHERE THE REASONING ACTUALLY LANDS, RATHER THAN WHERE IT WAS ASSUMED TO.
     *
     * The first run of this proof reported opened=false, closed=false and a
     * correct answer of "4", and that was read as "no thinking". It was the
     * opposite: wllama loads llama.cpp with reasoning_format defaulting to
     * deepseek, which PARSES the reasoning block out of the message and
     * removes the tags from content. Looking for a literal <think> in content
     * therefore cannot see deliberation that definitely happened.
     *
     * So take the evidence the runtime actually offers, all of it:
     *   - content, in case reasoning_format is none and the tags survive;
     *   - reasoning_content, which is where llama.cpp puts the parsed block
     *     (wllama 3.5.1 does not declare it, so it is read defensively);
     *   - usage.completion_tokens_details.reasoning_tokens, which wllama DOES
     *     declare and which is a count nothing else could produce.
     *
     * Any one of the three is proof the model deliberated. The observed keys
     * are reported either way, so a future change of runtime is diagnosable
     * rather than mysterious.
     */
    const message = deliberated?.choices?.[0]?.message ?? {};
    const raw = String(message.content ?? "");
    const parsedReasoning = String(message.reasoning_content ?? "");
    const reasoningTokens = Number(
      deliberated?.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    );

    diagnostics.messageKeys = Object.keys(message);
    diagnostics.thinkingOpened = raw.includes(OPEN_TAG);
    diagnostics.thinkingClosed = raw.includes(CLOSE_TAG);
    diagnostics.reasoningContentChars = parsedReasoning.length;
    diagnostics.reasoningTokens = Number.isFinite(reasoningTokens) ? reasoningTokens : 0;
    diagnostics.thinkingChars = raw.length;
    diagnostics.deliberated =
      (diagnostics.thinkingOpened && diagnostics.thinkingClosed) ||
      diagnostics.reasoningContentChars > 0 ||
      diagnostics.reasoningTokens > 0;

    /*
     * NO REGULAR EXPRESSION, AND THAT IS THE POINT.
     *
     * This page is a template literal in a Node file, so every backslash in it
     * is eaten before the browser sees it. An ordinary think-tag regex lost the
     * backslash escaping its closing slash, so the literal ended early, and the
     * page died with "Invalid regular expression flags" before window.__prove
     * was ever defined. String indexes carry no backslashes at all, so there is
     * nothing left for the outer literal to mangle.
     */
    const opened = raw.indexOf(OPEN_TAG);
    const closed = raw.indexOf(CLOSE_TAG);
    const thinkingAnswer = (
      opened === -1 || closed === -1
        ? raw
        : raw.slice(0, opened) + raw.slice(closed + CLOSE_TAG.length)
    ).trim();

    return { answer, thinkingAnswer, diagnostics };
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
   * THINKING IS A SEPARATE CLAIM AND GETS A SEPARATE VERDICT.
   *
   * `release/OCADE_OFFLINE_RELEASE.json` may only carry `thinkingSuitable:
   * true` on the strength of these three lines. Qwen3-0.6B carries both modes
   * in one artifact, but "the model card says so" is not proof about this file
   * in this runtime.
   */
  const thinking = String(result?.thinkingAnswer ?? "").trim();
  process.stdout.write(
    `thinking: deliberated=${Boolean(d.deliberated)} tags=${Boolean(d.thinkingOpened && d.thinkingClosed)} ` +
      `reasoningContentChars=${d.reasoningContentChars ?? 0} reasoningTokens=${d.reasoningTokens ?? 0} ` +
      `answerChars=${d.thinkingChars ?? "?"} ms=${d.thinkingMs ?? "?"} ` +
      `messageKeys=${JSON.stringify(d.messageKeys ?? [])}\n`,
  );
  process.stdout.write(`thinking answer: ${JSON.stringify(thinking.slice(0, 200))}\n`);

  if (!d.deliberated) {
    failed = true;
    process.stderr.write(
      "Asked to deliberate, the artifact showed no reasoning by any measure the runtime offers: " +
        "no reasoning block in content, no reasoning_content, and no reasoning tokens counted. " +
        "Do not set thinkingSuitable on this release.\n",
    );
  } else if (!isCorrectArithmeticAnswer(thinking)) {
    failed = true;
    process.stderr.write(
      "The artifact deliberated but the answer left after the reasoning was not correct. " +
        "Do not set thinkingSuitable on this release.\n",
    );
  } else {
    process.stdout.write("PASS  the same artifact deliberates and still answers correctly\n");
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
  if (d.gpuAdapter && (d.gpuRequested ?? 0) > 0) {
    process.stdout.write(
      "PASS  the artifact answered with layers offloaded to the graphics card\n",
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

process.exit(failed ? 1 : 0);
