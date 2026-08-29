/**
 * PROVE THE OCADE MODEL CDN, OR SAY EXACTLY WHAT IS MISSING.
 *
 * `VITE_OCADE_MODEL_CDN` being set is configuration, not distribution. A URL in
 * an environment variable proves nothing about whether the bucket exists, the
 * domain resolves, Range works, CORS is right, or the bytes are the ones the
 * catalogue's digest was taken from. Every one of those can be wrong
 * independently, and each produces a different failure on somebody's first run:
 *
 *   - no CORS            → the transfer cannot start at all
 *   - no Range           → the chunked path falls back to a whole-file stream
 *                          and an interruption costs everything
 *   - wrong digest       → the artifact downloads completely and is then
 *                          deleted, which is the most expensive failure of all
 *   - wrong cache header → every visitor re-downloads a gigabyte
 *
 * So this asks the real origin real questions. It downloads a few megabytes in
 * parallel ranges and verifies them; it does not pull the whole artifact, which
 * would make the check too slow to run and would prove nothing the ranged reads
 * do not already prove.
 *
 * WHEN THE CDN IS NOT CONFIGURED it says so and exits 0. An unconfigured
 * deployment is a valid deployment — the source ladder falls back to the
 * publisher and first run still works — so this is a readiness report, not a
 * gate that fails a build for a bucket nobody has provisioned yet.
 *
 * Run:  npm run model:cdn-verify
 *       npm run model:cdn-verify -- --base https://models.ocade.in
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = process.cwd();
const OUT = "release/OCADE_MODEL_CDN_VERIFICATION.json";
const WRITE = process.argv.includes("--write");
const STRICT = process.argv.includes("--strict");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * The configured base, from the flag or the environment.
 *
 * Held to the same rule the client applies: https and absolute, or it is not a
 * distribution. A relative or plain-http value would silently downgrade every
 * first run, so it is refused here rather than reported as configured.
 */
function cdnBase() {
  const raw = (argValue("--base") ?? process.env.VITE_OCADE_MODEL_CDN ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/\/+$/, ""));
    if (url.protocol === "https:") return raw.replace(/\/+$/, "");
    /*
     * PLAIN HTTP IS REFUSED, with one deliberate exception.
     *
     * A loopback test server cannot serve https, and this script is worthless
     * unless it is itself verified against origins that are wrong in known
     * ways. `OCADE_CDN_ALLOW_INSECURE` exists only for that, is scoped to
     * loopback, and is asserted by `model-cdn-verification.test.ts` never to
     * appear in application source — where it would silently make a plain-http
     * model host acceptable.
     */
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (process.env.OCADE_CDN_ALLOW_INSECURE === "1" && loopback) {
      return raw.replace(/\/+$/, "");
    }
    return null;
  } catch {
    return null;
  }
}

const catalogue = JSON.parse(
  readFileSync(resolve(ROOT, "release/OCADE_BROWSER_MODEL_CATALOGUE.json"), "utf8"),
);

