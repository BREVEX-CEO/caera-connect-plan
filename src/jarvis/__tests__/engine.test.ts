import { describe, expect, it } from "vitest";
import type { NormalizedMessage, NormalizedToolCall } from "@/lib/intelligence/contract";
import {
  humanBoundary,
  loopRefusal,
  OUTCOME_UNKNOWN,
  pairToolHistory,
  PRUNE,
  PRUNE_MARKER,
  pruneOlderResults,
  pruneText,
  toolResultMessage,
  type TraceStep,
} from "../engine";

const call = (name: string, id = name): NormalizedToolCall => ({ id, name, arguments: {} });

describe("model-free result pruning (DeepSeek-derived)", () => {
  it("keeps short text untouched and long text as head, marker and tail", () => {
    expect(pruneText("short")).toBe("short");
    const long = "h".repeat(PRUNE.headChars) + "m".repeat(20_000) + "t".repeat(PRUNE.tailChars);
    const pruned = pruneText(long);
    expect(pruned).toBe("h".repeat(PRUNE.headChars) + PRUNE_MARKER + "t".repeat(PRUNE.tailChars));
    expect(pruned.length).toBeLessThanOrEqual(PRUNE.thresholdChars);
  });

  it("never splits a surrogate pair", () => {
    const pruned = pruneText("😀".repeat(PRUNE.thresholdChars + 10));
    expect(pruned.replace(PRUNE_MARKER, "")).toBe("😀".repeat(PRUNE.headChars + PRUNE.tailChars));
  });

  it("shrinks only older tool results and reports what it saved", () => {
    const big = "x".repeat(30_000);
    const messages: NormalizedMessage[] = [
      { role: "system", content: big },
      toolResultMessage(call("docs"), big),
      { role: "assistant", content: "" },
      toolResultMessage(call("research"), big),
    ];
    const removed = pruneOlderResults(messages, 3);
    expect(messages[0]!.content).toBe(big);
    expect(messages[1]!.content.length).toBeLessThanOrEqual(PRUNE.thresholdChars);
    expect(messages[1]!.toolResult).toEqual({ callId: "docs", name: "docs" });
    expect(messages[3]!.content.length).toBeGreaterThan(30_000);
    expect(removed).toBeGreaterThan(20_000);
  });
});

describe("one human-boundary rule for both planners", () => {
  it("names what only the person can do", () => {
    expect(humanBoundary({ status: "human_required", summary: "Sign in", result: null })).toBe(
      "Sign in",
    );
    expect(
      humanBoundary({
        status: "done",
        summary: "",
        result: { observation: { humanBoundary: "captcha" } },
      }),
    ).toMatch(/prove you are human/);
    expect(
      humanBoundary({
        status: "done",
        summary: "",
        result: { observation: { humanBoundary: "made-up" } },
      }),
    ).toBeNull();
    expect(humanBoundary({ status: "done", summary: "", result: null })).toBeNull();
  });
});

describe("tool history pairing (adapted from DeepSeek session repair)", () => {
  const ask = (...ids: string[]): NormalizedMessage => ({
    role: "assistant",
    content: "",
    toolCalls: ids.map((id) => call("computer", id)),
  });
  const answer = (id: string) => toolResultMessage(call("computer", id), { status: "done" });

  it("answers a call whose result was lost with an honest 'outcome unknown'", () => {
    const repaired = pairToolHistory([ask("a", "b"), answer("a"), { role: "user", content: "go" }]);
    expect(repaired.map((m) => m.toolResult?.callId ?? m.role)).toEqual([
      "assistant",
      "a",
      "b",
      "user",
    ]);
    expect(repaired[2]!.content).toContain(OUTCOME_UNKNOWN);
  });

  it("drops an answer whose call was cut away, and keeps paired history unchanged", () => {
    const paired = [ask("a"), answer("a")];
    expect(pairToolHistory([answer("x"), ...paired])).toEqual(paired);
    expect(pairToolHistory(paired)).toEqual(paired);
  });

  it("closes a trailing call left open by a crash", () => {
    const repaired = pairToolHistory([{ role: "user", content: "hi" }, ask("z")]);
    expect(repaired.at(-1)?.toolResult?.callId).toBe("z");
  });
});

describe("one loop rule for both planners, read from the task's trace (B01)", () => {
  const open = { action: "open", url: "https://a.example" };
  const click = (ref: string) => ({ action: "click", ref, observationId: "o1" });
  const done = (changed: string[]) => ({ status: "done", changed });

  it("refuses the same step after three tries, whatever order its keys came in", () => {
    const trace: TraceStep[] = [];
    for (let i = 0; i < 3; i += 1) {
      expect(loopRefusal(trace, "browser", open)).toBeNull();
      trace.push({ family: "browser", args: open, result: done(["x"]) });
    }
    expect(loopRefusal(trace, "browser", { url: open.url, action: "open" })).toMatch(
      /already ran 3 times/,
    );
    // Moving through a page is not a loop.
    const scroll = { action: "scroll", direction: "down" };
    const scrolled = Array.from({ length: 5 }, () => ({
      family: "browser" as const,
      args: scroll,
    }));
    expect(loopRefusal(scrolled, "browser", scroll)).toBeNull();
  });

  it("asks for a fresh look after four page actions that changed nothing", () => {
    const trace: TraceStep[] = ["e1", "e2", "e3", "e4"].map((ref) => ({
      family: "browser",
      args: click(ref),
      result: done([]),
    }));
    expect(loopRefusal(trace, "browser", click("e5"))).toMatch(/changed nothing/);
    expect(loopRefusal(trace, "browser", { action: "look" })).toBeNull();
    const looked: TraceStep[] = [...trace, { family: "browser", args: { action: "look" } }];
    expect(loopRefusal(looked, "browser", click("e5"))).toBeNull();
    // A sequence's last step counts as the call's result.
    const sequence: TraceStep[] = trace.map((step) => ({ ...step, result: { last: step.result } }));
    expect(loopRefusal(sequence, "browser", click("e5"))).toMatch(/changed nothing/);
  });
});
