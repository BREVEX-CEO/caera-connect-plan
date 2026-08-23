/**
 * Privacy-aware OCADE chat persistence (Plan §18/§30, decision #9 storage).
 *
 * Where a conversation is stored follows the user's `chats` privacy mode:
 *  - browser_only -> the encrypted Browser Vault (IndexedDB, AES-GCM). Nothing
 *    is written to Supabase, so a Browser-Only chat truly stays on this device.
 *  - private_sync -> Supabase (RLS own-row), as before.
 *  - pc_vault     -> the PC Device Vault, which requires the Native Companion;
 *    the adapter throws rather than silently falling back.
 *
 * The vault path pairs with local inference so a Browser-Only + OCADE Local
 * conversation never touches the network at all.
 */
import { resolveAdapter } from "./storage/resolver";
import { StorageLockedError } from "./storage/types";
import { appendOcadeMessage, listMessages } from "./ocade.functions";
import { isConversationKey } from "./chat/local-conversations";

export type ChatsMode = "browser_only" | "pc_vault" | "private_sync";

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
}

/** Vault records are keyed so a conversation's messages can be filtered fast. */
function vaultKey(conversationId: string, createdAt: string, suffix: string): string {
  return `${conversationId}::${createdAt}::${suffix}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Where the message ended up.
 *
 * `pending_sync` is new and is NOT a failure: the message is safely on this
 * device and the upload is queued. A screen that renders it as an error would
 * be telling somebody their message was lost when it was not.
 */
export type PersistTarget = "vault" | "cloud" | "pending_sync";

export interface PersistResult {
  stored: PersistTarget;
  record: ChatMessageRecord;
}

/**
 * Persist one message according to the privacy mode. Throws StorageLockedError
 * (vault locked) and NativeCompanionRequiredError (pc_vault) unchanged so the
 * caller can surface an honest, actionable message.
 */
export async function persistChatMessage(input: {
  userId: string;
  chatsMode: ChatsMode;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string | null;
  providerId?: string | null;
  attachments?: ChatAttachmentMeta[];
}): Promise<PersistResult> {
  const createdAt = new Date().toISOString();
  const record: ChatMessageRecord = {
    id: vaultKey(input.conversationId, createdAt, randomSuffix()),
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    attachments: input.attachments ?? [],
    model_id: input.modelId ?? null,
    provider_id: input.providerId ?? null,
    created_at: createdAt,
  };

  if (input.chatsMode === "private_sync") {
    /*
     * DEVICE FIRST, SERVER SECOND — AND THE ORDER IS THE WHOLE POINT.
     *
     * This used to be `await appendOcadeMessage(...)` and nothing else: a
     * server function, a network round trip, and no copy on the machine the
     * user was typing on. So a message sent with the network down was lost,
     * Chat waited on a round trip before it could show what you typed, and
     * Supabase being briefly unreachable made Chat unusable instead of merely
     * un-synchronised.
     *
     * The vault write below cannot be skipped and cannot be deferred. The
     * upload is owed afterwards, and `syncAdapter.put` is what owes it: it
     * writes locally, queues the obligation, and drains in the background.
     */
    const adapter = await resolveAdapter(input.userId, "chats");
    await adapter.put("chats", record.id, record);

    /*
     * The server function still runs, because `ocade_messages` is a real
     * table with its own schema that Projects, search and export read from —
     * the generic `user_private_records` row the adapter writes is not a
     * substitute for it.
     *
     * Its failure is no longer fatal. The message is already on the device
     * and already queued, so a failed append means "not synchronised yet",
     * and telling the user their message failed when it is safely stored
     * would be the wrong sentence entirely.
     */
    try {
      await appendOcadeMessage({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          modelId: input.modelId ?? null,
          providerId: input.providerId ?? null,
          attachments: input.attachments ?? [],
        },
      });
      return { stored: "cloud", record };
    } catch {
      return { stored: "pending_sync", record };
    }
  }

  // browser_only and pc_vault both go through the storage adapter.
  const adapter = await resolveAdapter(input.userId, "chats");
  await adapter.put("chats", record.id, record);
  return { stored: "vault", record };
}

/**
 * Load a conversation's messages from wherever they live. Vault records are
 * filtered by conversation and ordered by creation time.
 */
export async function loadChatMessages(input: {
  userId: string;
  chatsMode: ChatsMode;
  conversationId: string;
}): Promise<ChatMessageRecord[]> {
  /*
   * THE DEVICE IS READ FIRST, IN EVERY MODE.
   *
   * `private_sync` used to call `listMessages` and nothing else. Writing to
   * the device and then reading back from the server is not local-first: it is
   * a slower way of depending on the server, and it meant opening a
   * synchronised conversation with the connection down returned an empty
   * transcript while the messages sat in the vault a few milliseconds away.
   *
   * Now the vault answers, and the server is asked only to pick up what
   * another device wrote. If that request fails the local answer stands, which
   * is why Chat keeps working when Supabase does not.
   */
  const adapter = await resolveAdapter(input.userId, "chats");
  const stored = await adapter.list<ChatMessageRecord>("chats");
  const local = stored
    .filter((r) => !isConversationKey(r.id))
    .map((r) => r.value)
    .filter(
      (m): m is ChatMessageRecord => Boolean(m) && m.conversation_id === input.conversationId,
    );

  if (input.chatsMode !== "private_sync") {
    return local.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  let remote: ChatMessageRecord[] = [];
  try {
    remote =
      ((await listMessages({
        data: { conversationId: input.conversationId },
      })) as unknown as ChatMessageRecord[]) ?? [];
  } catch {
    // Offline, or Supabase down. The device's own copy is a complete answer
    // for this device; throwing here would empty a conversation being read.
    return local.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return mergeMessages(local, remote);
}

/**
 * Union two views of one conversation without duplicating a turn.
 *
 * Matching is by id first, because ids are generated on the device and are the
 * idempotency key. The content fallback exists for one real case: a message
 * written before this change went to the server, which assigned its own uuid,
 * so the same turn can genuinely carry two different ids. Matching those on
 * role + content + timestamp is imperfect in theory and exact in practice,
 * and the alternative is showing every one of those turns twice forever.
 */
export function mergeMessages(
  local: ChatMessageRecord[],
  remote: ChatMessageRecord[],
): ChatMessageRecord[] {
  const byId = new Map(local.map((m) => [m.id, m]));
  const fingerprint = new Set(local.map((m) => `${m.role}\u0000${m.content}\u0000${m.created_at}`));
  for (const m of remote) {
    if (byId.has(m.id)) continue;
    if (fingerprint.has(`${m.role}\u0000${m.content}\u0000${m.created_at}`)) continue;
    byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Remove every vault-stored message for a conversation (privacy control). */
export async function deleteVaultConversation(
  userId: string,
  conversationId: string,
): Promise<number> {
  const adapter = await resolveAdapter(userId, "chats");
  const all = await adapter.list<ChatMessageRecord>("chats");
  const targets = all.filter(
    (r) => !isConversationKey(r.id) && r.value?.conversation_id === conversationId,
  );
  for (const t of targets) {
    await adapter.delete("chats", t.id);
  }
  return targets.length;
}

/** Human-readable, actionable message for a storage failure. */
export function describeStorageError(e: unknown): string {
  if (e instanceof StorageLockedError) {
    return "Your Browser Vault is locked. Unlock it in Settings → Storage to keep this chat on this device.";
  }
  if (e instanceof Error && e.name === "NativeCompanionRequiredError") {
    return "PC Vault storage needs the OCADE Native Companion, which isn't connected.";
  }
  return e instanceof Error ? e.message : "Could not save this message.";
}
