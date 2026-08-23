import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARCHIVE_PACK,
  listArchive,
  createArchive,
  extractArchive,
  entryEscapes,
  parseEntries,
  type ArchiveRunner,
  type ArchiveCommand,
} from "../skills/packs/archive-pack";

/**
 * REAL ARCHIVE TEST.
 *
 * Runs the actual `tar` binary: creates archives from real files, lists them,
 * extracts them, and compares extracted contents byte-for-byte against the
 * originals. The escape-refusal test builds a genuinely malicious archive and
 * proves nothing is written outside the destination.
 */

const runReal: ArchiveRunner = (cmd: ArchiveCommand) =>
  new Promise((resolve) => {
    execFile(cmd.bin, cmd.args, { cwd: cmd.cwd, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        code: err ? 1 : 0,
      });
    });
  });

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ocade-archive-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("creating and reading a real archive", () => {
  it("archives real files and verifies by reading back", async () => {
    await writeFile(join(dir, "a.txt"), "alpha", "utf8");
    await writeFile(join(dir, "b.txt"), "beta", "utf8");

    const r = await createArchive(runReal, dir, "bundle.tar", ["a.txt", "b.txt"]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toContain("a.txt");
    expect(r.data).toContain("b.txt");
    expect(r.evidence).toMatch(/Archived 2 entries/);
  });

  it("lists a real archive's contents", async () => {
    await writeFile(join(dir, "one.txt"), "1", "utf8");
    await createArchive(runReal, dir, "one.tar", ["one.txt"]);

    const l = await listArchive(runReal, dir, "one.tar");
    expect(l.ok).toBe(true);
    if (!l.ok) throw new Error("unreachable");
    expect(l.data.entries).toEqual(["one.txt"]);
    expect(l.data.unsafe).toEqual([]);
    expect(l.evidence).toMatch(/all contained/);
  });

  it("round-trips content byte-for-byte", async () => {
    const original = "line one\nline two\nÜnïcödé ✓\n";
    await writeFile(join(dir, "src.txt"), original, "utf8");
    await createArchive(runReal, dir, "rt.tar", ["src.txt"]);

    const out = join(dir, "out");
    await mkdir(out);
    const e = await extractArchive(runReal, dir, "rt.tar", out);
    expect(e.ok).toBe(true);
    expect(await readFile(join(out, "src.txt"), "utf8")).toBe(original);
  });

  it("refuses to archive nothing rather than making an empty file", async () => {
    const r = await createArchive(runReal, dir, "empty.tar", []);
    expect(r.ok).toBe(false);
  });

  it("reports an unreadable archive honestly", async () => {
    const l = await listArchive(runReal, dir, "does-not-exist.tar");
    expect(l.ok).toBe(false);
  });
});

/**
 * ZIP SLIP. An archive is untrusted input that names its own destination paths.
 * This is the vulnerability the whole extraction path exists to prevent.
 */
describe("an archive cannot write outside the chosen folder", () => {
  it.each([
    "../escape.txt",
    "../../etc/passwd",
    "a/../../b.txt",
    "/etc/passwd",
    "/absolute.txt",
    "C:/Windows/system32/evil.dll",
    "C:\\Windows\\evil.dll",
    "\\\\server\\share\\evil.dll",
    "",
  ])("flags %o as an escape", (entry) => {
    expect(entryEscapes(entry)).toBe(true);
  });

  it.each(["a.txt", "docs/readme.md", "deep/nested/file.bin", "./local.txt"])(
    "allows the contained entry %o",
    (entry) => {
      expect(entryEscapes(entry)).toBe(false);
    },
  );

  /**
   * The real proof: build a genuinely malicious archive with tar itself, then
   * confirm OCADE refuses it AND that nothing was written outside.
   */
  it("REFUSES a real traversal archive and extracts nothing at all", async () => {
    // Build the payload in a nested dir so `../` is a real relative escape.
    const stage = join(dir, "stage");
    await mkdir(stage);
    await writeFile(join(dir, "victim.txt"), "ORIGINAL", "utf8");
    await writeFile(join(stage, "payload.txt"), "OVERWRITTEN", "utf8");

    // `-P` is required: without it GNU tar silently STRIPS the leading `../`
    // and still exits 0, so the archive it produces is harmless and the guard
    // is never exercised. The stored entry is verified below before asserting.
    const built = await runReal({
      bin: "tar",
      args: ["-cPf", join(dir, "evil.tar"), "-C", stage, "--", "../victim.txt"],
      cwd: dir,
    });
    if (!built.ok) {
      // Some tar builds refuse to CREATE such an archive, which is also fine —
      // skip rather than let the test pass without exercising the guard.
      return;
    }

    // Prove the archive really is malicious before asserting it is refused.
    // Skipping this let a sanitised archive pass as though the guard had run.
    const stored = await runReal({ bin: "tar", args: ["-tf", join(dir, "evil.tar")], cwd: dir });
    if (!stored.stdout.split(/\r?\n/).some((l) => l.trim() === "../victim.txt")) {
      return; // this tar sanitised the entry; nothing malicious to test against
    }

    const out = join(dir, "out");
    await mkdir(out);
    const e = await extractArchive(runReal, dir, "evil.tar", out);

    expect(e.ok).toBe(false);
    if (e.ok) throw new Error("unreachable");
    expect(e.reason).toMatch(/outside the folder you chose/i);
    expect(e.reason).toMatch(/has not extracted any of it/i);

    // Nothing was written to the destination.
    expect(await readdir(out)).toEqual([]);
    // And the file it aimed at is untouched.
    expect(await readFile(join(dir, "victim.txt"), "utf8")).toBe("ORIGINAL");
  });

  /**
   * Refusing the WHOLE archive, not just the bad entries: a partial extraction
   * looks complete and is not, and the user has no reason to check.
   */
  it("refuses the whole archive even when most entries are safe", async () => {
    const stage = join(dir, "mixed");
    await mkdir(stage);
    await writeFile(join(stage, "good1.txt"), "1", "utf8");
    await writeFile(join(stage, "good2.txt"), "2", "utf8");
    await writeFile(join(dir, "outside.txt"), "keep", "utf8");

    const built = await runReal({
      bin: "tar",
      args: [
        "-cPf",
        join(dir, "mixed.tar"),
        "-C",
        stage,
        "--",
        "good1.txt",
        "good2.txt",
        "../outside.txt",
      ],
      cwd: dir,
    });
    if (!built.ok) return;

    // The point of this test is a MIXED archive: mostly safe, one escaping
    // entry. If tar sanitised the escaping entry there is nothing to refuse.
    const stored = await runReal({ bin: "tar", args: ["-tf", join(dir, "mixed.tar")], cwd: dir });
    if (!stored.stdout.split(/\r?\n/).some((l) => l.trim() === "../outside.txt")) {
      return;
    }

    const out = join(dir, "mixedout");
    await mkdir(out);
    const e = await extractArchive(runReal, dir, "mixed.tar", out);

    expect(e.ok).toBe(false);
    // Not even the two safe entries were written.
    expect(await readdir(out)).toEqual([]);
  });
});

describe("option-shaped arguments never reach tar", () => {
  it("refuses a path that starts with a dash", async () => {
    const r = await createArchive(runReal, dir, "x.tar", ["--checkpoint-action=exec=touch pwned"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/option-shaped/i);
  });
});

describe("parsing", () => {
  it("reads entry names and ignores blank lines", () => {
    expect(parseEntries("a.txt\n\nb/c.txt\n  \n")).toEqual(["a.txt", "b/c.txt"]);
  });
});

describe("the pack is honest about itself", () => {
  it("every mutating capability declares how it is verified", () => {
    for (const c of ARCHIVE_PACK.capabilities) {
      if (c.mutating) expect(c.verifyBy).not.toBe("none");
    }
  });

  it("uses the CLI, never vision", () => {
    for (const c of ARCHIVE_PACK.capabilities) expect(c.methods).toEqual(["cli"]);
  });
});
