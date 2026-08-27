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
import type { QueryMessage } from "@/primary-logic/query/deps";

const user = (content: string): QueryMessage => ({ role: "user", content });
const assistant = (content: string): QueryMessage => ({ role: "assistant", content });
const result = (content: string): QueryMessage => ({
  role: "user",
  content: `Result of ${content}`,
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
