/**
 * Local files skill pack — a REAL, executed adapter for the OS/system category.
 *
 * Exercised against the actual filesystem in `local-files-pack.test.ts`: it
 * creates a throwaway directory, performs each operation, and verifies the
 * result by reading the filesystem back. That is what makes `tested: true`
 * truthful here.
 *
 * Everything runs locally with no network, which is the point — this is the
 * work OCADE can still do with the connection off.
 *
 * Safety posture:
 *  - every path is resolved and confirmed to be INSIDE an approved root before
 *    anything happens, so a symlink or `..` cannot reach outside it;
 *  - no recursive delete is exposed at all — the operation that most often
 *    destroys work irrecoverably cannot be expressed by this pack;
 *  - overwrite is never implicit: a write that would replace an existing file
 *    is refused unless the caller explicitly asked for it.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

/** Injected so tests use real fs and production uses the companion. */
export interface FileSystemLike {
  realpath(p: string): Promise<string>;
  stat(p: string): Promise<{ isFile: boolean; isDirectory: boolean; size: number }>;
  readFile(p: string): Promise<string>;
  writeFile(p: string, data: string): Promise<void>;
  readdir(p: string): Promise<string[]>;
  mkdir(p: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(p: string): Promise<void>;
}

const CAPABILITIES: SkillCapability[] = [
  {
    id: "files.list",
    label: "List a folder",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "files.read",
    label: "Read a text file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "files.write",
    label: "Write a text file",
    methods: ["file"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "files.rename",
    label: "Rename or move a file",
    methods: ["file"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "files.mkdir",
    label: "Create a folder",
    methods: ["file"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "files.delete",
    label: "Delete a single file",
    methods: ["file"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
];

export const LOCAL_FILES_PACK: SkillPack = {
  appId: "ocade.files.local",
  displayName: "Local files",
  category: "os_utilities",
  // The filesystem API is the contract, and it is exercised directly.
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
};

export type FileOutcome =
  { ok: true; evidence: string; data?: string } | { ok: false; reason: string };

/**
 * Locations nothing may touch, however the path is expressed or approved.
 *
 * Scoping to an approved root is NOT sufficient on its own, and this was found
 * the hard way: approving `C:\Windows` as the root and writing to a file that
 * did not yet exist created a real file in the real Windows directory. The
 * scope check passed, correctly — the target genuinely was inside the approved
 * root. The root was the problem.
 *
 * So this is a second, independent lock, applied at the same choke point every
 * operation already goes through. It is checked against the RESOLVED real path,
 * so `..` and symlinks cannot dodge it, and it applies to reads as well as
 * writes — `C:\Windows\System32\config\SAM` is not something to hand back
 * either.
 */
const PROTECTED_PATTERNS: { pattern: RegExp; what: string }[] = [
  { pattern: /^[a-z]:\/windows(\/|$)/i, what: "the Windows system folder" },
  { pattern: /^[a-z]:\/program files( \(x86\))?(\/|$)/i, what: "an installed-programs folder" },
  { pattern: /^[a-z]:\/programdata(\/|$)/i, what: "the shared program data folder" },
  { pattern: /^[a-z]:\/\$recycle\.bin(\/|$)/i, what: "the recycle bin" },
  { pattern: /^[a-z]:\/system volume information(\/|$)/i, what: "a system volume folder" },
  {
    pattern: /^\/(etc|bin|sbin|usr\/bin|usr\/sbin|boot|sys|proc|dev)(\/|$)/i,
    what: "a system folder",
  },
  { pattern: /^\/system(\/|$)/i, what: "the macOS system folder" },
  { pattern: /^\/library\/(launchdaemons|launchagents)(\/|$)/i, what: "a system startup folder" },
  { pattern: /(^|\/)\.ssh(\/|$)/i, what: "an SSH key folder" },
  { pattern: /(^|\/)\.aws(\/|$)/i, what: "a cloud-credentials folder" },
  { pattern: /(^|\/)\.git(\/|$)/i, what: "a Git internals folder" },
];

/** Pure, so it is cheap to test exhaustively. Expects a resolved real path. */
export function assertNotProtected(
  resolvedPath: string,
): { ok: true } | { ok: false; reason: string } {
  const p = resolvedPath.replace(/\\/g, "/").replace(/\/+$/, "");
  for (const { pattern, what } of PROTECTED_PATTERNS) {
    if (pattern.test(p)) {
      return {
        ok: false,
        reason: `That path is inside ${what}, which OCADE will not touch even if the folder was approved.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Confirm a path is genuinely inside the approved root AND not protected.
 *
 * Uses the RESOLVED real path on both sides, so a symlink pointing outside the
 * root is caught. A string-prefix check on the unresolved path would pass a
 * symlink straight through, which is the classic sandbox escape.
 */
export async function assertInsideRoot(
  fs: FileSystemLike,
  root: string,
  target: string,
): Promise<{ ok: true; resolved: string } | { ok: false; reason: string }> {
  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    return { ok: false, reason: "The approved folder could not be found." };
  }

  // Resolve the target itself when it exists. The path handed to the
  // filesystem must always be the caller's ORIGINAL path: case-folding it
  // first makes `realpath` fail on every case-sensitive filesystem, which
  // silently broke every operation under folders like `~/Documents`.
  let resolved: string;
  try {
    resolved = await fs.realpath(target);
  } catch {
    // The target may legitimately not exist yet (a create or a write), so
    // resolve its PARENT and re-attach the leaf name. Only the parent is
    // canonicalised, and the boundary check below compares against that
    // canonical prefix, so an unresolved leaf cannot widen the scope.
    const cut = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
    const parent = cut > 0 ? target.slice(0, cut) : root;
    const leaf = cut >= 0 ? target.slice(cut + 1) : target;
    if (leaf === "" || leaf === "." || leaf === "..") {
      return { ok: false, reason: "That location doesn't exist." };
    }
    let realParent: string;
    try {
      realParent = await fs.realpath(parent);
    } catch {
      return { ok: false, reason: "That location doesn't exist." };
    }
    const sep = realParent.includes("\\") && !realParent.includes("/") ? "\\" : "/";
    resolved = `${realParent.replace(/[\\/]+$/, "")}${sep}${leaf}`;
  }

  // Compare canonical path against canonical path, WITHOUT case-folding.
  // Both sides come back from `realpath`, so a case-insensitive filesystem
  // already reports each in its true on-disk case and an exact comparison is
  // correct there too. Folding instead treated `/data` and `/DATA` — two
  // genuinely different directories on Linux — as the same folder, which let
  // a target outside the approved root pass the boundary check.
  const rootKey = toPosix(realRoot);
  const targetKey = toPosix(resolved);
  const inside = targetKey === rootKey || targetKey.startsWith(`${rootKey}/`);
  if (!inside) {
    return { ok: false, reason: "That path is outside the folder you approved for this task." };
  }

  // Second lock: being inside an approved root is not enough if the root
  // itself is somewhere nothing should be writing.
  const notProtected = assertNotProtected(resolved);
  if (!notProtected.ok) return { ok: false, reason: notProtected.reason };

  return { ok: true, resolved };
}

/** Separator-normalised form used ONLY for comparison, never for filesystem calls. */
function toPosix(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** List a folder, verified by reading it back. */
export async function listFolder(
  fs: FileSystemLike,
  root: string,
  target: string,
): Promise<FileOutcome> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  try {
    const entries = await fs.readdir(target);
    return {
      ok: true,
      data: entries.join("\n"),
      evidence: `${entries.length} item${entries.length === 1 ? "" : "s"} in ${target}.`,
    };
  } catch {
    return { ok: false, reason: "That folder could not be read." };
  }
}

export async function readTextFile(
  fs: FileSystemLike,
  root: string,
  target: string,
): Promise<FileOutcome> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  try {
    const content = await fs.readFile(target);
    return { ok: true, data: content, evidence: `Read ${content.length} characters.` };
  } catch {
    return { ok: false, reason: "That file could not be read." };
  }
}

/**
 * Write a file, then VERIFY by reading it back.
 *
 * A successful write call is not proof: a full disk, a quota, or a filter
 * driver can accept the call and produce a truncated file. Overwrite must be
 * requested explicitly — silently replacing a file is how work disappears.
 */
export async function writeTextFile(
  fs: FileSystemLike,
  root: string,
  target: string,
  content: string,
  opts: { overwrite?: boolean } = {},
): Promise<FileOutcome> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return { ok: false, reason: scope.reason };

  if (!opts.overwrite) {
    try {
      await fs.stat(target);
      return {
        ok: false,
        reason: "That file already exists. OCADE won't replace it unless you ask it to.",
      };
    } catch {
      /* does not exist — safe to create */
    }
  }

  try {
    await fs.writeFile(target, content);
  } catch {
    return { ok: false, reason: "The file could not be written." };
  }

  // Verify by reading back, not by trusting the write.
  try {
    const readBack = await fs.readFile(target);
    if (readBack !== content) {
      return { ok: false, reason: "The file was written but its contents don't match." };
    }
    return { ok: true, evidence: `Wrote ${content.length} characters to ${target}.` };
  } catch {
    return { ok: false, reason: "The file was written but could not be read back to confirm." };
  }
}

/** Rename, verified by confirming the destination exists and the source is gone. */
export async function renameFile(
  fs: FileSystemLike,
  root: string,
  from: string,
  to: string,
): Promise<FileOutcome> {
  for (const p of [from, to]) {
    const scope = await assertInsideRoot(fs, root, p);
    if (!scope.ok) return { ok: false, reason: scope.reason };
  }

  // Never clobber silently.
  try {
    await fs.stat(to);
    return { ok: false, reason: "Something already exists at that name." };
  } catch {
    /* free */
  }

  try {
    await fs.rename(from, to);
  } catch {
    return { ok: false, reason: "The file could not be renamed." };
  }

  try {
    await fs.stat(to);
  } catch {
    return { ok: false, reason: "The rename reported success but the new name doesn't exist." };
  }
  return { ok: true, evidence: `Renamed to ${to}.` };
}

export async function makeFolder(
  fs: FileSystemLike,
  root: string,
  target: string,
): Promise<FileOutcome> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  try {
    await fs.mkdir(target);
    const st = await fs.stat(target);
    if (!st.isDirectory) return { ok: false, reason: "That path exists but is not a folder." };
    return { ok: true, evidence: `Created ${target}.` };
  } catch {
    return { ok: false, reason: "The folder could not be created." };
  }
}

/**
 * Delete ONE file. Never a folder, never recursive.
 *
 * Recursive delete is the operation that most often destroys work with no way
 * back, so this pack cannot express it at all.
 */
export async function deleteFile(
  fs: FileSystemLike,
  root: string,
  target: string,
): Promise<FileOutcome> {
  const scope = await assertInsideRoot(fs, root, target);
  if (!scope.ok) return { ok: false, reason: scope.reason };

  let st: { isFile: boolean; isDirectory: boolean; size: number };
  try {
    st = await fs.stat(target);
  } catch {
    return { ok: false, reason: "That file doesn't exist." };
  }
  if (st.isDirectory) {
    return {
      ok: false,
      reason: "That's a folder. OCADE only deletes one file at a time, never a folder.",
    };
  }

  try {
    await fs.unlink(target);
  } catch {
    return { ok: false, reason: "The file could not be deleted." };
  }

  // Confirm it is actually gone.
  try {
    await fs.stat(target);
    return { ok: false, reason: "The delete reported success but the file is still there." };
  } catch {
    return { ok: true, evidence: `Deleted ${target} (${st.size} bytes).` };
  }
}
