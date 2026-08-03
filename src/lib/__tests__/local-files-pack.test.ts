import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LOCAL_FILES_PACK,
  assertInsideRoot,
  listFolder,
  readTextFile,
  writeTextFile,
  renameFile,
  makeFolder,
  deleteFile,
  type FileSystemLike,
} from "../skills/packs/local-files-pack";

/**
 * REAL FILESYSTEM TEST.
 *
 * Every operation runs against the actual filesystem in a throwaway directory
 * and is verified by reading the filesystem back. No network is involved, which
 * is the point: this is the work OCADE can still do with the connection off.
 */

/** The real fs, adapted to the injected interface. */
const realFs: FileSystemLike = {
  realpath: (p) => fsp.realpath(p),
  stat: async (p) => {
    const s = await fsp.stat(p);
    return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
  },
  readFile: (p) => fsp.readFile(p, "utf8"),
  writeFile: (p, d) => fsp.writeFile(p, d, "utf8"),
  readdir: (p) => fsp.readdir(p),
  mkdir: (p) => fsp.mkdir(p).then(() => undefined),
  rename: (a, b) => fsp.rename(a, b),
  unlink: (p) => fsp.unlink(p),
};

let root: string;
let outside: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ocade-files-"));
  outside = await mkdtemp(join(tmpdir(), "ocade-outside-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("working inside the approved folder", () => {
  it("lists real entries", async () => {
    await writeFile(join(root, "a.txt"), "A", "utf8");
    await mkdir(join(root, "sub"));
    const r = await listFolder(realFs, root, root);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toContain("a.txt");
    expect(r.data).toContain("sub");
    expect(r.evidence).toMatch(/2 items/);
  });

  it("reads a real file", async () => {
    await writeFile(join(root, "notes.txt"), "hello world", "utf8");
    const r = await readTextFile(realFs, root, join(root, "notes.txt"));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toBe("hello world");
  });

  it("creates a folder and confirms it is one", async () => {
    const r = await makeFolder(realFs, root, join(root, "archive"));
    expect(r.ok).toBe(true);
    expect((await fsp.stat(join(root, "archive"))).isDirectory()).toBe(true);
  });
});

/**
 * A successful write call is not proof: a full disk or a filter driver can
 * accept the call and leave a truncated file.
 */
describe("writes are verified by reading back", () => {
  it("writes a new file and confirms the contents", async () => {
    const target = join(root, "new.txt");
    const r = await writeTextFile(realFs, root, target, "written by OCADE");
    expect(r.ok).toBe(true);
    expect(await fsp.readFile(target, "utf8")).toBe("written by OCADE");
  });

  /** Silently replacing a file is how work disappears. */
  it("REFUSES to overwrite unless explicitly asked", async () => {
    const target = join(root, "existing.txt");
    await writeFile(target, "original", "utf8");

    const refused = await writeTextFile(realFs, root, target, "replacement");
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.reason).toMatch(/won't replace it unless you ask/i);
    // The original must be untouched.
    expect(await fsp.readFile(target, "utf8")).toBe("original");
  });

  it("overwrites when the caller genuinely asked", async () => {
    const target = join(root, "existing.txt");
    await writeFile(target, "original", "utf8");
    const r = await writeTextFile(realFs, root, target, "replacement", { overwrite: true });
    expect(r.ok).toBe(true);
    expect(await fsp.readFile(target, "utf8")).toBe("replacement");
  });
});

describe("renames are verified at the destination", () => {
  it("renames and confirms the new name exists", async () => {
    await writeFile(join(root, "before.txt"), "x", "utf8");
    const r = await renameFile(realFs, root, join(root, "before.txt"), join(root, "after.txt"));
    expect(r.ok).toBe(true);
    expect(await fsp.readFile(join(root, "after.txt"), "utf8")).toBe("x");
  });

  it("never clobbers an existing destination", async () => {
    await writeFile(join(root, "a.txt"), "A", "utf8");
    await writeFile(join(root, "b.txt"), "B", "utf8");
    const r = await renameFile(realFs, root, join(root, "a.txt"), join(root, "b.txt"));
    expect(r.ok).toBe(false);
    // Both files survive.
    expect(await fsp.readFile(join(root, "b.txt"), "utf8")).toBe("B");
  });
});

