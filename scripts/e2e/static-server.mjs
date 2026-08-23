/** Minimal static server with Range support, for serving test model assets. */
import http from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { join, extname, normalize } from "node:path";

const ROOT = process.argv[2] ?? ".";
const PORT = Number(process.argv[3] ?? 4174);
const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".html": "text/html",
  ".gguf": "application/octet-stream",
  ".map": "application/json",
  ".ts": "text/plain",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, rel === "/" ? "/index.html" : rel);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    const size = statSync(file).size;
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const headers = {
      "content-type": type,
      "access-control-allow-origin": "*",
      "accept-ranges": "bytes",
      // wllama's multi-thread path wants cross-origin isolation; harmless here.
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "cross-origin",
    };
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Number(m[2]) : size - 1;
        res.writeHead(206, {
          ...headers,
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${size}`,
        });
        createReadStream(file, { start, end }).pipe(res);
        return;
      }
    }
    res.writeHead(200, { ...headers, "content-length": String(size) });
    createReadStream(file).pipe(res);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`static ${ROOT} on ${PORT}`));
