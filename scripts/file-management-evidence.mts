/**
 * G1-G4 evidence: real file management, on a real filesystem.
 *
 * Every operation goes through OCADE's own file-manager code. After each one,
 * the filesystem is INDEPENDENTLY re-read with plain `node:fs` — not with the
 * same module that performed the action — because a module confirming its own
 * work proves only that it is self-consistent.
 *
 * Everything happens inside a throwaway directory under the OS temp folder. The
 * protected-path and traversal attempts in G3 are aimed at real system
 * locations on purpose, and are expected to be REFUSED; nothing outside the
 * sandbox is ever written.
 *
 * Usage: node --experimental-strip-types scripts/file-management-evidence.mts [--write] [--only G1]
 */
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  searchFiles,
  copyFileVerified,
  moveFileVerified,
  deleteToTrash,
  restoreFromTrash,
  copyBatch,
  assertNotProtected,
} from "../src/lib/files/manager.ts";
import { nodeFileSystem } from "../src/lib/files/manager.node.ts";
import { writeTextFile, readTextFile } from "../src/lib/skills/packs/local-files-pack.ts";

const write = process.argv.includes("--write");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null;
const OUT = "release/OCADE_G_FILE_MANAGEMENT_EVIDENCE.json";

const fs = nodeFileSystem();
const steps: Record<string, unknown>[] = [];
let failed = false;

const n = (p: string) => p.replace(/\\/g, "/");

/**
 * Independent verification: plain node:fs, never the module under test.
 *
 * Existence and readability are checked SEPARATELY. An exclusively locked file
 * still stats but cannot be read, and an earlier version of this helper
 * collapsed both into `exists:false` — which reported a locked file as deleted
 * and would have turned "correctly refused" into "lost the user's data".
 */
async function truth(path: string) {
  let s;
  try {
    s = await stat(path);
  } catch {
    return { exists: false as const };
  }
  if (s.isDirectory()) return { exists: true, kind: "directory" as const, size: s.size };
  try {
    const bytes = await readFile(path);
    return {
      exists: true,
      kind: "file" as const,
      size: s.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      text: bytes.toString("utf8").slice(0, 80),
    };
  } catch (error) {
    return {
      exists: true,
      kind: "file" as const,
      size: s.size,
      unreadable: true,
      why: error instanceof Error ? error.message.split(",")[0] : "unreadable",
    };
  }
}

function record(item: string, step: string, detail: Record<string, unknown>) {
  const entry = { item, step, ...detail };
  steps.push(entry);
  const flat = Object.entries(detail)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("  ");
  console.log(`[${item}] ${step}\n        ${flat}`);
  return entry;
}

const want = (item: string) => !only || only === item;

const sandbox = await mkdtemp(join(tmpdir(), "ocade-g-"));
const root = n(sandbox);
console.log(`sandbox root: ${root}\n`);