describe("deleting is one file at a time, and confirmed", () => {
  it("deletes a real file and proves it is gone", async () => {
    const target = join(root, "gone.txt");
    await writeFile(target, "bye", "utf8");
    const r = await deleteFile(realFs, root, target);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/3 bytes/);
    await expect(fsp.stat(target)).rejects.toThrow();
  });

  /** Recursive delete destroys work with no way back; it cannot be expressed. */
  it("REFUSES to delete a folder", async () => {
    await mkdir(join(root, "important"));
    await writeFile(join(root, "important", "keep.txt"), "keep", "utf8");

    const r = await deleteFile(realFs, root, join(root, "important"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/never a folder|only deletes one file/i);
    // Contents survive.
    expect(await fsp.readFile(join(root, "important", "keep.txt"), "utf8")).toBe("keep");
  });

  it("reports a missing file honestly rather than claiming success", async () => {
    const r = await deleteFile(realFs, root, join(root, "never-existed.txt"));
    expect(r.ok).toBe(false);
  });
});

/**
 * ADVERSARIAL. The sandbox must hold against traversal AND symlinks — a
 * string-prefix check on an unresolved path passes a symlink straight through,
 * which is the classic escape.
 */
describe("the approved folder is a real boundary", () => {
  it("refuses a traversal path", async () => {
    const r = await readTextFile(realFs, root, join(root, "..", "escape.txt"));
    expect(r.ok).toBe(false);
  });

  it("refuses an absolute path outside the root", async () => {
    await writeFile(join(outside, "secret.txt"), "secret", "utf8");
    const r = await readTextFile(realFs, root, join(outside, "secret.txt"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/outside the folder you approved/i);
  });

  /** The escape that a naive prefix check would miss. */
  it("REFUSES a symlink that points outside the approved folder", async () => {
    await writeFile(join(outside, "secret.txt"), "top secret", "utf8");
    const link = join(root, "innocent.txt");
    try {
      await symlink(join(outside, "secret.txt"), link);
    } catch {
      // Windows without developer mode cannot create symlinks; skip rather
      // than pretend the case was covered.
      return;
    }

    const r = await readTextFile(realFs, root, link);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/outside the folder you approved/i);
  });

  it("allows a path genuinely inside the root", async () => {
    await mkdir(join(root, "deep"));
    await writeFile(join(root, "deep", "ok.txt"), "fine", "utf8");
    const r = await assertInsideRoot(realFs, root, join(root, "deep", "ok.txt"));
    expect(r.ok).toBe(true);
  });

  it("refuses a write aimed outside the root before touching anything", async () => {
    const target = join(outside, "planted.txt");
    const r = await writeTextFile(realFs, root, target, "should never exist");
    expect(r.ok).toBe(false);
    await expect(fsp.stat(target)).rejects.toThrow();
  });
});

describe("the pack is honest about itself", () => {
  it("exposes no recursive or bulk delete", () => {
    const ids = LOCAL_FILES_PACK.capabilities.map((c) => c.id).join(" ");
    expect(ids).not.toMatch(/rmdir|recursive|deleteAll|purge|wipe/i);
  });

  it("every mutating capability declares how it is verified", () => {
    for (const c of LOCAL_FILES_PACK.capabilities) {
      if (c.mutating) expect(c.verifyBy).toBe("file");
    }
  });

  it("uses direct file access, never vision", () => {
    for (const c of LOCAL_FILES_PACK.capabilities) {
      expect(c.methods).toEqual(["file"]);
    }
  });
});
