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
const ARTIFACT = path.resolve(process.argv[2] ?? path.join(ROOT, ".artifact", "artifact.bin"));
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 8799;
const PROOF_TIMEOUT_MS = 600_000;
const ARTIFACT_SIZE = statSync(ARTIFACT).size;

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

  // The proof must not silently fetch compatibility runtime code from a CDN.
  // Current Chromium supports JSPI + Memory64, so use the bundled OCADE WASM only.
  engine.setCompat(null);

  const threads = diagnostics.crossOriginIsolated && diagnostics.sharedArrayBuffer ? 2 : 1;
  diagnostics.threads = threads;

  try {
    // Loading the already-fetched Blob avoids the ModelManager/cache download path
    // and lets modern Wllama use async Blob reads instead of materializing a second
    // full copy of the GGUF in browser/WASM memory.
    await engine.loadModel([modelBlob], {
      n_ctx: 128,
      n_batch: 32,
      n_ubatch: 32,
      n_threads: threads,
      n_gpu_layers: 0,
      n_parallel: 1,
      reasoning: false,
      warmup: false,
      jinja: true,
    });

    const response = await engine.createChatCompletion({
      messages: [
        {
          role: "user",
          content: "What is two plus two? Answer with the number only. /no_think",
        },
      ],
      max_tokens: 24,
      temperature: 0,
      stream: false,
    });

    const answer = String(response?.choices?.[0]?.message?.content ?? "").trim();
    return { answer, diagnostics };
  } finally {
    await engine.exit();
  }
};
</script>`;

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

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ["--no-sandbox", "--disable-gpu"],
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
      setTimeout(() => reject(new Error("Offline browser proof timed out after 10 minutes.")), PROOF_TIMEOUT_MS),
    ),
  ]);

  const text = String(result?.answer ?? "").trim();
  const d = result?.diagnostics ?? {};
  process.stdout.write(
    `runtime: JSPI=${Boolean(d.jspi)} Memory64=${Boolean(d.memory64)} isolated=${Boolean(d.crossOriginIsolated)} threads=${d.threads ?? "?"} modelBytes=${d.modelBytes ?? "?"}\n`,
  );
  process.stdout.write(`answer: ${JSON.stringify(text.slice(0, 200))}\n`);

  if (!text) {
    failed = true;
    process.stderr.write("The engine loaded the artifact and produced nothing.\n");
  } else if (!/\b(4|four)\b/i.test(text)) {
    failed = true;
    process.stderr.write("The engine answered, but not correctly.\n");
  } else {
    process.stdout.write("PASS  the artifact loads and answers correctly\n");
  }
} catch (error) {
  failed = true;
  process.stderr.write(`${error}\n`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

process.exit(failed ? 1 : 0);