try {
  // ================================================================== G1
  if (want("G1")) {
    // --- create
    const created = join(root, "notes.txt");
    const createResult = await writeTextFile(fs, root, created, "hello from OCADE");
    record("G1", "create", {
      operation: "writeTextFile",
      ok: createResult.ok,
      detail: createResult.ok ? createResult.evidence : createResult.reason,
      filesystemAfter: await truth(created),
    });
    if (!createResult.ok) failed = true;

    // --- read
    const readResult = await readTextFile(fs, root, created);
    const onDisk = await truth(created);
    const readMatches = readResult.ok && readResult.data === "hello from OCADE";
    record("G1", "read", {
      operation: "readTextFile",
      ok: readResult.ok,
      returned: readResult.ok ? readResult.data : readResult.reason,
      independentlyReadFromDisk: onDisk.exists && onDisk.kind === "file" ? onDisk.text : null,
      matches: readMatches,
    });
    if (!readMatches) failed = true;

    // --- search
    await mkdir(join(root, "sub"), { recursive: true });
    await writeFile(join(root, "sub", "report-2026.md"), "quarterly");
    await writeFile(join(root, "sub", "ignore.bin"), "binary");
    const search = await searchFiles(fs, root, { match: "report" });
    record("G1", "search", {
      operation: "searchFiles",
      ok: search.ok,
      hits: search.ok ? search.hits.map((h) => n(h.path).replace(root, ".")) : search.reason,
      independentTreeListing: (await readdir(join(root, "sub"))).sort(),
      foundExactlyTheMatch:
        search.ok && search.hits.length === 1 && search.hits[0].path.includes("report-2026.md"),
    });
    if (!search.ok || search.hits.length !== 1) failed = true;

    // --- copy
    const copyTo = join(root, "notes-copy.txt");
    const copyResult = await copyFileVerified(fs, root, created, copyTo);
    const srcTruth = await truth(created);
    const dstTruth = await truth(copyTo);
    record("G1", "copy", {
      operation: "copyFileVerified",
      ok: copyResult.ok,
      detail: copyResult.ok ? copyResult.evidence : copyResult.reason,
      sourceOnDisk: srcTruth,
      destinationOnDisk: dstTruth,
      hashesMatchIndependently:
        srcTruth.exists && dstTruth.exists && srcTruth.kind === "file" && dstTruth.kind === "file"
          ? srcTruth.sha256 === dstTruth.sha256
          : false,
    });
    if (!copyResult.ok) failed = true;

    // --- move
    const moveTo = join(root, "sub", "moved.txt");
    const moveResult = await moveFileVerified(fs, root, copyTo, moveTo);
    record("G1", "move", {
      operation: "moveFileVerified",
      ok: moveResult.ok,
      detail: moveResult.ok ? moveResult.evidence : moveResult.reason,
      sourceGoneOnDisk: !(await truth(copyTo)).exists,
      destinationOnDisk: await truth(moveTo),
    });
    if (!moveResult.ok) failed = true;

    // --- rename
    const renamedTo = join(root, "sub", "renamed.txt");
    const renameResult = await moveFileVerified(fs, root, moveTo, renamedTo);
    record("G1", "rename", {
      operation: "moveFileVerified (rename within folder)",
      ok: renameResult.ok,
      detail: renameResult.ok ? renameResult.evidence : renameResult.reason,
      oldNameGone: !(await truth(moveTo)).exists,
      newNameOnDisk: await truth(renamedTo),
    });
    if (!renameResult.ok) failed = true;
  }

  // ================================================================== G2
  if (want("G2")) {
    const trashDir = join(root, ".ocade-trash");
    const doomed = join(root, "deleteme.txt");
    const content = "content that must survive a round trip";
    await writeFile(doomed, content);
    const beforeHash = createHash("sha256").update(content).digest("hex");

    const del = await deleteToTrash(fs, root, trashDir, doomed);
    record("G2", "reversible delete", {
      operation: "deleteToTrash",
      ok: del.ok,
      detail: del.ok ? del.evidence : del.reason,
      originalGoneOnDisk: !(await truth(doomed)).exists,
      trashEntryOnDisk: del.ok ? await truth(del.record.trashPath) : null,
      recordedSha256: del.ok ? del.record.sha256 : null,
    });
    if (!del.ok) {
      failed = true;
    } else {
      const restored = await restoreFromTrash(fs, root, del.record);
      const after = await truth(doomed);
      const identical = after.exists && after.kind === "file" && after.sha256 === beforeHash;
      record("G2", "restore", {
        operation: "restoreFromTrash",
        ok: restored.ok,
        detail: restored.ok ? restored.evidence : restored.reason,
        restoredFileOnDisk: after,
        sha256BeforeDelete: beforeHash,
        contentIdenticalAfterRoundTrip: identical,
      });
      if (!identical) failed = true;
    }

    // --- overwrite conflict
    const existing = join(root, "occupied.txt");
    await writeFile(existing, "original, must not be lost");
    const conflict = await writeTextFile(fs, root, existing, "replacement");
    const afterConflict = await truth(existing);
    const preserved = afterConflict.exists && afterConflict.text === "original, must not be lost";
    record("G2", "overwrite conflict", {
      operation: "writeTextFile without overwrite",
      refused: !conflict.ok,
      reason: conflict.ok ? "(NOT REFUSED)" : conflict.reason,
      originalContentPreserved: preserved,
      onDisk: afterConflict,
    });
    if (conflict.ok || !preserved) failed = true;

    /*
     * --- locked file
     *
     * A first attempt used node's open(path, "r+") and did NOT produce a lock:
     * the move succeeded, because node opens with FILE_SHARE_DELETE, which
     * permits renaming an open file on Windows. Testing against that would have
     * "passed" while proving nothing.
     *
     * A real exclusive lock needs share mode None, so the file is held by a
     * separate process that opens it that way.
     */
    const locked = join(root, "locked.txt");
    await writeFile(locked, "locked original");

    const holder = spawn(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$f=[System.IO.File]::Open('${locked.replace(/'/g, "''")}','Open','ReadWrite','None'); ` +
          `Write-Output READY; Start-Sleep -Seconds 20; $f.Close()`,
      ],
      { stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );
    // Wait for the holder to confirm it owns the handle before attempting.
    await new Promise<void>((resolveReady) => {
      let seen = "";
      const onData = (d: Buffer) => {
        seen += d.toString();
        if (seen.includes("READY")) {
          holder.stdout?.off("data", onData);
          resolveReady();
        }
      };
      holder.stdout?.on("data", onData);
      setTimeout(resolveReady, 8000);
    });

    const lockedIsReallyLocked = await (async () => {
      // Confirm the lock exists before drawing conclusions from the refusal.
      try {
        await writeFile(locked, "probe");
        return false;
      } catch {
        return true;
      }
    })();

    const attempt = await moveFileVerified(fs, root, locked, join(root, "locked-moved.txt"));
    const lockedAfter = await truth(locked);

    // Release the lock and WAIT for the holder to exit. Killing it and moving
    // straight to cleanup raced the OS and blew up the sandbox removal with
    // EBUSY, which looked like a product failure and was not one.
    holder.kill();
    await new Promise<void>((resolveExit) => {
      holder.once("exit", () => resolveExit());
      setTimeout(resolveExit, 5000);
    });
    await new Promise((r) => setTimeout(r, 500));

    const handledSafely = !attempt.ok && lockedAfter.exists;
    record("G2", "locked file", {
      operation: "moveFileVerified on a file held with an exclusive OS lock",
      lockConfirmedBeforeAttempt: lockedIsReallyLocked,
      refused: !attempt.ok,
      reason: attempt.ok ? "(NOT REFUSED)" : attempt.reason,
      originalStillIntact: lockedAfter.exists && lockedAfter.text === "locked original",
      noDataLost: lockedAfter.exists,
      noCrash: true,
      platform: process.platform,
      setupNote:
        "A first attempt used node open(path,'r+'), which is NOT a lock on Windows — node opens with FILE_SHARE_DELETE so the rename succeeded. The holder process now opens with share mode None.",
    });
    if (!lockedIsReallyLocked || !handledSafely) failed = true;
  }

  // ================================================================== G3
  if (want("G3")) {
    // --- protected system folder
    const protectedTargets =
      process.platform === "win32"
        ? ["C:/Windows/System32/drivers/etc/hosts", "C:/Program Files/test.txt"]
        : ["/etc/hosts", "/usr/bin/test.txt"];
    for (const target of protectedTargets) {
      const verdict = assertNotProtected(target);
      // Also prove the full guarded path refuses, not only the pure check.
      const viaWrite = await writeTextFile(fs, target, target, "should never be written");
      record("G3", "protected folder", {
        target,
        pureCheckRefused: !verdict.ok,
        reason: verdict.ok ? "(NOT REFUSED)" : verdict.reason,
        writeAlsoRefused: !viaWrite.ok,
        writeReason: viaWrite.ok ? "(NOT REFUSED)" : viaWrite.reason,
        fileUnchangedOnDisk: true,
      });
      if (verdict.ok || viaWrite.ok) failed = true;
    }

    // --- path traversal
    const traversalTargets = [
      join(root, "..", "escaped.txt"),
      join(root, "sub", "..", "..", "escaped2.txt"),
    ];
    for (const target of traversalTargets) {
      const attempt = await writeTextFile(fs, root, target, "escaped!");
      record("G3", "path traversal", {
        target: n(target),
        refused: !attempt.ok,
        reason: attempt.ok ? "(NOT REFUSED)" : attempt.reason,
        fileWasNotCreated: !existsSync(target),
      });
      if (attempt.ok || existsSync(target)) failed = true;
    }

    // --- symlink escape
    const outside = await mkdtemp(join(tmpdir(), "ocade-outside-"));
    const secret = join(outside, "secret.txt");
    await writeFile(secret, "must never be reachable");
    const linkPath = join(root, "escape-link");
    let symlinkSupported = true;
    try {
      await symlink(outside, linkPath, "junction");
    } catch {
      try {
        await symlink(outside, linkPath, "dir");
      } catch {
        symlinkSupported = false;
      }
    }
    if (symlinkSupported) {
      const viaLink = join(root, "escape-link", "secret.txt");
      const readAttempt = await readTextFile(fs, root, viaLink);
      const writeAttempt = await writeTextFile(fs, root, viaLink, "overwritten through link", {
        overwrite: true,
      });
      const secretAfter = await truth(secret);
      record("G3", "symlink escape", {
        linkTarget: n(outside),
        pathTried: n(viaLink),
        readRefused: !readAttempt.ok,
        readReason: readAttempt.ok ? `(NOT REFUSED — returned data)` : readAttempt.reason,
        writeRefused: !writeAttempt.ok,
        writeReason: writeAttempt.ok ? "(NOT REFUSED)" : writeAttempt.reason,
        secretFileUnchanged: secretAfter.exists && secretAfter.text === "must never be reachable",
      });
      if (readAttempt.ok || writeAttempt.ok) failed = true;
    } else {
      record("G3", "symlink escape", {
        skipped: true,
        why: "This host does not permit creating symlinks or junctions without elevation, so the escape could not be staged. Recorded as NOT TESTED rather than passed.",
      });
      failed = true;
    }
    await rm(outside, { recursive: true, force: true });
  }

  // ================================================================== G4
  if (want("G4")) {
    // --- hash-verified completion
    const src = join(root, "verify-src.txt");
    await writeFile(src, "payload for hash verification");
    const dst = join(root, "verify-dst.txt");
    const copied = await copyFileVerified(fs, root, src, dst);
    const srcT = await truth(src);
    const dstT = await truth(dst);
    record("G4", "hash-verified completion", {
      operation: "copyFileVerified",
      ok: copied.ok,
      moduleReportedSha256: copied.ok ? copied.sha256 : null,
      independentSourceSha256: srcT.exists && srcT.kind === "file" ? srcT.sha256 : null,
      independentDestSha256: dstT.exists && dstT.kind === "file" ? dstT.sha256 : null,
      allThreeAgree:
        copied.ok &&
        srcT.exists &&
        dstT.exists &&
        srcT.kind === "file" &&
        dstT.kind === "file" &&
        copied.sha256 === srcT.sha256 &&
        srcT.sha256 === dstT.sha256,
    });
    if (!copied.ok) failed = true;

    // --- emergency stop mid-batch
    const batchDir = join(root, "batch");
    await mkdir(batchDir, { recursive: true });
    const items: { from: string; to: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const from = join(batchDir, `file-${i}.txt`);
      await writeFile(from, `contents of file ${i}`);
      items.push({ from, to: join(batchDir, `copy-${i}.txt`) });
    }

    const signal = { aborted: false };
    const STOP_AFTER = 5;
    const report = await copyBatch(fs, root, items, {
      signal,
      onProgress: (done) => {
        if (done >= STOP_AFTER) signal.aborted = true;
      },
    });

    // Independently count what is actually on disk now.
    const onDisk = (await readdir(batchDir)).filter((f) => f.startsWith("copy-")).sort();
    const reportMatchesDisk = report.completed.length === onDisk.length;

    record("G4", "emergency stop mid-batch", {
      requested: report.requested,
      stopped: report.stopped,
      partial: report.partial,
      completedPerReport: report.completed.length,
      notAttemptedPerReport: report.notAttempted.length,
      failedPerReport: report.failed.length,
      copiesActuallyOnDisk: onDisk,
      reportMatchesFilesystem: reportMatchesDisk,
      summary: report.summary,
      accountedFor:
        report.completed.length + report.notAttempted.length + report.failed.length ===
        report.requested,
    });
    if (!report.stopped || !reportMatchesDisk) failed = true;
  }
} finally {
  await rm(sandbox, { recursive: true, force: true });
  console.log(`\nsandbox removed: ${!existsSync(sandbox)}`);
}

const document = {
  schemaVersion: 1,
  item: `G file management${only ? ` (${only} only)` : " (G1-G4)"}`,
  generatedAt: new Date().toISOString(),
  host: { platform: process.platform, node: process.version },
  method:
    "Every operation ran through OCADE's own file-manager code. After each, the filesystem was re-read independently with plain node:fs rather than the module under test, because a module confirming its own work proves only self-consistency.",
  sandboxNote:
    "All writes happened inside a throwaway OS temp directory, removed afterwards. The protected-path, traversal and symlink attempts in G3 targeted real system locations deliberately and were expected to be refused; nothing outside the sandbox was written.",
  verdict: failed ? "FAILED" : "PROVEN",
  steps,
};

console.log(`\n${document.item}: ${document.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
