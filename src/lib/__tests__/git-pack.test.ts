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
    /*
     * Its OWN repository, rather than the shared one.
     *
     * This is the only test here that requires a pristine tree, and the shared
     * repo is deliberately built up across the blocks below — stage, commit,
     * branch. That made this assertion depend on running before all of them:
     * with `--sequence.shuffle` it saw two staged files and failed on a
     * property that was never actually broken.
     *
     * A test whose subject is emptiness should not be reading a fixture that
     * other tests are filling.
     */
    const pristine = await mkdtemp(join(tmpdir(), "ocade-git-clean-"));
    try {
      await runReal({ bin: "git", args: ["init", "--initial-branch=main"], cwd: pristine });
      const r = await runReal(gitCommands.status(pristine));
      expect(r.ok).toBe(true);
      expect(parseStatus(r.stdout)).toEqual([]);
    } finally {
      await rm(pristine, { recursive: true, force: true });
    }
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

/**
 * A fresh repository with one file present but unstaged.
 *
 * Each block that mutates git state gets its own, because the blocks form a
 * workflow — create, stage, commit, branch — and sharing one repository made
 * every block depend on the ones above it having run first. Under
 * `--sequence.shuffle` those dependencies do not hold, and the tests failed on
 * missing prerequisites rather than on the behaviour they exist to check.
 *
 * Dependencies WITHIN a block are kept, because there they are the point:
 * "refuses a duplicate" is only meaningful after "creates it".
 */
async function freshRepo(label: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `ocade-git-${label}-`));
  await runReal({ bin: "git", args: ["init", "--initial-branch=main"], cwd: dir });
  await runReal({ bin: "git", args: ["config", "user.email", "test@example.invalid"], cwd: dir });
  await runReal({ bin: "git", args: ["config", "user.name", "OCADE Test"], cwd: dir });
  await writeFile(join(dir, "notes.txt"), "hello\n", "utf8");
  return dir;
}

describe("staging is verified, not assumed", () => {
  let stageRepo: string;
  beforeAll(async () => {
    stageRepo = await freshRepo("stage");
  });
  afterAll(async () => {
    await rm(stageRepo, { recursive: true, force: true });
  });

  it("stages a real file and proves it", async () => {
    const r = await stageAndVerify(runReal, stageRepo, ["notes.txt"]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toContain("notes.txt");
  });

  it("REFUSES to report success when nothing was actually staged", async () => {
    const r = await stageAndVerify(runReal, stageRepo, ["does-not-exist.txt"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    // git add exits non-zero here, but the check that matters is that we never
    // report a success we did not confirm.
    expect(r.reason.length).toBeGreaterThan(0);
  });
});

describe("committing is verified against history", () => {
  let commitRepo: string;
  beforeAll(async () => {
    commitRepo = await freshRepo("commit");
    await runReal({ bin: "git", args: ["add", "notes.txt"], cwd: commitRepo });
  });
  afterAll(async () => {
    await rm(commitRepo, { recursive: true, force: true });
  });

  it("creates a commit and confirms it landed", async () => {
    const r = await commitAndVerify(runReal, commitRepo, "Add notes");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/Commit [0-9a-f]{8} created: "Add notes"/);

    // Independent confirmation through git itself.
    const log = await runReal(gitCommands.log(commitRepo, 1));
    expect(parseLog(log.stdout)[0].subject).toBe("Add notes");
  });

  it("reports failure when there is nothing to commit", async () => {
    const r = await commitAndVerify(runReal, commitRepo, "Empty commit attempt");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("refuses an empty message rather than inventing one", async () => {
    const r = await commitAndVerify(runReal, commitRepo, "   ");
    expect(r.ok).toBe(false);
  });
});

describe("branching is verified by listing", () => {
  /*
   * Its own repository, with its own commit.
   *
   * Git cannot create a branch before there is a commit, so these tests used to
   * depend on the "committing" block above having already run against the
   * shared repo. Under `--sequence.shuffle` that ordering does not hold and
   * both failed — on a missing prerequisite, not on the behaviour they exist to
   * check.
   *
   * The create/duplicate PAIR below is still deliberately sequential: the
   * second asserts that re-creating an existing branch is refused, which is
   * only meaningful after the first. Vitest keeps `it`s within one suite in
   * source order, so that dependency is expressed where it holds.
   */
  let branchRepo: string;

  beforeAll(async () => {
    branchRepo = await mkdtemp(join(tmpdir(), "ocade-git-branch-"));
    await runReal({ bin: "git", args: ["init", "--initial-branch=main"], cwd: branchRepo });
    await runReal({
      bin: "git",
      args: ["config", "user.email", "test@example.invalid"],
      cwd: branchRepo,
    });
    await runReal({ bin: "git", args: ["config", "user.name", "OCADE Test"], cwd: branchRepo });
    await writeFile(join(branchRepo, "seed.txt"), "seed\n", "utf8");
    await runReal({ bin: "git", args: ["add", "seed.txt"], cwd: branchRepo });
    await runReal({ bin: "git", args: ["commit", "-m", "seed"], cwd: branchRepo });
  });

  afterAll(async () => {
    await rm(branchRepo, { recursive: true, force: true });
  });

  it("creates a branch and confirms it exists", async () => {
    const r = await createBranchAndVerify(runReal, branchRepo, "feature/ocade-test");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toContain("feature/ocade-test");

    const list = await runReal(gitCommands.listBranches(branchRepo));
    expect(list.stdout).toContain("feature/ocade-test");
  });

  it("reports failure for a duplicate branch instead of claiming success", async () => {
    const r = await createBranchAndVerify(runReal, branchRepo, "feature/ocade-test");
    expect(r.ok).toBe(false);
  });
});

/**
 * ADVERSARIAL. Every command is argv-only, so shell metacharacters are inert —
 * but arguments that git itself treats as options are the real risk.
 */
describe("adversarial input never becomes a command", () => {
  /*
   * Its own repository too. These cases stage deliberately hostile paths, and
   * doing that in a fixture another block is asserting against would make one
   * suite's adversarial input another suite's unexplained failure.
   */
  let advRepo: string;
  beforeAll(async () => {
    advRepo = await freshRepo("adversarial");
  });
  afterAll(async () => {
    await rm(advRepo, { recursive: true, force: true });
  });

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
    const r = await stageAndVerify(runReal, advRepo, ["--upload-pack=touch pwned"]);
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
    const r = await stageAndVerify(runReal, advRepo, ["; rm -rf /"]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/pathspec/i);
    expect(r.reason).toMatch(/did not match any files/i);
  });

  it("a shell metacharacter in a real filename is treated as data, not code", async () => {
    // Argv means this is just an unusual filename, and it must NOT execute.
    const weird = "a;b.txt";
    await writeFile(join(advRepo, weird), "x\n", "utf8");
    const r = await stageAndVerify(runReal, advRepo, [weird]);
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
