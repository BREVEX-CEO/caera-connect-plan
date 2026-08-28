import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import http from "node:http";
import { readFileSync } from "node:fs";

/**
 * The CDN verifier, run against real servers over real sockets.
 *
 * A CHECKER THAT PASSES A BROKEN ORIGIN IS WORSE THAN NO CHECKER, because it
 * converts "we have not looked" into "we looked and it was fine". So the
 * verifier is pointed at deliberately misconfigured servers — each wrong in
 * exactly one way a real CDN is wrong — and required to notice.
 *
 * The misconfigurations are not hypothetical. Every one is a default somebody
 * ships: an object store with no CORS, a proxy that advertises ranges and
 * ignores them, a bucket without immutable caching, an object replaced without
 * the version in the path changing.
 */

const catalogue = JSON.parse(
  readFileSync("release/OCADE_BROWSER_MODEL_CATALOGUE.json", "utf8"),
) as { entries: { id: string; path: string; sizeBytes: number }[] };

const ENTRY = catalogue.entries[0];
const VERSION = ENTRY.id.replace(/^wasm-/, "");

interface ServerOptions {
  cors?: boolean;
  ranges?: boolean;
  /** Advertise ranges but answer 200 with the whole body anyway. */
  ignoreRanges?: boolean;
  immutable?: boolean;
  /** Serve a different length than the catalogue declares. */
  wrongSize?: boolean;
}

const servers: http.Server[] = [];

/**
 * A stand-in origin.
 *
 * It serves a small body while REPORTING the catalogue's size, because what is
 * under test is the verifier's reading of headers and range semantics, not its
 * ability to move a gigabyte. The one case that needs the size to disagree
 * sets `wrongSize`.
 */
