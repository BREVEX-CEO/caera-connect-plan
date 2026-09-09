/**
 * The shapes Chat works in, and the small pure helpers that go with them.
 *
 * SPLIT OUT OF THE ROUTE, which had grown past six thousand lines with the
 * conversation row type, the composer's file limits, the mode list a person
 * picks from and a speech-recognition interface all declared between two
 * screens' worth of JSX. `PLAN.md` Phase 1 names that file specifically.
 *
 * Everything here is data or a pure function: no state, no effects, nothing
 * that reads the network. That is what lets the route, the composer, the
 * sidebar and the dialogs share one definition of a conversation instead of
 * each keeping a nearly-identical local copy — which is how the same field
 * ends up optional in one place and required in another.
 */
import { capabilityLabelFor } from "@/lib/ocade-capability-labels";
import { getOcadeModel } from "@/lib/ocade-models";
import type { ExtractResult } from "@/lib/ocade-documents";
import type { ChatMessageView } from "./chat-types";

/**
 * What a person chooses, in their words.
 *
 * Not model names, not runtimes, not "automatic". Two of these are the same
 * question anybody actually has — sooner or better — and the third is a
 * different promise: nothing leaves this device, including a web lookup.
 */
export const MODES: { id: "fast" | "thinking" | "local"; label: string; hint: string }[] = [
  { id: "fast", label: "Fast", hint: "Answers as quickly as this device can." },
  {
    id: "thinking",
    label: "Thinking",
    hint: "Takes longer and reasons before answering. Better for hard questions.",
  },
  {
    id: "local",
    label: "Local Intelligence",
    hint: "Stays entirely on this device. No lookups, no sync — nothing leaves.",
  },
];

export type Attachment = {
  kind: "image" | "file";
  name: string;
  mime: string;
  sizeBytes: number;
  dataUrl?: string;
  /** Text extracted on-device for readable documents (never uploaded raw). */
  extractedText?: string;
  /** Honest note when a file could not be read (e.g. needs the document pack). */
  extractNote?: string;
  /**
   * The full extraction result, kept so citations can point at a real position.
   * Without it the source locator is empty and a citation can only name the
   * file, never the page, sheet or line it came from.
   */
  extract?: ExtractResult;
};

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  privacy_mode: string;
  updated_at: string;
  project_id?: string | null;
  /**
   * PLAN.md §8's incognito conversation.
   *
   * Never loaded from anywhere, because nothing about an incognito
   * conversation is ever written — storing "this was incognito" would itself
   * be a record of it having happened. It exists in this component's state and
   * ends with the tab, which is also the honest behaviour: there is nothing to
   * come back to.
   */
  incognito?: boolean;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: Attachment[];
  model_id: string | null;
  created_at: string;
};

/**
 * Adapt a stored row to what the shared chat components render.
 *
 * Kept as a function rather than changing the row type: the row is what the
 * database and the vault hand back, and reshaping those to suit a component
 * would put presentation concerns into storage.
 */
export function toMessageView(message: Message): ChatMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
    attachments: message.attachments?.map((a) => ({
      kind: a.kind,
      name: a.name,
      mime: a.mime,
      sizeBytes: a.sizeBytes,
      dataUrl: a.dataUrl,
    })),
    engineLabel: message.model_id
      ? capabilityLabelFor({ locality: getOcadeModel(message.model_id).locality })
      : null,
  };
}

export type PermissionMode = "manual" | "assisted" | "autonomous";
export type PendingChatMessage = {
  id: string;
  conversationId: string;
  text: string;
  attachments: Attachment[];
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export function readChatError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
  } catch {
    // Plain-text gateway and infrastructure errors remain valid user-facing
    // evidence; JSON parsing is only an optional improvement.
  }
  return body.trim() || `Chat request failed (HTTP ${status}).`;
}

export function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

/** One alternative transcription of a recognised phrase. */
export type SpeechAlternativeLike = { transcript: string };

/**
 * A recognition result. `isFinal` distinguishes a settled phrase from an
 * in-progress guess, which is what drives live captions.
 */
export type SpeechResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechAlternativeLike;
};

export type SpeechResultListLike = {
  readonly length: number;
  [index: number]: SpeechResultLike;
};

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  /** BCP-47 language tag requested from the browser recognition engine. */
  lang: string;
  /** Experimental Web Speech flag; required for the continuous wake listener. */
  processLocally?: boolean;
  onresult: (ev: { results: SpeechResultListLike }) => void;
  onend: () => void;
  onerror: (ev: unknown) => void;
  start: () => void;
  stop: () => void;
};
