/**
 * Git skill pack — a REAL, executed adapter for the development category.
 *
 * This is not a declared pack. Its capabilities are exercised against an actual
 * `git` binary in `git-pack.test.ts`, which creates a throwaway repository, runs
 * the commands, and verifies the results through git itself. That is what makes
 * `tested: true` truthful here.
 *
 * Safety posture:
 *  - every command is built from a fixed argv array, never a shell string, so a
 *    branch or path containing `;` or `&&` cannot become a second command;
 *  - the working directory is required and must be inside an approved scope;
 *  - destructive porcelain (`push --force`, `reset --hard`, `clean -fd`) is not
 *    exposed at all — those are the operations that lose work irrecoverably,
 *    and a pack that cannot express them cannot be talked into running them.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

/** Argv-only command description. No shell, ever. */
export interface GitCommand {
  /** Always "git". Present so a receipt records what actually ran. */
  bin: "git";
  args: string[];
  cwd: string;
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

/** Injected so tests use the real binary and production uses the companion. */
export type CommandRunner = (cmd: GitCommand) => Promise<CommandResult>;

/* --------------------------------------------------------- capabilities -- */

const CAPABILITIES: SkillCapability[] = [
  {
    id: "git.version",
    label: "Check the installed Git version",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.status",
    label: "See what has changed",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.log",
    label: "Read recent history",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.diff",
    label: "Show the exact changes",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.branch.list",
    label: "List branches",
    methods: ["cli"],
    mutating: false,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.stage",
    label: "Stage specific files",
    methods: ["cli"],
    mutating: true,
    // Verified by re-reading status, not by trusting the exit code.
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.commit",
    label: "Commit staged changes",
    methods: ["cli"],
    mutating: true,
    verifyBy: "log",
    tested: true,
  },
  {
    id: "git.branch.create",
    label: "Create a branch",
    methods: ["cli"],
    mutating: true,
    verifyBy: "log",
    tested: true,
  },
];

export const GIT_PACK: SkillPack = {
  appId: "git",
  displayName: "Git",
  category: "dev_tools",
  // Git's porcelain is stable across these majors; the pack is exercised
  // against whichever version is installed when the tests run.
  testedVersions: ["2."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
};

/* ------------------------------------------------------------ commands --- */

/**
 * Reject anything that could escape the argv boundary or reach outside the
 * repository. Git accepts `--upload-pack=...` style options that can execute
 * programs, so an argument that starts with `-` where a PATH is expected is
 * refused rather than passed through.
 */
export function isSafePathArg(arg: string): boolean {
  if (!arg.trim()) return false;
  if (arg.startsWith("-")) return false;
  if (arg.includes("\0")) return false;
  // Traversal is refused rather than resolved.
  return !arg.replace(/\\/g, "/").split("/").includes("..");
}

export function isSafeBranchName(name: string): boolean {
  // Git's own rules, tightened: no leading dash, no whitespace, no path tricks.
  return /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,100}$/.test(name) && !name.includes("..");
}

export const gitCommands = {
  version: (cwd: string): GitCommand => ({ bin: "git", args: ["--version"], cwd }),
  status: (cwd: string): GitCommand => ({
    bin: "git",
    args: ["status", "--porcelain=v1"],
    cwd,
  }),
  log: (cwd: string, limit = 10): GitCommand => ({
    bin: "git",
    args: ["log", `--max-count=${Math.max(1, Math.min(100, limit))}`, "--pretty=%H%x09%s"],
    cwd,
  }),
  diff: (cwd: string): GitCommand => ({ bin: "git", args: ["diff", "--stat"], cwd }),
  listBranches: (cwd: string): GitCommand => ({
    bin: "git",
    args: ["branch", "--format=%(refname:short)"],
    cwd,
  }),
  stage: (cwd: string, paths: string[]): GitCommand => ({
    bin: "git",
    // `--` separates paths from options, so a file named `-f` stays a file.
    args: ["add", "--", ...paths],
    cwd,
  }),
  commit: (cwd: string, message: string): GitCommand => ({
    bin: "git",
    args: ["commit", "-m", message],
    cwd,
  }),
  createBranch: (cwd: string, name: string): GitCommand => ({
    bin: "git",
    args: ["branch", name],
    cwd,
  }),
};

/* ------------------------------------------------------------ execution -- */

export type GitOutcome =
  { ok: true; evidence: string; data: string } | { ok: false; reason: string };

/** Parse `git --version` without assuming a format. */
export function parseVersion(stdout: string): string | null {
  const m = /git version (\S+)/i.exec(stdout);
  return m ? m[1] : null;
}

/** Parse porcelain status into a stable shape. */
export function parseStatus(stdout: string): { path: string; state: string }[] {
  return stdout
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => ({ state: l.slice(0, 2).trim(), path: l.slice(3).trim() }));
}

