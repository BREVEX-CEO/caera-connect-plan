import { describe, it, expect } from "vitest";
import {
  MAX_STEPS,
  looksMultiStep,
  parsePlan,
  planPrompt,
  runPlannedTask,
  summarise,
} from "@/lib/agent/planner";
import type { ToolOutcome } from "@/lib/agent/outcomes";
import { Revision, type AgentResult } from "@/lib/agent/loop";

/**
 * The planner's claim is not "it can run several tools" — the flat loop already
 * could. It is that a goal with distinct phases stays FAST and stays COHERENT,
 * because each phase runs in a context that is thrown away afterwards.
 *
 * So these test the two things that claim rests on: that decomposition is
 * conservative enough not to fire on ordinary requests, and that a step's
 * verbose internals never reach the next step.
 */

const outcome = (detail: string): ToolOutcome => ({ kind: "success", detail, verified: true });

describe("only a goal with real phases gets decomposed", () => {
  it("leaves an ordinary instruction alone", () => {
    // Planning "open notepad" costs a round trip to be told it is one step.
    for (const said of [
      "open notepad",
      "what is on my screen",
      "type an essay about cars in wordpad",
      "search for quantum computing",
    ]) {
      expect(looksMultiStep(said), said).toBe(false);
    }
  });

  it("recognises a goal that names several things to do", () => {
    for (const said of [
      "research quantum computing, summarise it and whatsapp it to H",
      "find the latest news about AI and then write it into a file",
      "look up the weather and send it to H",
    ]) {
      expect(looksMultiStep(said), said).toBe(true);
    }
  });

  it("names the domain vocabulary in the prompt", () => {
    // A step whose domains are invented loads no tools and silently becomes a
    // conversation, so the model is given the actual words.
    const prompt = planPrompt("do a thing and then another thing");
    expect(prompt).toContain("os_app");
    expect(prompt).toContain("files");
    expect(prompt).toContain("web");
    expect(prompt).toContain("do a thing and then another thing");
  });
});

describe("a plan is read without trusting the model's formatting", () => {
  it("reads a clean plan", () => {
    const plan = parsePlan(
      '{"steps":[{"do":"search the web","needs":["web"]},{"do":"type it","needs":["os_app"]}]}',
    );
    expect(plan).toEqual([
      { instruction: "search the web", domains: ["web"] },
      { instruction: "type it", domains: ["os_app"] },
    ]);
  });

  it("survives prose, code fences and thinking blocks", () => {
    const messy =
      "<think>the user wants two things</think>\nSure! Here is the plan:\n```json\n" +
      '{"steps":[{"do":"look it up","needs":["web"]},{"do":"write it down","needs":["files"]}]}\n```';
    expect(parsePlan(messy)).toHaveLength(2);
  });

  it("gives a step with no usable domains the computer rather than nothing", () => {
    // An empty domain list loads zero tools, which turns an action into a
    // description of an action.
    const plan = parsePlan(
      '{"steps":[{"do":"click send","needs":["nonsense"]},{"do":"x","needs":[]}]}',
    );
    expect(plan?.[0].domains).toEqual(["os_app"]);
    expect(plan?.[1].domains).toEqual(["os_app"]);
  });

  it("refuses junk rather than returning half a plan", () => {
    // Half a plan executed is worse than none: the goal ends up half done and
    // gets reported as finished.
    expect(parsePlan("I'd be happy to help with that!")).toBeNull();
    expect(parsePlan('{"steps":[]}')).toBeNull();
    expect(parsePlan("{not json")).toBeNull();
  });

  it("caps the plan length", () => {
    const many = Array.from({ length: 20 }, (_, i) => `{"do":"step ${i}","needs":["os_app"]}`).join(
      ",",
    );
    expect(parsePlan(`{"steps":[${many}]}`)!.length).toBe(MAX_STEPS);
  });
});

