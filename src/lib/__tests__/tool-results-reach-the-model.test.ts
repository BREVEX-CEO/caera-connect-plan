/**
 * What a tool found has to reach the model, or the next step is guesswork.
 *
 * FOUND LIVE, AND MISDIAGNOSED TWICE BEFORE IT WAS FOUND.
 *
 * `describe()` renders a tool result into the text the model reads on its next
 * turn. It appended `outcome.observation` — and nothing else. But `ok(data,
 * detail)`, the helper almost every adapter returns, puts the payload in
 * `outcome.data`. Only the few adapters that ALSO passed `observation:`
 * explicitly were ever readable.
 *
 * So "check how much memory this computer is using, then save that number into
 * a file" made exactly one tool call and stopped. The model asked for the
 * system status and was handed:
 *
 *     Result: success. Read this computer's processor, memory, disk and
 *     battery state.
 *
 * — the tool's own description, with no numbers in it. There was nothing to
 * write, so it stopped. And because the only step so far was a read, no
 * mutation existed to fail verification, and the run ended reported as
 * "verified".
 *
 * That failure is indistinguishable from a model too weak to plan, which is
 * exactly what it was blamed on: first qwen3:4b for being slow, then qwen2.5
 * for stopping early. Neither was the cause. Handed the actual numbers in a
 * raw two-turn probe, the same model called `workspace_write` correctly.
 *
 * These tests exist because the bug is silent. Nothing throws, nothing logs,
 * the transcript looks reasonable, and the only symptom is an agent that
 * quietly does half a job.
 */

import { describe as group, expect, it } from "vitest";

import { describe as renderResult } from "@/lib/agent/loop";
import { fail, ok } from "@/lib/agent/outcomes";

group("a tool result carries what the tool found", () => {
  it("includes the payload adapters actually return", () => {
    // This is the exact shape `systemStatus` returns.
    const rendered = renderResult(
      ok(
        { cpu_percent: 19, ram_percent: 76.4, ram_used_gb: 11.9 },
        "Read this computer's processor, memory, disk and battery state.",
      ),
    );

    expect(rendered).toContain("76.4");
    expect(rendered).toContain("ram_percent");
  });

  it("prefers a deliberate observation over the raw payload", () => {
    // `observation` is the post-action RE-READ — what is true now, rather than
    // what the call was handed. Where an adapter sets both, that is the more
    // truthful thing to show the model.
    const rendered = renderResult({
      ...ok({ requested: "before" }, "Typed the text."),
      observation: { readback: "after" },
    });

    expect(rendered).toContain("after");
    // And not twice: sending both wastes context on a small model.
    expect(rendered).not.toContain("before");
  });

  it("says nothing rather than sending an empty envelope", () => {
    for (const empty of [ok({}, "Done."), ok([], "Done."), ok(null, "Done.")]) {
      expect(renderResult(empty)).not.toContain("Observed:");
    }
  });

  it("still leads with the outcome and the sentence", () => {
    const rendered = renderResult(ok({ windows: 3 }, "Listed the windows."));
    expect(rendered.split("\n")[0]).toBe("Result: success. Listed the windows.");
  });

  it("keeps a large payload from swallowing the context window", () => {
    const huge = { rows: Array.from({ length: 5_000 }, (_, i) => `row-${i}`) };
    const rendered = renderResult(ok(huge, "Listed everything."));
    expect(rendered.length).toBeLessThan(6_400);
    expect(rendered).toContain("…");
  });
});

group("a failure still says what went wrong", () => {
  it("names an unverified mutation in words the model will not read past", () => {
    const rendered = renderResult({
      ...ok({ typed: "hello" }, "Typed into the window."),
      verified: false,
    });
    expect(rendered).toContain("NOT observed");
    expect(rendered).toContain("Do not report this as done");
  });

  it("marks a confirmed one", () => {
    const rendered = renderResult({ ...ok({ name: "a.txt" }, "Wrote it."), verified: true });
    expect(rendered).toContain("confirmed by looking afterwards");
  });

  it("carries the reason for a refusal, which has no payload at all", () => {
    const rendered = renderResult(fail("blocked", "That looks like a password."));
    expect(rendered).toContain("blocked");
    expect(rendered).toContain("That looks like a password.");
    expect(rendered).not.toContain("Observed:");
  });
});
