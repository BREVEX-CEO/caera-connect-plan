/**
 * Compaction has to make a transcript shorter without making it misleading.
 *
 * The failure this guards is quiet: a window that opens part-way through an
 * exchange hands the model tool results whose request it can no longer see, and
 * the model fills the gap in rather than asking. Nothing errors; the answer is
 * just about a question nobody asked.
 */

import { describe, expect, it } from "vitest";

import { compactTranscript } from "../compact";
import { CLEARED_MARKER, isToolResult, microCompact } from "@/primary-logic/query/microCompact";
import { analyseTranscript } from "@/primary-logic/query/contextAnalysis";
import type { QueryMessage } from "@/primary-logic/query/deps";

const user = (content: string): QueryMessage => ({ role: "user", content });
const assistant = (content: string): QueryMessage => ({ role: "assistant", content });
const result = (content: string): QueryMessage => ({
  role: "user",
  content: `Result of ${content}`,
});
/** A tool result with a body big enough to be worth clearing. */
const bigResult = (name: string): QueryMessage => ({
  role: "user",
  content: `Result of ${name}\n${"x".repeat(4_000)}`,
});

/** A conversation of `rounds` exchanges, each with two tool results. */
function transcript(rounds: number): QueryMessage[] {
  const messages: QueryMessage[] = [];
  for (let index = 0; index < rounds; index += 1) {
    messages.push(user(`Ask number ${index}`));
    messages.push(assistant(`Working on ${index}`));
    messages.push(result(`step ${index}a`));
    messages.push(result(`step ${index}b`));
  }
  return messages;
}

describe("compaction", () => {
  it("leaves a short conversation alone", async () => {
    expect(await compactTranscript(transcript(3))).toBeNull();
  });

  it("keeps the original request", async () => {
    const messages = transcript(10);
    const compacted = await compactTranscript(messages);
    expect(compacted?.[0]).toEqual(user("Ask number 0"));
  });

  it("opens the kept window on a real question, never on a bare result", async () => {
    const compacted = await compactTranscript(transcript(10));
    expect(compacted).not.toBeNull();
    // [original request, the summary, then the window]
    const windowStart = compacted![2];
    expect(windowStart.role).toBe("user");
    expect(String(windowStart.content).startsWith("Result of ")).toBe(false);
  });

  it("says what it dropped rather than leaving a silent gap", async () => {
    const compacted = await compactTranscript(transcript(10));
    const summary = String(compacted![1].content);
    expect(summary).toContain("were condensed to save room");
    expect(summary).toContain("tool results");
  });

  it("refuses when it would not actually save anything", async () => {
    // Sixteen tiny messages: past the minimum, but the summary line costs about
    // as much as what it replaces.
    const messages = Array.from({ length: 16 }, (_, index) => user(`${index}`));
    expect(await compactTranscript(messages)).toBeNull();
  });

  it("still compacts a long unbroken chain of tool results", async () => {
    /*
     * No round boundary exists anywhere in the recent window here. The cut must
     * fall back to where it was rather than refusing — this is the transcript
     * that needs compaction most.
     */
    const messages: QueryMessage[] = [user("Do the whole thing")];
    for (let index = 0; index < 40; index += 1) {
      messages.push(assistant(`step ${index}`));
      messages.push(result(`step ${index} finished with a reasonably long observation`));
    }
    const compacted = await compactTranscript(messages);
    expect(compacted).not.toBeNull();
    expect(compacted!.length).toBeLessThan(messages.length);
  });
});

/**
 * Emptying old observations before forgetting whole turns.
 *
 * The cheaper pass keeps the shape of what happened — which tools ran, and
 * whether they worked — and drops only the output nobody will read again. It
 * has to be tried first, and it has to leave the recent observations alone,
 * because those are what the next decision is made from.
 */
