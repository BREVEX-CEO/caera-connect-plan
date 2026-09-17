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

/**
 * Retire one turn, because the database now holds it.
 *
 * Separate from `forgetAllUnsyncedTurns` on purpose: a drain that loses the
 * turns it has not uploaded yet, because one of them succeeded, is worse than
 * one that never ran.
 */
export function forgetUnsyncedTurn(clientKey: string): void {
  if (buffer.delete(clientKey)) announce();
}

/**
 * Claim a turn for uploading, or refuse because something already has it.
 *
 * The correctness argument is the idempotency key the server enforces; this
 * only stops two drains doing the same pointless work at the same moment.
 */
export function claimUnsyncedTurn(clientKey: string): boolean {
  if (inFlight.has(clientKey)) return false;
  inFlight.add(clientKey);
  return true;
}

export function releaseUnsyncedTurn(clientKey: string): void {
  inFlight.delete(clientKey);
}

/** Discard everything. Sign-out, after the user has been warned. */
export function forgetAllUnsyncedTurns(): void {
  if (buffer.size === 0) return;
  buffer.clear();
  announce();
}
