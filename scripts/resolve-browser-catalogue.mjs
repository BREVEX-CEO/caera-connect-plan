/**
 * Resolve the browser model catalogue from the publisher's own index.
 *
 * WHAT PROBLEM THIS SOLVES. The browser engines were downloading weights with
 * no digest to check them against, so `downloadModel` had nothing to verify
 * and every file was stored as UNVERIFIED. Inventing a digest would have been
 * worse than none.
 *
 * WHAT A DIGEST FROM THE PUBLISHER IS AND IS NOT WORTH. This reads the SHA-256
 * that Hugging Face records for each LFS object and COMMITS it to the
 * repository. At runtime the download is checked against the committed value.
 *
 *   - It DOES catch a truncated transfer, a corrupted CDN object, a proxy that
 *     rewrote the body, and a mirror serving different bytes. Those are the
 *     realistic failures.
 *   - It does NOT protect against the publisher itself having served different
 *     weights at the moment this ran. Nothing a downloader can do would.
 *
 * The protection therefore comes from the value being FIXED AT REVIEW TIME and
 * living in git history, exactly as a dependency lockfile works — not from the
 * digest and the file arriving together at runtime, which would prove nothing.
 *
 * Usage: node scripts/resolve-browser-catalogue.mjs [--write]
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const OUT = "release/OCADE_BROWSER_MODEL_CATALOGUE.json";
const write = process.argv.includes("--write");

/** Every GGUF tier OCADE may fetch in a browser. */
const WANTED = [
  {
    id: "wasm-qwen2.5-0.5b-instruct-q4_k_m",
    label: "OCADE Browser (compatibility)",
    repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
    path: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
  },
];

async function resolveOne(entry) {
  const url = `https://huggingface.co/api/models/${entry.repo}/tree/main`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${entry.repo}: index returned HTTP ${response.status}`);
  }
  const listing = await response.json();
  const file = listing.find((f) => f.path === entry.path);
  if (!file) {
    throw new Error(`${entry.repo}: ${entry.path} is not in the published file list`);
  }

  /*
   * The LFS oid IS the SHA-256 of the object for these repositories. It is
   * read rather than computed because computing it would mean downloading half
   * a gigabyte per tier on every catalogue refresh — and the value is being
   * pinned for review, not being independently attested.
   */
  const sha256 = file.lfs?.oid ?? file.lfs?.sha256 ?? null;
  if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(
      `${entry.repo}: no usable SHA-256 published for ${entry.path}. Refusing to record an unverifiable tier.`,
    );
  }
  if (typeof file.size !== "number" || file.size <= 0) {
    throw new Error(`${entry.repo}: no usable size published for ${entry.path}`);
  }

  return {
    id: entry.id,
    label: entry.label,
    repo: entry.repo,
    path: entry.path,
    sizeBytes: file.size,
    sha256,
    url: `https://huggingface.co/${entry.repo}/resolve/main/${entry.path}?download=true`,
  };
}

const entries = [];
for (const wanted of WANTED) {
  entries.push(await resolveOne(wanted));
  console.log(`resolved ${wanted.id}`);
}

const catalogue = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/resolve-browser-catalogue.mjs",
  provenance:
    "Sizes and SHA-256 digests were READ from each publisher's own file index at the time above and committed here. Nothing is hand-typed. The digest protects against a truncated, corrupted or substituted transfer; it is not an independent attestation of the weights themselves, and pinning it at review time is what gives it force.",
  entries,
};

const rendered = `${JSON.stringify(catalogue, null, 2)}\n`;

for (const entry of entries) {
  console.log(`  ${entry.path}`);
  console.log(`    ${(entry.sizeBytes / 1024 ** 2).toFixed(1)} MiB  sha256 ${entry.sha256}`);
}

if (write) {
  writeFileSync(OUT, rendered);
  console.log(`\nwrote ${OUT}`);
} else if (existsSync(OUT)) {
  const current = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
  // Compare only the resolved facts: `generatedAt` changes on every run and is
  // not drift worth failing a check over.
  const currentEntries = JSON.stringify(JSON.parse(current).entries);
  if (currentEntries !== JSON.stringify(entries)) {
    console.error(`\n${OUT} is stale. Run with --write and commit the result.`);
    process.exit(1);
  }
  console.log(`\n${OUT} is current.`);
}
