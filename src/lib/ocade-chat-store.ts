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

export type PersistTarget = "vault" | "cloud";

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
  if (input.chatsMode === "private_sync") {
    const rows = (await listMessages({
      data: { conversationId: input.conversationId },
    })) as unknown as ChatMessageRecord[];
    return rows ?? [];
  }

  const adapter = await resolveAdapter(input.userId, "chats");
  const all = await adapter.list<ChatMessageRecord>("chats");
  return all
    .map((r) => r.value)
    .filter((m): m is ChatMessageRecord => Boolean(m) && m.conversation_id === input.conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Remove every vault-stored message for a conversation (privacy control). */
export async function deleteVaultConversation(userId: string, conversationId: string): Promise<number> {
  const adapter = await resolveAdapter(userId, "chats");
  const all = await adapter.list<ChatMessageRecord>("chats");
  const targets = all.filter((r) => r.value?.conversation_id === conversationId);
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
    return "PC Vault storage needs the CAERA Native Companion, which isn't connected.";
  }
  return e instanceof Error ? e.message : "Could not save this message.";
}
