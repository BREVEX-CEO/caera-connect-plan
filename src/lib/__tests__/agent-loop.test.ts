import { describe, expect, it, vi } from "vitest";
import { classify, classifyDeterministic, parseClassification, DOMAINS } from "@/lib/agent/domains";
import {
  MAX_TOOLS_PER_TURN,
  schemasFor,
  toolsFor,
  findTool,
  allToolNames,
} from "@/lib/agent/tool-registry";
import {
  Revision,
  runAgentTask,
  describe as describeOutcome,
  type ToolCall,
} from "@/lib/agent/loop";
import { isRetryable, isTerminal, signatureOf, type ToolOutcome } from "@/lib/agent/outcomes";
import { readToolCall } from "@/lib/ocade-local";

const noTools = { complete: async () => null };

describe("stage 1 — the router classifies before any schema is loaded", () => {
  it("resolves the unambiguous cases without the model at all", async () => {
    const spy = vi.fn(async () => '{"domains":["conversation"]}');
    const result = await classify("OCADE, what is on my screen?", { complete: spy });
    expect(result.basis).toBe("deterministic");
    expect(result.domains).toContain("os_app");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null rather than guessing when a request is genuinely ambiguous", () => {
    expect(classifyDeterministic("what do you think about this?")).toBeNull();
  });

  it("reads JSON out of a chatty reply, including a leaked think block", () => {
    expect(
      parseClassification('<think>hmm</think> Sure! ```json\n{"domains":["files","web"]}\n```'),
    ).toEqual(["files", "web"]);
  });

  it("drops invented domain names instead of passing them on", () => {
    expect(parseClassification('{"domains":["files","teleportation"]}')).toEqual(["files"]);
  });

  it("degrades to plain conversation, never to every tool", async () => {
    const result = await classify("something ambiguous entirely", {
      complete: async () => "I am not sure what you mean",
    });
    expect(result.domains).toEqual(["conversation"]);
    expect(result.basis).toBe("fallback");
  });

  it("survives a classifier that throws", async () => {
    const result = await classify("do a thing", {
      complete: async () => {
        throw new Error("engine down");
      },
    });
    expect(result.domains).toEqual(["conversation"]);
  });
});

describe("stage 2 — only the chosen domains' tools are exposed", () => {
  it("shows OS tools and withholds everything else for an OS request", () => {
    // The request matters now: the catalogue is ranked against it and capped,
    // because sixty schemas took the shipped model past its deadline. Domain
    // separation is the property being asserted, and it is unchanged.
    const names = schemasFor(["os_app"], "activate the save control in this window").map(
      (t) => t.function.name,
    );
    expect(names).toContain("control_activate");
    expect(names).not.toContain("file_trash");
    expect(names).not.toContain("browser_navigate");
    expect(names).not.toContain("web_search");
  });

  it("never offers more tools in one turn than the model can read in time", () => {
    /*
     * MEASURED, AND THE REASON THE CAP EXISTS. On this machine with qwen2.5:3b:
     * 6 tools 15.7 s, 14 tools 21.5 s, 28 tools 48.1 s, and the full `os_app`
     * set of sixty ran past the 60 s deadline -- so "type a poem in notepad"
     * failed with "the engine sent nothing back in 60s". The engine was fine;
     * the prompt was unanswerable in the time allowed.
     */
    for (const request of ["type a poem in notepad", "message someone", ""]) {
      const offered = schemasFor(["os_app", "files", "web"], request);
      expect(offered.length, request).toBeLessThanOrEqual(MAX_TOOLS_PER_TURN);
    }
  });

  it("always offers a way to look at the screen, whatever was asked", () => {
    // Ranking on word overlap alone would drop these on a request that shares
    // no vocabulary with them, leaving a turn that can only guess.
    const names = schemasFor(["os_app"], "make it bigger").map((t) => t.function.name);
    expect(names).toContain("screen_map");
    expect(names).toContain("screen_do");
  });

  it("loads strictly fewer tools than the whole catalogue", () => {
    expect(toolsFor(["os_app"]).length).toBeLessThan(allToolNames().length);
  });

  it("adds a second domain's tools when a task widens", () => {
    const os = schemasFor(["os_app"], "activate a control").map((t) => t.function.name);
    const both = schemasFor(["os_app", "web"], "browse to a page and navigate").map(
      (t) => t.function.name,
    );
    expect(os).not.toContain("browser_navigate");
    expect(both).toContain("browser_navigate");
  });

  it("exposes no tool granting a shell, a raw path or pointer coordinates", () => {
    for (const name of allToolNames()) {
      expect(name).not.toMatch(/shell|exec|powershell|command|eval|adb|sudo|script/i);
      const tool = findTool(name)!;
      const params = Object.keys(tool.parameters.properties);
      // A tool taking bare x/y would let the model click blind as a first move.
      expect(params).not.toContain("x");
      expect(params).not.toContain("y");
    }
  });

  it("marks every file and control mutation as needing permission", () => {
    for (const name of ["file_trash", "control_activate", "control_set_text", "browser_click"]) {
      expect(findTool(name)?.mutating).toBe(true);
    }
    for (const name of ["screen_observe", "window_list", "browser_read", "system_status"]) {
      expect(findTool(name)?.mutating).toBe(false);
    }
  });

  it("covers every declared domain", () => {
    for (const domain of DOMAINS) expect(() => toolsFor([domain])).not.toThrow();
  });
});

