import { describe, expect, it } from "vitest";
import { approvalPolicy, type MissionMode } from "@/lib/work/use-mission";
import { findTool, toolsFor } from "@/lib/agent/tool-registry";
import type { Domain } from "@/lib/agent/domains";

/**
 * The line between "hands-free is convenient" and "hands-free is dangerous".
 *
 * Voice mode exists because a confirmation card is unanswerable from across the
 * room. That reasoning is sound for medium-risk work and catastrophic for
 * high-risk work, so the distinction is asserted here rather than trusted to
 * whoever next edits the permission closure.
 */

const MODES: MissionMode[] = ["prompt", "voice"];

describe("what each mode asks about", () => {
  /*
   * THE CONTRACT CHANGED, AND THIS BLOCK IS THE RECORD OF IT.
   *
   * These cases used to assert that medium risk asked at the keyboard and
   * announced hands-free, and that high risk always asked. That was the right
   * design for a supervised assistant and the wrong one for this product: the
   * approval card was measured, live, as the last thing standing between "in
   * wordpad type about cars" and the text appearing — everything worked and
   * the run stopped on a Yes/No nobody wanted.
   *
   * OCADE now acts on what it was told to do. What survives is the ONE action
   * whose consequence leaves this computer.
   */
  it("does not ask before acting on this computer, in either mode", () => {
    for (const mode of ["prompt", "voice"] as const) {
      for (const risk of ["read", "low", "medium", "high"] as const) {
        expect(approvalPolicy(risk, mode)).toBe("auto");
      }
    }
  });

  it.each(["app_open", "type_text", "workspace_write", "file_trash", "screen_click"])(
    "runs %s without a prompt",
    (tool) => {
      expect(approvalPolicy("high", "prompt", tool)).toBe("auto");
    },
  );

  it("still asks before sending a message to another person", () => {
    // The one action that cannot be undone and does not stop at this machine.
    // Being hands-free is a reason to be more careful, not less, so voice mode
    // asks too rather than announcing.
    expect(approvalPolicy("high", "prompt", "message_send")).toBe("ask");
    expect(approvalPolicy("high", "voice", "message_send")).toBe("ask");
  });
});

describe("the tools that must never run unattended", () => {
  const irreversible = ["file_trash", "message_send"];

  /*
   * THE BAND AND THE PROMPT ARE NO LONGER THE SAME QUESTION.
   *
   * `high` still means "irreversible", and the SERVER still refuses a
   * high-risk call that arrives unconfirmed — that check is untouched. What
   * changed is that being irreversible no longer implies stopping to ask,
   * because `file_trash` is irreversible on this computer and recoverable from
   * the recycle bin, while `message_send` is irreversible in somebody else's
   * inbox. Only the second is worth a prompt.
   */
  it.each(irreversible)("%s stays banded high", (name) => {
    const tool = findTool(name);
    expect(tool, `${name} is missing from the registry`).not.toBeNull();
    expect(tool!.risk).toBe("high");
  });

  it("stops only for the action that leaves this computer", () => {
    for (const mode of MODES) {
      expect(approvalPolicy("high", mode, "message_send")).toBe("ask");
      expect(approvalPolicy("high", mode, "file_trash")).toBe("auto");
    }
  });

  it("keeps every high-risk tool mutating, so it reaches the permission gate", () => {
    /*
     * `runOneCall` only asks permission for tools marked `mutating`. A tool
     * that is high risk but not mutating would skip the gate entirely — the
     * combination is always a mistake, so it is asserted rather than assumed.
     */
    const all = toolsFor(["os_app", "files", "web"] as Domain[]);
    const highButNotMutating = all.filter((t) => t.risk === "high" && !t.mutating);
    expect(highButNotMutating.map((t) => t.name)).toEqual([]);
  });
});
