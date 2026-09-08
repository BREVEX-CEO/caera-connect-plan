/**
 * SHARING A CONVERSATION — PLAN.md §8 ("share") and §7's Share/export control.
 *
 * The client half of `20260905090000_conversation_share_links.sql`. Everything
 * that DECIDES anything lives in the database: what the snapshot contains, who
 * may take one, whether a link still works. This module carries the link
 * format, the refusal vocabulary and one pure function for the sentence a
 * person is shown — three things a screen would otherwise each invent for
 * itself.
 *
 * WHY THE REFUSALS ARE A CLOSED SET. The share function raises with a
 * machine-readable `DETAIL`, which PostgREST surfaces as `error.details`, and
 * the interface has to pick a DIFFERENT recovery for each: a device-only
 * conversation needs its storage changed, an empty one needs a message in it,
 * and one that is not yours needs nothing at all because you should not have
 * been offered the control. Matching on the message text would tie the product
 * to prose that will be reworded.
 */

import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

/** How a share link is written, everywhere it is written. */
export const SHARE_PATH = "/share";

/**
 * The full link, from an origin and a token.
 *
 * Named rather than interpolated at each call site because a share link that
 * differs between the copy button, the dialog and the toast is three chances to
 * hand somebody a URL that does not open.
 */
export function shareLinkFor(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${SHARE_PATH}/${token}`;
}

/** A token as the database issues it: 24 random bytes, hex. */
export function isShareToken(value: string): boolean {
  return /^[0-9a-f]{48}$/.test(value);
}

export type ShareRefusal =
  | "authentication_required"
  | "not_found_or_forbidden"
  | "conversation_not_synchronised"
  | "conversation_empty"
  | "expiry_in_past"
  | "unknown";

/** What the person is told, and what they can do about it. */
export const SHARE_REFUSAL_MESSAGE: Record<ShareRefusal, string> = {
  authentication_required: "Sign in to share a conversation.",
  not_found_or_forbidden: "That conversation is not available to share.",
  conversation_not_synchronised:
    "This conversation is stored only on your device, so there is nothing on the server to share. Change its storage to Private Sync in Settings → Storage first.",
  conversation_empty: "There is nothing in this conversation to share yet.",
  expiry_in_past: "Choose an expiry in the future.",
  unknown: "That conversation could not be shared. Try again.",
};

/**
 * Classify a PostgREST error by its `details`, never by its message.
 *
 * An unrecognised detail becomes `unknown` rather than being passed through:
 * showing a raw database string to a person is how internal names, column
 * names and occasionally row contents end up on screen.
 */
export function shareRefusalOf(error: unknown): ShareRefusal {
  const details = (error as { details?: unknown } | null)?.details;
  if (typeof details !== "string") return "unknown";
  return details in SHARE_REFUSAL_MESSAGE ? (details as ShareRefusal) : "unknown";
}

export interface SharedConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  /**
   * How many files were attached to this turn — not which.
   *
   * "Share this conversation" is not consent to publish the documents read
   * during it, and a file name alone can disclose more than the conversation
   * does. The reader is told a document was there.
   */
  attachment_count: number;
}

export interface SharedConversation {
  title: string;
  messages: SharedConversationMessage[];
  messageCount: number;
  /** When the snapshot was taken — the honest answer to "how current is this". */
  snapshotAt: string;
}

export type ShareOutcome<T> = { ok: true; value: T } | { ok: false; refusal: ShareRefusal };

/**
 * Share a conversation, or refresh the snapshot of one already shared.
 *
 * Returns the token. The same conversation keeps the same token across a
 * refresh, so a link already sent does not stop working because its owner
 * updated what it shows.
 */
export async function shareConversation(input: {
  conversationId: string;
  expiresAt?: string | null;
}): Promise<ShareOutcome<string>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_share_conversation", {
      p_conversation_id: input.conversationId,
      p_expires_at: input.expiresAt ?? null,
    });
    if (error) return { ok: false, refusal: shareRefusalOf(error) };
    return { ok: true, value: String(data) };
  } catch (cause) {
    return { ok: false, refusal: shareRefusalOf(cause) };
  }
}

/**
 * Stop sharing a conversation.
 *
 * Returns how many links stopped working, so the interface can say "it was
 * already not shared" instead of claiming to have revoked something.
 */
export async function revokeConversationShare(
  conversationId: string,
): Promise<ShareOutcome<number>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_revoke_conversation_share", {
      p_conversation_id: conversationId,
    });
    if (error) return { ok: false, refusal: shareRefusalOf(error) };
    return { ok: true, value: Number(data ?? 0) };
  } catch (cause) {
    return { ok: false, refusal: shareRefusalOf(cause) };
  }
}

/**
 * The live link for a conversation, if it has one.
 *
 * Read from the table under the owner's own row-level security rather than
 * through a function: this one genuinely is "my own rows", and it is what lets
 * the Share control open showing the existing link instead of silently minting
 * a second snapshot the moment somebody opens the dialog to check.
 */
export async function currentShareToken(conversationId: string): Promise<string | null> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_conversation_shares")
      .select("token, expires_at")
      .eq("conversation_id", conversationId)
      .is("revoked_at", null)
      .maybeSingle();
    if (error || !data) return null;
    const expiry = (data as { expires_at: string | null }).expires_at;
    // An expired link is not a live one. The reader already refuses it; showing
    // it here would present a dead URL as the conversation's share link.
    if (expiry && Date.parse(expiry) <= Date.now()) return null;
    return (data as { token: string }).token;
  } catch {
    return null;
  }
}

/**
 * Read a shared conversation by its link.
 *
 * `null` covers unknown, revoked and expired identically, because the database
 * answers all three the same way: a distinguishable "this was revoked" would
 * confirm the link had once been real.
 */
export async function readSharedConversation(token: string): Promise<SharedConversation | null> {
  if (!isShareToken(token)) return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.rpc("ocade_read_shared_conversation", {
    p_token: token,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const record = row as {
    title: string;
    messages: SharedConversationMessage[] | null;
    message_count: number;
    snapshot_at: string;
  };
  return {
    title: record.title,
    messages: record.messages ?? [],
    messageCount: Number(record.message_count ?? 0),
    snapshotAt: record.snapshot_at,
  };
}

/**
 * What the share dialog says about how current the link is.
 *
 * Pure, and separate from the component, because it is the sentence that stops
 * somebody assuming a share is live. Somebody who believes the link updates
 * itself will keep talking in a shared conversation; somebody who believes it
 * is frozen when it is not will share more than they meant to. Only one of
 * those is true, and it is this one.
 */
export function describeSnapshot(input: {
  messageCount: number;
  snapshotAt: string;
  currentMessageCount: number;
}): string {
  const turns = input.messageCount === 1 ? "1 message" : `${input.messageCount} messages`;
  const behind = input.currentMessageCount - input.messageCount;
  if (behind <= 0) {
    return `Anyone with the link can read the ${turns} in this conversation. It does not update by itself.`;
  }
  const since = behind === 1 ? "1 message" : `${behind} messages`;
  return `Anyone with the link can read the ${turns} this conversation held when you shared it. ${since} since then ${behind === 1 ? "is" : "are"} not on the link. Update it to include ${behind === 1 ? "it" : "them"}.`;
}
