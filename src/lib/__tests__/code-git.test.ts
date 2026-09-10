import { describe, it, expect } from "vitest";
import { createCodeWorkspace, applyCodePatch } from "@/lib/code/workspace";
import {
  runGitOperation,
  unavailableGitHost,
  workspaceDiff,
  workspaceStatus,
  type GitHost,
  type GitObservation,
} from "@/lib/code/git";

/**
 * What OCADE may claim about a repository, and what it must ask a host for.
 *
 * The phase gate is that every success rests on an observed postcondition.
 * Status and diff are observations of two things OCADE holds — the files taken
 * in and the files as they stand — so it answers those itself, exactly. A
 * commit or a push is a claim about a repository OCADE does not have, so those
 * go through a host, and a host that answers without watching is refused
 * rather than believed. That refusal is the test that matters.
 */

const workspaceOf = (files: { path: string; content: string }[]) => {
  const made = createCodeWorkspace({ name: "demo", files });
  if (!made.ok) throw new Error(made.reason);
  return made.data;
};

const greet = ["export function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");

/** A patch that rewrites the greeting line, in the format the workspace parses. */
const patchText = [
  "--- a/src/greet.js",
  "+++ b/src/greet.js",
  "@@ -1,3 +1,3 @@",
  " export function greet(name) {",
  '-  return "hi " + name;',
  '+  return "hello " + name;',
  " }",
].join("\n");

describe("what has changed in this session", () => {
  it("is clean when nothing has been touched", () => {
    const status = workspaceStatus(workspaceOf([{ path: "src/greet.js", content: greet }]));
    expect(status.clean).toBe(true);
    expect(status.entries).toEqual([]);
    expect(status.evidence).toMatch(/intake/i);
  });

  it("reports a modified file against the baseline, not against the last patch", async () => {
    const workspace = workspaceOf([{ path: "src/greet.js", content: greet }]);
    const applied = await applyCodePatch(workspace, patchText);
    expect(applied.ok, applied.ok ? "" : applied.reason).toBe(true);
    if (!applied.ok) return;

    const status = workspaceStatus(applied.data.workspace);
    expect(status.clean).toBe(false);
    expect(status.entries).toHaveLength(1);
    expect(status.entries[0].path).toBe("src/greet.js");
    expect(status.entries[0].status).toBe("modified");
    expect(status.entries[0].added).toBe(1);
    expect(status.entries[0].removed).toBe(1);
  });

  it("goes clean again when the change is undone", async () => {
    const workspace = workspaceOf([{ path: "src/greet.js", content: greet }]);
    const applied = await applyCodePatch(workspace, patchText);
    if (!applied.ok) throw new Error(applied.reason);
    const { undoCodeChange } = await import("@/lib/code/workspace");
    const undone = await undoCodeChange(applied.data.workspace, applied.data.change.id);
    expect(undone.ok, undone.ok ? "" : undone.reason).toBe(true);
    if (!undone.ok) return;
    // The baseline is the fixed point: undoing everything returns to it exactly.
    expect(workspaceStatus(undone.data.workspace).clean).toBe(true);
  });

  it("produces a diff that names the file and both sides of the change", async () => {
    const workspace = workspaceOf([{ path: "src/greet.js", content: greet }]);
    const applied = await applyCodePatch(workspace, patchText);
    if (!applied.ok) throw new Error(applied.reason);

    const diff = workspaceDiff(applied.data.workspace);
    expect(diff).toContain("diff --git a/src/greet.js b/src/greet.js");
    expect(diff).toContain('-  return "hi " + name;');
    expect(diff).toContain('+  return "hello " + name;');

    // And it can be narrowed to one path, which is what a review pane asks for.
    expect(workspaceDiff(applied.data.workspace, "nothing/here.js")).toBe("");
  });

  it("says nothing about a file it was never given", () => {
    const status = workspaceStatus(workspaceOf([{ path: "a.js", content: "x\n" }]));
    expect(status.entries.map((entry) => entry.path)).not.toContain("b.js");
  });
});

/* ------------------------------------------------------------- the host -- */

const observation = (over: Partial<GitObservation> = {}): GitObservation => ({
  operation: "commit",
  exitCode: 0,
  stdout: "[main abc1234] work",
  stderr: "",
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  observed: true,
  ...over,
});

const hostThat = (
  run: GitHost["run"],
  authorized: GitHost["authorized"] = ["commit"],
): GitHost => ({
  id: "test-host",
  kind: "desktop",
  authorized,
  run,
});

describe("what needs a repository, and what a host has to prove", () => {
  it("refuses everything when no host is connected, and says why", async () => {
    const result = await runGitOperation(unavailableGitHost(), {
      operation: "commit",
      workspaceId: "w1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/repository host/i);
    // The refusal names what OCADE can still do, so it is not a dead end.
    expect(result.reason).toMatch(/status and diff/i);
  });

  it("refuses an operation the host is not authorized for", async () => {
    const result = await runGitOperation(
      hostThat(async () => observation({ operation: "push" }), ["commit"]),
      { operation: "push", workspaceId: "w1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not authorized/i);
  });

  it("refuses a host that reports success without having watched it", async () => {
    /*
     * THE ONE THAT MATTERS. A plausible integration that returns as soon as it
     * has dispatched the command would turn "pushed" into a label, and the
     * person would find out from their colleague rather than from OCADE.
     */
    const result = await runGitOperation(
      hostThat(async () => observation({ observed: false })),
      { operation: "commit", workspaceId: "w1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/without observing/i);
  });

  it("refuses an answer about a different operation", async () => {
    const result = await runGitOperation(
      hostThat(async () => observation({ operation: "push" }), ["commit", "push"]),
      { operation: "commit", workspaceId: "w1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/different operation/i);
  });

  it("carries a thrown host failure through as a failure, not as silence", async () => {
    const result = await runGitOperation(
      hostThat(async () => {
        throw new Error("the companion is not running");
      }),
      { operation: "commit", workspaceId: "w1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/the companion is not running/);
  });

  it("accepts an observed operation, including one that failed", async () => {
    const good = await runGitOperation(
      hostThat(async () => observation()),
      {
        operation: "commit",
        workspaceId: "w1",
      },
    );
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.evidence).toMatch(/exit 0/);

    // A non-zero exit is a real answer and is reported as one — not hidden,
    // and not turned into a refusal.
    const failed = await runGitOperation(
      hostThat(async () => observation({ exitCode: 1, stderr: "nothing to commit" })),
      { operation: "commit", workspaceId: "w1" },
    );
    expect(failed.ok).toBe(true);
    if (failed.ok) {
      expect(failed.observation.exitCode).toBe(1);
      expect(failed.evidence).toMatch(/exit 1/);
    }
  });
});