describe("tool calls are read defensively", () => {
  it("accepts an object argument set", () => {
    expect(readToolCall({ function: { name: "window_list", arguments: { a: 1 } } })).toEqual({
      name: "window_list",
      arguments: { a: 1 },
    });
  });

  it("accepts a JSON string argument set", () => {
    expect(readToolCall({ function: { name: "x", arguments: '{"b":2}' } })?.arguments).toEqual({
      b: 2,
    });
  });

  it("drops a malformed call rather than defaulting it to empty arguments", () => {
    // `{}` on a file action is not a harmless default.
    expect(readToolCall({ function: { name: "file_trash", arguments: "{not json" } })).toBeNull();
    expect(readToolCall({ function: { arguments: {} } })).toBeNull();
  });
});

/* ------------------------------------------------------------- loop -- */

function harness(turns: { text: string; toolCalls: ToolCall[] }[], outcomes: ToolOutcome[]) {
  let turnIndex = 0;
  let outcomeIndex = 0;
  const executed: ToolCall[] = [];
  return {
    executed,
    deps: {
      complete: async () => '{"domains":["os_app"]}',
      turn: async () => turns[Math.min(turnIndex++, turns.length - 1)],
      execute: async (call: ToolCall) => {
        executed.push(call);
        return outcomes[Math.min(outcomeIndex++, outcomes.length - 1)];
      },
      permit: async () => true,
    },
  };
}

describe("the loop refuses to claim more than it verified", () => {
  it("reports success only when the mutating step was confirmed", async () => {
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "control_activate", arguments: { name: "Continue" } }] },
        { text: "I pressed Continue and the window changed.", toolCalls: [] },
      ],
      [{ kind: "success", detail: "Activated.", verified: true }],
    );
    const result = await runAgentTask(deps, { request: "click Continue" });
    expect(result.reason).toBe("verified");
    expect(result.allVerified).toBe(true);
  });

  it("says so when the action ran but nothing on screen changed", async () => {
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "control_activate", arguments: { name: "Continue" } }] },
        { text: "Done!", toolCalls: [] },
      ],
      [{ kind: "success", detail: "Activated.", verified: false }],
    );
    const result = await runAgentTask(deps, { request: "click Continue" });
    expect(result.allVerified).toBe(false);
    expect(result.text).toMatch(/could not be confirmed/i);
  });

  it("tells the model plainly when a change was not observed", () => {
    expect(describeOutcome({ kind: "success", detail: "ok", verified: false })).toMatch(
      /Do not report this as done/,
    );
  });

  it("does not report a task as verified when every step failed", async () => {
    /*
     * Caught by running the loop against the real machine, not by reading it.
     * All three live tasks used read-only tools, all three tools failed, and
     * the result still came back `stop=verified allVerified=true` — because
     * the check only looked at mutating steps and there were none. The model's
     * own answer said the tool had failed, so the structured result was
     * contradicting the text next to it.
     */
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] },
        { text: "I could not read the screen.", toolCalls: [] },
      ],
      [{ kind: "retryable_failure", detail: "The control host could not start." }],
    );
    const result = await runAgentTask(deps, { request: "what is on my screen" });
    expect(result.allVerified).toBe(false);
    expect(result.reason).not.toBe("verified");
    expect(result.text).toMatch(/did not succeed/i);
  });

  it("still reports verified when read-only steps all succeeded", async () => {
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] },
        { text: "You have Chrome open.", toolCalls: [] },
      ],
      [{ kind: "success", detail: "Read the screen.", data: {} }],
    );
    const result = await runAgentTask(deps, { request: "what is on my screen" });
    expect(result.allVerified).toBe(true);
    expect(result.reason).toBe("verified");
  });
});

