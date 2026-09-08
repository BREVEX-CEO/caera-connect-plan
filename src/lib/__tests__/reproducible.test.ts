import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  seedFor,
  pinRun,
  compareRuns,
  diffAnswers,
  driftRatio,
  type PinnedRun,
} from "../edge/reproducible";

/**
 * Reproducibility is a claim about CONDITIONS, and the reporting has to respect
 * that or it becomes alarming noise.
 *
 * A different answer after the temperature changed is not the model being
 * unreliable — it is the user changing the experiment. Presenting those two
 * situations the same way would make the feature useless for the audiences it
 * exists for: audit, clinical review, compliance, anyone who has to explain
 * later what the system said and why.
 */

async function run(over: Partial<Parameters<typeof pinRun>[0]> = {}): Promise<PinnedRun> {
  return pinRun({
    prompt: "summarise the termination clause",
    answer: "Either party may terminate with 30 days' notice.",
    modelKey: "wasm/qwen2.5-1.5b.gguf",
    modelSha256: "a".repeat(64),
    seed: 1234,
    temperature: 0.2,
    topP: 0.9,
    backend: "wasm",
    at: new Date("2026-08-07T09:00:00Z"),
    ...over,
  });
}

describe("a run can be pinned and repeated", () => {
  it("reports an exact reproduction", async () => {
    const verdict = compareRuns(await run(), await run());
    expect(verdict.identical).toBe(true);
    expect(verdict.conditionsMatched).toBe(true);
    expect(verdict.summary).toMatch(/Reproduced exactly/);
  });

  it("derives a stable seed from the prompt when none is given", async () => {
    // A random seed nobody recorded is the same as no seed: the run cannot be
    // repeated from the pin alone.
    expect(seedFor("hello")).toBe(seedFor("hello"));
    expect(seedFor("hello")).not.toBe(seedFor("hello!"));
    const pinned = await run({ seed: undefined });
    expect(pinned.pin.seed).toBe(seedFor("summarise the termination clause"));
    expect(pinned.pin.seed).toBeGreaterThanOrEqual(0);
  });

  it("pins the engine file, not just its name", async () => {
    /*
     * The failure a cloud assistant cannot even detect: same model NAME, new
     * weights. Pinning the digest is what makes "same model" checkable.
     */
    const verdict = compareRuns(await run(), await run({ modelSha256: "b".repeat(64) }));
    expect(verdict.conditionsMatched).toBe(false);
    expect(verdict.changes.map((c) => c.field)).toContain("modelSha256");
  });
});

describe("conditions are reported before conclusions", () => {
  it("blames the changed setting, not the model", async () => {
    const verdict = compareRuns(
      await run(),
      await run({ temperature: 0.9, answer: "Thirty days, either side." }),
    );
    expect(verdict.identical).toBe(false);
    expect(verdict.summary).toMatch(/so did the conditions/);
    expect(verdict.summary).toMatch(/temperature/);
    // The alarming reading must NOT appear when there is an ordinary cause.
    expect(verdict.summary).not.toMatch(/not deterministic/);
  });

  it("flags non-determinism only when nothing else changed", async () => {
    const verdict = compareRuns(await run(), await run({ answer: "A different answer entirely." }));
    expect(verdict.conditionsMatched).toBe(true);
    expect(verdict.summary).toMatch(/identical conditions/);
    expect(verdict.summary).toMatch(/pin the seed/);
  });

  it("notes when the answer survived a condition change", async () => {
    const verdict = compareRuns(await run(), await run({ temperature: 0.7 }));
    expect(verdict.identical).toBe(true);
    expect(verdict.summary).toMatch(/identical even though the conditions changed/);
  });

  it("treats the hardware path as a real explanation", async () => {
    /*
     * GPU kernels are not always bit-reproducible against a CPU path, even with
     * identical weights and seed. Reporting that as model instability would be
     * wrong, and blaming the user's hardware silently would be worse.
     */
    const verdict = compareRuns(
      await run(),
      await run({ backend: "webgpu", answer: "Either party may terminate with 30 days notice." }),
    );
    expect(verdict.changes.map((c) => c.field)).toContain("backend");
    expect(verdict.summary).toMatch(/hardware path/);
  });

  it("names a changed question rather than calling it drift", async () => {
    const verdict = compareRuns(
      await run(),
      await run({ prompt: "something else", answer: "A different answer." }),
    );
    expect(verdict.summary).toMatch(/the question/);
    expect(verdict.summary).not.toMatch(/not deterministic/);
  });

  it("names the changed conditions even when the answer survived", async () => {
    /*
     * An identical answer to a DIFFERENT question is not a reproduction, it is
     * a coincidence — and the summary has to make that visible rather than
     * reading as reassurance.
     */
    const verdict = compareRuns(await run(), await run({ prompt: "something else" }));
    expect(verdict.identical).toBe(true);
    expect(verdict.summary).toMatch(/the question/);
  });

  it("lists every changed condition, not just the first", async () => {
    const verdict = compareRuns(
      await run(),
      await run({ temperature: 0.9, topP: 0.5, seed: 9999 }),
    );
    expect(verdict.changes.map((c) => c.field).sort()).toEqual(["seed", "temperature", "topP"]);
  });
});

