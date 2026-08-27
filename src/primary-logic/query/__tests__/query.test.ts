import { describe, expect, it, vi } from "vitest";
import {
  estimateTranscriptTokens,
  isPromptTooLong,
  runQuery,
  type QueryEvent,
} from "../query";
import type { QueryDeps, QueryTurn } from "../deps";
import { checkTokenBudget, createBudgetTracker } from "../tokenBudget";
import { parseTokenBudget } from "../budgetText";

/**
 * The query loop's recovery paths, each driven through the injected deps.
 *
 * This is what the donor built `QueryDeps` for: every path below runs with no
 * network, no engine and no tab, because the loop asks `deps` for everything it
 * cannot do itself. A loop that could only be tested against a real model is a
 * loop whose recovery paths are never tested, since the failures they answer
 * are the ones that are hard to provoke on purpose.
 */

const turn = (patch: Partial<QueryTurn> = {}): QueryTurn => ({
  text: "",
  toolCalls: [],
  stopReason: "end_turn",
  ...patch,
});

function deps(patch: Partial<QueryDeps> = {}): QueryDeps {
  return {
    callModel: vi.fn(async () => turn({ text: "done" })),
    runTools: vi.fn(async () => []),
    compact: vi.fn(async () => null),
    countTokens: estimateTranscriptTokens,
    uuid: () => "id",
    ...patch,
  };
}

const params = (patch: Partial<Parameters<typeof runQuery>[0]> = {}) => ({
  messages: [{ role: "user" as const, content: "hello" }],
  systemPrompt: "be useful",
  tools: [],
  deps: deps(),
  ...patch,
});

describe("an ordinary turn", () => {
  it("completes and returns what the model said", async () => {
    const result = await runQuery(params());
    expect(result.terminal.reason).toBe("completed");
    expect(result.text).toBe("done");
    expect(result.turns).toBe(1);
  });

  it("never imports a model client — everything comes through deps", async () => {
    const callModel = vi.fn(async () => turn({ text: "hi" }));
    await runQuery(params({ deps: deps({ callModel }) }));
    expect(callModel).toHaveBeenCalledOnce();
  });
});

