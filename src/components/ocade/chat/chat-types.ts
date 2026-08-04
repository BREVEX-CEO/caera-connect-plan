/**
 * The shape the OCADE chat surface renders.
 *
 * Deliberately independent of Supabase rows, the demo fixtures and the local
 * engine's own types. The chat shell is used by the signed-in product AND by
 * the public demo; a shell coupled to one of them would either drag database
 * types into a marketing page or force the demo to fake a database.
 */

export type ChatRole = "user" | "assistant" | "system";

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
export type EngineLocality = "local" | "cloud" | "unknown";

export interface EngineStatusView {
  locality: EngineLocality;
  /** "OCADE Local", "OCADE Cloud" — capability names, never model ids. */
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
  onContinue?: (message: ChatMessageView) => void;
  onRetry?: (message: ChatMessageView) => void;
  onBranch?: (message: ChatMessageView) => void;
  onSpeak?: (message: ChatMessageView) => void;
  onSave?: (message: ChatMessageView) => void;
  onDelete?: (message: ChatMessageView) => void;
}
