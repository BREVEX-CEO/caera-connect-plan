/**
 * File management operations OCADE can perform on a real machine (G1-G4).
 *
 * WHAT ALREADY EXISTED
 * --------------------
 * `skills/packs/local-files-pack.ts` covers list, read, write, rename, mkdir
 * and delete, with two safety properties worth keeping and reusing rather than
 * reimplementing: `assertInsideRoot` resolves BOTH sides with realpath (so a
 * symlink cannot escape an approved folder), and writes refuse to overwrite
 * unless asked.
 *
 * WHAT THIS ADDS
 * --------------
 *   search        - find files without loading a whole tree into memory
 *   copy          - with content verified by hash, not by "no error thrown"
 *   trash/restore - deletion that is genuinely reversible
 *   protected     - a denylist so an approved root inside C:\Windows is still refused
 *   batch + stop  - a long operation that can be halted and then reports the truth
 *
 * THREE RULES THIS MODULE WILL NOT BEND
 *
 * 1. **An operation is not complete because the OS returned success.** Every
 *    mutation is confirmed by reading the result back, and copies are confirmed
 *    by comparing content hashes. `rename()` returning without throwing tells
 *    you the call was accepted, not that the bytes are where you think.
 * 2. **Deletion is reversible or it is refused.** Files move to a trash folder
 *    with a manifest recording where they came from and what they hashed to.
 *    Nothing here can permanently destroy a file.
 * 3. **A stopped batch reports exactly what it did.** Emergency stop leaves a
 *    partially-completed operation, and the caller is told precisely which
 *    items completed, which did not, and that the state is partial. Reporting
 *    "cancelled" without that list is how people lose track of their own data.
 */
import {
  assertInsideRoot,
  assertNotProtected,
  type FileSystemLike,
  type FileOutcome,
} from "../skills/packs/local-files-pack.ts";

// One denylist, defined beside the scope check it belongs with. Re-exported so
// callers of this module do not need to know which file it lives in — two
// copies of a security rule is two rules that can drift apart.
export { assertNotProtected };

/** The extra capabilities file management needs beyond the base pack. */
export interface FileManagerFs extends FileSystemLike {
  /** SHA-256 of a file's bytes, as lowercase hex. */
  hashFile(p: string): Promise<string>;
  copyFile(from: string, to: string): Promise<void>;
  /** True when the path exists at all — file, directory or link. */
  exists(p: string): Promise<boolean>;
  /** Directory entries with their kind, so search need not stat each one. */
  readdirTyped(p: string): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]>;
}

const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");

/**
 * Turn an OS error into something a person can act on.
 *
 * "The file could not be read" is true and useless: it does not tell someone
 * their document is open in Word. EBUSY and EPERM on a file that plainly exists
 * mean another program is holding it, and saying so is the difference between a
 * user closing an app and a user filing a bug.
 */
function describeAccessFailure(error: unknown, path: string, verb: "read" | "move"): string {
  const code = (error as { code?: string } | null)?.code ?? "";
  const name = path.replace(/\\/g, "/").split("/").pop() ?? path;
  if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
    return `"${name}" is locked by another program, so OCADE could not ${verb} it. Close whatever has it open and try again — nothing was changed.`;
  }
  if (code === "ENOENT") return `"${name}" no longer exists.`;
  return `"${name}" could not be ${verb === "read" ? "read" : "moved"}${code ? ` (${code})` : ""}.`;
}

/**
 * Scope check plus protected check.
 *
 * `assertInsideRoot` now applies the denylist itself, so this is belt and
 * braces — but it stays explicit here because these two rules are the entire
 * safety story for this module, and a future refactor of one should not be able
 * to silently remove the other.
 */
async function guard(
  fs: FileManagerFs,
  root: string,
  target: string,
): Promise<{ ok: true; resolved: string } | { ok: false; reason: string }> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return scope;
  const protectedCheck = assertNotProtected(scope.resolved);
  if (!protectedCheck.ok) return { ok: false, reason: protectedCheck.reason };
  return scope;
}

// ---------------------------------------------------------------- G1: search

export interface SearchHit {
  path: string;
  sizeBytes: number;
}

export interface SearchOptions {
  /** Case-insensitive substring, or a regular expression. */
  match: string | RegExp;
  /** Stop after this many hits so a huge tree cannot exhaust memory. */
  limit?: number;
  /** How deep to descend. */
  maxDepth?: number;
  signal?: { aborted: boolean };
}

/**
 * Find files under an approved root.
 *
 * Bounded on purpose: a search with no limit on a large tree is a memory
 * problem waiting to happen, and an unbounded depth follows directory
 * structures nobody intended to walk.
 */
