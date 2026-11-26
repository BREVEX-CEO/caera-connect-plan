/**
 * A RENAME NEVER SILENTLY REPLACES A TITLE ANOTHER DEVICE SAVED (OFFLINE-03).
 *
 * The list holds each conversation's `title_revision`. A rename sends the revision it saw; the
 * account refuses it when the title has changed since. This pure helper turns the account's answer
 * into the list the screen should show, so the decision is testable without a server or a screen.
 */
import type { OcadeConversationRow } from "../ocade.functions.ts";

export type RenameResult =
  { ok: true; titleRevision?: number | null } | { ok: false; conflict: true };

export const RENAME_CONFLICT_MESSAGE =
  "This conversation was renamed on another device. Its newer title is shown; rename it again if you still want a different one.";

/** The revision a rename should name, or undefined when the account has not stored the row yet. */
export function expectedRevision(rows: OcadeConversationRow[], id: string): number | undefined {
  return rows.find((row) => row.id === id)?.title_revision;
}

/**
 * `before` is the list as it was when the person renamed. On success the title and the new
 * revision are kept; on a conflict nothing is applied and the caller reloads the account's list.
 */
export function applyRename(
  before: OcadeConversationRow[],
  id: string,
  title: string,
  result: RenameResult,
): { rows: OcadeConversationRow[]; conflict: boolean } {
  if (!result.ok) return { rows: before, conflict: true };
  return {
    rows: before.map((row) =>
      row.id === id
        ? {
            ...row,
            title,
            ...(typeof result.titleRevision === "number"
              ? { title_revision: result.titleRevision }
              : {}),
          }
        : row,
    ),
    conflict: false,
  };
}
