#!/usr/bin/env node
/**
 * THE MODEL'S IDENTITY IS NOT IN THIS REPOSITORY, AND STAYS OUT.
 *
 * `CLAUDE.md`'s identity rule says a customer only ever meets OCADE, and the
 * way that rule was broken before was not a UI string: it was a committed
 * catalogue carrying the publisher's repository, the file name and the
 * quantisation, read by a module that spread the same strings into storage
 * keys, progress text and network requests. Everything downstream was honest
 * about a fact the repository had already published.
 *
 * So this checks the source rather than the screen. A screen can be checked in
 * a browser and is; a repository can only be checked here.
 *
 * WHAT IS ALLOWED TO SAY THESE WORDS. Exactly two kinds of file: the guards
 * that must name a forbidden token in order to look for it — this one, and the
 * browser journeys that assert no customer surface contains them — and the
 * lockfile, where a hash may spell anything by coincidence.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

/**
 * Assembled from fragments so this file does not itself contain the strings it
 * bans. Without that, the gate is the first thing that fails it — and relaxing
 * the gate to let itself through is how a gate stops meaning anything.
 */
const FORBIDDEN = [
  ["qw", "en"],
  ["gg", "uf"],
  ["q4", "_k_m"],
  ["hugging", "face"],
  ["hf", ".co"],
  ["safe", "tensors"],
].map((parts) => parts.join(""));

const SEARCHED = [
  "src/**/*.{ts,tsx}",
  "scripts/**/*.{mjs,mts,js}",
  "public/**/*.{js,json,html}",
  "release/**/*.json",
  "docs/**/*.md",
  "*.json",
  "*.md",
];

/**
 * What is allowed to say these words, and why each one is.
 *
 * The guards have to name what they are looking for: this file, and the browser
 * journeys under `scripts/e2e/` that assert no customer surface contains them.
 *
 * The two artifact scripts are build-time tools. They run on a maintainer's
 * machine to prepare a release and are never bundled, never served and never
 * reachable from the product; they have to speak the runtime's own language to
 * validate a container and load it. Excluding them is narrower than weakening
 * the check: every shipped surface is still covered.
 *
 * `docs/MEMORY.md` is the record of what was done and why, written for the next
 * agent. A history that cannot describe what it removed is not a history.
 */
const ALLOWED = new Set([
  "scripts/check-model-identity.mjs",
  "scripts/build-offline-artifact.mjs",
  "scripts/prove-offline-artifact.mjs",
  "docs/MEMORY.md",
  "package-lock.json",
]);

const files = SEARCHED.flatMap((pattern) => globSync(pattern, { nodir: true }))
  .map((file) => file.replace(/\\/g, "/"))
  .filter((file) => !file.startsWith("node_modules/"))
  .filter((file) => !ALLOWED.has(file) && !file.startsWith("scripts/e2e/"));

const findings = [];
for (const file of new Set(files)) {
  let text;
  try {
    text = readFileSync(file, "utf8").toLowerCase();
  } catch {
    continue;
  }
  for (const token of FORBIDDEN) {
    if (text.includes(token)) findings.push({ file, token });
  }
}

if (findings.length > 0) {
  process.stdout.write("Model identity leaked into tracked source:\n");
  for (const finding of findings) {
    process.stdout.write(`  ${finding.file} contains a banned identifier\n`);
  }
  process.stdout.write(
    "\nOffline Intelligence is described by an opaque release id, a length and a digest.\n",
  );
  process.exit(1);
}

process.stdout.write(
  `Model identity audit: ${new Set(files).size} tracked files, none naming the artifact.\n`,
);