export async function searchFiles(
  fs: FileManagerFs,
  root: string,
  options: SearchOptions,
): Promise<{ ok: true; hits: SearchHit[]; truncated: boolean } | { ok: false; reason: string }> {
  const scope = await assertInsideRoot(fs, root, root);
  if (!scope.ok) return { ok: false, reason: scope.reason };

  const limit = options.limit ?? 500;
  const maxDepth = options.maxDepth ?? 12;
  const test = (name: string) =>
    typeof options.match === "string"
      ? name.toLowerCase().includes(options.match.toLowerCase())
      : options.match.test(name);

  const hits: SearchHit[] = [];
  let truncated = false;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || hits.length >= limit || options.signal?.aborted) return;
    let entries: { name: string; isDirectory: boolean; isFile: boolean }[];
    try {
      entries = await fs.readdirTyped(dir);
    } catch {
      return; // an unreadable folder is skipped, not fatal
    }
    for (const entry of entries) {
      if (options.signal?.aborted) return;
      if (hits.length >= limit) {
        truncated = true;
        return;
      }
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        await walk(full, depth + 1);
      } else if (entry.isFile && test(entry.name)) {
        try {
          const st = await fs.stat(full);
          hits.push({ path: full, sizeBytes: st.size });
        } catch {
          /* vanished between listing and stat — skip */
        }
      }
    }
  }

  await walk(norm(root), 0);
  return { ok: true, hits, truncated };
}

// ------------------------------------------------------------------ G1: copy

/**
 * Copy a file and prove the copy is identical.
 *
 * The hash comparison is the point. A copy that "succeeded" but produced
 * different bytes — truncated by a full disk, mangled by an encoding layer —
 * is worse than one that failed loudly, because nothing announces it.
 */
export async function copyFileVerified(
  fs: FileManagerFs,
  root: string,
  from: string,
  to: string,
  opts: { overwrite?: boolean } = {},
): Promise<FileOutcome & { sha256?: string }> {
  for (const p of [from, to]) {
    const g = await guard(fs, root, p);
    if (!g.ok) return { ok: false, reason: g.reason };
  }

  if (!opts.overwrite && (await fs.exists(to))) {
    return {
      ok: false,
      reason: "Something already exists at the destination. OCADE won't replace it unless you ask.",
    };
  }

  let sourceHash: string;
  try {
    sourceHash = await fs.hashFile(from);
  } catch {
    return { ok: false, reason: "The file to copy could not be read." };
  }

  try {
    await fs.copyFile(from, to);
  } catch {
    return { ok: false, reason: "The file could not be copied." };
  }

  let destHash: string;
  try {
    destHash = await fs.hashFile(to);
  } catch {
    return { ok: false, reason: "The copy was made but could not be read back to confirm." };
  }

  if (destHash !== sourceHash) {
    return {
      ok: false,
      reason: `The copy does not match the original (${sourceHash.slice(0, 12)} vs ${destHash.slice(0, 12)}).`,
    };
  }

  return {
    ok: true,
    evidence: `Copied to ${to}, verified sha256 ${sourceHash}.`,
    sha256: sourceHash,
  };
}

/** Move a file and confirm the source is genuinely gone. */
export async function moveFileVerified(
  fs: FileManagerFs,
  root: string,
  from: string,
  to: string,
): Promise<FileOutcome & { sha256?: string }> {
  for (const p of [from, to]) {
    const g = await guard(fs, root, p);
    if (!g.ok) return { ok: false, reason: g.reason };
  }

  if (await fs.exists(to)) {
    return { ok: false, reason: "Something already exists at that name." };
  }

  let sourceHash: string;
  try {
    sourceHash = await fs.hashFile(from);
  } catch (error) {
    return { ok: false, reason: describeAccessFailure(error, from, "read") };
  }

  try {
    await fs.rename(from, to);
  } catch (error) {
    return { ok: false, reason: describeAccessFailure(error, from, "move") };
  }

  // Both halves are checked: arrived, AND departed.
  if (!(await fs.exists(to))) {
    return {
      ok: false,
      reason: "The move reported success but the file is not at the destination.",
    };
  }
  if (await fs.exists(from)) {
    return {
      ok: false,
      reason: "The file was copied to the destination but still exists at the source.",
    };
  }
  const destHash = await fs.hashFile(to);
  if (destHash !== sourceHash) {
    return { ok: false, reason: "The moved file's contents do not match the original." };
  }
  return {
    ok: true,
    evidence: `Moved to ${to}, verified sha256 ${sourceHash}.`,
    sha256: sourceHash,
  };
}

// ------------------------------------------- G2: reversible delete and restore

export interface TrashRecord {
  id: string;
  originalPath: string;
  trashPath: string;
  sha256: string;
  sizeBytes: number;
  deletedAt: string;
}

/**
 * Delete reversibly: move to a trash folder and record how to undo it.
 *
 * Nothing in this module can permanently destroy a file. The hash is captured
 * BEFORE the move so a restore can prove the content came back unchanged
 * rather than merely that a file reappeared.
 */