describe("tool rounds", () => {
  it("runs the calls, feeds results back, and finishes", async () => {
    const calls = [{ id: "1", name: "look", arguments: {} }];
    let asked = 0;
    const callModel = vi.fn(async () => {
      asked += 1;
      return asked === 1 ? turn({ toolCalls: calls, stopReason: "tool_use" }) : turn({ text: "saw it" });
    });
    const runTools = vi.fn(async () => [
      { id: "1", name: "look", content: "a window", isError: false },
    ]);
    const result = await runQuery(params({ deps: deps({ callModel, runTools }) }));
    expect(runTools).toHaveBeenCalledOnce();
    expect(result.terminal.reason).toBe("completed");
    expect(result.toolResults).toHaveLength(1);
    expect(result.messages.some((m) => String(m.content).includes("a window"))).toBe(true);
  });

  it("stops after a bounded number of rounds rather than looping forever", async () => {
    /*
     * The measured shape of a stuck run: a model repeating one failing call. It
     * never converges, and without the bound the tab dies rather than the loop.
     */
    const callModel = vi.fn(async () =>
      turn({ toolCalls: [{ id: "x", name: "retry", arguments: {} }], stopReason: "tool_use" }),
    );
    const runTools = vi.fn(async () => [
      { id: "x", name: "retry", content: "failed again", isError: true },
    ]);
    const result = await runQuery(params({ deps: deps({ callModel, runTools }), maxTurns: 4 }));
    expect(result.terminal.reason).toBe("max_turns");
    expect(runTools.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("does not run tools once the person has aborted", async () => {
    const controller = new AbortController();
    const callModel = vi.fn(async () => {
      controller.abort();
      return turn({ toolCalls: [{ id: "1", name: "act", arguments: {} }], stopReason: "tool_use" });
    });
    const runTools = vi.fn(async () => []);
    const result = await runQuery(
      params({ deps: deps({ callModel, runTools }), signal: controller.signal }),
    );
    expect(result.terminal.reason).toBe("aborted_tools");
    expect(runTools).not.toHaveBeenCalled();
  });
});

describe("a truncated answer is not a finished answer", () => {
  it("asks the model to continue when it hit its output ceiling", async () => {
    let asked = 0;
    const callModel = vi.fn(async () => {
      asked += 1;
      return asked === 1
        ? turn({ text: "half a sen", stopReason: "max_tokens" })
        : turn({ text: "tence.", stopReason: "end_turn" });
    });
    const events: QueryEvent[] = [];
    const result = await runQuery(params({ deps: deps({ callModel }) }), (e) => events.push(e));
    expect(result.terminal.reason).toBe("completed");
    expect(result.text).toBe("half a sentence.");
    expect(events).toContainEqual({
      kind: "transition",
      transition: { reason: "max_output_tokens_recovery" },
    });
  });

  it("stops recovering rather than chasing a model that keeps truncating", async () => {
    const callModel = vi.fn(async () => turn({ text: "and", stopReason: "max_tokens" }));
    const result = await runQuery(params({ deps: deps({ callModel }) }));
    expect(result.terminal.reason).toBe("completed");
    expect(callModel.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe("a transcript that no longer fits", () => {
  it("compacts proactively once past the threshold", async () => {
    const compact = vi.fn(async () => [{ role: "user" as const, content: "summary" }]);
    const events: QueryEvent[] = [];
    await runQuery(
      params({
        messages: [{ role: "user", content: "x".repeat(80_000) }],
        deps: deps({ compact }),
        compactThreshold: 1_000,
      }),
      (e) => events.push(e),
    );
    expect(compact).toHaveBeenCalled();
    expect(events.some((e) => e.kind === "compacted")).toBe(true);
  });

  it("compacts and retries once when the engine refuses the prompt for length", async () => {
    let asked = 0;
    const callModel = vi.fn(async () => {
      asked += 1;
      if (asked === 1) throw new Error("Prompt exceeds the model's context window");
      return turn({ text: "recovered" });
    });
    const compact = vi.fn(async () => [{ role: "user" as const, content: "summary" }]);
    const result = await runQuery(params({ deps: deps({ callModel, compact }) }));
    expect(result.terminal.reason).toBe("completed");
    expect(result.text).toBe("recovered");
  });

  it("reports honestly when compaction cannot rescue it", async () => {
    const callModel = vi.fn(async () => {
      throw new Error("Prompt exceeds the model's context window");
    });
    const result = await runQuery(params({ deps: deps({ callModel }) }));
    expect(result.terminal.reason).toBe("prompt_too_long");
  });

  it("does not mistake an ordinary engine failure for an over-long prompt", async () => {
    const callModel = vi.fn(async () => {
      throw new Error("WebGPU adapter was lost");
    });
    const result = await runQuery(params({ deps: deps({ callModel }) }));
    expect(result.terminal.reason).toBe("model_error");
  });
});

describe("the token budget", () => {
  it("nudges the model back to work while the returns hold up", async () => {
    let asked = 0;
    const callModel = vi.fn(async () => {
      asked += 1;
      return turn({ text: "chunk ".repeat(2_000), usage: { input_tokens: 0, output_tokens: 4_000 } });
    });
    const events: QueryEvent[] = [];
    const result = await runQuery(
      params({ deps: deps({ callModel }), tokenBudget: 40_000 }),
      (e) => events.push(e),
    );
    expect(
      events.some(
        (e) => e.kind === "transition" && e.transition.reason === "token_budget_continuation",
      ),
    ).toBe(true);
    expect(result.terminal.reason).toBeDefined();
    expect(asked).toBeGreaterThan(1);
  });

  it("does not nudge at all when nobody asked for a budget", async () => {
    const events: QueryEvent[] = [];
    await runQuery(params(), (e) => events.push(e));
    expect(
      events.some(
        (e) => e.kind === "transition" && e.transition.reason === "token_budget_continuation",
      ),
    ).toBe(false);
  });

  it("stops nudging when two rounds in a row produce almost nothing", () => {
    // Straight from the donor's tracker: this is what keeps a budget from being
    // an infinite "keep going".
    const tracker = createBudgetTracker();
    tracker.continuationCount = 3;
    tracker.lastDeltaTokens = 10;
    tracker.lastGlobalTurnTokens = 1_000;
    const decision = checkTokenBudget(tracker, undefined, 500_000, 1_050);
    expect(decision.action).toBe("stop");
  });

  it("reads a budget out of the way a person actually writes one", () => {
    expect(parseTokenBudget("refactor the router +500k")).toBe(500_000);
    expect(parseTokenBudget("+2m go")).toBe(2_000_000);
    expect(parseTokenBudget("use 100k tokens on this")).toBe(100_000);
    expect(parseTokenBudget("what is 500k in binary")).toBeNull();
  });
});

describe("stopping", () => {
  it("honours the stop gate before calling the model at all", async () => {
    const callModel = vi.fn(async () => turn());
    const result = await runQuery(
      params({ deps: deps({ callModel, shouldStop: () => "You pressed stop." }) }),
    );
    expect(result.terminal.reason).toBe("stop_hook_prevented");
    expect(result.terminal.error).toBe("You pressed stop.");
    expect(callModel).not.toHaveBeenCalled();
  });

  it("treats an aborted signal as a stop, not a failure", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runQuery(params({ signal: controller.signal }));
    expect(result.terminal.reason).toBe("aborted_streaming");
  });
});

describe("prompt-length detection", () => {
  it.each([
    "context window exceeded",
    "Token limit reached",
    "The prompt is too large",
    "kv cache full",
  ])("recognises %s", (message) => {
    expect(isPromptTooLong(new Error(message))).toBe(true);
  });

  it("does not fire on an unrelated failure", () => {
    expect(isPromptTooLong(new Error("network unreachable"))).toBe(false);
  });
});
