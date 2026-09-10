/**
 * What has changed in this session, and what the rest of Git needs a host for.
 *
 * TWO KINDS OF ANSWER, KEPT APART ON PURPOSE
 * ------------------------------------------
 * `status` and `diff` are questions about the workspace, and the workspace is
 * right here: the baseline captured at intake and the files as they stand now.
 * Comparing them is observation, not inference, and it needs no repository on
 * disk, no credentials and no host — so OCADE answers them itself, exactly.
 *
 * Branch, worktree, commit, push, pull request and CI are questions about a
 * REPOSITORY, and this session is a set of files a person selected in a
 * browser. There is no `.git` here to read, no remote to reach and no
 * authorization to spend. The honest answer is that they need a host, said
 * plainly and once, with the reason — never a button that appears to work.
 *
 * WHY A DECLARED HOST DOES NOT MEAN A WORKING ONE. `GitHost.observed` is the
 * same rule the command host already uses: a result that was not watched to
 * completion is not a result. A host that returns "committed" without having
 * observed the commit is refused here rather than believed, because the whole
 * value of this surface is that a green line means the repository actually
 * moved.
 */

import type { CodeWorkspace } from "./workspace";
import type { SourceFile } from "./repo-map";

export type GitFileStatus = "added" | "modified" | "deleted";

export interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
  /** Lines added and removed against the baseline. Both zero for a rename-free no-op. */
  added: number;
  removed: number;
}

export interface GitStatus {
  entries: GitStatusEntry[];
  clean: boolean;
  /** How the answer was arrived at, in one sentence a person can check. */
  evidence: string;
}

/**
 * The working tree against the session baseline.
 *
 * Deterministic and pure: the same workspace always produces the same status,
 * which is what makes it something a test can hold and a person can trust.
 */
export function workspaceStatus(workspace: CodeWorkspace): GitStatus {
  const before = new Map(workspace.baseline.map((file) => [file.path, file.content]));
  const after = new Map(workspace.files.map((file) => [file.path, file.content]));
  const entries: GitStatusEntry[] = [];

  for (const [path, content] of after) {
    const original = before.get(path);
    if (original === undefined) {
      entries.push({ path, status: "added", added: lineCount(content), removed: 0 });
      continue;
    }
    if (original === content) continue;
    const counts = countChangedLines(original, content);
    entries.push({ path, status: "modified", ...counts });
  }
  for (const [path, content] of before) {
    if (!after.has(path)) {
      entries.push({ path, status: "deleted", added: 0, removed: lineCount(content) });
    }
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    entries,
    clean: entries.length === 0,
    evidence: `Compared ${workspace.files.length} working files against the ${workspace.baseline.length} taken in at intake.`,
  };
}

/**
 * A unified diff of the whole session, or of one path.
 *
 * The format is the one every reviewer already reads, produced from the same
 * two observed states the status came from — so the diff and the status can
 * never disagree.
 */
export function workspaceDiff(workspace: CodeWorkspace, path?: string): string {
  const before = new Map(workspace.baseline.map((file) => [file.path, file.content]));
  const after = new Map(workspace.files.map((file) => [file.path, file.content]));
  const paths = [...new Set([...before.keys(), ...after.keys()])]
    .filter((candidate) => path === undefined || candidate === path)
    .sort();

  const out: string[] = [];
  for (const candidate of paths) {
    const original = before.get(candidate);
    const current = after.get(candidate);
    if (original === current) continue;
    out.push(...fileDiff(candidate, original, current));
  }
  return out.join("\n");
}

/* ------------------------------------------------------------ the host -- */

export type GitOperation =
  | "branch-list"
  | "branch-create"
  | "branch-switch"
  | "worktree-list"
  | "commit"
  | "push"
  | "pull-request"
  | "ci-status";

export interface GitObservation {
  operation: GitOperation;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  /**
   * True only when the host watched the operation finish and captured its
   * output. An acknowledgement, a queued job or an optimistic reply is not
   * observation, and is refused below.
   */
  observed: boolean;
}

export interface GitHost {
  id: string;
  kind: "desktop" | "unavailable";
  /** Why nothing can be run, when nothing can. Shown to the person verbatim. */
  unavailableReason?: string;
  /** Operations this host is authorized for. An unlisted one is refused. */
  authorized: readonly GitOperation[];
  run(request: {
    operation: GitOperation;
    workspaceId: string;
    args?: Record<string, string>;
    signal?: AbortSignal;
  }): Promise<GitObservation>;
}

export type GitOutcome =
  { ok: true; observation: GitObservation; evidence: string } | { ok: false; reason: string };