describe("differences are shown, not just counted", () => {
  it("marks what was added and removed", () => {
    const spans = diffAnswers("the cat sat on the mat", "the dog sat on the mat");
    expect(spans.filter((s) => s.kind === "removed").map((s) => s.text.trim())).toContain("cat");
    expect(spans.filter((s) => s.kind === "added").map((s) => s.text.trim())).toContain("dog");
    expect(spans.some((s) => s.kind === "same" && s.text.includes("sat"))).toBe(true);
  });

  it("returns everything as unchanged for identical text", () => {
    const spans = diffAnswers("same text here", "same text here");
    expect(spans.every((s) => s.kind === "same")).toBe(true);
    expect(driftRatio(spans)).toBe(0);
  });

  it("reconstructs both sides exactly", () => {
    /*
     * The property that makes a diff trustworthy: dropping the additions gives
     * back the original, dropping the removals gives back the new version. A
     * diff that loses a word would misrepresent the very thing it is displaying.
     */
    const before = "Either party may terminate with 30 days notice.";
    const after = "Either side may end the agreement with 30 days notice.";
    const spans = diffAnswers(before, after);
    const rebuiltBefore = spans
      .filter((s) => s.kind !== "added")
      .map((s) => s.text)
      .join("");
    const rebuiltAfter = spans
      .filter((s) => s.kind !== "removed")
      .map((s) => s.text)
      .join("");
    expect(rebuiltBefore).toBe(before);
    expect(rebuiltAfter).toBe(after);
  });

  it("groups consecutive changes instead of emitting one span per word", () => {
    // Otherwise the display is unreadable confetti.
    const spans = diffAnswers("a b c d", "a x y d");
    expect(spans.length).toBeLessThan(8);
  });

  it("measures how much actually changed", () => {
    expect(driftRatio(diffAnswers("a b c d", "a b c d"))).toBe(0);
    const heavy = driftRatio(diffAnswers("a b c d", "w x y z"));
    expect(heavy).toBeGreaterThan(0.5);
  });

  it("handles an empty side", () => {
    expect(diffAnswers("", "new text").every((s) => s.kind === "added")).toBe(true);
    expect(diffAnswers("old text", "").every((s) => s.kind === "removed")).toBe(true);
    expect(driftRatio(diffAnswers("", ""))).toBe(0);
  });
});

