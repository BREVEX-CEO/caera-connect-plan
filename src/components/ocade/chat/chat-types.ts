/** Shared OCADE chat rendering types. */
export type ChatRole = "user" | "assistant" | "system";

export interface ChatAttachmentView {
  kind: "image" | "file";
  name: string;
  mime: string;
  sizeBytes: number;
  dataUrl?: string;
}

export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: ChatAttachmentView[];
  engineLabel?: string | null;
  error?: string | null;
  streaming?: boolean;
}

export interface ChatConversationView {
  id: string;
  title: string;
  updatedAt: string;
  pinned?: boolean;
  projectName?: string | null;
  messageCount?: number;
}

/**
 * `cloud` remains in this shared presentation type only so historical fixtures
 * and non-production story data compile. The OCADE runtime cannot produce that
 * state: EngineBadge renders every non-local state as unavailable/warning and
 * the engine router has no remote target.
 */
export type EngineLocality = "local" | "cloud" | "unknown";

export interface EngineStatusView {
  locality: EngineLocality;
  label: string;
  online: boolean;
  detail?: string | null;
  preparing?: boolean;
}

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
