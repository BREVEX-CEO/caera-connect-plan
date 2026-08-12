import { describe, it, expect } from "vitest";
import {
  planBudget,
  estimateTokens,
  truncationNotice,
  type BudgetItem,
} from "../edge/context-budget";

/**
 * Dropping context silently is the failure being fixed.
 *
 * The user's question after a truncated answer is never "how many tokens did
 * you use" — it is "did you actually read my file?". If the answer is no and
 * nobody said so, they trust a conclusion formed without the evidence they
 * believe it was formed from. That is a different and worse failure than a
 * wrong answer, because it is invisible.
 */

const item = (over: Partial<BudgetItem> & { id: string }): BudgetItem => ({
  label: over.id,
  kind: "turn",
  tokens: 100,
  priority: 1,
  ...over,
});

describe("when everything fits, nothing is said", () => {
  it("includes every item and reports completeness", () => {
    const plan = planBudget([item({ id: "a" }), item({ id: "b" })], 1000);
    expect(plan.complete).toBe(true);
    expect(plan.included).toHaveLength(2);
    expect(plan.dropped).toEqual([]);
    // No notice on a normal answer: a warning on every message is a warning
    // nobody reads.
    expect(truncationNotice(plan)).toBeNull();
  });

  it("keeps the caller's order, not priority order", () => {
    /*
     * The model needs the conversation in sequence. Sorting the survivors by
     * priority would reorder the dialogue and change its meaning.
     */
    const plan = planBudget(
      [item({ id: "first", priority: 1 }), item({ id: "second", priority: 9 })],
      1000,
    );
    expect(plan.included.map((i) => i.id)).toEqual(["first", "second"]);
  });
});

describe("when something must go, it is named", () => {
  it("drops the lowest priority first", () => {
    const plan = planBudget(
      [
        item({ id: "keep", priority: 10, tokens: 100 }),
        item({ id: "drop", priority: 1, tokens: 100 }),
      ],
      150,
    );
    expect(plan.included.map((i) => i.id)).toEqual(["keep"]);
    expect(plan.dropped.map((d) => d.id)).toEqual(["drop"]);
  });

  it("never drops a pinned item", () => {
    // The system prompt and the current question. Cutting either produces a
    // confidently wrong answer that looks entirely normal.
    const plan = planBudget(
      [
        item({ id: "system", pinned: true, tokens: 100, kind: "system" }),
        item({ id: "question", pinned: true, tokens: 100 }),
        item({ id: "history", tokens: 500 }),
      ],
      250,
    );
    expect(plan.included.map((i) => i.id).sort()).toEqual(["question", "system"]);
    expect(plan.dropped.map((d) => d.id)).toEqual(["history"]);
  });

  it("refuses rather than truncating the question itself", () => {
    const plan = planBudget([item({ id: "huge", pinned: true, tokens: 5000 })], 1000);
    expect(plan.impossible).toBe(true);
    expect(plan.included).toEqual([]);
    expect(plan.summary).toMatch(/too long for the engine/i);
    // Refusing is honest; silently cutting the user's own words is not.
    expect(plan.summary).toMatch(/Shorten the question/);
  });

  it("calls out a dropped DOCUMENT by name", () => {
    /*
     * The case that matters most. Someone attaches a contract, asks a question
     * about it, and the contract does not fit. Without this line they read the
     * answer as being about their contract.
     */
    const plan = planBudget(
      [
        item({ id: "q", pinned: true, tokens: 50 }),
        item({ id: "contract", kind: "document", label: "contract.pdf", tokens: 9000 }),
      ],
      1000,
    );
    const notice = truncationNotice(plan);
    expect(notice).toMatch(/contract\.pdf/);
    expect(notice).toMatch(/did not fit/);
  });

  it("gives every drop a reason and something to do about it", () => {
    const plan = planBudget(
      [item({ id: "q", pinned: true, tokens: 50 }), item({ id: "old", tokens: 5000 })],
      1000,
    );
    for (const drop of plan.dropped) {
      expect(drop.reason).toBeTruthy();
      // A notice with no remedy just tells someone their tool is broken.
      expect(drop.remedy.length).toBeGreaterThan(15);
    }
  });

  it("does not dress the loss up as optimisation", () => {
    const plan = planBudget(
      [item({ id: "q", pinned: true, tokens: 50 }), item({ id: "old", tokens: 5000 })],
      1000,
    );
    expect(plan.summary).toMatch(/left out/i);
    // The phrasing that hides this in other products.
    expect(plan.summary).not.toMatch(/optimis|compress|summaris/i);
  });
});

describe("the plan is reproducible", () => {
  it("produces the same result for the same input", () => {
    const items = [
      item({ id: "a", priority: 5, tokens: 300 }),
      item({ id: "b", priority: 5, tokens: 300 }),
      item({ id: "c", priority: 5, tokens: 300 }),
    ];
    const first = planBudget(items, 700);
    const second = planBudget(items, 700);
    expect(first.included.map((i) => i.id)).toEqual(second.included.map((i) => i.id));
    expect(first.dropped.map((d) => d.id)).toEqual(second.dropped.map((d) => d.id));
  });

  it("breaks priority ties by original order, not arbitrarily", () => {
    // A budget that shuffled would make the disclosure impossible to trust:
    // the same conversation would report different omissions each time.
    const items = [
      item({ id: "first", priority: 5, tokens: 400 }),
      item({ id: "second", priority: 5, tokens: 400 }),
    ];
    expect(planBudget(items, 500).included.map((i) => i.id)).toEqual(["first"]);
  });
});

describe("token estimates are honest about being estimates", () => {
  it("scales with length", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(400))).toBeGreaterThan(estimateTokens("a".repeat(40)));
  });

  it("never returns zero for non-empty text", () => {
    // A zero-cost item would be included regardless of the budget.
    expect(estimateTokens("x")).toBeGreaterThan(0);
  });

  it("is described as approximate wherever it is shown", () => {
    const plan = planBudget([item({ id: "a" })], 1000);
    expect(plan.summary).toMatch(/about/i);
  });
});
