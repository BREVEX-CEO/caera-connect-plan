/**
 * Conversations that exist on this device before they exist anywhere else.
 *
 * WHAT WAS WRONG. `createConversation` was a server function: it INSERTed into
 * `ocade_conversations` and returned the row, and the id came back from
 * Postgres. So the id of a conversation could not exist until a round trip
 * succeeded, which means starting a brand-new chat required the network — in
 * every privacy mode, including the two whose entire promise is that they do
 * not need one. And `loadChatMessages` for `private_sync` called `listMessages`
 * and nothing else, so opening an existing synchronised chat offline returned
 * an empty transcript rather than the messages sitting in the vault.
 *
 * Local-first has to hold in BOTH directions or it is not local-first: writing
 * to the device and then reading back from the server is just a slower way of
 * depending on the server.
 *
 * So ids are made here, the record is written here, and the server is told
 * afterwards. Every read prefers this device.
 */
import { resolveAdapter } from "@/lib/storage/resolver";

/** The shape the Chat screen renders. Mirrors the `ocade_conversations` row. */
export interface LocalConversation {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  privacy_mode: string;
  updated_at: string;
  created_at: string;
  project_id?: string | null;
  /** Set when the user deleted it. Kept so the delete can travel. */
  deleted_at?: string | null;
}

/**
 * A time-ordered unique id, generated here.
 *
 * UUIDv7-shaped: 48 bits of millisecond timestamp then randomness. Sorting by
 * id therefore sorts by creation time, which is what lets a merge of two
 * devices' conversations come out in a sensible order without a clock
 * negotiation. `crypto.randomUUID` would have been simpler and sorts randomly.
 *
 * The server column is a uuid, so this must remain a syntactically valid uuid:
 * version nibble 7 and the variant bits are set explicitly rather than left to
 * chance, because an id Postgres rejects would fail only on the sync path,
 * long after the conversation looked fine on the device.
 */
