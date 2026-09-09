/**
 * WHERE A CHAT MESSAGE GOES: SUPABASE, AND NOWHERE ELSE.
 *
 * `PLAN.md` Phase 2 removed the storage-mode question this file used to
 * answer. It routed every message by the account's `chats` privacy setting —
 * an encrypted IndexedDB vault for Browser Only, an OS store for PC Vault, and
 * Supabase for Private Sync — and for Private Sync it wrote to BOTH, treating
 * the device as the authority and the database as a synchronisation target.
 *
 * Three copies of a conversation is three answers to "what did I say", and the
 * product had no rule for which one won. Reading merged them by id with a
 * content fingerprint as a fallback, which is a way of hiding the question
 * rather than answering it. One authority answers it: the row in
 * `ocade_messages`, protected by row-level security, readable from every
 * device the person signs in on, and removed for good when they delete it.
 *
 * THE ONE EXCEPTION IS RAM, AND IT IS TEMPORARY. A turn generated on the
 * device while the database is unreachable waits in `chat/unsynced-turns.ts`
 * — in this tab's memory, never on disk — is shown as unsynchronised, warns
 * before it is lost, and uploads exactly once when the connection returns.
 *
 * INCOGNITO WRITES NOTHING AT ALL, and that is decided here rather than at the
 * call sites. A privacy guarantee spread across nine `if`s holds until somebody
 * adds a tenth.
 */
import { appendOcadeMessage, listMessages } from "./ocade.functions";
import { mayPersist, type IncognitoAwarePersistTarget } from "./chat/incognito";
import { rememberUnsyncedTurn, unsyncedTurns } from "./chat/unsynced-turns";
import { citationsFrom, type Citation } from "./ocade-citations";
import type { ChatReaction } from "@/components/ocade/chat/chat-types";

export interface ChatAttachmentMeta {
  kind: "image" | "file";
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ChatAttachmentMeta[];
  model_id: string | null;
  provider_id?: string | null;
  created_at: string;
  /**
   * The evidence recorded for this answer, and the reader's own feedback on it.
   *
   * Both are carried on the message rather than looked up separately: they used
   * to live in the browser with their own copies of the conversation and
   * message ids, and a deleted conversation left them behind.
   */
  citations?: Citation[] | null;
  reaction?: ChatReaction | null;
  /**
   * True while this turn exists only in the open tab.
   *
   * Carried on the record so the transcript can mark it without a second
   * lookup, and so nothing can render an unsynchronised turn as a saved one.
   */
  unsynced?: boolean;
}

export type PersistTarget = IncognitoAwarePersistTarget;

export interface PersistResult {
  stored: PersistTarget;
  record: ChatMessageRecord;
}

/**
 * A key the device chooses before the message is sent.
 *
 * It has to be generated here rather than by the database, because it is what
 * makes a retry recognisable — a key the server assigns is only known after
 * the write that a retry is trying not to repeat.
 */
function newClientKey(): string {
  const random = globalThis.crypto;
  if (random && "randomUUID" in random) return `turn-${random.randomUUID()}`;
  return `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Persist one message.
 *
 * Returns `not_stored` for an incognito turn, `cloud` when the row exists, and
 * `unsynced` when it is waiting in memory. None of the three is an error and
 * the interface must tell them apart: "we deliberately kept nothing", "it is
 * saved", and "it is not saved yet and you will lose it if you close this tab"
 * need three different sentences.
 */
export async function persistChatMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string | null;
  providerId?: string | null;
  attachments?: ChatAttachmentMeta[];
  incognito?: boolean;
}): Promise<PersistResult> {
  const createdAt = new Date().toISOString();
  const clientKey = newClientKey();
  const record: ChatMessageRecord = {
    id: clientKey,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    attachments: input.attachments ?? [],
    model_id: input.modelId ?? null,
    provider_id: input.providerId ?? null,
    created_at: createdAt,
  };

  if (!mayPersist(Boolean(input.incognito))) {
    /*
     * Returned, not written. The record is still built and handed back because
     * the screen renders from it — the message is real, it is on screen, and it
     * is nowhere else.
     */
    return { stored: "not_stored", record };
  }

  try {
    const row = (await appendOcadeMessage({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        modelId: input.modelId ?? null,
        providerId: input.providerId ?? null,
        clientKey,
        attachments: input.attachments ?? [],
      },
    })) as unknown as Partial<ChatMessageRecord> | null;
    return {
      stored: "cloud",
      // The server's id and timestamp win: they are what every other device
      // will see, and a screen showing the local ones would disagree with the
      // conversation as soon as it was reloaded.
      record: { ...record, ...(row ?? {}), conversation_id: input.conversationId },
    };
  } catch {
    rememberUnsyncedTurn({
      clientKey,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      modelId: input.modelId ?? null,
      providerId: input.providerId ?? null,
      attachments: input.attachments ?? [],
      createdAt,
    });
    return { stored: "unsynced", record: { ...record, unsynced: true } };
  }
}

/**
 * Read a conversation.
 *
 * The database answers, and anything still waiting in this tab is appended so
 * the transcript a person is looking at is complete. Waiting turns are marked,
 * so "shown" never quietly means "saved".
 */
export async function loadChatMessages(input: {
  conversationId: string;
}): Promise<ChatMessageRecord[]> {
  /*
   * Narrowed on the way out. `citations` is a `jsonb` column and `reaction` is
   * text, so both hold whatever was written to them — including a shape an
   * older version of OCADE wrote. A malformed citation is dropped rather than
   * rendered as a card with no source, and an unrecognised reaction reads as no
   * feedback rather than as a control the interface cannot show.
   */
  const rows =
    ((await listMessages({
      data: { conversationId: input.conversationId },
    })) as unknown as Array<
      Omit<ChatMessageRecord, "citations" | "reaction"> & {
        citations?: unknown;
        reaction?: unknown;
      }
    >) ?? [];
  const remote: ChatMessageRecord[] = rows.map((row) => ({
    ...row,
    citations: row.citations ? citationsFrom(row.citations) : null,
    reaction: row.reaction === "helpful" || row.reaction === "not_helpful" ? row.reaction : null,
  }));

  const waiting = unsyncedTurns()
    .filter((turn) => turn.conversationId === input.conversationId)
    .map((turn): ChatMessageRecord => ({
      id: turn.clientKey,
      conversation_id: turn.conversationId,
      role: turn.role,
      content: turn.content,
      attachments: turn.attachments,
      model_id: turn.modelId,
      provider_id: turn.providerId,
      created_at: turn.createdAt,
      unsynced: true,
    }));

  return [...remote, ...waiting].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Human-readable, actionable message for a failed write. */
export function describeStorageError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e ?? "");
  if (/network|fetch|offline|failed to fetch/i.test(message)) {
    return "OCADE could not reach your account. The message is being held in this tab and will be saved when the connection returns — closing the tab discards it.";
  }
  return message.trim() || "OCADE could not save this message.";
}
