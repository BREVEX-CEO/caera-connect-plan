import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GIT_PACK,
  gitCommands,
  parseVersion,
  parseStatus,
  parseLog,
  stageAndVerify,
  commitAndVerify,
  createBranchAndVerify,
  isSafePathArg,
  isSafeBranchName,
  type CommandRunner,
  type GitCommand,
} from "../skills/packs/git-pack";
import { matchPack } from "../skills/skill-pack";

/**
 * REAL EXECUTION TEST.
 *
 * These run the actual `git` binary against a throwaway repository and verify
 * results through git itself. This is what makes `tested: true` on the Git pack
 * a fact rather than a claim — every other pack in the registry is honest about
 * being unverified precisely because it has no equivalent to this file.
 */

/** Runs the real binary. argv only — never a shell string. */
const runReal: CommandRunner = (cmd: GitCommand) =>
  new Promise((resolve) => {
    execFile(cmd.bin, cmd.args, { cwd: cmd.cwd, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        code:
          err && typeof (err as { code?: number }).code === "number"
            ? (err as { code: number }).code
            : err
              ? 1
              : 0,
      });
    });
  });

let repo: string;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "ocade-git-"));
  await runReal({ bin: "git", args: ["init", "--initial-branch=main"], cwd: repo });
  // Identity is required for a commit; scoped to this repo only.
  await runReal({ bin: "git", args: ["config", "user.email", "test@example.invalid"], cwd: repo });
  await runReal({ bin: "git", args: ["config", "user.name", "OCADE Test"], cwd: repo });
}, 30_000);

afterAll(async () => {
  if (repo) await rm(repo, { recursive: true, force: true });
});

describe("the pack resolves against the installed Git", () => {
  it("reads the real version", async () => {
    const r = await runReal(gitCommands.version(repo));
    expect(r.ok).toBe(true);
    const version = parseVersion(r.stdout);
    expect(version).toMatch(/^\d+\./);
  });

  it("matches the installed version as a TESTED pack", async () => {
    const r = await runReal(gitCommands.version(repo));
    const version = parseVersion(r.stdout)!;
    const m = matchPack({ appId: "git", displayName: "Git", version }, [GIT_PACK]);
    // Only claim `verified` because this file actually exercises it.
    expect(m.confidence).toBe("verified");
  });

  it("reports `probed` for a version this pack was never run against", () => {
    const m = matchPack({ appId: "git", displayName: "Git", version: "3.0.0" }, [GIT_PACK]);
    expect(m.confidence).toBe("probed");
  });
});

describe("reading a real repository", () => {
  it("reports a clean tree honestly", async () => {
    const r = await runReal(gitCommands.status(repo));
    expect(r.ok).toBe(true);
    expect(parseStatus(r.stdout)).toEqual([]);
  });

  it("sees a new file appear", async () => {
    await writeFile(join(repo, "notes.txt"), "hello\n", "utf8");
    const r = await runReal(gitCommands.status(repo));
    const entries = parseStatus(r.stdout);
    expect(entries.map((e) => e.path)).toContain("notes.txt");
  });
});

/**
 * The core accuracy claim: OCADE verifies through the tool, not through an exit
 * code. `git add` exits 0 for a path that matches nothing, so trusting it would
 * report success having staged nothing at all.
 */
