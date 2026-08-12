/**
 * A task with two steps in it has to do both.
 *
 * ONE INSTRUCTION, FOUR SEPARATE BUGS, ALL WITH THE SAME SYMPTOM.
 *
 * "Check how much memory this computer is using, then save that number into a
 * file called memory-check.txt" did the first half and stopped, reporting
 * success. It was blamed on qwen3:4b being slow, then on qwen2.5:3b giving up
 * early — a model was swapped over it. The model was never the problem, and
 * for most of that time was never even reached.
 *
 *   1. THE ROUTER claimed it. "how much memory" is a substring, the
 *      system-status rule matched, one tool ran and the mission ended. One
 *      request in the whole run and none of it went to a model.
 *
 *   2. THE CLASSIFIER gave it `os_app` alone. `workspace_write` lives in
 *      `files`, so the tool it needed was not in the vocabulary it could see.
 *
 *   3. `describe()` rendered tool results from `outcome.observation`, but the
 *      helper every adapter returns puts them in `outcome.data`. The model was
 *      handed the tool's own description with no numbers in it.
 *
 *   4. Given all of the above fixed, the model wrote
 *      `Memory usage: $(system_status memory) Megabytes` — a placeholder. Every
 *      check passed: the write happened, the readback matched, the tool
 *      reported verified. Truthful verification of a useless result.
 *
 * Each of these is silent. Nothing throws, nothing logs, and the transcript
 * looks reasonable. The only symptom is an agent that quietly does half a job,
 * which is why they are pinned here as behaviour rather than left to be
 * noticed.
 */

import { describe, expect, it } from "vitest";

import { classifyDeterministic } from "@/lib/agent/domains";
import { findTool } from "@/lib/agent/tool-registry";
import { routeDirect } from "@/lib/work/fast-router";
import { validateArguments } from "@/lib/work/tool-contract";
import { parseModelReply } from "@/lib/work/tool-protocol";

const TWO_STEP =
  "Check how much memory this computer is using, then save that number into a file called memory-check.txt";

describe("the fast router claims only what it can finish", () => {
  it("hands a two-step instruction to the model", () => {
    // It used to answer the first clause and end the mission.
    expect(routeDirect(TWO_STEP)).toBeNull();
  });

  it.each([
    "open notepad and then type hello",
    "open chrome; go to example.com",
    "read my screen after that open notepad",
    "list my windows, then close the browser",
  ])("defers %s", (request) => {
    expect(routeDirect(request)).toBeNull();
  });

  it("still answers a single instruction without a model", () => {
    // The point of the router is that these never wait for anything.
    for (const request of [
      "how much memory am I using",
      "what's on my screen",
      "open notepad",
      "list my open windows",
    ]) {
      expect(routeDirect(request), request).not.toBeNull();
    }
  });

  it("does not mistake a plain 'and' for a second step", () => {
    // "search for cats and dogs" is one search. No cheap test separates that
    // from "open notepad and type hello", so only unambiguous sequencing
    // words defer — bare `and` is deliberately not one of them.
    expect(routeDirect("search for cats and dogs")).not.toBeNull();
  });

  it("keeps the stop word working while something is running", () => {
    // "stop" has to be instant even mid-task, so the sequencing guard must
    // not swallow it.
    expect(routeDirect("stop")?.control).toBe("stop");
    expect(routeDirect("pause")?.control).toBe("pause");
    expect(routeDirect("continue")?.control).toBe("continue");
  });
});

describe("the classifier loads the tools the task actually needs", () => {
  it("gives a read-then-write task BOTH domains", () => {
    const domains = classifyDeterministic(TWO_STEP) ?? [];
    expect(domains).toContain("os_app");
    // Without this the model cannot see workspace_write at all.
    expect(domains).toContain("files");
  });

  it("treats searching your own documents as a file search, not a web search", () => {
    // It classified as `web`, so OCADE would have gone looking on the
    // internet for the user's own files.
    const domains = classifyDeterministic("search my documents for invoices") ?? [];
    expect(domains).toContain("files");
    expect(domains).not.toContain("web");
  });

  it("still sends a real web search to the web", () => {
    const domains = classifyDeterministic("search the web for the weather in Paris") ?? [];
    expect(domains).toContain("web");
    expect(domains).not.toContain("files");
  });

  it("recognises opening any application, not only a browser", () => {
    // "open notepad and type hello" matched nothing and cost a full
    // classification turn before any work started.
    expect(classifyDeterministic("open notepad and type hello")).toContain("os_app");
  });

  it("says nothing for a question that needs no computer", () => {
    expect(classifyDeterministic("how are you today")).toBeNull();
  });
});

describe("a placeholder is refused rather than written to disk", () => {
  const workspaceWrite = findTool("workspace_write")!;

  it.each([
    "Memory usage: $(system_status memory) Megabytes",
    "Memory: ${value}%",
    "Result: {{memory}}",
    "Usage: %s percent",
    "key: YOUR_API_KEY",
    "TODO: fill this in",
    "Memory: <the value here>",
  ])("refuses %s", (content) => {
    const verdict = validateArguments(workspaceWrite, { name: "note.txt", content });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      // The reason goes back to the model as a tool result, so it has to say
      // what to do next rather than only what was wrong.
      expect(verdict.reason).toMatch(/substitute/i);
    }
  });

  it("lets real content through, including code with single braces", () => {
    for (const content of [
      "Memory usage: 65.4%",
      "const config = { retries: 3 };",
      "A note about $5 and 100% of the plan",
      "if (x) { return 1; }",
    ]) {
      const verdict = validateArguments(workspaceWrite, { name: "note.txt", content });
      expect(verdict.ok, content).toBe(true);
    }
  });
});

describe("the action contract accepts the shapes the model actually writes", () => {
  const KNOWN = ["workspace_write", "system_status", "screen_observe"];

  it("reads the documented shape", () => {
    const parsed = parseModelReply(
      '{"tool": "workspace_write", "arguments": {"name": "a.txt", "content": "hi"}}',
      KNOWN,
    );
    expect(parsed.toolCalls).toEqual([
      { name: "workspace_write", arguments: { name: "a.txt", content: "hi" } },
    ]);
  });

  it("reads the OpenAI-flavoured synonym", () => {
    const parsed = parseModelReply('{"name": "system_status", "args": {}}', KNOWN);
    expect(parsed.toolCalls[0]?.name).toBe("system_status");
  });

  it("reads the name written OUTSIDE the braces", () => {
    /*
     * FOUND LIVE: this exact reply was dropped and shown to the user as raw
     * JSON in the transcript, because `record.name` was "memory-check.txt" —
     * a filename, not a tool.
     */
    const parsed = parseModelReply(
      'workspace_write {"name": "memory-check.txt", "content": "Memory: 65.4%"}',
      KNOWN,
    );
    expect(parsed.toolCalls).toEqual([
      {
        name: "workspace_write",
        arguments: { name: "memory-check.txt", content: "Memory: 65.4%" },
      },
    ]);
  });

  it("still refuses a tool nobody registered, in either shape", () => {
    expect(parseModelReply('{"tool": "rm_rf", "arguments": {}}', KNOWN).toolCalls).toEqual([]);
    expect(parseModelReply('rm_rf {"path": "/"}', KNOWN).toolCalls).toEqual([]);
  });

  it("does not turn a sentence ending in a word into a tool call", () => {
    // The prefix form only fires when the trailing word IS a known tool.
    const parsed = parseModelReply('Here is the configuration {"retries": 3}', KNOWN);
    expect(parsed.toolCalls).toEqual([]);
  });
});
