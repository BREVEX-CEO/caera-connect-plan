/**
 * Conversation history you can move around in.
 *
 * WHAT EVERY ASSISTANT GETS WRONG HERE. A chat is a tree pretending to be a
 * list. You ask, you get an answer, you rephrase — and the old branch is gone,
 * or buried behind an "edit" that silently discards everything after it. Try to
 * compare two approaches to the same problem and you are reduced to copying
 * text into a scratch file. The interface models a transcript; the work is an
 * exploration.
 *
 * The reason nobody fixes it is not that the idea is hard. It is that a cloud
 * product pays storage and compute for every branch a user keeps, so the
 * incentive is to prune. When the conversation lives on the user's own machine,
 * branches cost the user nothing they did not already own, and the honest data
 * structure becomes affordable.
 *
 * WHAT THIS IS. An append-only set of nodes, each pointing at its parent. Every
 * message is a node; a branch is just two children of one parent. Nothing is
 * ever mutated or deleted, so "go back and try differently" never destroys the
 * path you were on.
 *
 * The invariants worth stating, because they are what make it trustworthy:
 *  - a node's parent always exists and always precedes it
 *  - no node is ever its own ancestor
 *  - deleting is explicit and always removes the whole subtree, never orphans
 */

export interface Node {
  id: string;
  /** Null for the root. */
  parentId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  at: string;
  /** Optional label, for a checkpoint the user named. */
  label?: string;
}

export interface Tree {
  nodes: Map<string, Node>;
  /** Where new messages currently attach. */
  headId: string | null;
}

export function emptyTree(): Tree {
  return { nodes: new Map(), headId: null };
}

/**
 * Add a message at the current head.
 *
 * Returns a NEW tree rather than mutating, so a caller holding the previous one
 * still has it — which is the whole point of the structure and would be
 * undermined by in-place edits.
 */
export function addMessage(
  tree: Tree,
  message: { id: string; role: Node["role"]; content: string; at: Date; label?: string },
): Tree {
  const node: Node = {
    id: message.id,
    parentId: tree.headId,
    role: message.role,
    content: message.content,
    at: message.at.toISOString(),
    label: message.label,
  };
  const nodes = new Map(tree.nodes);
  nodes.set(node.id, node);
  return { nodes, headId: node.id };
}

/** Move the head to an earlier point. New messages branch from there. */
export function rewindTo(
  tree: Tree,
  nodeId: string,
): { ok: true; tree: Tree } | { ok: false; reason: string } {
  if (!tree.nodes.has(nodeId)) {
    return { ok: false, reason: "That point is not part of this conversation." };
  }
  return { ok: true, tree: { nodes: tree.nodes, headId: nodeId } };
}

/**
 * The path from the root to a node, in order.
 *
 * This is what actually gets sent to the engine: one branch of the tree,
 * flattened. Guarded against cycles — a corrupted file with a parent loop would
 * otherwise hang the tab rather than reporting a broken conversation.
 */
export function pathTo(tree: Tree, nodeId: string): Node[] {
  const path: Node[] = [];
  const seen = new Set<string>();
  let current = tree.nodes.get(nodeId) ?? null;
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    path.push(current);
    current = current.parentId ? (tree.nodes.get(current.parentId) ?? null) : null;
  }
  return path.reverse();
}

/** The conversation as it currently stands. */
export function activePath(tree: Tree): Node[] {
  return tree.headId ? pathTo(tree, tree.headId) : [];
}

/** Direct children of a node — more than one means a branch point. */
export function childrenOf(tree: Tree, nodeId: string | null): Node[] {
  return [...tree.nodes.values()]
    .filter((n) => n.parentId === nodeId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/** Every point where the conversation forked. */
export function branchPoints(tree: Tree): Array<{ node: Node | null; branches: Node[] }> {
  const points: Array<{ node: Node | null; branches: Node[] }> = [];
  const parents = new Set<string | null>([null, ...[...tree.nodes.values()].map((n) => n.id)]);
  for (const parentId of parents) {
    const children = childrenOf(tree, parentId);
    if (children.length > 1) {
      points.push({
        node: parentId ? (tree.nodes.get(parentId) ?? null) : null,
        branches: children,
      });
    }
  }
  return points;
}

/**
 * Remove a node and everything descended from it.
 *
 * Deleting a node without its subtree would leave orphans pointing at nothing —
 * they would vanish from every path while still occupying the map, which is the
 * kind of corruption that shows up months later as a conversation that cannot
 * be opened.
 */
export function deleteSubtree(tree: Tree, nodeId: string): { tree: Tree; removed: number } {
  if (!tree.nodes.has(nodeId)) return { tree, removed: 0 };

  const doomed = new Set<string>([nodeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of tree.nodes.values()) {
      if (node.parentId && doomed.has(node.parentId) && !doomed.has(node.id)) {
        doomed.add(node.id);
        grew = true;
      }
    }
  }

  const nodes = new Map([...tree.nodes].filter(([id]) => !doomed.has(id)));

  /*
   * The head may have just been deleted. It moves to the deleted node's parent
   * rather than to null: dropping the user at an empty conversation because
   * they pruned a branch would lose their place entirely.
   */
  let headId = tree.headId;
  if (headId && doomed.has(headId)) {
    const parent = tree.nodes.get(nodeId)?.parentId ?? null;
    headId = parent && nodes.has(parent) ? parent : null;
  }

  return { tree: { nodes, headId }, removed: doomed.size };
}

/** Named checkpoints, for jumping back to a point that mattered. */
export function checkpoints(tree: Tree): Node[] {
  return [...tree.nodes.values()].filter((n) => n.label).sort((a, b) => a.at.localeCompare(b.at));
}

export interface TreeStats {
  messages: number;
  branchPoints: number;
  /** Longest root-to-leaf path. */
  depth: number;
  /** Distinct endings currently in the tree. */
  leaves: number;
}

export function stats(tree: Tree): TreeStats {
  const leaves = [...tree.nodes.values()].filter((n) => childrenOf(tree, n.id).length === 0);
  const depth = leaves.reduce((max, leaf) => Math.max(max, pathTo(tree, leaf.id).length), 0);
  return {
    messages: tree.nodes.size,
    branchPoints: branchPoints(tree).length,
    depth,
    leaves: leaves.length,
  };
}

/** One line for the interface. */
export function describeTree(tree: Tree): string {
  const s = stats(tree);
  if (s.messages === 0) return "This conversation is empty.";
  if (s.branchPoints === 0) {
    return `${s.messages} ${s.messages === 1 ? "message" : "messages"}, in a single line.`;
  }
  return `${s.messages} messages across ${s.leaves} ${
    s.leaves === 1 ? "version" : "versions"
  }, branching at ${s.branchPoints} ${s.branchPoints === 1 ? "point" : "points"}. Nothing you tried has been discarded.`;
}