describe("staging is verified, not assumed", () => {
  it("stages a real file and proves it", async () => {
    const r = await stageAndVerify(runReal, repo, ["notes.txt"]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toContain("notes.txt");
  });

  it("REFUSES to report success when nothing was actually staged", async () => {
    const r = await stageAndVerify(runReal, repo, ["does-not-exist.txt"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    // git add exits non-zero here, but the check that matters is that we never
    // report a success we did not confirm.
    expect(r.reason.length).toBeGreaterThan(0);
  });
});

describe("committing is verified against history", () => {
  it("creates a commit and confirms it landed", async () => {
    const r = await commitAndVerify(runReal, repo, "Add notes");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/Commit [0-9a-f]{8} created: "Add notes"/);

    // Independent confirmation through git itself.
    const log = await runReal(gitCommands.log(repo, 1));
    expect(parseLog(log.stdout)[0].subject).toBe("Add notes");
  });

  it("reports failure when there is nothing to commit", async () => {
    const r = await commitAndVerify(runReal, repo, "Empty commit attempt");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("refuses an empty message rather than inventing one", async () => {
    const r = await commitAndVerify(runReal, repo, "   ");
    expect(r.ok).toBe(false);
  });
});

describe("branching is verified by listing", () => {
  it("creates a branch and confirms it exists", async () => {
    const r = await createBranchAndVerify(runReal, repo, "feature/ocade-test");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toContain("feature/ocade-test");

    const list = await runReal(gitCommands.listBranches(repo));
    expect(list.stdout).toContain("feature/ocade-test");
  });

  it("reports failure for a duplicate branch instead of claiming success", async () => {
    const r = await createBranchAndVerify(runReal, repo, "feature/ocade-test");
    expect(r.ok).toBe(false);
  });
});

/**
 * ADVERSARIAL. Every command is argv-only, so shell metacharacters are inert —
 * but arguments that git itself treats as options are the real risk.
 */
describe("adversarial input never becomes a command", () => {
  /**
   * These are the arguments that are genuinely dangerous with argv: git treats
   * a leading `-` as an OPTION, and options like `--upload-pack=` can execute a
   * program. Traversal is refused rather than resolved.
   */
  it.each(["--upload-pack=touch pwned", "-f", "--exec=evil", "../../etc/passwd", "", "   "])(
    "refuses %o as a path argument",
    (arg) => {
      expect(isSafePathArg(arg)).toBe(false);
    },
  );

  /**
   * Shell metacharacters are deliberately NOT rejected.
   *
   * Every command is argv-only, so `;` and backticks are inert — and `a;b.txt`
   * is a legitimate filename on Linux and macOS. Blocking them would break real
   * files while adding no protection, which is security theatre. The proof that
   * argv is doing the work is the "treated as data, not code" test below, which
   * stages a file whose name contains a semicolon.
   */
  it.each(["; rm -rf /", "&& echo pwned", "$(whoami)", "`id`"])(
    "treats %o as an ordinary (if odd) path, because argv makes it inert",
    (arg) => {
      expect(isSafePathArg(arg)).toBe(true);
    },
  );

  it("accepts ordinary paths", () => {
    for (const p of ["notes.txt", "src/index.ts", "docs/a b.md"]) {
      expect(isSafePathArg(p)).toBe(true);
    }
  });

  it.each(["-f", "--force", "a b", "..", "feat/../../x", "x".repeat(200), ""])(
    "refuses %o as a branch name",
    (name) => {
      expect(isSafeBranchName(name)).toBe(false);
    },
  );

  it("an option-shaped argument is rejected BEFORE any command runs", async () => {
    const r = await stageAndVerify(runReal, repo, ["--upload-pack=touch pwned"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/unsafe path/i);
  });

  /**
   * The end-to-end proof that argv, not string filtering, is what protects us:
   * git is handed a metacharacter path, runs, and reports it as a missing FILE
   * — never as a command. Nothing is executed.
   */
  it("hands a metacharacter path to git as data and gets a file error, not execution", async () => {
    const r = await stageAndVerify(runReal, repo, ["; rm -rf /"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/pathspec/i);
    expect(r.reason).toMatch(/did not match any files/i);
  });

  it("a shell metacharacter in a real filename is treated as data, not code", async () => {
    // Argv means this is just an unusual filename, and it must NOT execute.
    const weird = "a;b.txt";
    await writeFile(join(repo, weird), "x\n", "utf8");
    const r = await stageAndVerify(runReal, repo, [weird]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toContain(weird);
  });
});

/**
 * Destructive porcelain is not expressible by this pack. A capability that
 * cannot be named cannot be talked into running.
 */
describe("irrecoverable operations are absent by construction", () => {
  it("exposes no force-push, hard reset or clean", () => {
    const ids = GIT_PACK.capabilities.map((c) => c.id).join(" ");
    expect(ids).not.toMatch(/push|reset|clean|rebase|filter/i);
  });

  it("every mutating capability declares how it is verified", () => {
    for (const c of GIT_PACK.capabilities) {
      if (c.mutating) expect(c.verifyBy).not.toBe("none");
    }
  });

  it("only exposes the CLI route — no vision fallback for a tool with an API", () => {
    for (const c of GIT_PACK.capabilities) {
      expect(c.methods).toEqual(["cli"]);
    }
  });
});
