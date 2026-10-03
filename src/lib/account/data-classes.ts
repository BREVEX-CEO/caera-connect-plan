/**
 * WHAT AN ACCOUNT HOLDS, BY CLASS — THE ONE MAP THE EXPORT AND THE
 * PER-CLASS DELETION BOTH READ.
 *
 * PLAN.md §O asks for four things this file is the authority for: export
 * synchronised account data, make the export machine-readable, delete ONE data
 * class, and remove or anonymise billing data according to retention
 * requirements. All four need the same answer to one question — which tables
 * belong to which class — and a second copy of that answer is how an export
 * quietly stops covering a table the deletion still clears, or the other way
 * round.
 *
 * WHY DELETABILITY IS A FIELD RATHER THAN A CONVENTION. Three of these classes
 * must NOT be deletable on request, and each for a different reason a person is
 * owed in words:
 *
 *   `legal` — a consent receipt is the evidence that consent was given. The
 *   table has no delete policy at all, deliberately, and erasing it would
 *   destroy the record that protects the person as much as the product.
 *
 *   `billing` — plan-access grants are the audit record of who gave paid
 *   access and why. They are exported in full and leave with the account.
 *
 *   `profile` — the account's own identity row. Deleting it is deleting the
 *   account, which is a different, irreversible operation with its own
 *   confirmation, assurance and receipt in `account.functions.ts`. Offering it
 *   here as one class among six would be a trap.
 *
 * A class that cannot be deleted still says why, in `retention`, and the screen
 * shows that sentence rather than hiding the control — "you cannot" with no
 * reason reads as a bug, and people ask support about bugs.
 *
 * CASCADES ARE NAMED, NOT ASSUMED. Where a child table is removed by an
 * ON DELETE CASCADE from a parent listed here, it appears in `cascades` so the
 * export covers it and the receipt can say it went. Deleting by parent is
 * deliberate: `account.functions.ts` records what happened the last time this
 * was done by reading ids and deleting children with `.in(...)` — PostgREST
 * capped the read at a thousand rows and the rest were silently never named.
 */

import type { Database } from "@/integrations/supabase/types";

/**
 * A real table name, checked by the compiler.
 *
 * Typed against the generated schema rather than left as `string`: a table
 * renamed in a migration, or mistyped here, is then a build failure instead of
 * an export that silently omits a class and a deletion that silently clears
 * nothing.
 */
export type AccountTable = keyof Database["public"]["Tables"];

/** The column that ties a table to its account. */
export type OwnerColumn = "user_id" | "id";

export interface AccountDataTable {
  table: AccountTable;
  owner: OwnerColumn;
  /**
   * Tables removed by an ON DELETE CASCADE when this one goes. Exported
   * separately — the child rows are the person's data too — and never deleted
   * directly.
   */
  cascades?: readonly AccountTable[];
}

export type AccountDataClassId =
  | "conversations"
  | "library"
  | "activity"
  | "devices"
  | "settings"
  | "profile"
  | "billing"
  | "legal"
  | "jarvis";

export interface AccountDataClass {
  id: AccountDataClassId;
  /** What a person calls this. */
  label: string;
  /** One sentence, in the second person, about what is in it. */
  description: string;
  tables: readonly AccountDataTable[];
  /**
   * `null` when the class may be deleted on request. Otherwise the exact
   * reason it may not, written for the person rather than for an operator.
   */
  retention: string | null;
}

export const ACCOUNT_DATA_CLASSES: readonly AccountDataClass[] = [
  {
    id: "conversations",
    label: "Conversations",
    description: "Every OCADE chat you have kept, and the messages inside them.",
    tables: [{ table: "ocade_conversations", owner: "user_id", cascades: ["ocade_messages"] }],
    retention: null,
  },
  {
    /*
     * Its own class, not part of Conversations. A file somebody uploaded is
     * theirs whether or not the chat it arrived in still exists — folding it
     * into Conversations would mean "delete my chats" silently took their
     * files with it.
     */
    id: "library",
    label: "Library",
    description: "Files and images you uploaded, and the ones OCADE produced for you.",
    tables: [{ table: "ocade_library_items", owner: "user_id" }],
    retention: null,
  },
  {
    id: "activity",
    label: "Activity",
    description: "The record of actions taken on this account, kept for your own security review.",
    tables: [{ table: "activity_log", owner: "user_id" }],
    retention: null,
  },
  {
    /*
     * Everything JARVIS keeps apart from its conversations (those are in
     * Conversations). Clearing it disconnects the computers too: their keys
     * stop working, and each asks to be connected again.
     */
    id: "jarvis",
    label: "JARVIS",
    description:
      "JARVIS tasks and their activity, what it remembers about you, your reminders and scheduled work, its permissions and the computers you connected.",
    tables: [
      { table: "jarvis_tasks", owner: "user_id" },
      { table: "jarvis_activity", owner: "user_id" },
      { table: "jarvis_memories", owner: "user_id" },
      { table: "jarvis_schedules", owner: "user_id" },
      { table: "jarvis_permissions", owner: "user_id" },
      { table: "jarvis_devices", owner: "user_id" },
    ],
    retention: null,
  },
  {
    id: "devices",
    label: "Devices and grants",
    description:
      "Browsers and devices registered to this account, what each may do, and which browsers show its notifications.",
    tables: [
      { table: "devices", owner: "user_id" },
      { table: "browser_grants", owner: "user_id" },
      { table: "ocade_push_subscriptions", owner: "user_id" },
    ],
    retention: null,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Appearance, privacy modes and the rest of your preferences.",
    tables: [
      { table: "user_settings", owner: "user_id" },
      { table: "data_class_privacy", owner: "user_id" },
    ],
    retention: null,
  },
  {
    id: "profile",
    label: "Profile",
    description: "Your name, handle and the identity this account signs in with.",
    tables: [{ table: "profiles", owner: "id" }],
    retention:
      "Your profile is the account itself. Deleting it means deleting the account, which is a separate and irreversible action with its own confirmation.",
  },
  {
    id: "billing",
    label: "Plan access",
    description: "Pro or Max access given to this account, by whom, why and for how long.",
    tables: [{ table: "ocade_entitlement_grants", owner: "user_id" }],
    retention:
      "Plan access records are the audit trail of who gave access and why. They are kept while the account exists and are included in your export.",
  },
  {
    id: "legal",
    label: "Consent receipts",
    description: "Which version of the terms and privacy policy you accepted, and when.",
    tables: [{ table: "legal_consent_receipts", owner: "user_id" }],
    retention:
      "A consent receipt is the evidence that you were asked and answered. It is kept for as long as the record is required, and is included in your export.",
  },
];

export function findAccountDataClass(id: string): AccountDataClass | null {
  return ACCOUNT_DATA_CLASSES.find((entry) => entry.id === id) ?? null;
}

/** Just the classes a person may clear without closing the account. */
export function deletableAccountDataClasses(): readonly AccountDataClass[] {
  return ACCOUNT_DATA_CLASSES.filter((entry) => entry.retention === null);
}

/**
 * Every table an export must read, parents and cascaded children alike.
 *
 * Children are listed so the export is COMPLETE: a message lives in
 * `ocade_messages` and is removed by its conversation's cascade, so an export
 * that read only the parents would hand somebody a list of conversation titles
 * and none of what was said in them.
 */
export function exportedTablesFor(entry: AccountDataClass): readonly AccountTable[] {
  return entry.tables.flatMap((table) => [table.table, ...(table.cascades ?? [])]);
}
