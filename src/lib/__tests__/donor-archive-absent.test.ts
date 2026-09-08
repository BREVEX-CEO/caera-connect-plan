import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * THE DONOR ARCHIVE IS NOT PART OF THE PRODUCT.
 *
 * `PLAN.md` §25: "Remove the raw RAR from the final tracked product and
 * releases without rewriting history." The final verification matrix states it
 * twice more — "No donor archive or extraction" and "Exactly 2,126 donor
 * dispositions" — because the two go together: the archive leaves, and the
 * record of what was decided about every file in it stays.
 *
 * WHY A TEST AND NOT JUST A DELETION. `.incoming/` is a live drop point for the
 * next archive. Deleting the file removes it once; the next `git add -A` after
 * somebody drops a replacement there puts a ten-megabyte binary back into the
 * product, and nothing would say so. The `.gitignore` rule prevents that and
 * this proves the rule is doing its job.
 *
 * Asks GIT rather than the filesystem, deliberately. A working copy can hold
 * whatever an operator is currently examining; what ships is what is tracked.
 */

function trackedFiles(): string[] {
  if (existsSync(".git") && process.env.OCADE_SOURCE_ARCHIVE !== "1") {
    return execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
  }

  /*
   * Release verification also runs against exported source archives, where
   * `.git` is intentionally absent. In that environment every source file in
   * the archive is part of the product, so a deterministic filesystem walk is
   * the equivalent authority. Dependency/build directories are created after
   * export and are not source-package contents.
   */
  const files: string[] = [];
  const excluded = new Set([".git", ".output", ".wrangler", "coverage", "node_modules"]);
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      if (excluded.has(entry)) continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(".", path).replace(/\\/g, "/"));
    }
  };
  walk(".");
  return files.sort();
}

const tracked = trackedFiles();

describe("no donor archive ships with the product", () => {
  it("tracks no archive of any kind", () => {
    /*
     * Not just `.rar`. Renaming it to `.zip` or `.7z` on the way in would
     * satisfy a narrower check while shipping exactly the same bytes.
     */
    /*
     * Not just `.rar`: renaming it to `.zip` or `.7z` on the way in would
     * satisfy a narrower check while shipping exactly the same bytes.
     *
     * ONE EXCEPTION, named with its reason. `release/packages/*.zip` is the
     * Chrome extension OCADE itself publishes — a deliverable the product
     * builds and a store consumes, not donor material. It is checked on its
     * own terms in `extension-package-installs.test.ts`, which reads it back
     * and asserts it is a loadable extension.
     */
    const archives = tracked
      .filter((file) => /\.(rar|zip|7z|tar|tgz|tar\.gz)$/i.test(file))
      .filter((file) => !file.startsWith("release/packages/"));
    expect(archives, "archives tracked in the product").toEqual([]);
  });

  it("tracks nothing under .incoming except its notes", () => {
    // The folder stays browsable so it does not 404; what it may CONTAIN is
    // documentation, not payload.
    const incoming = tracked.filter((file) => file.startsWith(".incoming/"));
    expect(incoming.sort()).toEqual([".incoming/LICENSE_TEMPLATE.md", ".incoming/README.md"]);
  });

  it("ignores a replacement archive rather than relying on nobody adding one", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain(".incoming/*.rar");

    // And proves the rule actually bites, rather than merely being present:
    // `git check-ignore` is git's own answer, not a reading of the file.
    if (existsSync(".git") && process.env.OCADE_SOURCE_ARCHIVE !== "1") {
      const answer = execFileSync(
        "git",
        ["check-ignore", "-v", ".incoming/OCADE_PRIMARY_LOGIC.rar"],
        { encoding: "utf8" },
      );
      expect(answer).toContain(".incoming/*.rar");
    }
  });
});

describe("what the archive was for is still here", () => {
  /*
   * The removal must not take the record with it. Provenance and the
   * disposition ledger are the reason it was safe to remove the binary at all.
   */
  it("keeps a decided outcome for every one of the 2,126 files", () => {
    const jsonl = readFileSync(
      "imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl",
      "utf8",
    );
    const records = jsonl.split(/\r?\n/).filter(Boolean);
    expect(records).toHaveLength(2126);

    // The CSV remains the historical decision input, not the final authority.
    const csv = readFileSync("imports/ocade-primary-logic/INTEGRATION_MAP.csv", "utf8");
    const rows = csv.split("\n").filter((line) => line.trim().length > 0);
    // One header plus one row per file.
    expect(rows.length - 1).toBe(2126);
  });

  it("keeps the archive's identity, so a future auditor can confirm the same one", () => {
    const notes = readFileSync(".incoming/README.md", "utf8");
    expect(notes).toContain("fd831f6c817af1dbadcd6cbc67ec17cd11d0a8edb7e01343fa60766ff11b17cd");
    expect(notes).toContain("2,126");
  });

  it("keeps the licence template the archive's terms require", () => {
    expect(tracked).toContain(".incoming/LICENSE_TEMPLATE.md");
  });
});
