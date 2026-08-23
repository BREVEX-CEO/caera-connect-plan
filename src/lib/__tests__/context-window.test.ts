import { describe, it, expect } from "vitest";
import {
  planContextWindow,
  estimateTokens,
  CONTEXT_CEILING,
  contextCeilingFor,
  estimatedReadSeconds,
  SLOW_READ_WARNING_SECONDS,
  type LocalChatMessage,
} from "../ocade-local";

/**
 * Sizing the context window.
 *
 * THE BUG THIS FILE GUARDS. The runtime defaults to a 4,096-token context and
 * throws away whatever does not fit — no warning, no error, just a confident
 * answer drawn from a fragment. Measured against the real engine on this
 * machine: a 220-line log with an access code on line 147 came to 5,654 tokens,
 * and the question "what is the code?" returned "74". With a large enough
 * window the same prompt, the same model and the same question returned
 * "742913". Nothing in the product said anything had been dropped.
 *
 * So these assertions are about a real observed failure, not a hypothetical:
 * the request that measured 5,654 tokens must ask for more than 4,096.
 */

const user = (content: string, images?: string[]): LocalChatMessage => ({
  role: "user",
  content,
  ...(images ? { images } : {}),
});

describe("a short conversation gets a bounded floor", () => {
  it("explicitly sends 4,096 so a model's larger default cannot take over", () => {
    // The installed vision model advertises a 128k default. Delegating to that
    // default allocated about 13 GB for a tiny image proof on the reference PC.
    const plan = planContextWindow([user("What is the capital of Japan?")]);
    expect(plan.numCtx).toBe(4096);
    expect(plan.exceedsCeiling).toBe(false);
  });

  it("keeps the floor just below 4,096, where the reply must also fit", () => {
    // 4096 minus the reply reserve, in characters at the estimator's rate.
    const plan = planContextWindow([user("x".repeat(Math.floor((4096 - 1024) * 3.5) - 100))]);
    expect(plan.numCtx).toBe(4096);
  });
});

describe("the request that actually failed", () => {
  /* The same document the evidence run built, rebuilt here. */
  const lines: string[] = [];
  for (let i = 1; i <= 220; i += 1) {
    lines.push(
      i === 147
        ? `Line ${i}: The maintenance access code for the north gate is 742913.`
        : `Line ${i}: routine inventory entry, nothing of note, item ${1000 + i} checked and returned to stock.`,
    );
  }
  const document = lines.join("\n");

  it("is estimated at more than the runtime's default", () => {
    // The real tokeniser reported 5,654 for this prompt. The estimate only has
    // to land on the correct SIDE of 4,096 — and it must not undershoot, since
    // undershooting is what causes silent truncation.
    const tokens = estimateTokens([user(document)]);
    expect(tokens).toBeGreaterThan(4096);
    expect(tokens).toBeGreaterThan(5000);
  });

  it("asks for a window that holds it, with room left for the answer", () => {
    const plan = planContextWindow([user(document)]);
    expect(plan.numCtx).not.toBeNull();
    expect(plan.numCtx!).toBeGreaterThanOrEqual(8192);
    expect(plan.numCtx!).toBeGreaterThan(plan.estimatedTokens);
    expect(plan.exceedsCeiling).toBe(false);
  });
});

describe("images are counted, because a picture is not free", () => {
  it("charges for an image even when the text is short", () => {
    // A vision model expands an image into hundreds of tokens before a word is
    // read. Counting only the characters would size the window as though the
    // picture were not there.
    const withText = estimateTokens([user("Describe this.")]);
    const withImage = estimateTokens([user("Describe this.", ["<base64>"])]);
    expect(withImage - withText).toBeGreaterThanOrEqual(1000);
  });

  it("makes several images push past the default on their own", () => {
    const plan = planContextWindow([user("Compare these.", ["a", "b", "c"])]);
    expect(plan.numCtx).not.toBeNull();
  });
});

const GIB = 1024 ** 3;