describe("a step's verbose internals never reach the next step", () => {
  it("trims a long closing sentence to something a planner can hold", () => {
    const long = {
      text: `${"This step did a thing. ".repeat(40)}`,
      steps: [],
    } as unknown as AgentResult;
    expect(summarise(long).length).toBeLessThanOrEqual(241);
  });

  it("falls back to the last tool's detail when a step said nothing", () => {
    const quiet = {
      text: "",
      steps: [{ call: { name: "screen_act", arguments: {} }, outcome: outcome("Clicked Send.") }],
    } as unknown as AgentResult;
    expect(summarise(quiet)).toContain("Clicked Send.");
  });

  it("carries only summaries forward, never the tool traffic", async () => {
    /*
     * THE ISOLATION TEST, AND THE WHOLE POINT OF THE FILE.
     *
     * The first step's sub-agent emits an enormous perception payload — the
     * kind `screen_find` really returns. If any of that reaches the second
     * step's request, the context saving is imaginary and a six-step goal
     * degrades exactly as it did before.
     */
    const BOUNDING_BOX_NOISE = `{"targets":[${Array.from(
      { length: 40 },
      (_, i) =>
        `{"label":"row ${i}","bounds":{"x":${i * 13},"y":${i * 7},"width":220,"height":34},"confidence":0.82}`,
    ).join(",")}]}`;

    const seenRequests: string[] = [];
    let turn = 0;

    const deps = {
      complete: async () =>
        '{"steps":[{"do":"find the chat","needs":["os_app"]},{"do":"type the message","needs":["os_app"]}]}',
      turn: async (messages: { role: string; content: string }[]) => {
        const user = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        seenRequests.push(user);
        turn += 1;
        return turn === 1
          ? { text: `Found it. ${BOUNDING_BOX_NOISE}`, toolCalls: [] }
          : { text: "Typed the message.", toolCalls: [] };
      },
      execute: async () => outcome("ok"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, { goal: "find the chat and then type the message" });

    expect(result.planned).toBe(true);
    expect(result.steps).toHaveLength(2);

    // The second step saw the first step's SUMMARY...
    expect(seenRequests[1]).toContain("Already done in this task");
    // ...and none of its bounding boxes.
    expect(seenRequests[1]).not.toContain('"bounds"');
    expect(seenRequests[1]).not.toContain("row 39");
    expect(seenRequests[1].length).toBeLessThan(BOUNDING_BOX_NOISE.length);
  });

  it("carries a failure forward as plainly as a success", async () => {
    // A later step that depends on a failed one must be able to say so rather
    // than quietly acting on nothing.
    const seen: string[] = [];
    let turn = 0;
    const deps = {
      complete: async () =>
        '{"steps":[{"do":"open the chat","needs":["os_app"]},{"do":"send it","needs":["os_app"]}]}',
      turn: async (messages: { role: string; content: string }[]) => {
        seen.push(
          messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n"),
        );
        turn += 1;
        if (turn === 1) throw new Error("no conversation called that appeared");
        return { text: "Reported the problem.", toolCalls: [] };
      },
      execute: async () => outcome("ok"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, { goal: "open the chat and then send it" });
    expect(result.ok).toBe(false);
    expect(result.steps[0].ok).toBe(false);
    expect(seen[1]).toMatch(/did not work|failed/i);
  });

  it("runs a single-step goal through the ordinary loop untouched", async () => {
    // The fast path must stay exactly as fast as it was.
    let planned = false;
    const deps = {
      complete: async () => {
        planned = true;
        return '{"steps":[{"do":"x","needs":["os_app"]}]}';
      },
      turn: async () => ({ text: "Opened Notepad.", toolCalls: [] }),
      execute: async () => outcome("ok"),
      permit: async () => true,
    };
    const result = await runPlannedTask(deps, { goal: "open notepad" });
    expect(planned).toBe(false);
    expect(result.planned).toBe(false);
    expect(result.text).toBe("Opened Notepad.");
  });
});

/**
 * A PLAN THAT STOPPED AND A PLAN THAT FAILED ARE NOT THE SAME ENDING.
 *
 * Both leave the plan incomplete, and reading incompleteness alone was all the
 * caller could do — so the two were reported identically: a failure. On the
 * mission surface that meant a red panel for pressing Stop, and, because only
 * a cancelled run escapes delivery, being charged for it.
 */
describe("a stop is reported as a stop", () => {
  const twoSteps =
    '{"steps":[{"do":"open the chat","needs":["os_app"]},{"do":"send it","needs":["os_app"]}]}';

  it("ends a plan the user interrupted as cancelled, not as a failure", async () => {
    const control = new AbortController();
    const reached: string[] = [];
    const deps = {
      complete: async () => twoSteps,
      turn: async (messages: { role: string; content: string }[]) => {
        reached.push(
          messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n"),
        );
        // Stop pressed while the first step is talking.
        control.abort();
        return { text: "Opened it.", toolCalls: [] };
      },
      execute: async () => outcome("ok"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, {
      goal: "open the chat and then send it",
      signal: control.signal,
    });

    expect(result.reason).toBe("cancelled");
    // Still incomplete — the stop does not pretend the work finished.
    expect(result.ok).toBe(false);
    // And the second step never started.
    expect(reached).toHaveLength(1);
  });

  it("still ends a plan that genuinely failed as a failure", async () => {
    let turn = 0;
    const deps = {
      complete: async () => twoSteps,
      turn: async () => {
        turn += 1;
        if (turn === 1) throw new Error("no conversation called that appeared");
        return { text: "Reported the problem.", toolCalls: [] };
      },
      execute: async () => outcome("ok"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, { goal: "open the chat and then send it" });

    expect(result.ok).toBe(false);
    expect(result.reason).not.toBe("cancelled");
  });

  it("does not call a step that verified its work a failure", async () => {
    /*
     * The loop's endings are `answered` for a run that used no tools and
     * `verified` for one that used them and could stand behind them — so
     * reading success as `answered` alone marked every step that touched
     * anything as failed, carried "did not work" forward into the next step's
     * context, and reported a completed plan as a failed run.
     */
    let turn = 0;
    const deps = {
      complete: async () => twoSteps,
      turn: async (messages: { role: string; content: string }[]) => {
        turn += 1;
        // Each step observes once, then reports.
        if (turn === 1 || turn === 3) {
          return { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] };
        }
        seen.push(
          messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n"),
        );
        return { text: turn === 2 ? "Opened it." : "Sent it.", toolCalls: [] };
      },
      execute: async () => outcome("the chat window is open"),
      permit: async () => true,
    };
    const seen: string[] = [];

    const result = await runPlannedTask(deps, { goal: "open the chat and then send it" });

    expect(result.steps.map((step) => step.reason)).toEqual(["verified", "verified"]);
    expect(result.steps.every((step) => step.ok)).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("verified");
    // And the second step was told what the first one did, not that it failed.
    expect(seen[1]).toContain("Already done in this task");
    expect(seen[1]).not.toMatch(/did not work/i);
  });

  it("counts every tool call across the plan, so the receipt can say how much was done", async () => {
    let turn = 0;
    const deps = {
      complete: async () => twoSteps,
      turn: async () => {
        turn += 1;
        if (turn === 1) {
          return { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] };
        }
        return { text: turn === 2 ? "Opened it." : "Sent it.", toolCalls: [] };
      },
      execute: async () => outcome("the chat window is open"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, { goal: "open the chat and then send it" });

    expect(result.ok).toBe(true);
    // One call in the first step, none in the second — and the total is the
    // sum, not the length of a step list the sub-agents already threw away.
    expect(result.steps.map((step) => step.toolCalls)).toEqual([1, 0]);
    expect(result.toolCalls).toBe(1);
  });
});

/**
 * THE COMPOSER STAYS LIVE DURING A PLAN.
 *
 * Typing a new sentence mid-task is a change of plan, not a line of text: the
 * work already done is kept and only what happens next changes. During a
 * PLANNED task it was neither — the handle was passed to the flat loop and
 * never to the planner, so the timeline recorded "New instruction" and nothing
 * read it. That is the definition of a fake control.
 */
describe("a change of plan reaches a planned task", () => {
  it("hands the correction to the running step and to the steps after it", async () => {
    const revision = new Revision();
    const seen: string[] = [];
    let turn = 0;
    const deps = {
      complete: async () =>
        '{"steps":[{"do":"open the chat","needs":["os_app"]},{"do":"send it","needs":["os_app"]}]}',
      turn: async (messages: { role: string; content: string }[]) => {
        turn += 1;
        seen.push(
          messages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join("\n"),
        );
        // The user types it while the first step is talking.
        if (turn === 1) {
          revision.submit("actually send it to Sam");
          return { text: "", toolCalls: [{ name: "screen_observe", arguments: {} }] };
        }
        return { text: turn === 2 ? "Opened it." : "Sent it to Sam.", toolCalls: [] };
      },
      execute: async () => outcome("the chat window is open"),
      permit: async () => true,
    };

    const result = await runPlannedTask(deps, {
      goal: "open the chat and then send it",
      revision,
    });

    // The step that was running was told, by the loop, in its own words.
    expect(
      seen.some((text) => /Change of plan, starting now: actually send it to Sam/.test(text)),
    ).toBe(true);
    // And the step after it was told too, rather than carrying on with an
    // instruction the user has already withdrawn.
    const laterStep = seen.at(-1) ?? "";
    expect(laterStep).toContain("The user changed the plan");
    expect(laterStep).toContain("actually send it to Sam");
    expect(result.ok).toBe(true);
  });
});
