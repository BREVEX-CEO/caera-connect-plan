import { describe, it, expect } from "vitest";
import { assertNotProtected, assertInsideRoot } from "../skills/packs/local-files-pack";
import type { FileSystemLike } from "../skills/packs/local-files-pack";

/**
 * Regression cover for a real defect.
 *
 * G3 found that approving `C:\Windows` as the root and writing to a file that
 * did not yet exist CREATED A REAL FILE in the real Windows directory. The
 * scope check passed and was right to: the target was genuinely inside the
 * approved root. The root itself was the problem, and nothing was checking it.
 *
 * The denylist now lives inside `assertInsideRoot`, the choke point every
 * operation already passes through, so it cannot be bypassed by adding a new
 * operation that forgets to call it.
 */

/**
 * `assertInsideRoot` lowercases paths before comparing, so it looks up the
 * lowercased form. A first version of this fake keyed on the original case and
 * every lookup missed, which surfaced as "That location doesn't exist." — a
 * harness bug that looked exactly like a product bug.
 */
function fakeFs(realpaths: Record<string, string>): FileSystemLike {
  const lookup = new Map(
    Object.entries(realpaths).map(([k, v]) => [
      k.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase(),
      v,
    ]),
  );
  return {
    realpath: async (p) => {
      const key = p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
      const hit = lookup.get(key);
      if (hit) return hit;
      throw new Error("ENOENT");
    },
    stat: async () => ({ isFile: true, isDirectory: false, size: 0 }),
    readFile: async () => "",
    writeFile: async () => undefined,
    readdir: async () => [],
    mkdir: async () => undefined,
    rename: async () => undefined,
    unlink: async () => undefined,
  };
}

describe("protected locations are refused however the path is expressed", () => {
  it.each([
    ["C:/Windows/System32/drivers/etc/hosts", "Windows system folder"],
    ["C:/Windows", "Windows system folder"],
    ["c:/windows/anything.txt", "Windows system folder"],
    ["D:/Program Files/app/config.ini", "installed-programs folder"],
    ["C:/Program Files (x86)/thing.dll", "installed-programs folder"],
    ["C:/ProgramData/secrets.json", "shared program data folder"],
    ["C:/$Recycle.Bin/file", "recycle bin"],
    ["/etc/passwd", "system folder"],
    ["/usr/bin/node", "system folder"],
    ["/home/user/.ssh/id_rsa", "SSH key folder"],
    ["/home/user/.aws/credentials", "cloud-credentials folder"],
    ["/repo/.git/config", "Git internals folder"],
  ])("refuses %s", (path, expected) => {
    const verdict = assertNotProtected(path);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.reason).toContain(expected);
  });

  it.each([
    "C:/Users/someone/Documents/report.txt",
    "C:/Windowsy/not-really-system.txt",
    "/home/user/projects/app.ts",
    "/tmp/scratch/file.txt",
  ])("allows ordinary path %s", (path) => {
    expect(assertNotProtected(path).ok).toBe(true);
  });

  it("does not mistake a folder merely STARTING with a protected name", () => {
    // "C:/Windowsy" is not "C:/Windows" — the boundary matters, or users lose
    // access to their own folders.
    expect(assertNotProtected("C:/Windowsy/file.txt").ok).toBe(true);
    expect(assertNotProtected("C:/Windows/file.txt").ok).toBe(false);
  });
});

describe("the defect itself: an approved root inside a system folder", () => {
  it("REFUSES even when the target is genuinely inside the approved root", async () => {
    // This is the exact shape that created a file in C:\Windows.
    const fs = fakeFs({ "C:/Windows": "C:/Windows" });
    const result = await assertInsideRoot(fs, "C:/Windows", "C:/Windows/new-file.txt");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/Windows system folder/);
  });

  it("still allows an ordinary approved root", async () => {
    const fs = fakeFs({ "C:/Users/me/docs": "C:/Users/me/docs" });
    const result = await assertInsideRoot(fs, "C:/Users/me/docs", "C:/Users/me/docs/new.txt");
    expect(result.ok).toBe(true);
  });

  it("still refuses a path outside the approved root, for the original reason", async () => {
    const fs = fakeFs({
      "C:/Users/me/docs": "C:/Users/me/docs",
      "C:/Users/me/other": "C:/Users/me/other",
    });
    const result = await assertInsideRoot(fs, "C:/Users/me/docs", "C:/Users/me/other");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/outside the folder you approved/);
  });
});
