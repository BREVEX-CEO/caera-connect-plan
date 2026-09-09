/**
 * TURNS THAT EXIST ONLY IN THIS TAB, AND ONLY UNTIL THE DATABASE ANSWERS.
 *
 * `PLAN.md` Phase 2 makes Supabase the single persistent authority for chat.
 * That leaves one honest exception: a turn produced by on-device generation
 * while the database is unreachable. Refusing to answer at all would be worse
 * — the engine is right there, on the user's own machine — and writing the
 * turn to IndexedDB would recreate the second content authority the phase
 * exists to remove.
 *
 * So it waits HERE, in module memory, and the consequences are stated to the
 * user rather than hidden: the turn is marked unsynchronised, closing or
 * reloading the tab warns first, and signing out warns first. Nothing in this
 * file touches `localStorage`, IndexedDB, OPFS or Cache Storage, and
 * `scripts/check-content-storage.mjs` fails the build if it ever does.
 *
 * EXACTLY ONCE, WHICHEVER WAY THE FLUSH GOES WRONG. Each turn carries a
 * `clientKey` chosen when it was written; `appendOcadeMessage` refuses a
 * second row for the same key and hands back the first. So a request that
 * timed out after the server applied it, a reconnect that fires twice, and two
 * tabs draining at the same moment all end with one row. The in-flight guard
 * below is an optimisation on top of that, not the correctness argument.
 *
 * WHY A MODULE SINGLETON RATHER THAN REACT STATE. The buffer must outlive the
 * Chat route: somebody who writes a turn offline and navigates to Settings has
 * not abandoned it, and a warning that only appears while Chat is mounted is a
 * warning that fires when it is least needed.
 */

import type { ChatAttachmentMeta } from "@/lib/ocade-chat-store";

export interface UnsyncedTurn {
  /** Idempotency key. Also this buffer's map key. */
  clientKey: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;
  providerId: string | null;
  attachments: ChatAttachmentMeta[];
  /** When the turn happened, not when it was uploaded. */
  createdAt: string;
}

const buffer = new Map<string, UnsyncedTurn>();
const listeners = new Set<() => void>();
/** Keys currently being uploaded, so one drain does not start on top of another. */
const inFlight = new Set<string>();

function announce(): void {
  for (const listener of listeners) listener();
}

/** Hold a turn the database could not be told about yet. */
export function rememberUnsyncedTurn(turn: UnsyncedTurn): void {
  buffer.set(turn.clientKey, turn);
  announce();
}

/** Every waiting turn, oldest first, so a flush replays them in order. */
export function unsyncedTurns(): UnsyncedTurn[] {
  return [...buffer.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function unsyncedCount(): number {
  return buffer.size;
}

/** Forget one turn. Called when it is uploaded, or when its conversation goes. */
export function forgetUnsyncedTurn(clientKey: string): void {
  if (buffer.delete(clientKey)) announce();
}

/**
 * Drop every waiting turn for one conversation.
 *
 * Deleting a conversation must not leave its turns queued for upload into a
 * conversation that no longer exists — the flush would fail forever and the
 * warning would never clear.
 */
export function forgetConversationTurns(conversationId: string): void {
  let changed = false;
  for (const [key, turn] of buffer) {
    if (turn.conversationId !== conversationId) continue;
    buffer.delete(key);
    changed = true;
  }
  if (changed) announce();
}

/** Discard everything. Sign-out, after the user has been warned. */
export function forgetAllUnsyncedTurns(): void {
  if (buffer.size === 0) return;
  buffer.clear();
  announce();
}

/** Watch the count, for the badge and the close warning. */
export function subscribeUnsynced(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface FlushResult {
  uploaded: number;
  /** Still waiting: the database is still unreachable, or refused them. */
  remaining: number;
}

/**
 * Upload everything waiting.
 *
 * The uploader is injected rather than imported so this module stays free of
 * the server-function graph, which is what lets it be tested without a network
 * and imported from anywhere.
 *
 * STOPS AT THE FIRST FAILURE, on purpose. The overwhelming cause of a failure
 * here is that the connection is still down, and marching through two hundred
 * turns to collect two hundred identical failures wastes the battery of a
 * machine that is probably on one. The next `online` event tries again.
 */
export async function flushUnsyncedTurns(
  upload: (turn: UnsyncedTurn) => Promise<void>,
): Promise<FlushResult> {
  let uploaded = 0;
  for (const turn of unsyncedTurns()) {
    if (inFlight.has(turn.clientKey)) continue;
    inFlight.add(turn.clientKey);
    try {
      await upload(turn);
      buffer.delete(turn.clientKey);
      uploaded += 1;
    } catch {
      return { uploaded, remaining: buffer.size };
    } finally {
      inFlight.delete(turn.clientKey);
    }
  }
  if (uploaded) announce();
  return { uploaded, remaining: buffer.size };
}

/**
 * What to tell somebody who is about to lose them.
 *
 * Written here so the close warning, the sign-out confirmation and the badge
 * cannot drift into three different counts of the same thing.
 */
export function describeUnsynced(count = unsyncedCount()): string | null {
  if (count === 0) return null;
  return count === 1
    ? "One message has not reached your account yet. Leaving now discards it."
    : `${count} messages have not reached your account yet. Leaving now discards them.`;
}
