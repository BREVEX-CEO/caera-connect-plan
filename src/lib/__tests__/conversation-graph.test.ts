import { describe, it, expect } from "vitest";
import { ConversationGraph } from "../chat/conversation-graph";

function seed() {
  // A simple exchange: user → assistant → user → assistant.
  const g = new ConversationGraph();
  g.append("user", "What is 2+2?");
  g.append("assistant", "4.");
  g.append("user", "And 3+3?");
  g.append("assistant", "6.");
  return g;
}

describe("the active thread is the path, and only the path", () => {
  it("returns messages root-to-leaf in order", () => {
    const g = seed();
    expect(g.activeThread().map((m) => m.text)).toEqual(["What is 2+2?", "4.", "And 3+3?", "6."]);
  });

  it("appends as children of the active leaf", () => {
    const g = seed();
    expect(g.size()).toBe(4);
    expect(g.activeThread()).toHaveLength(4);
  });
});

/**
 * Editing must fork, not overwrite. The original branch and its replies stay
 * intact and reachable.
 */
describe("edit-and-resend forks rather than overwriting", () => {
  it("creates a sibling branch and makes it active", () => {
    const g = seed();
    const thread = g.activeThread();
    const firstUser = thread[0]; // "What is 2+2?"

    const edited = g.editAndResend(firstUser.id, "What is 10+10?");
    if (!edited.ok) throw new Error("unreachable");

    // The active thread now starts from the edit and drops the old continuation.
    const active = g.activeThread().map((m) => m.text);
    expect(active).toEqual(["What is 10+10?"]);
    // The original is preserved: switching back restores its whole thread.
    g.switchTo(thread[3].id); // the old final assistant "6."
    expect(g.activeThread().map((m) => m.text)).toEqual(["What is 2+2?", "4.", "And 3+3?", "6."]);
  });

  it("shows both versions as branches at that point", () => {
    const g = seed();
    const firstUser = g.activeThread()[0];
    g.editAndResend(firstUser.id, "What is 10+10?");
    const branches = g
      .branchesAt(firstUser.id)
      .map((m) => m.text)
      .sort();
    expect(branches).toEqual(["What is 10+10?", "What is 2+2?"]);
  });

  it("refuses to edit an assistant message", () => {
    const g = seed();
    const assistant = g.activeThread()[1];
    expect(g.editAndResend(assistant.id, "nope").ok).toBe(false);
  });

  it("refuses an empty edit", () => {
    const g = seed();
    const firstUser = g.activeThread()[0];
    expect(g.editAndResend(firstUser.id, "  ").ok).toBe(false);
  });
});

/**
 * Regenerate produces an alternative answer to the SAME prompt — the two sit
 * side by side, neither destroys the other.
 */
describe("regenerate creates a sibling answer", () => {
  it("adds an alternative reply under the same prompt", () => {
    const g = seed();
    const lastAssistant = g.activeThread()[3]; // "6."
    const regen = g.regenerate(lastAssistant.id, "Six.");
    if (!regen.ok) throw new Error("unreachable");

    // Active thread now ends with the new answer.
    expect(g.activeThread().map((m) => m.text)).toEqual(["What is 2+2?", "4.", "And 3+3?", "Six."]);
    // Both answers are siblings at that point.
    const answers = g
      .branchesAt(lastAssistant.id)
      .map((m) => m.text)
      .sort();
    expect(answers).toEqual(["6.", "Six."]);
  });

  it("refuses to regenerate a user message", () => {
    const g = seed();
    const user = g.activeThread()[0];
    expect(g.regenerate(user.id, "x").ok).toBe(false);
  });
});

/**
 * The leak the tree model exists to prevent: a message from a branch not taken
 * must never appear in the thread you're reading.
 */
describe("branches never leak into each other", () => {
  it("keeps the two branches' messages separate", () => {
    const g = seed();
    const firstUser = g.activeThread()[0];

    // Branch A already exists ("What is 2+2?" → "4." → "And 3+3?" → "6.").
    // Create branch B by editing the first question.
    g.editAndResend(firstUser.id, "What is the capital of France?");
    g.append("assistant", "Paris.");

    const branchB = g.activeThread().map((m) => m.text);
    expect(branchB).toEqual(["What is the capital of France?", "Paris."]);
    // None of branch A's messages leaked in.
    expect(branchB).not.toContain("4.");
    expect(branchB).not.toContain("And 3+3?");
  });

  it("navigating back to a leaf reconstructs exactly that branch", () => {
    const g = seed();
    const oldLeaf = g.activeLeafId()!;
    const firstUser = g.activeThread()[0];
    g.editAndResend(firstUser.id, "Different question?");
    g.append("assistant", "Different answer.");

    g.switchTo(oldLeaf);
    expect(g.activeThread().map((m) => m.text)).toEqual(["What is 2+2?", "4.", "And 3+3?", "6."]);
  });
});

describe("guards", () => {
  it("refuses an empty append", () => {
    expect(new ConversationGraph().append("user", "  ").ok).toBe(false);
  });

  it("refuses to switch to a nonexistent node", () => {
    expect(seed().switchTo("nope").ok).toBe(false);
  });
});
