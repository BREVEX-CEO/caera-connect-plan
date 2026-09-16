#!/usr/bin/env node
/**
 * PROVE THAT THIS EXACT ARTIFACT ANSWERS A QUESTION.
 *
 * A digest proves the bytes arrived intact. It does not prove they are a model
 * that runs, and the failures that reach customers are exactly the ones a
 * digest is blind to: a container this engine's build cannot read, a tensor
 * layout it will not accept, a context it cannot allocate. So before a release
 * is served to anybody, it is loaded in a real browser, in the same engine the
 * product uses, and asked something with a knowable answer.
 *
 * It runs against the local file rather than the bucket on purpose: this is a
 * question about the artifact, not about delivery. Delivery is proved
 * separately, in the browser journey, against the real endpoint.
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

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".html": "text/html; charset=utf-8",
};

const PAGE = `<!doctype html><meta charset="utf-8"><title>proof</title><script type="module">
import { Wllama } from "/node_modules/@wllama/wllama/esm/index.js";
window.__prove = async () => {
  const wasm = "/node_modules/@wllama/wllama/esm/wasm/wllama.wasm";
  const engine = new Wllama(
    { "single-thread/wllama.wasm": wasm, default: wasm },
    { allowOffline: true },
  );
  await engine.loadModelFromUrl("/artifact.gguf", { n_ctx: 512, n_threads: 1 });
  const answer = await engine.createCompletion(
    "<|im_start|>user\\nWhat is two plus two? Answer with the number only.<|im_end|>\\n<|im_start|>assistant\\n",
    { nPredict: 24, sampling: { temp: 0 } },
  );
  await engine.exit();
  return answer;
};
</script>`;

/**
 * A static server that honours Range.
 *
 * The engine asks for the model in pieces, so a server that ignores `Range`
 * would make this prove something the product never does.
 */
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": TYPES[".html"] });
    response.end(PAGE);
    return;
  }

  const file =
    url.pathname === "/artifact.gguf" ? ARTIFACT : path.join(ROOT, url.pathname.replace(/^\/+/, ""));
  if (!file.startsWith(ROOT) && file !== ARTIFACT) {
    response.writeHead(403).end();
    return;
  }

  let size;
  try {
    size = statSync(file).size;
  } catch {
    response.writeHead(404).end();
    return;
  }

  const type = TYPES[path.extname(file)] ?? "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    response.writeHead(206, {
      "content-type": type,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
      "accept-ranges": "bytes",
    });
    createReadStream(file, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "content-type": type,
    "content-length": size,
    "accept-ranges": "bytes",
  });
  createReadStream(file).pipe(response);
});

statSync(ARTIFACT);
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
let failed = false;
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    failed = true;
    process.stderr.write(`page error: ${error}\n`);
  });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
  const answer = await page.evaluate(() => window.__prove(), { timeout: 600_000 });
  const text = String(answer ?? "").trim();
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
  server.close();
}

process.exit(failed ? 1 : 0);
