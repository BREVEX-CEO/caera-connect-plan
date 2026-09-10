/**
 * WHICH SOURCE IS RUNNING IN THE EDGE FUNCTION, AND WHAT ROLLING IT BACK MEANS.
 *
 * `PLAN.md` Phase 16 asks for "versioned releases and previous application/
 * Edge Function/Cloudflare rollback". Two of the three had an answer:
 * `scripts/deploy.mjs` uploads an immutable Cloudflare version, verifies it and
 * can roll back to a named prior version id. The Edge Function had none. It is
 * deployed by pushing a directory; Supabase counts the versions; and nothing in
 * this repository recorded WHICH source each of those numbers was, so "roll
 * the Edge Function back" meant guessing at a commit.
 *
 * So this is the ledger. Each deployed version names the exact files that went
 * out, a hash of each, the release they belonged to and the commit they came
 * from. That makes three questions answerable:
 *
 *   - Is the deployed function the source in this repository, or has one of
 *     them moved? (`--verify`)
 *   - What exactly do we go back to? (`--rollback-plan`)
 *   - Can we still produce that source, byte for byte, today?
 *     (`--prove-rollback`, which reconstructs it from git and re-hashes it)
 *
 * The last one is the one worth having. A rollback target nobody has ever
 * reconstructed is a plan, not a recovery.
 *
 * WHAT IS HASHED. The entrypoint plus every local file it imports, followed
 * transitively -- the Edge Function imports modules from `src/lib`, so a change
 * there changes what is deployed even though nothing under
 * `supabase/functions/` was touched. Remote imports (`npm:`, `https:`) are
 * recorded as declared specifiers, since they are pinned in the source and
 * their content is not ours to hash.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

export const LEDGER_PATH = "release/OCADE_EDGE_FUNCTION_RELEASES.json";
export const ENTRYPOINT = "supabase/functions/ocade-intelligence/index.ts";

const LOCAL_IMPORT = /^(?:\.\.?)\//;
const IMPORT_SPECIFIER = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;

/** Every local file the entrypoint pulls in, transitively, sorted. */
export function edgeFunctionSources(read, entrypoint = ENTRYPOINT) {
  const seen = new Set();
  const remote = new Set();
  const queue = [normalize(entrypoint)];

  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    const source = read(file);
    if (source === null) continue;
    seen.add(file);

    for (const match of source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      if (!LOCAL_IMPORT.test(specifier)) {
        remote.add(specifier);
        continue;
      }
      queue.push(normalize(join(dirname(file), specifier)));
    }
  }

  return { files: [...seen].sort(), remote: [...remote].sort() };
}

/** One hash over the whole deployable set. Order-independent by sorting. */
export function hashSources(read, files) {
  const perFile = files.map((file) => ({
    file,
    sha256: createHash("sha256")
      .update(read(file) ?? "")
      .digest("hex"),
  }));
  const combined = createHash("sha256");
  for (const entry of [...perFile].sort((a, b) => a.file.localeCompare(b.file))) {
    combined.update(`${entry.file}:${entry.sha256}\n`);
  }
  return { sourceHash: combined.digest("hex"), files: perFile };
}

/* ------------------------------------------------------------- readers -- */

/** Read from the working tree. Missing file returns null rather than throwing. */
export function workingTreeReader(root = process.cwd()) {
  return (file) => {
    const path = resolve(root, file);
    if (!path.startsWith(resolve(root)) || !existsSync(path)) return null;
    return readFileSync(path, "utf8");
  };
}

