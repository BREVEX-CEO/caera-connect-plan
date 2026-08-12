/**
 * StorageAdapter contract — every persistent write in CAERA CADANE flows
 * through one of three adapters chosen by the resolver based on the user's
 * per-data-class privacy setting.
 *
 *  - browser_only  → encrypted IndexedDB, this browser only, never reaches cloud.
 *  - pc_vault      → OS-level encrypted store via the Native Companion (not yet available on web).
 *  - private_sync  → Supabase table + Storage, RLS-scoped to the user / tenant.
 */

export type StorageMode = "browser_only" | "pc_vault" | "private_sync";

/**
 * Every kind of data this product can create.
 *
 * "resumes", "company", "timesheets" and "accounting" were removed with the
 * products that produced them. A privacy control for a data class nothing can
 * write is a switch with no wire behind it — worse than useless, because it
 * invites someone to believe they have configured where their company records
 * are stored when no company record can exist.
 *
 * The `data_class_privacy` rows for those classes are left untouched in the
 * database. Deleting a user's stated privacy preference is not a cleanup, and
 * if those products are ever built the preference should still be theirs.
 */
export const DATA_CLASSES = [
  "chats",
  "images",
  "files",
  "recordings",
  "copilot",
  "learning_replays",
] as const;

export type DataClass = (typeof DATA_CLASSES)[number];

export interface StoredRecord<T = unknown> {
  id: string;
  dataClass: DataClass;
  createdAt: number;
  updatedAt: number;
  value: T;
}

export interface StorageAdapter {
  readonly mode: StorageMode;
  put<T>(dataClass: DataClass, id: string, value: T): Promise<void>;
  get<T>(dataClass: DataClass, id: string): Promise<StoredRecord<T> | null>;
  list<T>(dataClass: DataClass): Promise<StoredRecord<T>[]>;
  delete(dataClass: DataClass, id: string): Promise<void>;
  clear(dataClass?: DataClass): Promise<void>;
}

export class StorageLockedError extends Error {
  constructor() {
    super("Browser Only vault is locked. Unlock it in Settings → Vault.");
    this.name = "StorageLockedError";
  }
}

export class NativeCompanionRequiredError extends Error {
  /**
   * `message` is optional so other companion-gated surfaces (computer control,
   * local engines) can give their own honest reason. Existing callers pass
   * nothing and keep the original vault wording unchanged.
   */
  constructor(message?: string) {
    super(
      message ??
        "PC Device Vault requires the CAERA Native Companion. Not available in the browser yet.",
    );
    this.name = "NativeCompanionRequiredError";
  }
}
