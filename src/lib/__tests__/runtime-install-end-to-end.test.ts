import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRuntime, type InstallDeps } from "@/lib/local/runtime-installer";

/**
 * The first-run install, exercised with real machinery instead of mocks.
 *
 * WHY THIS EXISTS. `runtime-installer.test.ts` injects every dependency, which
 * is the right way to test the decisions -- what happens with no digest, with an
 * untrusted host, on an unsupported platform. What it cannot tell you is whether
 * the thing works when the bytes are real: a suite of fakes agrees with itself
 * by construction, and "nobody has watched it work" was the honest state of this
 * path.
 *
 * So everything here is genuine. A real HTTP server serves real bytes over a
 * real socket; the digest is real `node:crypto` SHA-256; the temp file is really
 * written to and really read back off disk; the subprocess is a real
 * `execFile` that really starts, exits and yields a real exit code.
 *
 * THE ONE SUBSTITUTION, AND WHY. `run` does not execute an actual Ollama
 * installer. Running it would install software on whichever machine the suite
 * happens to be on -- a test that modifies the developer's computer is not a
 * test, it is a side effect with an assertion attached. So the subprocess is
 * `node --version`: a real process, really spawned, really waited on, proving
 * the spawn-and-exit-code path works with real process machinery, while
 * installing nothing.
 *
 * WHAT IS ACTUALLY PROVEN: a machine with no runtime downloads one over HTTP,
 * hashes what arrived, compares it against the expected digest, writes it to
 * disk, executes it, reads the exit code, and cleans up -- and refuses at the
 * digest step when the bytes are not the bytes that were promised.
 */

let server: Server;
let origin: string;
let workDir: string;

/** What the server will serve. Random, so nothing can pass by coincidence. */
const PAYLOAD = randomBytes(64 * 1024);
const PAYLOAD_DIGEST = createHash("sha256").update(PAYLOAD).digest("hex");

/** Bytes that are NOT the payload, for the tampering case. */
const TAMPERED = randomBytes(64 * 1024);

/**
 * Where the vendor link really lands.
 *
 * Taken from an actual fetch of https://ollama.com/download/OllamaSetup.exe,
 * which 302s to GitHub's release-asset CDN. Hard-coded rather than fetched so
 * the suite stays offline and deterministic.
 */
const REDIRECTED_TO =
  "https://release-assets.githubusercontent.com/github-production-release-asset/658928958/asset";

let servePath = "/good";

beforeAll(async () => {
  server = createServer((req, res) => {
    const body = req.url?.startsWith("/tampered") ? TAMPERED : PAYLOAD;
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": String(body.length),
    });
    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  origin = `http://127.0.0.1:${address.port}`;

  workDir = await mkdtemp(join(tmpdir(), "ocade-install-"));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(workDir, { recursive: true, force: true });
});