/** Read from a commit, which is what makes a rollback target reconstructible. */
export function commitReader(commit, root = process.cwd()) {
  return (file) => {
    try {
      return execFileSync("git", ["show", `${commit}:${file}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };
}

/* -------------------------------------------------------------- ledger -- */

export function readLedger(root = process.cwd()) {
  const path = resolve(root, LEDGER_PATH);
  if (!existsSync(path)) return { schemaVersion: 1, function: "ocade-intelligence", releases: [] };
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeLedger(ledger, root = process.cwd()) {
  writeFileSync(resolve(root, LEDGER_PATH), `${JSON.stringify(ledger, null, 2)}\n`);
}

/** The release currently deployed, by the highest version the ledger records. */
export function currentRelease(ledger) {
  return [...ledger.releases].sort((a, b) => a.version - b.version).at(-1) ?? null;
}

/** What a rollback goes to: the highest version below the current one. */
export function previousRelease(ledger) {
  const ordered = [...ledger.releases].sort((a, b) => a.version - b.version);
  return ordered.length >= 2 ? ordered[ordered.length - 2] : null;
}

/**
 * Ledger rules, checked rather than assumed.
 *
 * An append-only record that something quietly rewrote is worse than no record,
 * because it is believed.
 */
export function ledgerProblems(ledger) {
  const problems = [];
  if (ledger.schemaVersion !== 1) problems.push("unknown ledger schema version");

  const versions = ledger.releases.map((r) => r.version);
  if (new Set(versions).size !== versions.length) problems.push("a version is recorded twice");

  for (const release of ledger.releases) {
    if (!Number.isInteger(release.version) || release.version < 1) {
      problems.push(`release ${release.version}: version must be a positive integer`);
    }
    if (!/^[0-9a-f]{64}$/.test(release.sourceHash ?? "")) {
      problems.push(`release ${release.version}: source hash is not a sha256`);
    }
    if (!Array.isArray(release.files) || release.files.length === 0) {
      problems.push(`release ${release.version}: no files recorded`);
    }
    if (release.commit !== null && !/^[0-9a-f]{7,40}$/.test(release.commit ?? "")) {
      problems.push(`release ${release.version}: commit is not a git object name`);
    }
  }

  const secretShaped =
    /AIza[0-9A-Za-z_-]{10,}|eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.|-----BEGIN/;
  if (secretShaped.test(JSON.stringify(ledger))) problems.push("a secret-shaped value is recorded");

  return problems;
}

/* ----------------------------------------------------------- the checks -- */

/**
 * Does the working tree still produce the deployed release?
 *
 * "ahead" is not a failure. It is the normal state between writing a change
 * and deploying it, and saying so is more useful than a red cross -- what an
 * operator must never see is the tree matching a release the ledger does not
 * record.
 */
export function verifyWorkingTree(ledger, read) {
  const release = currentRelease(ledger);
  if (!release) return { state: "no_release", detail: "the ledger records no deployment yet" };
  const { files } = edgeFunctionSources(read);
  const { sourceHash } = hashSources(read, files);
  return sourceHash === release.sourceHash
    ? {
        state: "matches",
        detail: `the tree is the deployed source of version ${release.version}`,
        sourceHash,
      }
    : {
        state: "ahead",
        detail: `the tree differs from deployed version ${release.version}; deploying it would create a new version`,
        sourceHash,
      };
}

/** Can the rollback target still be produced, byte for byte, from git? */
export function proveRollback(ledger, root = process.cwd()) {
  const target = previousRelease(ledger) ?? currentRelease(ledger);
  if (!target) return { ok: false, detail: "the ledger records no release to roll back to" };
  if (!target.commit) {
    return {
      ok: false,
      detail: `version ${target.version} names no commit, so its source cannot be reconstructed`,
    };
  }
  const read = commitReader(target.commit, root);
  const missing = target.files.filter((f) => read(f.file) === null);
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `version ${target.version}: ${missing.length} file(s) are not in commit ${target.commit}`,
    };
  }
  const { sourceHash } = hashSources(
    read,
    target.files.map((f) => f.file),
  );
  return sourceHash === target.sourceHash
    ? {
        ok: true,
        version: target.version,
        commit: target.commit,
        detail: `version ${target.version} rebuilt from ${target.commit} and hashes identically`,
      }
    : {
        ok: false,
        detail: `version ${target.version} rebuilt from ${target.commit} does NOT hash identically`,
      };
}

/* ------------------------------------------------------------ the CLI -- */

function head(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function main(argv) {
  const root = process.cwd();
  const ledger = readLedger(root);
  const problems = ledgerProblems(ledger);
  if (problems.length > 0) {
    console.error("Edge Function release ledger is not usable:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  if (argv.includes("--record")) {
    const version = Number(argv[argv.indexOf("--version") + 1]);
    const commitFlag = argv.indexOf("--commit");
    const commit = commitFlag > -1 ? argv[commitFlag + 1] : head(root);
    const read = commit ? commitReader(commit, root) : workingTreeReader(root);
    const { files, remote } = edgeFunctionSources(read);
    const hashed = hashSources(read, files);
    ledger.releases = ledger.releases.filter((r) => r.version !== version);
    ledger.releases.push({
      version,
      recordedAt: new Date().toISOString(),
      release: /OCADE_RELEASE_VERSION = "([^"]+)"/.exec(
        read("src/lib/release-health.ts") ?? "",
      )?.[1],
      commit,
      sourceHash: hashed.sourceHash,
      remoteImports: remote,
      files: hashed.files,
    });
    ledger.releases.sort((a, b) => a.version - b.version);
    writeLedger(ledger, root);
    console.log(`recorded Edge Function version ${version} at ${hashed.sourceHash.slice(0, 12)}`);
    return;
  }

  if (argv.includes("--rollback-plan")) {
    const target = previousRelease(ledger);
    if (!target) {
      console.error("No previous Edge Function version is recorded; there is nothing to roll to.");
      process.exit(1);
    }
    console.log(`roll back to version ${target.version}, commit ${target.commit}`);
    console.log(`source hash ${target.sourceHash}`);
    for (const file of target.files) console.log(`  ${file.file}`);
    return;
  }

  if (argv.includes("--prove-rollback")) {
    const proof = proveRollback(ledger, root);
    console.log(proof.detail);
    if (!proof.ok) process.exit(1);
    return;
  }

  const verified = verifyWorkingTree(ledger, workingTreeReader(root));
  console.log(verified.detail);
  if (verified.state === "no_release") process.exit(1);
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked && relative(invoked, resolve("scripts/edge-function-release.mjs")) === "") {
  main(process.argv.slice(2));
}