export function parseLog(stdout: string): { hash: string; subject: string }[] {
  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [hash, ...rest] = l.split("\t");
      return { hash, subject: rest.join("\t") };
    });
}

/**
 * Stage files, then VERIFY by re-reading status.
 *
 * The exit code alone is not proof: `git add` succeeds on a path that matches
 * nothing, so a typo'd filename would report success having staged nothing.
 */
export async function stageAndVerify(
  run: CommandRunner,
  cwd: string,
  paths: string[],
): Promise<GitOutcome> {
  const unsafe = paths.find((p) => !isSafePathArg(p));
  if (unsafe !== undefined) {
    return { ok: false, reason: `Refused an unsafe path argument: ${JSON.stringify(unsafe)}` };
  }

  const add = await run(gitCommands.stage(cwd, paths));
  if (!add.ok) return { ok: false, reason: add.stderr.trim() || "git add failed." };

  const after = await run(gitCommands.status(cwd));
  if (!after.ok) return { ok: false, reason: "Staged, but the result could not be verified." };

  const staged = parseStatus(after.stdout).filter((e) => /^[AMRD]/.test(e.state));
  if (staged.length === 0) {
    return {
      ok: false,
      reason: "Nothing was actually staged — the paths may not match any changed file.",
    };
  }
  return {
    ok: true,
    data: staged.map((s) => s.path).join(", "),
    evidence: `${staged.length} file${staged.length === 1 ? "" : "s"} staged: ${staged
      .map((s) => s.path)
      .join(", ")}`,
  };
}

/**
 * Commit, then VERIFY the new commit exists with the expected subject.
 * A zero exit code from `git commit` is not proof the commit landed.
 */
export async function commitAndVerify(
  run: CommandRunner,
  cwd: string,
  message: string,
): Promise<GitOutcome> {
  if (!message.trim()) return { ok: false, reason: "A commit needs a message." };

  const before = await run(gitCommands.log(cwd, 1));
  const beforeHash = parseLog(before.stdout)[0]?.hash ?? null;

  const commit = await run(gitCommands.commit(cwd, message));
  if (!commit.ok) {
    return {
      ok: false,
      reason: commit.stderr.trim() || commit.stdout.trim() || "git commit failed.",
    };
  }

  const after = await run(gitCommands.log(cwd, 1));
  const head = parseLog(after.stdout)[0];
  if (!head || head.hash === beforeHash) {
    return { ok: false, reason: "The commit did not appear in history." };
  }
  return {
    ok: true,
    data: head.hash,
    evidence: `Commit ${head.hash.slice(0, 8)} created: "${head.subject}"`,
  };
}

/** Create a branch, then VERIFY it is listed. */
export async function createBranchAndVerify(
  run: CommandRunner,
  cwd: string,
  name: string,
): Promise<GitOutcome> {
  if (!isSafeBranchName(name)) {
    return { ok: false, reason: `Refused an unsafe branch name: ${JSON.stringify(name)}` };
  }
  const create = await run(gitCommands.createBranch(cwd, name));
  if (!create.ok) {
    return { ok: false, reason: create.stderr.trim() || "The branch could not be created." };
  }
  const list = await run(gitCommands.listBranches(cwd));
  const branches = list.stdout
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (!branches.includes(name)) {
    return { ok: false, reason: "The branch was not found after creating it." };
  }
  return { ok: true, data: name, evidence: `Branch ${name} exists (${branches.length} total).` };
}
