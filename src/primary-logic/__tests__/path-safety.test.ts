/**
 * Which paths OCADE will not change without asking.
 *
 * The rule is deliberately narrow: everything, a filesystem root, a whole
 * drive, the home folder, and the system folders sitting directly on a root.
 * Narrow because a rule that objects to ordinary work gets turned off, and the
 * one it is protecting against — "empty this folder", pointed at a home
 * directory — is not ordinary work.
 */

import { describe, expect, it } from "vitest";

import {
  containsPathTraversal,
  dangerousPath,
  expandTilde,
  globBaseDirectory,
  normalizePath,
} from "../permissions/pathSafety";

const HOME = "/home/ada";

describe("paths OCADE will not change on its own", () => {
  it("recognises the whole disk", () => {
    expect(dangerousPath("/").dangerous).toBe(true);
    expect(dangerousPath("C:/").dangerous).toBe(true);
    expect(dangerousPath("C:\\").dangerous).toBe(true);
    expect(dangerousPath("*").dangerous).toBe(true);
    expect(dangerousPath("/*").dangerous).toBe(true);
  });

  it("recognises the home folder, however it was written", () => {
    expect(dangerousPath("~", HOME).dangerous).toBe(true);
    expect(dangerousPath("/home/ada", HOME).dangerous).toBe(true);
    expect(dangerousPath("/home/ada/", HOME).dangerous).toBe(true);
  });

  it("recognises a system folder sitting on a root", () => {
    for (const path of ["/etc", "/usr", "/System", "C:/Windows", "C:\\Program Files"]) {
      expect(dangerousPath(path).dangerous, path).toBe(true);
    }
  });

  it("leaves ordinary work alone", () => {
    for (const path of [
      "/home/ada/Downloads",
      "/usr/local/share/fonts",
      "C:/Users/ada/Documents",
      "./notes",
      "report.pdf",
    ]) {
      expect(dangerousPath(path, HOME).dangerous, path).toBe(false);
    }
  });

  it("judges a glob by where it looks, not by how it is written", () => {
    // The pattern reaches everything under root, whatever follows the star.
    expect(dangerousPath("/*.txt").dangerous).toBe(true);
    expect(dangerousPath("/home/ada/Downloads/*.txt", HOME).dangerous).toBe(false);
  });

  it("cannot be fooled by doubled separators", () => {
    // Valid in PowerShell, and the reason the donor collapses runs first.
    expect(dangerousPath("C:\\\\Windows").dangerous).toBe(true);
    expect(dangerousPath("//").dangerous).toBe(true);
  });

  it("says what it objected to, so OCADE can tell the user", () => {
    expect(dangerousPath("/", HOME).reason).toBe("that is the root of the filesystem");
    expect(dangerousPath("~", HOME).reason).toBe("that is the whole home folder");
    expect(dangerousPath("/etc").reason).toContain("system folder");
  });

  it("recognises a bare tilde without being told where home is", () => {
    /*
     * The browser deciding about somebody else's computer never knows their
     * home directory. `~` still means the whole home folder, so the rule is
     * written against the literal rather than against a resolution it cannot
     * perform.
     */
    expect(dangerousPath("~").dangerous).toBe(true);
    expect(dangerousPath("~/").dangerous).toBe(true);
    expect(dangerousPath("~/Downloads").dangerous).toBe(false);
    expect(dangerousPath("/").dangerous).toBe(true);
  });

  it("treats an empty path as nothing to object to", () => {
    expect(dangerousPath("   ", HOME).dangerous).toBe(false);
  });
});

describe("climbing out", () => {
  it("spots a traversal wherever it appears", () => {
    expect(containsPathTraversal("../secrets")).toBe(true);
    expect(containsPathTraversal("approved/../../etc")).toBe(true);
    expect(containsPathTraversal("approved\\..\\etc")).toBe(true);
    expect(containsPathTraversal("a/..")).toBe(true);
  });

  it("does not object to a name that merely contains dots", () => {
    expect(containsPathTraversal("../../fine")).toBe(true);
    expect(containsPathTraversal("my..notes.txt")).toBe(false);
    expect(containsPathTraversal("..hidden/file")).toBe(false);
  });
});

describe("the helpers", () => {
  it("expands a leading tilde and nothing else", () => {
    expect(expandTilde("~/Documents", HOME)).toBe("/home/ada/Documents");
    // Another account's home is deliberately not resolvable.
    expect(expandTilde("~bob/Documents", HOME)).toBe("~bob/Documents");
    expect(expandTilde("~/Documents", null)).toBe("~/Documents");
  });

  it("finds the directory a glob is rooted at", () => {
    expect(globBaseDirectory("/home/ada/*.txt")).toBe("/home/ada");
    expect(globBaseDirectory("*.txt")).toBe(".");
    expect(globBaseDirectory("/home/ada/notes.txt")).toBe("/home/ada/notes.txt");
  });

  it("normalises separators without eating the root", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("C:\\\\Users\\\\ada\\\\")).toBe("C:/Users/ada");
  });
});