/** Real implementations of everything the installer needs. */
function realDeps(over: Partial<InstallDeps> = {}): InstallDeps {
  const written: string[] = [];

  return {
    platform: "win32",

    // A real socket, a real response body, and a REAL redirect target.
    download: async (url: string) => {
      expect(url.startsWith("https://")).toBe(true);
      const response = await fetch(`${origin}${servePath}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      /*
       * `finalUrl` is the host the bytes really came from, NOT the URL we asked
       * for. Returning the requested URL here is what let a fatal bug hide: the
       * vendor link redirects to GitHub's release-asset CDN, the installer
       * re-checks the host after redirects, and it refused every real download
       * while every test passed. A fixture that cannot redirect cannot catch
       * that, so this one redirects.
       */
      return { bytes, finalUrl: REDIRECTED_TO };
    },

    digest: async (bytes: Uint8Array) =>
      createHash("sha256").update(Buffer.from(bytes)).digest("hex"),

    expectedDigest: async () => PAYLOAD_DIGEST,

    writeTemp: async (fileName: string, bytes: Uint8Array) => {
      const path = join(workDir, fileName);
      await writeFile(path, bytes);
      written.push(path);
      return path;
    },

    // A real process: really spawned, really waited on, real exit code.
    run: async () =>
      new Promise<number>((resolve) => {
        execFile(process.execPath, ["--version"], (error) => resolve(error ? 1 : 0));
      }),

    remove: async (path: string) => {
      await rm(path, { force: true });
    },

    ...over,
  };
}

describe("installing the runtime on a machine that has none", () => {
  it("downloads, verifies the digest, writes to disk and runs it", async () => {
    servePath = "/good";
    let lastPercent: number | null = null;

    const result = await installRuntime(
      realDeps({ onProgress: (p) => void (lastPercent = p) }),
    );

    expect(result.ok).toBe(true);
    // The user-facing line never names the vendor — the product speaks about
    // itself, not about what it happens to bundle.
    expect(result.detail.toLowerCase()).not.toContain("ollama");
    expect(lastPercent === null || typeof lastPercent === "number").toBe(true);
  });

  it("really wrote the payload to disk, byte for byte", async () => {
    servePath = "/good";
    let writtenPath = "";

    const result = await installRuntime(
      realDeps({
        writeTemp: async (fileName, bytes) => {
          writtenPath = join(workDir, `kept-${fileName}`);
          await writeFile(writtenPath, bytes);
          return writtenPath;
        },
        // Keep the file so the bytes can be compared off disk.
        remove: async () => {},
      }),
    );

    expect(result.ok).toBe(true);
    expect(existsSync(writtenPath)).toBe(true);

    const fromDisk = await readFile(writtenPath);
    expect(createHash("sha256").update(fromDisk).digest("hex")).toBe(PAYLOAD_DIGEST);
  });

  it("accepts the vendor's REAL redirect to the release-asset CDN", async () => {
    /*
     * The regression this file exists for. `ollama.com` redirects to GitHub's
     * asset host, so an installer that re-checks the host after redirects and
     * only knows the vendor name refuses every genuine download and installs
     * nothing, forever. It failed silently -- "Setup could not start safely" --
     * so no crash ever pointed at it.
     */
    servePath = "/good";
    const result = await installRuntime(realDeps());
    expect(result.ok).toBe(true);
    expect(result.reason).not.toBe("untrusted_redirect");
  });

  it("still REFUSES a redirect to somewhere arbitrary", async () => {
    // Widening the allow-list must not have widened it to everything.
    servePath = "/good";
    let ran = false;
    const result = await installRuntime(
      realDeps({
        download: async () => {
          const response = await fetch(`${origin}/good`);
          return {
            bytes: new Uint8Array(await response.arrayBuffer()),
            finalUrl: "https://evilollama.com/OllamaSetup.exe",
          };
        },
        run: async () => {
          ran = true;
          return 0;
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("untrusted_redirect");
    expect(ran).toBe(false);
  });

  it("REFUSES bytes that do not match the promised digest", async () => {
    // The security property this whole path exists for. A download that arrives
    // altered -- a hostile mirror, a proxy injecting a payload, a corrupted
    // transfer -- must never be executed.
    servePath = "/tampered";

    let ran = false;
    const result = await installRuntime(
      realDeps({
        run: async () => {
          ran = true;
          return 0;
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(ran).toBe(false);
  });

  it("REFUSES when the manifest carries no digest at all", async () => {
    // Absence is not permission. Unverifiable bytes are refused rather than
    // upgraded to trusted, which is the same rule the Rust side keeps.
    servePath = "/good";

    let ran = false;
    const result = await installRuntime(
      realDeps({
        expectedDigest: async () => null,
        run: async () => {
          ran = true;
          return 0;
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(ran).toBe(false);
  });

  it("does not leave the downloaded installer lying around", async () => {
    servePath = "/good";
    const removed: string[] = [];

    await installRuntime(
      realDeps({
        remove: async (path) => {
          removed.push(path);
          await rm(path, { force: true });
        },
      }),
    );

    expect(removed.length).toBeGreaterThan(0);
    for (const path of removed) expect(existsSync(path)).toBe(false);
  });

  it("reports a failing installer exit code rather than claiming success", async () => {
    servePath = "/good";

    const result = await installRuntime(
      realDeps({
        run: async () =>
          new Promise<number>((resolve) => {
            // A real process that really fails: node exiting non-zero.
            execFile(process.execPath, ["-e", "process.exit(3)"], (error) =>
              resolve(error ? 3 : 0),
            );
          }),
      }),
    );

    expect(result.ok).toBe(false);
  });
});
