import { describe, it, expect } from "vitest";
import {
  emptyTree,
  addMessage,
  rewindTo,
  activePath,
  pathTo,
  childrenOf,
  branchPoints,
  deleteSubtree,
  checkpoints,
  stats,
  describeTree,
  type Tree,
} from "../edge/checkpoints";

/**
 * The property under test is that nothing is ever silently lost.
 *
 * Rephrasing a question in a mainstream assistant destroys the branch you were
 * on. Here it must not — and the tests below try every way that could go wrong:
 * rewinding, branching, deleting, and the corrupted-file case where a parent
 * pointer forms a loop.
 */

const at = (n: number) => new Date(Date.UTC(2026, 7, 7, 9, n));

function conversation(): Tree {
  let tree = emptyTree();
  tree = addMessage(tree, { id: "u1", role: "user", content: "how do I sort this?", at: at(0) });
  tree = addMessage(tree, { id: "a1", role: "assistant", content: "Use sort().", at: at(1) });
  return tree;
}

describe("an ordinary conversation is a straight line", () => {
  it("appends in order", () => {
    const tree = conversation();
    expect(activePath(tree).map((n) => n.id)).toEqual(["u1", "a1"]);
  });

  it("reports no branches", () => {
    expect(stats(conversation()).branchPoints).toBe(0);
    expect(describeTree(conversation())).toMatch(/single line/);
  });

  it("says an empty conversation is empty", () => {
    expect(describeTree(emptyTree())).toMatch(/empty/);
    expect(activePath(emptyTree())).toEqual([]);
  });
});

