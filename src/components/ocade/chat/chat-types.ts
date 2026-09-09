/**
 * The shape the OCADE chat surface renders.
 *
 * Deliberately independent of Supabase rows, the demo fixtures and the local
 * engine's own types. The chat shell is used by the signed-in product AND by
 * the public demo; a shell coupled to one of them would either drag database
 * types into a marketing page or force the demo to fake a database.
 */

export type ChatRole = "user" | "assistant" | "system";

export type ChatReaction = "helpful" | "not_helpful";
/**
 * `unsynced` is not a stage of the others: it says the turn exists only in this
 * tab because the account could not be reached, and that closing the tab loses
 * it. It has to be visible on the message itself — a person who can see their
 * words on screen has every reason to assume they are saved.
 */
export type ChatDeliveryState = "sent" | "processing" | "processed" | "unsynced";

export interface ChatAttachmentView {
  kind: "image" | "file";
  name: string;
  mime: string;
  sizeBytes: number;
  /** Present only for images that are still in memory on this device. */
  dataUrl?: string;
}

export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ChatAttachmentView[];
  /** Capability label — never a raw model name in ordinary conversation. */
  engineLabel?: string | null;
  /** Set when this message failed, so the row can offer a real retry. */
  error?: string | null;
  /** True while this message is still arriving. */
  streaming?: boolean;
  /** Local feedback for an OCADE reply. It never contains message content. */
  reaction?: ChatReaction | null;
  /** Truthful lifecycle of a user turn, rather than a simulated human read receipt. */
  deliveryState?: ChatDeliveryState;
  /** True while this turn is held in the open tab and not yet in the account. */
  unsynced?: boolean;
}

export interface ChatConversationView {
  id: string;
  title: string;
  updatedAt: string;
  /** Grouped in the sidebar; a pinned chat sorts above everything. */
  pinned?: boolean;
  projectName?: string | null;
  messageCount?: number;
}

/** Where this reply is coming from, shown as a badge the user can trust. */
export type EngineLocality = "local" | "unknown";

export interface EngineStatusView {
  locality: EngineLocality;
  /** Local capability name or an honest unavailable label; never a model id. */
  label: string;
  /** False shows the offline treatment rather than hiding the badge. */
  online: boolean;
  /** One sentence for the tooltip: why this engine, on this machine. */
  detail?: string | null;
  /** Set while the engine is still being prepared in the background. */
  preparing?: boolean;
}

/**
 * Every action a message row can offer.
 *
 * All optional, and the row renders ONLY what it is given. That is the
 * no-dead-button rule expressed in a type: a surface that cannot regenerate
 * simply omits `onRegenerate`, and no disabled mystery button appears.
 */
export interface MessageActions {
  onCopy?: (message: ChatMessageView) => void;
  onEdit?: (message: ChatMessageView) => void;
  onRegenerate?: (message: ChatMessageView) => void;
  /**
   * Ask the same question again under the SAME pinned conditions and show what
   * changed, keeping the original answer.
   *
   * Distinct from `onRegenerate`, which starts a fresh branch: this one is a
   * reproducibility check, and its whole value is that the answer you already
   * had is still there to compare against.
   */
  onRerun?: (message: ChatMessageView) => void;
  onContinue?: (message: ChatMessageView) => void;
  onRetry?: (message: ChatMessageView) => void;
  onBranch?: (message: ChatMessageView) => void;
  /**
   * PLAN.md §8's SIDE CONVERSATION: one short question about this message,
   * answered beside the thread rather than in it.
   *
   * Deliberately not `onBranch`. A branch takes the conversation in another
   * direction and produces a second conversation carrying a copy of everything
   * before the fork; a side question produces nothing in the sidebar at all and
   * is deleted with the message it hangs off. §8 lists both because they solve
   * opposite problems.
   */
  onAside?: (message: ChatMessageView) => void;
  onSpeak?: (message: ChatMessageView) => void;
  onSave?: (message: ChatMessageView) => void;
  onDelete?: (message: ChatMessageView) => void;
  onReply?: (message: ChatMessageView) => void;
  onReact?: (message: ChatMessageView, reaction: ChatReaction) => void;
}
