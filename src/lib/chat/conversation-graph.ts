/**
 * OCADE conversation graph (master plan §4.2: branch, edit-and-resend,
 * regenerate).
 *
 * A chat that supports editing a message, branching, and regenerating is not a
 * list — it's a tree. Model it as a list and the bugs are subtle and bad: an
 * edit silently rewrites history so the old answer's context is lost; a branch
 * leaks messages from the path not taken into the one you're reading.
 *
 * So this is an explicit message tree with parent pointers, and the operations
 * that matter — edit-and-resend, branch, regenerate — create NEW nodes rather
 * than mutating old ones. The rule that keeps it honest:
 *
 *   **The active thread is exactly the path from root to the active leaf, and
 *   nothing else.** No message from a sibling branch ever appears in the thread
 *   you're reading. Editing a message doesn't destroy the original — it forks —
 *   so a branch you navigate back to still shows the words that actually
 *   produced its replies. History is append-only; you move between versions,
 *   you never overwrite one.
 *
 * Pure and in-memory; persistence is a separate concern.
 */

export type Role = "user" | "assistant";

export interface MessageNode {
  id: string;
  parentId: string | null;
  role: Role;
  text: string;
  /** Which of a node's children is currently the active continuation. */
  createdAt: string;
}

export type GraphOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export class ConversationGraph {
  private nodes = new Map<string, MessageNode>();
  private children = new Map<string, string[]>();
  private activeLeaf: string | null = null;
  private counter = 0;

  private nextId(): string {
    return `n${++this.counter}`;
  }

  /** Append a message as a child of the current active leaf and make it active. */
  append(role: Role, text: string, now: Date = new Date()): GraphOutcome<MessageNode> {
    if (!text.trim()) return { ok: false, reason: "A message can't be empty." };

    const parentId = this.activeLeaf;
    // Alternation isn't enforced hard (a system may inject), but a user message
    // following a user message on the same path is almost always a bug worth
    // catching in tests; we allow it but it's visible via the thread.
    const node: MessageNode = {
      id: this.nextId(),
      parentId,
      role,
      text,
      createdAt: now.toISOString(),
    };
    this.nodes.set(node.id, node);
    if (parentId) this.children.set(parentId, [...(this.children.get(parentId) ?? []), node.id]);
    this.activeLeaf = node.id;
    return { ok: true, data: node, evidence: `Appended ${role} message ${node.id}.` };
  }

  /**
   * Edit a user message and resend: forks a NEW child of the edited message's
   * PARENT, rather than changing the original. The original and its replies
   * stay intact on their own branch; the new edit starts a fresh branch that
   * becomes active.
   */
  editAndResend(
    messageId: string,
    newText: string,
    now: Date = new Date(),
  ): GraphOutcome<MessageNode> {
    const original = this.nodes.get(messageId);
    if (!original) return { ok: false, reason: "No such message to edit." };
    if (original.role !== "user") {
      return { ok: false, reason: "Only your own messages can be edited and resent." };
    }
    if (!newText.trim()) return { ok: false, reason: "The edited message can't be empty." };

    const node: MessageNode = {
      id: this.nextId(),
      parentId: original.parentId, // sibling of the original, NOT its replacement
      role: "user",
      text: newText,
      createdAt: now.toISOString(),
    };
    this.nodes.set(node.id, node);
    if (original.parentId) {
      this.children.set(original.parentId, [
        ...(this.children.get(original.parentId) ?? []),
        node.id,
      ]);
    }
    this.activeLeaf = node.id;
    return {
      ok: true,
      data: node,
      evidence: `Edited ${messageId} into a new branch ${node.id}; the original is preserved.`,
    };
  }

  /**
   * Regenerate an assistant reply: a new assistant child of the SAME parent,
   * so the two answers to the same question sit side by side as alternatives.
   */
  regenerate(
    assistantMessageId: string,
    newText: string,
    now: Date = new Date(),
  ): GraphOutcome<MessageNode> {
    const original = this.nodes.get(assistantMessageId);
    if (!original) return { ok: false, reason: "No such message to regenerate." };
    if (original.role !== "assistant") {
      return { ok: false, reason: "Only an assistant reply can be regenerated." };
    }
    if (original.parentId === null) {
      return { ok: false, reason: "This reply has no prompt to regenerate from." };
    }
    const node: MessageNode = {
      id: this.nextId(),
      parentId: original.parentId,
      role: "assistant",
      text: newText,
      createdAt: now.toISOString(),
    };
    this.nodes.set(node.id, node);
    this.children.set(original.parentId, [
      ...(this.children.get(original.parentId) ?? []),
      node.id,
    ]);
    this.activeLeaf = node.id;
    return {
      ok: true,
      data: node,
      evidence: `Regenerated ${assistantMessageId} as alternative ${node.id}.`,
    };
  }

  /** Move the active thread to a specific node (navigating between branches). */
  switchTo(messageId: string): GraphOutcome<MessageNode> {
    const node = this.nodes.get(messageId);
    if (!node) return { ok: false, reason: "No such message." };
    this.activeLeaf = messageId;
    return { ok: true, data: node, evidence: `Active thread now ends at ${messageId}.` };
  }

  /**
   * The active thread: the path from root to the active leaf, and NOTHING else.
   * This is the property the whole model exists to guarantee — no sibling
   * branch ever leaks in.
   */
  activeThread(): MessageNode[] {
    const path: MessageNode[] = [];
    let cursor = this.activeLeaf;
    const guard = new Set<string>();
    while (cursor) {
      if (guard.has(cursor)) break; // defensive against a malformed cycle
      guard.add(cursor);
      const node = this.nodes.get(cursor);
      if (!node) break;
      path.push(node);
      cursor = node.parentId;
    }
    return path.reverse();
  }

  /**
   * Alternatives that share a parent with the given node (its siblings + it).
   *
   * Root-level branches (created by editing the very first message) have no
   * parent to group them, so parent-less nodes are treated as siblings of each
   * other — otherwise editing the opening message would hide the alternative.
   */
  branchesAt(messageId: string): MessageNode[] {
    const node = this.nodes.get(messageId);
    if (!node) return [];
    if (node.parentId === null) {
      return [...this.nodes.values()].filter((n) => n.parentId === null);
    }
    const siblingIds = this.children.get(node.parentId) ?? [];
    return siblingIds.map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  size(): number {
    return this.nodes.size;
  }

  activeLeafId(): string | null {
    return this.activeLeaf;
  }
}
