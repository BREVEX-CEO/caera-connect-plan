import { describe, expect, it } from "vitest";
import type { NormalizedMessage, NormalizedToolCall } from "@/lib/intelligence/contract";
import {
  humanBoundary,
  PRUNE,
  PRUNE_MARKER,
  pruneOlderResults,
  pruneText,
  scheduleCalls,
  toolResultMessage,
} from "../engine";

const call = (name: string, id = name): NormalizedToolCall => ({ id, name, arguments: {} });
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("one reply's calls (DeepSeek-derived scheduler)", () => {
  it("runs read-only calls together and returns results in the model's order", async () => {
    const log: string[] = [];
    let running = 0;
    let most = 0;
    const calls = [call("research", "a"), call("docs", "b"), call("research", "c")];
    const results = await scheduleCalls(
      calls,
      async (c) => {
        running += 1;
        most = Math.max(most, running);
        log.push(`start ${c.id}`);
        await tick(c.id === "a" ? 30 : 5);
        running -= 1;
        return c.id;
      },
      { signal: new AbortController().signal, skipped: () => "skipped" },
    );
    expect(results).toEqual(["a", "b", "c"]);
    expect(most).toBe(3);
    expect(log.slice(0, 3)).toEqual(["start a", "start b", "start c"]);
  });

  it("never overlaps an effect with anything: device actions are barriers", async () => {
    const order: string[] = [];
    let running = 0;
    const calls = [call("research", "r1"), call("computer", "c1"), call("research", "r2")];
    await scheduleCalls(
      calls,
      async (c) => {
        running += 1;
        expect(running).toBe(1);
        order.push(c.id);
        await tick(2);
        running -= 1;
        return c.id;
      },
      { signal: new AbortController().signal, skipped: () => "skipped" },
    );
    expect(order).toEqual(["r1", "c1", "r2"]);
  });

  it("bounds the read pool", async () => {
    let running = 0;
    let most = 0;
    const calls = Array.from({ length: 7 }, (_, i) => call("research", `r${i}`));
    await scheduleCalls(
      calls,
      async () => {
        running += 1;
        most = Math.max(most, running);
        await tick(3);
        running -= 1;
        return 1;
      },
      { signal: new AbortController().signal, skipped: () => 0, parallel: 2 },
    );
    expect(most).toBe(2);
  });

  it("after STOP nothing new starts and every unstarted call is recorded as not run", async () => {
    const stop = new AbortController();
    const ran: string[] = [];
    const results = await scheduleCalls(
      [call("computer", "c1"), call("computer", "c2"), call("finish_task", "f")],
      async (c) => {
        ran.push(c.id);
        stop.abort();
        return c.id;
      },
      { signal: stop.signal, skipped: (c) => `not run ${c.id}` },
    );
    expect(ran).toEqual(["c1"]);
    expect(results).toEqual(["c1", "not run c2", "not run f"]);
  });

  it("a failing call lets started calls settle, starts nothing more and rethrows", async () => {
    const settled: string[] = [];
    const ran: string[] = [];
    await expect(
      scheduleCalls(
        [call("research", "slow"), call("research", "bad"), call("computer", "later")],
        async (c) => {
          ran.push(c.id);
          if (c.id === "bad") throw new Error("boom");
          await tick(10);
          settled.push(c.id);
          return c.id;
        },
        { signal: new AbortController().signal, skipped: () => "skipped" },
      ),
    ).rejects.toThrow("boom");
    expect(settled).toEqual(["slow"]);
    expect(ran).not.toContain("later");
  });
});

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
