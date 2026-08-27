import { describe, expect, it } from "vitest";
import { findTool, toolsFor } from "@/lib/agent/tool-registry";
import type { Domain } from "@/lib/agent/domains";
import { createPermissionContext, decide } from "@/lib/runtime/permissions";

/**
 * What Cowork asks about, now that it asks the same layer Chat does.
 *
 * THE CONTRACT THIS FILE USED TO ASSERT, AND WHY IT IS GONE.
 *
 * These cases used to prove that `approvalPolicy` returned "auto" for every
 * risk band in every mode — that OCADE would trash a file, type into a window
 * or run a shell command without a question, and that only `message_send`
 * stopped. That was written when the approval card was measured as the last
 * thing standing between an instruction and its result, and the fix chosen was
 * to remove the question rather than to make it a good one.
 *
 * It is the wrong trade for a product that controls a computer. The cost of a
 * bad prompt is an annoyed user; the cost of no prompt is work the user cannot
 * get back. The imported permission layer resolves it properly: reading is
 * free, routine mutations follow the mode the user actually set, and the
 * irreversible and destructive cases ask however permissive that mode is.
 */

const call = (name: string, args: Record<string, unknown> = {}) => ({ name, arguments: args });

describe("what Cowork asks about", () => {
  it("never asks before looking", () => {
    for (const name of ["screen_observe", "window_list"]) {
      const tool = findTool(name);
      if (!tool) continue;
      expect(decide(call(name), tool, createPermissionContext("guarded")).outcome).toBe("allow");
    }
  });

  it("asks before changing this computer, in the guarded default", () => {
    for (const name of ["app_open", "type_text", "file_trash"]) {
      const tool = findTool(name);
      if (!tool?.mutating) continue;
      expect(decide(call(name), tool, createPermissionContext("guarded")).outcome).toBe("ask");
    }
  });

  it("stops asking about routine work once the user says so", () => {
    const tool = findTool("app_open");
    expect(tool).not.toBeNull();
    expect(
      decide(call("app_open", { name: "Notepad" }), tool, createPermissionContext("trusted"))
        .outcome,
    ).toBe("allow");
  });

  it("still asks before sending a message to another person, however trusting the mode", () => {
    const tool = findTool("message_send");
    expect(tool, "message_send is missing from the registry").not.toBeNull();
    for (const mode of ["guarded", "acceptEdits", "trusted"] as const) {
      expect(decide(call("message_send"), tool, createPermissionContext(mode)).outcome).toBe("ask");
    }
  });
});

describe("the tools that must never run unattended", () => {
  it.each(["file_trash", "message_send"])("%s stays banded high", (name) => {
    const tool = findTool(name);
    expect(tool, `${name} is missing from the registry`).not.toBeNull();
    expect(tool!.risk).toBe("high");
  });

  it("keeps every high-risk tool mutating, so it reaches the permission gate", () => {
    /*
     * The gate only runs for tools marked `mutating`. A tool that is high risk
     * but not mutating would skip it entirely — the combination is always a
     * mistake, so it is asserted rather than assumed.
     */
    const all = toolsFor(["os_app", "files", "web"] as Domain[]);
    const highButNotMutating = all.filter((t) => t.risk === "high" && !t.mutating);
    expect(highButNotMutating.map((t) => t.name)).toEqual([]);
  });
});