describe("the re-run is reachable and non-destructive", () => {
  const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");
  const DIFF = readFileSync("src/components/ocade/chat/AnswerDiff.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it("stores the pin when the answer is first produced", () => {
    // Without it, a later re-run has nothing to compare conditions against and
    // every difference becomes uninterpretable.
    const c = code(CHAT);
    expect(c).toMatch(/const pinned = await pinRun\(\{/);
    expect(c).toMatch(
      /setRunPins\(\(current\) => \(\{ \.\.\.current, \[assistant\.id\]: pinned \}\)\)/,
    );
  });

  it("pins the sampling values the engine actually ran at", () => {
    /*
     * A pin naming conditions that were never applied is worse than no pin:
     * it reports a controlled repeat that was not controlled. One authority
     * supplies the numbers to both the adapters and the pin.
     */
    const c = code(CHAT);
    expect(c).toMatch(/temperature: BROWSER_SAMPLER\.temperature/);
    expect(c).toMatch(/topP: BROWSER_SAMPLER\.topP/);
    for (const adapter of [
      "src/lib/brain/adapters/browser-webgpu.ts",
      "src/lib/brain/adapters/browser-wasm.ts",
    ]) {
      const source = code(readFileSync(adapter, "utf8"));
      expect(source, adapter).toMatch(/temperature: BROWSER_SAMPLER\.temperature/);
      expect(source, adapter).toMatch(/top_p: BROWSER_SAMPLER\.topP/);
      expect(source, adapter).not.toMatch(/temperature: 0\.2/);
    }
  });

  it("keeps the original answer beside the re-run", () => {
    /*
     * THE RULE THAT MATTERS. Regenerate in a mainstream assistant overwrites
     * the answer you had. Here the original is the left-hand side of the
     * comparison — replacing it would destroy the thing being compared, and
     * "run it again" would become a way to lose work.
     *
     * The repeat is held in its OWN map, keyed by the original's id, and the
     * diff reads `message.content` for the left-hand side. Neither the message
     * list nor the stored conversation is written to, so there is no path by
     * which a repeat can replace what it is being compared against.
     */
    const c = code(CHAT);
    expect(c).toMatch(/setReruns\(\(current\) => \(\{/);
    expect(c).toMatch(/before=\{message\.content\}/);
    expect(c).toMatch(/after=\{repeat\.answer\}/);
    // The repeat never becomes the message.
    expect(c).not.toMatch(/setMessages[\s\S]{0,80}repeated/);
  });

  it("only offers a re-run on the newest answer, and only where it is meaningful", () => {
    /*
     * Re-running from the middle of a thread would compare against a
     * conversation state that no longer exists. And an answer with no pin —
     * one loaded from history, or produced by an online provider whose weights
     * change without notice — has nothing interpretable to compare against, so
     * the control is ABSENT rather than present and misleading.
     */
    const c = code(CHAT);
    expect(c).toMatch(/messages\.at\(-1\)\?\.role === "assistant" &&/);
    expect(c).toMatch(/runPins\[messages\.at\(-1\)!\.id\]/);
  });

  it("refuses to re-run while a generation is in flight", () => {
    const fn = code(CHAT).slice(code(CHAT).indexOf("const rerunAnswer = useCallback"));
    expect(fn.slice(0, 300)).toMatch(/if \(streaming\) return;/);
  });

  it("replays the stored request rather than reassembling it", () => {
    /*
     * Rebuilding the context would quietly change the input — a document since
     * detached, a freshness line with a newer timestamp — and the comparison
     * would then be measuring OCADE's context builder rather than the engine.
     */
    const c = code(CHAT);
    expect(c).toMatch(/const replay = replayRef\.current\[answerId\]/);
    expect(c).toMatch(/messages: replay\.messages/);
  });

  it("leads with the conditions, not with the difference", () => {
    /*
     * On screen as well as in the data. If the user changed the temperature,
     * "the answer changed" is technically true and misdirects every reader who
     * does not scroll.
     */
    const c = code(DIFF);
    expect(c.indexOf("verdict.summary")).toBeLessThan(c.indexOf("spans.map"));
  });

  it("reserves the alarming treatment for unexplained change", () => {
    const c = code(DIFF);
    expect(c).toMatch(/verdict\.conditionsMatched\s*\?[\s\S]{0,120}"unstable"/);
  });

  it("explains its own colours", () => {
    // A red strike-through and a green highlight mean nothing to someone who
    // has not been told which side is which.
    expect(DIFF).toMatch(/was in the first answer/);
    expect(DIFF).toMatch(/is new/);
  });
});
