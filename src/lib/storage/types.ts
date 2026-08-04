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

export const DATA_CLASSES = [
  "chats",
  "images",
  "files",
  "recordings",
  "copilot",
  "learning_replays",
  "resumes",
  "company",
  "timesheets",
  "accounting",
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