describe("the loop stops instead of grinding", () => {
  it("ends when the same call fails the same way twice", async () => {
    const { deps, executed } = harness(
      [{ text: "", toolCalls: [{ name: "control_activate", arguments: { name: "Nope" } }] }],
      [{ kind: "state_changed", detail: "That control is not there." }],
    );
    const result = await runAgentTask(deps, { request: "click Nope" });
    expect(result.reason).toBe("repeating");
    // Two attempts of the same signature, not twelve steps of it.
    expect(executed.length).toBeLessThanOrEqual(3);
  });

  it("stops immediately when the user refuses permission", async () => {
    const { deps, executed } = harness(
      [{ text: "", toolCalls: [{ name: "file_trash", arguments: { folder: "x", path: "y" } }] }],
      [{ kind: "success", detail: "gone" }],
    );
    const result = await runAgentTask(
      { ...deps, permit: async () => false },
      { request: "delete it" },
    );
    expect(result.reason).toBe("blocked");
    expect(executed).toHaveLength(0);
  });

  it("never asks permission to look", async () => {
    const permit = vi.fn(async () => true);
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] },
        { text: "I can see the desktop.", toolCalls: [] },
      ],
      [{ kind: "success", detail: "read", data: {} }],
    );
    await runAgentTask({ ...deps, permit }, { request: "what is on my screen" });
    expect(permit).not.toHaveBeenCalled();
  });

  it("hands an invented tool name back to the model instead of throwing", async () => {
    const { deps } = harness(
      [
        { text: "", toolCalls: [{ name: "make_coffee", arguments: {} }] },
        { text: "I cannot do that.", toolCalls: [] },
      ],
      [{ kind: "success", detail: "unused" }],
    );
    const result = await runAgentTask(deps, { request: "coffee" });
    expect(result.steps[0].outcome.kind).toBe("unsupported");
  });

  it("stops when the task is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const { deps } = harness([{ text: "", toolCalls: [] }], []);
    const result = await runAgentTask(deps, { request: "anything", signal: controller.signal });
    expect(result.reason).toBe("cancelled");
  });
});

describe("changing your mind mid-task", () => {
  it("injects the revision and keeps the completed work", async () => {
    const revision = new Revision();
    revision.submit("actually put it on Facebook");
    const seen: string[] = [];
    const result = await runAgentTask(
      {
        complete: async () => '{"domains":["os_app"]}',
        turn: async (messages) => {
          seen.push(...messages.filter((m) => m.role === "user").map((m) => m.content));
          return { text: "Understood, switching.", toolCalls: [] };
        },
        execute: async () => ({ kind: "success", detail: "" }) as ToolOutcome,
        permit: async () => true,
      },
      { request: "upload this to Instagram", revision },
    );
    expect(seen.join(" ")).toMatch(/Change of plan/);
    expect(seen.join(" ")).toMatch(/Do not repeat steps you have already finished/);
    expect(result.reason).toBe("answered");
  });

  it("hands a revision over exactly once", () => {
    const revision = new Revision();
    revision.submit("x");
    expect(revision.take()).toBe("x");
    expect(revision.take()).toBeNull();
  });
});

describe("the outcome taxonomy drives retry policy", () => {
  it("retries only what could plausibly differ", () => {
    expect(isRetryable("retryable_failure")).toBe(true);
    expect(isRetryable("offline")).toBe(true);
    expect(isRetryable("blocked")).toBe(false);
    // A stale view is re-observed, never blindly repeated.
    expect(isRetryable("state_changed")).toBe(false);
  });

  it("treats refusals as terminal", () => {
    expect(isTerminal("permission_required")).toBe(true);
    expect(isTerminal("unsupported")).toBe(true);
    expect(isTerminal("retryable_failure")).toBe(false);
  });

  it("makes a repeated failure recognisable regardless of key order", () => {
    expect(signatureOf("t", { a: 1, b: 2 }, "blocked")).toBe(
      signatureOf("t", { b: 2, a: 1 }, "blocked"),
    );
  });
});
