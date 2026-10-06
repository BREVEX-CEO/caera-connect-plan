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
 * THE ONE EXCEPTION IS TEMPORARY. A turn written while the database is
 * unreachable waits in `chat/unsynced-turns.ts` (encrypted, surviving a
 * restart), is shown as unsynchronised, and uploads exactly once when the
 * connection returns.
 *
 */
import { appendOcadeMessage, createConversation, listMessages } from "./ocade.functions";
import {
  claimUnsyncedTurn,
  forgetUnsyncedTurn,
  releaseUnsyncedTurn,
  rememberUnsyncedTurn,
  unsyncedTurns,
} from "./chat/unsynced-turns";

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
  /** For `unsynced`: false when only this tab holds it (the device journal refused it). */
  durable?: boolean;
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
  /** Set when the conversation itself was started without a connection. */
  title?: string;
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
    const durable = await rememberUnsyncedTurn({
      clientKey,
      conversationId: input.conversationId,
      title: input.title,
      role: input.role,
      content: input.content,
      modelId: input.modelId ?? null,
      providerId: input.providerId ?? null,
      attachments: input.attachments ?? [],
      createdAt,
    });
    return { stored: "unsynced", durable, record: { ...record, unsynced: true } };
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
    })) as unknown as (ChatMessageRecord & { client_key?: string | null })[]) ?? [];

  // A waiting turn the account already holds (its answer was lost on the way back) is shown
  // once, as saved, and leaves the journal.
  const saved = new Set(remote.map((row) => row.client_key).filter(Boolean));
  const waiting = unsyncedTurns()
    .filter((turn) => turn.conversationId === input.conversationId)
    .filter((turn) => {
      if (!saved.has(turn.clientKey)) return true;
      forgetUnsyncedTurn(turn.clientKey);
      return false;
    })
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

/**
 * UPLOAD EVERYTHING THAT HAS BEEN WAITING. Nothing did this.
 *
 * The buffer had a writer and a reader and no drain, so a turn produced while
 * the database was unreachable stayed in the tab until it was closed. The
 * module's own documentation described a flush and an in-flight guard; the
 * guard was unused and the flush did not exist. Offline work was never
 * synchronised at all.
 *
 * EXACTLY ONCE IS THE SERVER'S GUARANTEE, NOT THIS FUNCTION'S. Every turn
 * carries the `clientKey` it was written with, and `appendOcadeMessage` refuses
 * a second row for the same key. So a reconnect that fires twice, two tabs
 * draining together, and a request that timed out after the server applied it
 * all end with one row. This only avoids the duplicated effort.
 *
 * Oldest first, and a turn is retired only after the write returns — a drain
 * that forgot on failure would lose exactly the work it exists to protect.
 */
export async function flushUnsyncedTurns(): Promise<{ uploaded: number; waiting: number }> {
  let uploaded = 0;
  for (const turn of unsyncedTurns()) {
    if (!claimUnsyncedTurn(turn.clientKey)) continue;
    try {
      // A chat started offline is created first, under the id it already has.
      if (turn.title) {
        await createConversation({ data: { id: turn.conversationId, title: turn.title } });
      }
      await appendOcadeMessage({
        data: {
          conversationId: turn.conversationId,
          role: turn.role,
          content: turn.content,
          modelId: turn.modelId,
          providerId: turn.providerId,
          clientKey: turn.clientKey,
          attachments: turn.attachments,
        },
      });
      forgetUnsyncedTurn(turn.clientKey);
      uploaded += 1;
    } catch {
      // Still unreachable, or this turn cannot be written. It stays, and the
      // next reconnect tries again.
    } finally {
      releaseUnsyncedTurn(turn.clientKey);
    }
  }
  return { uploaded, waiting: unsyncedTurns().length };
}

/** True when a write failed because the account could not be reached. */
export function isUnreachable(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return /network|fetch|offline/i.test(e instanceof Error ? e.message : String(e ?? ""));
}

/** Human-readable, actionable message for a failed write. */
export function describeStorageError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e ?? "");
  if (isUnreachable(e)) {
    return "OCADE could not reach your account. The message is kept on this device and will be saved when the connection returns.";
  }
  return message.trim() || "OCADE could not save this message.";
}