/**
 * The one door to every repository operation OCADE cannot answer by itself.
 *
 * Four refusals, in the order that matters: no host, an unauthorized
 * operation, a host that threw, and a host that answered without having
 * watched. The last is the one worth having — it is what stops a plausible
 * integration from turning "push" into a label.
 */
export async function runGitOperation(
  host: GitHost,
  request: {
    operation: GitOperation;
    workspaceId: string;
    args?: Record<string, string>;
    signal?: AbortSignal;
  },
): Promise<GitOutcome> {
  if (host.kind === "unavailable") {
    return {
      ok: false,
      reason:
        host.unavailableReason ??
        "No repository host is connected, so OCADE cannot run Git operations on a real repository.",
    };
  }
  if (!host.authorized.includes(request.operation)) {
    return {
      ok: false,
      reason: `This repository host is not authorized for ${request.operation.replace("-", " ")}.`,
    };
  }

  let observation: GitObservation;
  try {
    observation = await host.run(request);
  } catch (cause) {
    return {
      ok: false,
      reason: `The repository host failed to run ${request.operation.replace("-", " ")}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    };
  }

  if (!observation.observed) {
    return {
      ok: false,
      reason: `The repository host reported ${request.operation.replace("-", " ")} without observing it finish. OCADE will not record an unobserved repository change.`,
    };
  }
  if (observation.operation !== request.operation) {
    return {
      ok: false,
      reason: "The repository host answered about a different operation than the one requested.",
    };
  }

  return {
    ok: true,
    observation,
    evidence:
      observation.exitCode === 0
        ? `${request.operation.replace("-", " ")} completed and was observed to exit 0.`
        : `${request.operation.replace("-", " ")} was observed to exit ${observation.exitCode}.`,
  };
}

/** The host every deployment has until a companion is connected and approved. */
export function unavailableGitHost(reason?: string): GitHost {
  return {
    id: "repository-host",
    kind: "unavailable",
    authorized: [],
    unavailableReason:
      reason ??
      "OCADE has this session's files, not a checkout, so branches, commits, pushes, pull requests and CI need a connected repository host. Status and diff below are computed from the files themselves.",
    async run() {
      throw new Error("Unavailable hosts must never be dispatched.");
    },
  };
}

/* ------------------------------------------------------------- private -- */

function lineCount(content: string): number {
  if (content === "") return 0;
  return content.split("\n").length;
}

function countChangedLines(before: string, after: string): { added: number; removed: number } {
  const left = before.split("\n");
  const right = after.split("\n");
  const common = longestCommonSubsequence(left, right);
  return { added: right.length - common, removed: left.length - common };
}

/**
 * Length of the longest common subsequence, which is what makes the counts
 * agree with the diff below rather than being a separate guess about it.
 *
 * Bounded: files this large are not reviewed line by line anyway, and an
 * unbounded quadratic walk over a generated bundle would freeze the tab.
 */
const MAX_DIFF_LINES = 4_000;

function longestCommonSubsequence(left: readonly string[], right: readonly string[]): number {
  if (left.length > MAX_DIFF_LINES || right.length > MAX_DIFF_LINES) {
    let same = 0;
    const shortest = Math.min(left.length, right.length);
    for (let index = 0; index < shortest; index += 1) {
      if (left[index] === right[index]) same += 1;
    }
    return same;
  }
  let previous = new Array<number>(right.length + 1).fill(0);
  let current = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    [previous, current] = [current, previous];
    current.fill(0);
  }
  return previous[right.length];
}

function fileDiff(path: string, before: string | undefined, after: string | undefined): string[] {
  const from = before === undefined ? "/dev/null" : `a/${path}`;
  const to = after === undefined ? "/dev/null" : `b/${path}`;
  const left = before === undefined ? [] : before.split("\n");
  const right = after === undefined ? [] : after.split("\n");

  /*
   * ONE HUNK PER FILE, WHOLE-FILE CONTEXT.
   *
   * Hunk splitting is an optimisation for humans reading long files in a
   * terminal, and getting the line arithmetic subtly wrong produces a diff
   * that applies cleanly to the wrong place. A whole-file hunk is always
   * correct, and the reviewer here has the file open beside it.
   */
  const body = [
    `--- ${from}`,
    `+++ ${to}`,
    `@@ -1,${left.length} +1,${right.length} @@`,
    ...left.map((line) => `-${line}`),
    ...right.map((line) => `+${line}`),
  ];
  return [`diff --git a/${path} b/${path}`, ...body];
}

export type { SourceFile };