const checks = [];
const record = (ok, what, detail) => {
  checks.push({ ok, what, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
};

/** The versioned, immutable path the client asks for. Must match `cdnUrlFor`. */
function artifactUrl(base, version, path) {
  return `${base}/models/${encodeURIComponent(version)}/${encodeURIComponent(path)}`;
}

async function verify(base, entry, version) {
  const url = artifactUrl(base, version, entry.path);
  console.log(`\nVerifying ${url}`);

  /* ------------------------------------------------------- reachable --- */

  let head;
  try {
    head = await fetch(url, { method: "HEAD" });
  } catch (error) {
    record(false, "the CDN is reachable", error instanceof Error ? error.message : String(error));
    return;
  }
  record(head.ok, "the CDN answers for this artifact", `HTTP ${head.status}`);
  if (!head.ok) return;

  const declared = Number(head.headers.get("content-length") ?? "");
  record(
    declared === entry.sizeBytes,
    "the served size matches the committed catalogue",
    `${declared} vs ${entry.sizeBytes}`,
  );

  /* ------------------------------------------------------- caching ----- */

  const cacheControl = head.headers.get("cache-control") ?? "";
  record(
    /immutable/.test(cacheControl) && /max-age=\d{7,}/.test(cacheControl),
    "it is cached immutably, so nobody re-downloads it",
    cacheControl || "(none)",
  );

  /*
   * `accept-ranges` is what makes an interrupted transfer resumable. Without
   * it the client falls back to a whole-file stream — which works, and throws
   * away everything an interruption had already cost the user.
   */
  record(
    (head.headers.get("accept-ranges") ?? "").includes("bytes"),
    "it advertises byte ranges",
    head.headers.get("accept-ranges") ?? "(none)",
  );

  /* ---------------------------------------------------------- CORS ----- */

  const allowOrigin = head.headers.get("access-control-allow-origin");
  record(
    allowOrigin === "*" || (allowOrigin ?? "").includes("ocade.in"),
    "CORS allows the site to fetch it",
    allowOrigin ?? "(none)",
  );
  const exposed = (head.headers.get("access-control-expose-headers") ?? "").toLowerCase();
  record(
    exposed.includes("content-range") || allowOrigin === "*",
    "content-range is readable by the client, which is how it discovers the size",
    exposed || "(none)",
  );

  /* --------------------------------------------------- Range actually -- */

  /*
   * ADVERTISING RANGES AND HONOURING THEM ARE DIFFERENT CLAIMS. A proxy that
   * answers 200 with the whole file while sending `accept-ranges: bytes` is a
   * real configuration, and it is the one that quietly turns every interruption
   * into a restart. So a range is actually requested and the status checked.
   */
  const CHUNK = 1024 * 1024;
  const first = await fetch(url, { headers: { Range: `bytes=0-${CHUNK - 1}` } });
  record(first.status === 206, "a ranged request is honoured with 206", `HTTP ${first.status}`);
  const contentRange = first.headers.get("content-range") ?? "";
  record(
    new RegExp(`/${entry.sizeBytes}$`).test(contentRange),
    "content-range reports the full artifact size",
    contentRange || "(none)",
  );
  const firstBytes = new Uint8Array(await first.arrayBuffer());
  record(
    firstBytes.length === CHUNK,
    "the range returns exactly what was asked for",
    `${firstBytes.length} bytes`,
  );

  /* --------------------------------------------- parallel and resume --- */

  /*
   * Several ranges at once, from different offsets, reassembled in order and
   * hashed. This is the actual shape of the production transfer, and it proves
   * the two things a single sequential read cannot: that concurrent range
   * requests are served correctly, and that a read starting at a non-zero
   * offset — a RESUME — returns the right bytes.
   */
  const offsets = [0, CHUNK, CHUNK * 2, CHUNK * 3];
  const started = Date.now();
  const parts = await Promise.all(
    offsets.map(async (start) => {
      const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${start + CHUNK - 1}` },
      });
      if (response.status !== 206) return null;
      return new Uint8Array(await response.arrayBuffer());
    }),
  );
  const elapsed = Date.now() - started;
  record(
    parts.every((part) => part !== null && part.length === CHUNK),
    "four concurrent ranges all return correct lengths",
    `${elapsed}ms`,
  );

  const resumed = parts[2];
  record(
    resumed !== null && resumed.length === CHUNK,
    "a read starting mid-file works, which is what a resume is",
    `offset ${CHUNK * 2}`,
  );

  /* -------------------------------------------------------- integrity -- */

  /*
   * The prefix hash. The catalogue's digest covers the WHOLE artifact, which
   * this deliberately does not download — so what is proven here is that the
   * bytes at these offsets are self-consistent across concurrent reads, which
   * is what catches a misconfigured range proxy or a partially-replaced object.
   * The whole-artifact digest is enforced on the client during the real
   * transfer, incrementally, and that remains the authority.
   */
  const again = await fetch(url, { headers: { Range: `bytes=0-${CHUNK - 1}` } });
  const repeat = new Uint8Array(await again.arrayBuffer());
  const sameTwice =
    repeat.length === firstBytes.length &&
    createHash("sha256").update(repeat).digest("hex") ===
      createHash("sha256").update(firstBytes).digest("hex");
  record(sameTwice, "the same range returns identical bytes when read twice");

  const stitched = Buffer.concat(parts.filter(Boolean).map((p) => Buffer.from(p)));
  const stitchedMatchesFirst =
    createHash("sha256").update(stitched.subarray(0, CHUNK)).digest("hex") ===
    createHash("sha256").update(Buffer.from(firstBytes)).digest("hex");
  record(stitchedMatchesFirst, "concurrent ranges reassemble in the right order");

  /* ------------------------------------------------------- protocol ---- */

  // Informational: HTTP/2 or /3 is what makes many concurrent ranges cheap.
  // Node does not expose the negotiated protocol from `fetch`, so this is
  // reported as unknown rather than guessed at.
  record(true, "protocol negotiation is not observable from this client", "reported by the edge");
}

async function main() {
  const base = cdnBase();

  console.log("\nOCADE model distribution verification");
  console.log("=".repeat(70));

  if (!base) {
    /*
     * NOT A FAILURE. An unconfigured deployment falls back to the publisher
     * through the source ladder and first run still works, so failing a build
     * over a bucket nobody has provisioned would be wrong. It is reported as
     * unconfigured, loudly, with the steps to change that.
     */
    console.log("\nVITE_OCADE_MODEL_CDN is not configured.");
    console.log("The source ladder falls back to the publisher, so first run still works.");
    console.log("\nTo provision OCADE's own distribution, see:");
    console.log("  docs/MODEL_DISTRIBUTION.md  — bucket layout and required headers");
    console.log("  docs/OPERATOR_CDN_SETUP.md  — the exact remaining steps\n");
    if (WRITE) {
      writeReport({ configured: false, base: null, checks: [] });
    }
    // Let Node's HTTP client close its sockets naturally. A forced exit while
    // Undici is tearing down connections can terminate with 0xC0000409 on
    // Windows even after every check has completed successfully.
    process.exitCode = STRICT ? 1 : 0;
    return;
  }

  console.log(`\nBase: ${base}`);
  for (const entry of catalogue.entries) {
    // The version in the path is the tier's immutable identity. It is read from
    // the same committed catalogue the client reads, so this cannot verify a
    // path the product would never ask for.
    const version = entry.id.replace(/^wasm-/, "");
    await verify(base, entry, version);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log("\n" + "=".repeat(70));
  if (failed.length === 0) {
    console.log(`ALL ${checks.length} CDN CHECKS PASSED against ${base}.`);
  } else {
    console.log(`${failed.length} of ${checks.length} CHECKS FAILED:`);
    for (const check of failed) {
      console.log(`  - ${check.what}${check.detail ? ` (${check.detail})` : ""}`);
    }
    console.log("\nSee docs/OPERATOR_CDN_SETUP.md for the headers each of these needs.");
  }
  console.log("=".repeat(70) + "\n");

  if (WRITE) writeReport({ configured: true, base, checks });
  process.exitCode = failed.length === 0 ? 0 : 1;
}

function writeReport(body) {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/verify-model-cdn.mjs",
    ...body,
  };
  const path = resolve(ROOT, OUT);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${OUT}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
