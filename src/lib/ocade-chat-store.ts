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
 */
import { appendOcadeMessage, listMessages } from "./ocade.functions";
import { rememberUnsyncedTurn, unsyncedTurns } from "./chat/unsynced-turns";

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
   * True while this turn exists only in the open tab.
   *
   * Carried on the record so the transcript can mark it without a second
   * lookup, and so nothing can render an unsynchronised turn as a saved one.
   */
  unsynced?: boolean;
}

/**
 * Where a turn ended up.
 *
 * `cloud` is saved; `unsynced` is held in this tab because the account could
 * not be reached. There used to be a third, `not_stored`, for an incognito
 * turn — the mode is gone with the privacy-mode question it answered, and the
 * two remaining states still need different sentences: "it is saved" and "it
 * is not saved yet and closing this tab discards it".
 */
export type PersistTarget = "cloud" | "unsynced";

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
 * Returns `cloud` when the row exists and `unsynced` when it is waiting in this
 * tab's memory. Neither is an error, and the interface must tell them apart.
 */
export async function persistChatMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string | null;
  providerId?: string | null;
  attachments?: ChatAttachmentMeta[];
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
  const remote =
    ((await listMessages({
      data: { conversationId: input.conversationId },
    })) as unknown as ChatMessageRecord[]) ?? [];

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