describe("rewinding branches instead of destroying", () => {
  it("keeps the original branch after asking differently", () => {
    /*
     * THE CASE THIS EXISTS FOR. In a mainstream assistant, editing the question
     * discards the answer you already had. Here both survive and can be
     * compared.
     */
    let tree = conversation();
    const rewound = rewindTo(tree, "u1");
    expect(rewound.ok).toBe(true);
    if (!rewound.ok) return;
    tree = addMessage(rewound.tree, {
      id: "a2",
      role: "assistant",
      content: "Use a comparator.",
      at: at(2),
    });

    // The new branch is active...
    expect(activePath(tree).map((n) => n.id)).toEqual(["u1", "a2"]);
    // ...and the old one is still there, intact.
    expect(pathTo(tree, "a1").map((n) => n.id)).toEqual(["u1", "a1"]);
    expect(tree.nodes.has("a1")).toBe(true);
  });

  it("records the fork so it can be shown", () => {
    let tree = conversation();
    const rewound = rewindTo(tree, "u1");
    if (!rewound.ok) return;
    tree = addMessage(rewound.tree, { id: "a2", role: "assistant", content: "b", at: at(2) });

    const points = branchPoints(tree);
    expect(points).toHaveLength(1);
    expect(points[0].node?.id).toBe("u1");
    expect(points[0].branches.map((b) => b.id).sort()).toEqual(["a1", "a2"]);
  });

  it("refuses to rewind to a point that is not in the conversation", () => {
    const result = rewindTo(conversation(), "nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not part of this conversation/i);
  });

  it("does not mutate the tree it was given", () => {
    // A caller holding the previous tree still has it — the whole point of the
    // structure, and the thing an in-place edit would quietly break.
    const before = conversation();
    const snapshot = [...before.nodes.keys()];
    addMessage(before, { id: "x", role: "user", content: "c", at: at(3) });
    expect([...before.nodes.keys()]).toEqual(snapshot);
    expect(before.headId).toBe("a1");
  });

  it("counts versions rather than claiming a single history", () => {
    let tree = conversation();
    const r = rewindTo(tree, "u1");
    if (!r.ok) return;
    tree = addMessage(r.tree, { id: "a2", role: "assistant", content: "b", at: at(2) });
    const text = describeTree(tree);
    expect(text).toMatch(/2 versions/);
    expect(text).toMatch(/Nothing you tried has been discarded/);
  });
});

describe("deleting removes a whole branch, never orphans", () => {
  it("takes the descendants with it", () => {
    /*
     * Removing a node without its subtree leaves children pointing at nothing.
     * They disappear from every path while still occupying the map — the kind
     * of corruption that surfaces months later as a conversation that will not
     * open.
     */
    let tree = conversation();
    tree = addMessage(tree, { id: "u2", role: "user", content: "and reverse?", at: at(2) });
    tree = addMessage(tree, { id: "a3", role: "assistant", content: "reverse()", at: at(3) });

    const { tree: pruned, removed } = deleteSubtree(tree, "u2");
    expect(removed).toBe(2);
    expect(pruned.nodes.has("u2")).toBe(false);
    expect(pruned.nodes.has("a3")).toBe(false);
    // Nothing left points at a missing parent.
    for (const node of pruned.nodes.values()) {
      if (node.parentId) expect(pruned.nodes.has(node.parentId)).toBe(true);
    }
  });

  it("moves the head to the parent rather than nowhere", () => {
    // Dropping the user into an empty conversation because they pruned a
    // branch would lose their place entirely.
    let tree = conversation();
    tree = addMessage(tree, { id: "u2", role: "user", content: "x", at: at(2) });
    const { tree: pruned } = deleteSubtree(tree, "u2");
    expect(pruned.headId).toBe("a1");
  });

  it("leaves the other branch untouched", () => {
    let tree = conversation();
    const r = rewindTo(tree, "u1");
    if (!r.ok) return;
    tree = addMessage(r.tree, { id: "a2", role: "assistant", content: "b", at: at(2) });

    const { tree: pruned } = deleteSubtree(tree, "a2");
    expect(pruned.nodes.has("a1")).toBe(true);
    expect(pathTo(pruned, "a1").map((n) => n.id)).toEqual(["u1", "a1"]);
  });

  it("deleting something absent is a no-op", () => {
    const tree = conversation();
    const { removed, tree: after } = deleteSubtree(tree, "ghost");
    expect(removed).toBe(0);
    expect(after.nodes.size).toBe(tree.nodes.size);
  });
});

describe("a corrupted tree does not hang the tab", () => {
  it("stops on a parent cycle instead of looping forever", () => {
    /*
     * A cycle cannot be produced by this API, but it can arrive in an imported
     * file. Without the guard, `pathTo` spins and the tab locks up with no
     * error — far worse than reporting a broken conversation.
     */
    const nodes = new Map([
      ["a", { id: "a", parentId: "b", role: "user" as const, content: "a", at: "x" }],
      ["b", { id: "b", parentId: "a", role: "user" as const, content: "b", at: "y" }],
    ]);
    const path = pathTo({ nodes, headId: "a" }, "a");
    expect(path.length).toBeLessThanOrEqual(2);
  });

  it("survives a parent that does not exist", () => {
    const nodes = new Map([
      ["a", { id: "a", parentId: "missing", role: "user" as const, content: "a", at: "x" }],
    ]);
    expect(pathTo({ nodes, headId: "a" }, "a").map((n) => n.id)).toEqual(["a"]);
  });
});

describe("checkpoints and shape", () => {
  it("lists only the points the user named", () => {
    let tree = conversation();
    tree = addMessage(tree, {
      id: "u2",
      role: "user",
      content: "now the hard part",
      at: at(2),
      label: "before the refactor",
    });
    expect(checkpoints(tree).map((c) => c.label)).toEqual(["before the refactor"]);
  });

  it("measures depth and endings", () => {
    let tree = conversation();
    const r = rewindTo(tree, "u1");
    if (!r.ok) return;
    tree = addMessage(r.tree, { id: "a2", role: "assistant", content: "b", at: at(2) });
    const s = stats(tree);
    expect(s.messages).toBe(3);
    expect(s.leaves).toBe(2);
    expect(s.depth).toBe(2);
  });

  it("orders siblings deterministically", () => {
    // Otherwise the branch list reshuffles between renders and the user cannot
    // tell which version they were looking at.
    let tree = conversation();
    const r = rewindTo(tree, "u1");
    if (!r.ok) return;
    tree = addMessage(r.tree, { id: "a2", role: "assistant", content: "b", at: at(2) });
    expect(childrenOf(tree, "u1").map((n) => n.id)).toEqual(
      childrenOf(tree, "u1").map((n) => n.id),
    );
    expect(childrenOf(tree, "u1").map((n) => n.id)).toEqual(["a1", "a2"]);
  });
});