export async function deleteToTrash(
  fs: FileManagerFs,
  root: string,
  trashDir: string,
  target: string,
  now: () => Date = () => new Date(),
): Promise<{ ok: true; record: TrashRecord; evidence: string } | { ok: false; reason: string }> {
  const g = await guard(fs, root, target);
  if (!g.ok) return { ok: false, reason: g.reason };

  let st: { isFile: boolean; isDirectory: boolean; size: number };
  try {
    st = await fs.stat(target);
  } catch {
    return { ok: false, reason: "That file doesn't exist." };
  }
  if (st.isDirectory) {
    return {
      ok: false,
      reason: "That's a folder. OCADE deletes one file at a time, never a folder.",
    };
  }

  const sha256 = await fs.hashFile(target);
  const id = `${now().getTime().toString(36)}-${norm(target).split("/").pop()}`;
  const trashPath = `${norm(trashDir)}/${id}`;

  try {
    await fs.mkdir(trashDir);
  } catch {
    /* already there */
  }

  try {
    await fs.rename(target, trashPath);
  } catch {
    return { ok: false, reason: "The file could not be moved to the trash folder." };
  }

  if (await fs.exists(target)) {
    return { ok: false, reason: "The delete reported success but the file is still in place." };
  }
  if (!(await fs.exists(trashPath))) {
    return {
      ok: false,
      reason: "The file left its original location but is not in the trash folder.",
    };
  }

  const record: TrashRecord = {
    id,
    originalPath: norm(target),
    trashPath,
    sha256,
    sizeBytes: st.size,
    deletedAt: now().toISOString(),
  };
  return { ok: true, record, evidence: `Moved to trash; recoverable. sha256 ${sha256}.` };
}

/** Put a trashed file back, and prove the content is byte-identical. */
export async function restoreFromTrash(
  fs: FileManagerFs,
  root: string,
  record: TrashRecord,
): Promise<FileOutcome> {
  const g = await guard(fs, root, record.originalPath);
  if (!g.ok) return { ok: false, reason: g.reason };

  if (!(await fs.exists(record.trashPath))) {
    return { ok: false, reason: "That deleted file is no longer in the trash folder." };
  }
  if (await fs.exists(record.originalPath)) {
    return {
      ok: false,
      reason:
        "Something already exists where that file used to be, so restoring it would overwrite something.",
    };
  }

  try {
    await fs.rename(record.trashPath, record.originalPath);
  } catch {
    return { ok: false, reason: "The file could not be restored." };
  }

  const restoredHash = await fs.hashFile(record.originalPath);
  if (restoredHash !== record.sha256) {
    return {
      ok: false,
      reason: `The file was restored but its contents changed (expected ${record.sha256.slice(0, 12)}, got ${restoredHash.slice(0, 12)}).`,
    };
  }
  return {
    ok: true,
    evidence: `Restored to ${record.originalPath}, sha256 matches: ${restoredHash}.`,
  };
}

// ------------------------------------------ G4: batch with real emergency stop

export interface BatchItem {
  from: string;
  to: string;
}

export interface BatchReport {
  requested: number;
  completed: { from: string; to: string; sha256: string }[];
  notAttempted: BatchItem[];
  failed: { item: BatchItem; reason: string }[];
  stopped: boolean;
  /** True when some items were done and some were not. */
  partial: boolean;
  summary: string;
}

/**
 * Copy many files, stoppable at any point.
 *
 * The report is the deliverable. A batch halted halfway has left the disk in a
 * state the user did not ask for, and telling them only "cancelled" leaves them
 * to work out what happened. Every item is accounted for as completed, failed
 * or not attempted, and `partial` says plainly that the operation is half done.
 */
export async function copyBatch(
  fs: FileManagerFs,
  root: string,
  items: BatchItem[],
  options: {
    signal?: { aborted: boolean };
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<BatchReport> {
  const completed: BatchReport["completed"] = [];
  const failed: BatchReport["failed"] = [];
  let stoppedAt = -1;

  for (let i = 0; i < items.length; i++) {
    if (options.signal?.aborted) {
      stoppedAt = i;
      break;
    }
    const item = items[i];
    const result = await copyFileVerified(fs, root, item.from, item.to);
    if (result.ok) {
      completed.push({ from: item.from, to: item.to, sha256: result.sha256! });
    } else {
      failed.push({ item, reason: result.reason });
    }
    options.onProgress?.(i + 1, items.length);
  }

  const notAttempted = stoppedAt >= 0 ? items.slice(stoppedAt) : [];
  const stopped = stoppedAt >= 0;
  const partial = stopped && completed.length > 0;

  const summary = stopped
    ? `Stopped after ${completed.length} of ${items.length}. ${completed.length} file(s) were copied and remain on disk; ${notAttempted.length} were not started. This is a partial result.`
    : failed.length > 0
      ? `Completed ${completed.length} of ${items.length}; ${failed.length} failed.`
      : `Completed all ${items.length}, each verified by hash.`;

  return { requested: items.length, completed, notAttempted, failed, stopped, partial, summary };
}