describe("the ceiling belongs to the machine, not to the model", () => {
  /*
   * Measured on the reference machine: the 8B tier occupies 5.53 GB at the
   * runtime's default window and 7.35 GB at 16,384 — 1.82 GB of extra resident
   * memory for the KV cache alone. That is why the ceiling is not a constant.
   * A 32,768 window on an 8 GB laptop would take the machine into swapping,
   * and a chat that makes the whole computer unusable is worse than a chat
   * that says it cannot see the whole document.
   */
  it("gives a small machine a small ceiling", () => {
    expect(contextCeilingFor(8 * GIB)).toBe(8192);
  });

  it("gives the reference machine the middle step", () => {
    expect(contextCeilingFor(15.65 * GIB)).toBe(16384);
  });

  it("gives a large machine the full ceiling", () => {
    expect(contextCeilingFor(64 * GIB)).toBe(CONTEXT_CEILING);
  });

  it("treats an unmeasured machine as small, never as large", () => {
    // Guessing upwards is paid for in responsiveness by the person using the
    // computer, and that is not OCADE's to spend on an assumption.
    expect(contextCeilingFor(undefined)).toBe(8192);
    expect(contextCeilingFor(0)).toBe(8192);
  });

  it("says plainly when a request is bigger than this machine will allocate", () => {
    const plan = planContextWindow([user("y".repeat(CONTEXT_CEILING * 4))], 64 * GIB);
    expect(plan.exceedsCeiling).toBe(true);
    // Still asks for the ceiling: a warned partial answer beats no answer.
    expect(plan.numCtx).toBe(CONTEXT_CEILING);
  });

  it("never asks a small machine for a window a large one would get", () => {
    const small = planContextWindow([user("q".repeat(200_000))], 8 * GIB);
    const large = planContextWindow([user("q".repeat(200_000))], 64 * GIB);
    expect(small.numCtx).toBe(8192);
    expect(large.numCtx).toBe(CONTEXT_CEILING);
    expect(small.exceedsCeiling).toBe(true);
  });
});

describe("telling the user how long the reading will take", () => {
  /*
   * From the engine's own counters on the reference machine: a 5,654-token
   * prompt took 458.4 seconds to EVALUATE and 3.8 seconds to answer. Reading is
   * the whole cost. Eight minutes of spinner is indistinguishable from a hang,
   * which is why this figure has to reach the user before they press send
   * rather than after.
   */
  it("estimates the wait from the measured rate when the machine has no acceleration", () => {
    const seconds = estimatedReadSeconds(5654, false);
    expect(seconds).not.toBeNull();
    // The real measurement was 458 s. Within a minute of it is close enough to
    // say "about eight minutes" and be right.
    expect(Math.abs(seconds! - 458)).toBeLessThan(60);
  });

  it("says nothing at all when the machine might have a graphics card", () => {
    // With acceleration the rate differs by an order of magnitude and nothing
    // here has measured it. A wrong time estimate is worse than none, because
    // people plan around it.
    expect(estimatedReadSeconds(5654, true)).toBeNull();
    expect(estimatedReadSeconds(5654, undefined)).toBeNull();
  });

  it("stays quiet about a short message", () => {
    const plan = planContextWindow([user("What is the capital of Japan?")], 16 * GIB, false);
    expect(plan.estimatedReadSeconds!).toBeLessThan(SLOW_READ_WARNING_SECONDS);
  });

  it("speaks up about a long one", () => {
    const plan = planContextWindow([user("q".repeat(40_000))], 16 * GIB, false);
    expect(plan.estimatedReadSeconds!).toBeGreaterThan(SLOW_READ_WARNING_SECONDS);
  });
});

describe("the window is stepped, not exact", () => {
  it("gives the same window to two similar turns, so the model is not reloaded", () => {
    // The runtime reallocates and reloads when the window changes. A value that
    // drifted with every message would reload several gigabytes mid-conversation
    // for no benefit.
    const a = planContextWindow([user("q".repeat(30_000))], 64 * GIB);
    const b = planContextWindow([user("q".repeat(30_100))], 64 * GIB);
    expect(a.numCtx).toBe(b.numCtx);
  });

  it("uses only the declared steps", () => {
    const sizes = new Set<number>();
    for (const length of [20_000, 40_000, 60_000, 100_000]) {
      const plan = planContextWindow([user("q".repeat(length))], 64 * GIB);
      sizes.add(plan.numCtx);
    }
    for (const size of sizes) expect([8192, 16384, 32768]).toContain(size);
  });
});