describe("micro-compaction", () => {
  function withBigResults(rounds: number): QueryMessage[] {
    const messages: QueryMessage[] = [];
    for (let index = 0; index < rounds; index += 1) {
      messages.push(user(`Ask number ${index}`));
      messages.push(assistant(`Working on ${index}`));
      messages.push(bigResult(`step ${index}`));
    }
    return messages;
  }

  it("clears old tool bodies rather than dropping the turns", async () => {
    const messages = withBigResults(10);
    const compacted = await compactTranscript(messages);

    expect(compacted).not.toBeNull();
    // Nothing was dropped: the saving came from emptying, not forgetting.
    expect(compacted).toHaveLength(messages.length);
    expect(compacted!.some((m) => String(m.content).includes(CLEARED_MARKER))).toBe(true);
  });

  it("keeps the headline, so a later turn still knows what ran", async () => {
    const compacted = await compactTranscript(withBigResults(10));
    const cleared = compacted!.find((m) => String(m.content).includes(CLEARED_MARKER))!;
    expect(String(cleared.content)).toMatch(/^Result of step \d/);
  });

  it("leaves the most recent observations intact", async () => {
    const messages = withBigResults(10);
    const compacted = await compactTranscript(messages);
    const lastResult = [...compacted!].reverse().find((m) => isToolResult(m))!;
    expect(String(lastResult.content)).not.toContain(CLEARED_MARKER);
    expect(String(lastResult.content).length).toBeGreaterThan(3_000);
  });

  it("does nothing when there is nothing old enough to clear", () => {
    expect(microCompact(withBigResults(2))).toBeNull();
  });

  it("does not bother with a body too small to be worth a marker", () => {
    const messages: QueryMessage[] = [];
    for (let index = 0; index < 10; index += 1) {
      messages.push(user(`Ask ${index}`));
      messages.push(result(`step ${index}`));
    }
    expect(microCompact(messages)).toBeNull();
  });

  it("falls through to dropping turns when emptying was not enough", async () => {
    /*
     * Long prose from the assistant, nothing to empty. The structural pass is
     * what has to save this transcript, and it still does.
     */
    const messages: QueryMessage[] = [];
    for (let index = 0; index < 12; index += 1) {
      messages.push(user(`Ask ${index}`));
      messages.push(assistant("Reasoning at length. ".repeat(120)));
    }
    const compacted = await compactTranscript(messages);
    expect(compacted).not.toBeNull();
    expect(compacted!.length).toBeLessThan(messages.length);
  });
});

/**
 * The same fact, several times over.
 *
 * The largest single waste in a long run is not that observations are big — it
 * is that the same one is present three times because the model re-read a file
 * it had already read. Every copy costs what the first did and only the last
 * one is worth anything, so clearing the earlier copies is a saving with no
 * loss at all.
 */
describe("superseded observations", () => {
  it("clears an older identical result even when it is recent", () => {
    const messages: QueryMessage[] = [];
    const body = `Result of file_read: ${"y".repeat(2_000)}`;
    for (let index = 0; index < 3; index += 1) {
      messages.push(user(`Check it again (${index})`));
      messages.push(assistant("Reading."));
      messages.push({ role: "user", content: body });
    }

    const trimmed = microCompact(messages, 12)!;
    expect(trimmed).not.toBeNull();

    const survivingCopies = trimmed.filter((m) => m.content === body);
    // Exactly one full copy left: the most recent.
    expect(survivingCopies).toHaveLength(1);
    expect(trimmed[trimmed.length - 1]!.content).toBe(body);
    expect(trimmed.filter((m) => String(m.content).includes(CLEARED_MARKER))).toHaveLength(2);
  });

  it("counts where the room went, by tool", () => {
    const analysis = analyseTranscript([
      user("Do it"),
      assistant("On it."),
      { role: "user", content: "Result of file_read: aaaa" },
      { role: "user", content: "Result of web_search: bbbbbb" },
    ]);
    expect(Object.keys(analysis.byTool).sort()).toEqual(["file_read", "web_search"]);
    expect(analysis.user).toBe("Do it".length);
    expect(analysis.assistant).toBe("On it.".length);
  });

  it("never marks the newest copy as superseded", () => {
    const body = { role: "user" as const, content: "Result of file_read: same" };
    const analysis = analyseTranscript([body, body, body]);
    expect(analysis.supersededResults).toEqual([0, 1]);
  });

  it("treats prose that merely mentions a tool as prose", () => {
    const analysis = analyseTranscript([assistant("I will use file_read next.")]);
    expect(analysis.byTool).toEqual({});
    expect(analysis.assistant).toBeGreaterThan(0);
  });
});
