import { describe, expect, it } from "vitest";
import { reasoningFilter } from "../adapters/browser-wasm";

/**
 * THE DELIBERATION MUST NOT REACH THE TRANSCRIPT, HOWEVER IT ARRIVES.
 *
 * With thinking on, the artifact wraps its reasoning in `<think>…</think>`.
 * The failure worth testing is not the easy case — it is a tag split across
 * chunks, because a stream delivers `<thi` and `nk>` separately whenever it
 * feels like it, and a per-chunk `replace` lets both halves through as visible
 * text. What the person would see is the model's private working, character by
 * character, presented as its answer.
 */
function run(pieces: string[]): string {
  const filter = reasoningFilter();
  return pieces.map((piece) => filter.visible(piece)).join("");
}

describe("the reasoning filter", () => {
  it("passes an ordinary answer through untouched", () => {
    expect(run(["The ", "answer ", "is ", "four."])).toBe("The answer is four.");
  });

  it("removes a reasoning block that arrives whole", () => {
    expect(run(["<think>2+2, carry nothing</think>", "Four."])).toBe("Four.");
  });

  it("removes one split across every possible boundary", () => {
    expect(run(["<", "thi", "nk>", "working", "</thi", "nk>", "Four."])).toBe("Four.");
    expect(run(["a<th", "ink>b</th", "ink>c"])).toBe("ac");
  });

  it("holds back text that could still become a tag, then releases it", () => {
    const filter = reasoningFilter();
    // Nothing is emitted yet: this could be the start of `<think>`.
    expect(filter.visible("done <th")).toBe("done ");
    // It was not, so the held text is ordinary prose after all.
    expect(filter.visible("at is all")).toBe("<that is all");
  });

  it("emits nothing while the reasoning is still open", () => {
    const filter = reasoningFilter();
    expect(filter.visible("<think>still going")).toBe("");
    expect(filter.visible(" and going")).toBe("");
    expect(filter.visible("</think>Four.")).toBe("Four.");
  });

  it("leaves a lone closing tag alone rather than swallowing the answer", () => {
    // Nothing opened, so nothing is being hidden; the text is just text.
    expect(run(["Four.</think>"])).toBe("Four.</think>");
  });
});