async function origin(options: ServerOptions = {}): Promise<string> {
  const declared = options.wrongSize ? ENTRY.sizeBytes - 1 : ENTRY.sizeBytes;
  const body = Buffer.alloc(8 * 1024 * 1024, 7);

  const server = http.createServer((req, res) => {
    const headers: Record<string, string> = {};
    if (options.cors !== false) {
      headers["access-control-allow-origin"] = "*";
      headers["access-control-expose-headers"] = "content-range, content-length, accept-ranges";
    }
    if (options.ranges !== false || options.ignoreRanges) headers["accept-ranges"] = "bytes";
    headers["cache-control"] =
      options.immutable === false ? "public, max-age=60" : "public, max-age=31536000, immutable";

    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "content-length": String(declared) });
      res.end();
      return;
    }

    const range = req.headers.range;
    const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
    if (!match || options.ranges === false || options.ignoreRanges) {
      res.writeHead(200, { ...headers, "content-length": String(body.length) });
      res.end(body);
      return;
    }

    const start = Number(match[1]);
    const end = match[2] === "" ? declared - 1 : Number(match[2]);
    const length = end - start + 1;
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${declared}`,
      "content-length": String(length),
    });
    // Deterministic from the offset, so concurrent reads of the same range
    // must produce identical bytes — which is what the verifier checks.
    res.end(Buffer.alloc(length, (start / (1024 * 1024)) % 251));
  });

  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  servers.push(server);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

afterAll(async () => {
  await Promise.all(
    servers.map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});

/**
 * Run the real script.
 *
 * `--base` normally refuses plain http, which is right for production and
 * impossible for a loopback test server, so the check is exercised through
 * `OCADE_CDN_ALLOW_INSECURE` — a flag that exists only for this and is asserted
 * below to be absent from any production path.
 */
function runVerifier(base: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, ["scripts/verify-model-cdn.mjs", "--base", base], {
      env: { ...process.env, OCADE_CDN_ALLOW_INSECURE: "1" },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    child.stderr.on("data", (chunk) => (output += String(chunk)));
    child.on("close", (code) => done({ code: code ?? 1, output }));
  });
}

describe("a correctly configured origin passes", () => {
  it("reports every check green and exits 0", async () => {
    const base = await origin();
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/ALL \d+ CDN CHECKS PASSED/);
    expect(code).toBe(0);
  }, 60_000);

  it("proves ranges are honoured rather than merely advertised", async () => {
    const base = await origin();
    const { output } = await runVerifier(base);
    expect(output).toMatch(/PASS {2}a ranged request is honoured with 206/);
    expect(output).toMatch(/PASS {2}four concurrent ranges all return correct lengths/);
    expect(output).toMatch(/PASS {2}a read starting mid-file works/);
  }, 60_000);
});

describe("each way a real CDN is misconfigured is caught", () => {
  it("catches a missing CORS header", async () => {
    // The most common object-store default, and the transfer cannot even start.
    const base = await origin({ cors: false });
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/FAIL {2}CORS allows the site to fetch it/);
    expect(code).not.toBe(0);
  }, 60_000);

  it("catches an origin that advertises ranges and ignores them", async () => {
    /*
     * The dangerous one. `accept-ranges: bytes` with a 200 answer looks correct
     * to a header check and turns every interruption into a restart.
     */
    const base = await origin({ ignoreRanges: true });
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/FAIL {2}a ranged request is honoured with 206/);
    expect(code).not.toBe(0);
  }, 60_000);

  it("catches an origin with no range support at all", async () => {
    const base = await origin({ ranges: false });
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/FAIL {2}it advertises byte ranges/);
    expect(code).not.toBe(0);
  }, 60_000);

  it("catches caching that is not immutable", async () => {
    // A short max-age means every visitor eventually re-downloads a gigabyte.
    const base = await origin({ immutable: false });
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/FAIL {2}it is cached immutably/);
    expect(code).not.toBe(0);
  }, 60_000);

  it("catches a served size that disagrees with the committed catalogue", async () => {
    /*
     * An object replaced in place without the version in the path changing.
     * The client would download it in full and then delete it for failing the
     * digest — the most expensive possible failure, caught here in a second.
     */
    const base = await origin({ wrongSize: true });
    const { code, output } = await runVerifier(base);
    expect(output).toMatch(/FAIL {2}the served size matches the committed catalogue/);
    expect(code).not.toBe(0);
  }, 60_000);

  it("catches an origin that is not there", async () => {
    const { code, output } = await runVerifier("http://127.0.0.1:1");
    expect(output).toMatch(/FAIL {2}the CDN is reachable/);
    expect(code).not.toBe(0);
  }, 60_000);
});

describe("an unconfigured deployment is reported, not failed", () => {
  it("says so and exits 0, because the publisher fallback still works", async () => {
    const result = await new Promise<{ code: number; output: string }>((done) => {
      const child = spawn(process.execPath, ["scripts/verify-model-cdn.mjs"], {
        env: { ...process.env, VITE_OCADE_MODEL_CDN: "" },
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += String(chunk)));
      child.on("close", (code) => done({ code: code ?? 1, output }));
    });
    expect(result.output).toMatch(/not configured/i);
    // Failing a build over a bucket nobody has provisioned would be wrong.
    expect(result.code).toBe(0);
  }, 60_000);

  it("fails under --strict, for a release gate that requires it", async () => {
    const result = await new Promise<{ code: number }>((done) => {
      const child = spawn(process.execPath, ["scripts/verify-model-cdn.mjs", "--strict"], {
        env: { ...process.env, VITE_OCADE_MODEL_CDN: "" },
      });
      child.on("close", (code) => done({ code: code ?? 1 }));
    });
    expect(result.code).not.toBe(0);
  }, 60_000);
});

describe("the verifier checks the path the client actually asks for", () => {
  it("derives the same version the browser catalogue declares", () => {
    /*
     * THE WHOLE CHECK IS WORTHLESS IF IT VERIFIES A DIFFERENT URL.
     *
     * The script derives the version by stripping the catalogue entry's `wasm-`
     * prefix; the client uses the tier's declared `version`. They agree today,
     * and they agree by a naming convention rather than by construction — so if
     * somebody renames a tier, this fails here rather than by the verifier
     * cheerfully proving an object nobody will ever request.
     */
    const source = readFileSync("src/lib/brain/browser-catalogue.ts", "utf8");
    const versions = [...source.matchAll(/version: "([^"]+)"/g)].map((match) => match[1]);
    expect(versions).toContain(VERSION);
  });

  it("builds the same path shape as cdnUrlFor", () => {
    const client = readFileSync("src/lib/brain/installation-browser.ts", "utf8");
    // `${base}/models/${version}/${entry.path}` in both places.
    expect(client).toMatch(/\$\{base\}\/models\/\$\{encodeURIComponent\(tier\.version\)\}/);
    const script = readFileSync("scripts/verify-model-cdn.mjs", "utf8");
    expect(script).toMatch(/\$\{base\}\/models\/\$\{encodeURIComponent\(version\)\}/);
  });
});

describe("the insecure-base escape hatch is test-only", () => {
  it("is never consulted by application source", () => {
    /*
     * It exists so a loopback test server can be verified. If it ever reached
     * the client, a plain-http model host would silently become acceptable —
     * so its absence from `src/` is asserted rather than assumed.
     */
    const client = readFileSync("src/lib/brain/installation-browser.ts", "utf8");
    expect(client).not.toMatch(/ALLOW_INSECURE/);
  });

  it("still refuses a plain-http base without it", async () => {
    const base = await origin();
    const result = await new Promise<{ output: string }>((done) => {
      const child = spawn(process.execPath, ["scripts/verify-model-cdn.mjs", "--base", base], {
        env: { ...process.env, OCADE_CDN_ALLOW_INSECURE: "" },
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += String(chunk)));
      child.on("close", () => done({ output }));
    });
    expect(result.output).toMatch(/not configured/i);
  }, 60_000);
});
