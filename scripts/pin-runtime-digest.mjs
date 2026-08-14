#!/usr/bin/env node
/**
 * Pin the SHA-256 of the engine installer, so first run can verify what it got.
 *
 * WHY THIS SCRIPT HAD TO EXIST. The installer refuses any download whose digest
 * it cannot check -- absence is not permission -- and it reads the expected
 * digest from `release/OCADE_RUNTIME_DIGESTS.json`. That file was never created.
 * The result was an install path that is perfectly safe and completely inert:
 * on a clean machine it would download the runtime, fail to find a digest to
 * compare against, refuse, and install nothing. Every unit test passed the whole
 * time, because the mocks supplied a digest that reality did not have.
 *
 * WHY A DIGEST CANNOT SIMPLY BE COMMITTED BY HAND. It has to be the hash of the
 * exact bytes the vendor is serving, which means somebody has to fetch them and
 * hash them. Writing a plausible-looking hex string would be worse than an empty
 * file: the installer would compare real bytes against a fiction, refuse every
 * download, and the failure would look like a corrupted network rather than a
 * bad manifest.
 *
 * SO THIS IS A DELIBERATE RELEASE ACTION. Run it when adopting a new engine
 * version, on a machine you trust, on a network you trust. It downloads from the
 * pinned vendor host, hashes what arrives, and writes the manifest. Re-run it and
 * commit the result whenever the pinned version changes.
 *
 * Usage:
 *   node scripts/pin-runtime-digest.mjs                # pin the current platform
 *   node scripts/pin-runtime-digest.mjs --all          # pin every platform
 *   node scripts/pin-runtime-digest.mjs --check        # verify the manifest exists
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "release", "OCADE_RUNTIME_DIGESTS.json");

/**
 * Kept in step with `installSourceFor` in src/lib/local/runtime-installer.ts.
 * The host is pinned there too and re-checked after redirects; this script must
 * not become a second, looser opinion about where the runtime comes from.
 */
const SOURCES = {
  win32: "https://ollama.com/download/OllamaSetup.exe",
  darwin: "https://ollama.com/download/Ollama-darwin.zip",
};

const HOST = "ollama.com";

function assertTrusted(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== HOST) {
    throw new Error(`refusing to fetch from an untrusted URL: ${url}`);
  }
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

if (process.argv.includes("--check")) {
  const manifest = await readManifest();
  const pinned = Object.entries(manifest).filter(
    ([, v]) => typeof v === "string" && v.length === 64,
  );

  if (!existsSync(MANIFEST) || pinned.length === 0) {
    console.error(
      "Release blocked: no engine digest is pinned.\n\n" +
        `  ${MANIFEST}\n` +
        "  is missing or empty, so first run cannot verify what it downloaded and\n" +
        "  will refuse to install anything. The product would ship with an install\n" +
        "  path that silently does nothing.\n\n" +
        "  Fix: node scripts/pin-runtime-digest.mjs --all",
    );
    process.exit(1);
  }

  console.log(`Engine digests pinned for: ${pinned.map(([k]) => k).join(", ")}`);
  process.exit(0);
}

const platforms = process.argv.includes("--all") ? Object.keys(SOURCES) : [process.platform];
const manifest = await readManifest();

for (const platform of platforms) {
  const url = SOURCES[platform];
  if (!url) {
    console.error(`no known installer for ${platform}; skipping`);
    continue;
  }

  assertTrusted(url);
  process.stdout.write(`fetching ${platform} installer… `);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    console.error(`\nfailed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  // The URL AFTER redirects is the one that actually served the bytes.
  assertTrusted(response.url || url);

  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  manifest[platform] = digest;

  console.log(`${(bytes.length / 1048576).toFixed(1)} MiB → ${digest}`);
}

await mkdir(dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nwrote ${MANIFEST}`);
console.log("Commit this file. First run compares downloads against it.");
