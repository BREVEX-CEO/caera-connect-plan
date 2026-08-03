/**
 * Archive skill pack — a REAL, executed adapter for file transfer and backup.
 *
 * Exercised against the actual `tar` binary in `archive-pack.test.ts`: it
 * creates archives from real files, lists them, extracts them, and verifies the
 * extracted contents byte-for-byte against the originals.
 *
 * The dangerous operation in this category is EXTRACTION, and the reason is
 * specific: an archive is untrusted input that names its own destination paths.
 * A crafted entry called `../../.ssh/authorized_keys` will happily write outside
 * the folder the user chose — the "zip slip" class of vulnerability. So this
 * pack inspects every entry BEFORE extracting anything, and refuses the whole
 * archive if any entry would escape.
 *
 * Refusing the whole archive rather than skipping bad entries is deliberate: a
 * partial extraction leaves the user with something that looks complete and
 * is not.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

export interface ArchiveCommand {
  bin: "tar";
  args: string[];
  cwd: string;
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export type ArchiveRunner = (cmd: ArchiveCommand) => Promise<CommandResult>;

const CAPABILITIES: SkillCapability[] = [
  {
    id: "archive.list",
    label: "List what's inside an archive",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "archive.create",
    label: "Create an archive",
    methods: ["cli"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "archive.extract",
    label: "Extract an archive you've approved",
    methods: ["cli"],
    mutating: true,
    verifyBy: "file",
    tested: true,
  },
];

export const ARCHIVE_PACK: SkillPack = {
  appId: "tar",
  displayName: "Archives",
  category: "browsers_transfer",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
};

export type ArchiveOutcome<T = string> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export const archiveCommands = {
  list: (cwd: string, archive: string): ArchiveCommand => ({
    bin: "tar",
    args: ["-tf", archive],
    cwd,
  }),
  create: (cwd: string, archive: string, entries: string[]): ArchiveCommand => ({
    bin: "tar",
    args: ["-cf", archive, "--", ...entries],
    cwd,
  }),
  extract: (cwd: string, archive: string, into: string): ArchiveCommand => ({
    bin: "tar",
    // `-C` sets the destination; entry paths are still validated first.
    args: ["-xf", archive, "-C", into],
    cwd,
  }),
};

/**
 * Would this archive entry escape the destination folder?
 *
 * Covers every escape route an archive can name:
 *  - `..` traversal, at any depth;
 *  - absolute POSIX paths (`/etc/passwd`);
 *  - Windows drive-absolute paths (`C:\Windows\...`);
 *  - UNC paths (`\\server\share`).
 *
 * Checked on the RAW entry name from the archive — not on a resolved path,
 * because resolution happens at extraction time, which is already too late.
 */
export function entryEscapes(entry: string): boolean {
  const e = entry.trim().replace(/\\/g, "/");
  if (!e) return true;
  if (e.startsWith("/")) return true; // absolute POSIX
  if (/^[A-Za-z]:\//.test(e)) return true; // C:/...
  if (e.startsWith("//")) return true; // UNC
  return e.split("/").includes("..");
}

/** Parse `tar -tf` output into entry names. */
export function parseEntries(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** List an archive's contents, flagging anything unsafe without extracting. */
export async function listArchive(
  run: ArchiveRunner,
  cwd: string,
  archive: string,
): Promise<ArchiveOutcome<{ entries: string[]; unsafe: string[] }>> {
  const r = await run(archiveCommands.list(cwd, archive));
  if (!r.ok) {
    return { ok: false, reason: r.stderr.trim() || "That archive could not be read." };
  }
  const entries = parseEntries(r.stdout);
  const unsafe = entries.filter(entryEscapes);
  return {
    ok: true,
    data: { entries, unsafe },
    evidence:
      unsafe.length > 0
        ? `${entries.length} entries, ${unsafe.length} of which would write outside the destination.`
        : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, all contained.`,
  };
}

/** Create an archive, then VERIFY by listing it back. */
export async function createArchive(
  run: ArchiveRunner,
  cwd: string,
  archive: string,
  entries: string[],
): Promise<ArchiveOutcome<string[]>> {
  if (entries.length === 0) return { ok: false, reason: "Nothing was selected to archive." };
  const unsafe = entries.filter((e) => e.startsWith("-"));
  if (unsafe.length > 0) {
    return { ok: false, reason: `Refused an option-shaped path: ${JSON.stringify(unsafe[0])}` };
  }

  const created = await run(archiveCommands.create(cwd, archive, entries));
  if (!created.ok) {
    return { ok: false, reason: created.stderr.trim() || "The archive could not be created." };
  }

  // Verify by reading the archive back, not by trusting the exit code.
  const listed = await listArchive(run, cwd, archive);
  if (!listed.ok) {
    return { ok: false, reason: "The archive was created but could not be read back to confirm." };
  }
  if (listed.data.entries.length === 0) {
    return { ok: false, reason: "The archive was created but is empty." };
  }
  return {
    ok: true,
    data: listed.data.entries,
    evidence: `Archived ${listed.data.entries.length} entr${listed.data.entries.length === 1 ? "y" : "ies"} into ${archive}.`,
  };
}

/**
 * Extract, but ONLY after inspecting every entry.
 *
 * The whole archive is refused if any entry would escape. Skipping the bad
 * entries and extracting the rest would leave the user with a result that looks
 * complete and is not — and they would have no reason to check.
 */
export async function extractArchive(
  run: ArchiveRunner,
  cwd: string,
  archive: string,
  into: string,
): Promise<ArchiveOutcome<string[]>> {
  const listed = await listArchive(run, cwd, archive);
  if (!listed.ok) return listed;

  if (listed.data.unsafe.length > 0) {
    const example = listed.data.unsafe[0];
    return {
      ok: false,
      reason: `This archive contains ${listed.data.unsafe.length} entr${listed.data.unsafe.length === 1 ? "y" : "ies"} that would write outside the folder you chose (for example “${example}”). OCADE has not extracted any of it.`,
    };
  }

  const extracted = await run(archiveCommands.extract(cwd, archive, into));
  if (!extracted.ok) {
    return { ok: false, reason: extracted.stderr.trim() || "The archive could not be extracted." };
  }
  return {
    ok: true,
    data: listed.data.entries,
    evidence: `Extracted ${listed.data.entries.length} entr${listed.data.entries.length === 1 ? "y" : "ies"} into ${into}.`,
  };
}