export function newConversationId(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const ts = BigInt(now);
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Conversation metadata lives in the `chats` data class alongside messages,
 * under a key prefix that cannot collide with a message key.
 *
 * Message keys are `${conversationId}::${createdAt}::${suffix}`; this prefix
 * contains no `::` before the id, so the two are separable by inspection and a
 * conversation can never be mistaken for a message when listing.
 */
const CONVERSATION_PREFIX = "conv:";

function keyFor(id: string): string {
  return `${CONVERSATION_PREFIX}${id}`;
}

function isConversationKey(id: string): boolean {
  return id.startsWith(CONVERSATION_PREFIX);
}

/**
 * Create a conversation on this device.
 *
 * Returns immediately with a usable record. Nothing here awaits the network:
 * the server copy is queued and drained in the background, so this works with
 * the connection down and the conversation is real either way.
 */
export async function createConversationLocally(
  userId: string,
  input: {
    title?: string;
    modelId?: string | null;
    privacyMode: string;
    projectId?: string | null;
  },
): Promise<LocalConversation> {
  const now = new Date().toISOString();
  const record: LocalConversation = {
    id: newConversationId(),
    title: input.title ?? "New chat",
    pinned: false,
    archived: false,
    model_id: input.modelId ?? null,
    privacy_mode: input.privacyMode,
    updated_at: now,
    created_at: now,
    project_id: input.projectId ?? null,
    deleted_at: null,
  };

  const adapter = await resolveAdapter(userId, "chats");
  await adapter.put("chats", keyFor(record.id), record);

  // Private Sync queues inside its adapter. Browser Only never does. Keeping
  // that distinction at the storage boundary prevents callers from uploading a
  // Browser Only record because a conversation field was stale.
  return record;
}

/** Every conversation this device knows about, newest first, deletes hidden. */
export async function listConversationsLocally(userId: string): Promise<LocalConversation[]> {
  const adapter = await resolveAdapter(userId, "chats");
  const rows = await adapter.list<LocalConversation>("chats");
  return rows
    .filter((r) => isConversationKey(r.id))
    .map((r) => r.value)
    .filter((c): c is LocalConversation => Boolean(c?.id) && !c.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getConversationLocally(
  userId: string,
  id: string,
): Promise<LocalConversation | null> {
  const adapter = await resolveAdapter(userId, "chats");
  const row = await adapter.get<LocalConversation>("chats", keyFor(id));
  return row?.value ?? null;
}

/**
 * Change a conversation on this device — rename, pin, archive, project, model.
 *
 * Reads, merges and writes rather than taking a whole record, so a caller
 * changing one field cannot blank the others by omission.
 */
export async function updateConversationLocally(
  userId: string,
  id: string,
  patch: Partial<Omit<LocalConversation, "id" | "created_at">>,
): Promise<LocalConversation | null> {
  const existing = await getConversationLocally(userId, id);
  if (!existing) return null;
  const next: LocalConversation = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const adapter = await resolveAdapter(userId, "chats");
  await adapter.put("chats", keyFor(id), next);
  return next;
}

/**
 * Delete as a TOMBSTONE, not a removal.
 *
 * A row simply removed from this device comes back on the next merge from a
 * device that was offline when the delete happened — the classic "I deleted
 * that yesterday" bug. Keeping a marker with `deleted_at` means the deletion
 * is a fact that travels, and `mergeRemoteConversations` below refuses to
 * resurrect anything carrying one.
 */
export async function deleteConversationLocally(userId: string, id: string): Promise<void> {
  const existing = await getConversationLocally(userId, id);
  if (!existing) return;
  const tombstone: LocalConversation = {
    ...existing,
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const adapter = await resolveAdapter(userId, "chats");
  await adapter.put("chats", keyFor(id), tombstone);
}

/**
 * Fold conversations from another device into this one.
 *
 * The rules, in order, and each exists because of a specific way this goes
 * wrong:
 *
 *  - A local tombstone always wins. Otherwise a second device that never saw
 *    the delete keeps handing the row back and it reappears forever.
 *  - Otherwise the newer `updated_at` wins. Both sides are the same user's
 *    edits to the same immutable-id record, so last-write-wins is right here
 *    and a merge dialog would be theatre.
 *  - An unseen remote row is added. That is the whole point of syncing.
 *
 * Pure, so every branch is testable without a database.
 */
export function mergeRemoteConversations(
  local: LocalConversation[],
  remote: LocalConversation[],
): LocalConversation[] {
  const byId = new Map(local.map((c) => [c.id, c]));
  for (const incoming of remote) {
    const mine = byId.get(incoming.id);
    if (!mine) {
      byId.set(incoming.id, incoming);
      continue;
    }
    if (mine.deleted_at) continue;
    if (incoming.deleted_at) {
      byId.set(incoming.id, incoming);
      continue;
    }
    if (incoming.updated_at > mine.updated_at) byId.set(incoming.id, incoming);
  }
  return [...byId.values()]
    .filter((c) => !c.deleted_at)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Exported for the message store, which must skip conversation rows. */
export { isConversationKey, keyFor as conversationKey };

/**
 * DELETE EVERY CONVERSATION ON THIS DEVICE — PLAN.md §8's "delete-all".
 *
 * TOMBSTONES, NOT REMOVALS, for exactly the reason one delete uses them: a row
 * simply removed comes back on the next merge from a device that was offline
 * when the delete happened. Deleting everything is the case where that matters
 * most — somebody clearing their history and watching it reappear on their
 * laptop has been told a lie by the product.
 *
 * ALREADY-DELETED ROWS ARE SKIPPED rather than re-stamped. Re-tombstoning a
 * conversation deleted last week would move its `updated_at` forward and make
 * a week-old deletion look like it happened just now in every audit and every
 * merge.
 *
 * Returns what it actually did, so the screen can say a number rather than
 * "done": somebody who presses this needs to know whether it found anything.
 */
export async function deleteAllConversationsLocally(userId: string): Promise<number> {
  const adapter = await resolveAdapter(userId, "chats");
  const rows = await adapter.list<LocalConversation>("chats");
  const now = new Date().toISOString();

  let deleted = 0;
  for (const row of rows) {
    if (!isConversationKey(row.id)) continue;
    const conversation = row.value;
    if (!conversation || conversation.deleted_at) continue;
    await adapter.put("chats", row.id, {
      ...conversation,
      deleted_at: now,
      updated_at: now,
    });
    deleted += 1;
  }
  return deleted;
}
