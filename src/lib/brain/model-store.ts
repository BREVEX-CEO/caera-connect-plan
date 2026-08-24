/**
 * Where browser-side model weights live.
 *
 * OPFS (the Origin Private File System) rather than IndexedDB or Cache
 * Storage, for reasons that matter at this size:
 *
 *  - It streams. A 400 MB GGUF can be written chunk by chunk and read back as
 *    a Blob without ever holding the whole thing in memory. IndexedDB wants a
 *    value; Cache Storage wants a Response. Both push you toward materialising
 *    hundreds of megabytes at once, which is how a tab dies on a phone.
 *  - It has real files. Resuming a partial download means knowing exactly how
 *    many bytes are on disk, which is a `getSize()` call here and a
 *    reconstruction exercise anywhere else.
 *
 * EVERY METHOD DEGRADES RATHER THAN THROWS. A browser without OPFS — or one in
 * private mode that refuses it — must leave the product working, just without
 * a browser engine. `isSupported()` is the honest gate and the adapters check
 * it before promising anything.
 *
 * NOTHING HERE TALKS TO A SERVER. It is storage, not transfer.
 */

const MODEL_DIRECTORY = "ocade-models";

export interface StoredModel {
  /** Stable key, e.g. "wasm/qwen2.5-1.5b-instruct-q4_k_m.gguf". */
  key: string;
  bytes: number;
  /** Set once the file has been verified against its expected digest. */
  verified: boolean;
}

export interface StorageReport {
  supported: boolean;
  /** True when the browser has promised not to evict this data under pressure. */
  persistent: boolean;
  /** Bytes this origin is currently using, when the browser will say. */
  usedBytes: number | null;
  /** Bytes this origin may use in total, when the browser will say. */
  quotaBytes: number | null;
  models: StoredModel[];
  /** Present when something could not be determined; never a silent zero. */
  problem?: string;
}

function opfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof FileSystemFileHandle !== "undefined"
  );
}

/** Metadata written next to each model so verification survives a reload. */
interface ModelMeta {
  verified: boolean;
  expectedBytes: number;
  sha256?: string;
}

export class ModelStore {
  static isSupported(): boolean {
    return opfsAvailable();
  }

  private async root(): Promise<FileSystemDirectoryHandle | null> {
    if (!opfsAvailable()) return null;
    try {
      const base = await navigator.storage.getDirectory();
      return await base.getDirectoryHandle(MODEL_DIRECTORY, { create: true });
    } catch {
      return null;
    }
  }

  /**
   * Ask the browser to stop evicting this data.
   *
   * Without it, weights live in "best effort" storage and can be cleared the
   * next time the device is short of space — so a user who downloaded 400 MB
   * on a train discovers it gone. The browser may refuse, and refusing is a
   * legitimate answer that gets reported rather than retried in a loop.
   */
  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    try {
      if (await navigator.storage.persisted?.()) return true;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  /** Bytes already written for this key. 0 when absent — the resume offset. */
  async sizeOf(key: string): Promise<number> {
    const handle = await this.fileHandle(key, false);
    if (!handle) return 0;
    try {
      const file = await handle.getFile();
      return file.size;
    } catch {
      return 0;
    }
  }

  private async fileHandle(key: string, create: boolean): Promise<FileSystemFileHandle | null> {
    const root = await this.root();
    if (!root) return null;
    // Keys may contain slashes; each segment becomes a directory so a repo
    // name and a file name cannot collide with another model's.
    const parts = key.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) return null;
    let dir = root;
    try {
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create });
      }
      return await dir.getFileHandle(name, { create });
    } catch {
      return null;
    }
  }

  /**
   * Append bytes at the end of the stored file.
   *
   * `at` is passed explicitly rather than inferred so a caller resuming a
   * download cannot accidentally append to the wrong offset after a retry.
   */
  async append(key: string, chunk: Uint8Array<ArrayBuffer>, at: number): Promise<boolean> {
    const handle = await this.fileHandle(key, true);
    if (!handle) return false;
    try {
      const writable = await handle.createWritable({ keepExistingData: true });
      await writable.write({ type: "write", position: at, data: chunk });
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  /** Read the whole model back, for handing to an engine. */
  async readBlob(key: string): Promise<Blob | null> {
    const handle = await this.fileHandle(key, false);
    if (!handle) return null;
    try {
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    const root = await this.root();
    if (!root) return false;
    const parts = key.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) return false;
    try {
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      await dir.removeEntry(name);
      await this.writeMeta(key, null);
      return true;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------ metadata -- */

  private metaKey(key: string): string {
    return `ocade.model.meta.${key}`;
  }

  async readMeta(key: string): Promise<ModelMeta | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.metaKey(key));
      return raw ? (JSON.parse(raw) as ModelMeta) : null;
    } catch {
      return null;
    }
  }

  async writeMeta(key: string, meta: ModelMeta | null): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      if (meta === null) window.localStorage.removeItem(this.metaKey(key));
      else window.localStorage.setItem(this.metaKey(key), JSON.stringify(meta));
    } catch {
      /* A browser refusing storage re-verifies next time. Slower, not wrong. */
    }
  }

  /* -------------------------------------------------------------- report -- */

  /** Everything the storage settings page needs, with unknowns left unknown. */
  async report(): Promise<StorageReport> {
    if (!opfsAvailable()) {
      return {
        supported: false,
        persistent: false,
        usedBytes: null,
        quotaBytes: null,
        models: [],
        problem:
          "This browser does not provide the private file storage OCADE needs to keep a model between visits.",
      };
    }

    let usedBytes: number | null = null;
    let quotaBytes: number | null = null;
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
    } catch {
      // Left null. A zero here would read as "nothing stored", which is a
      // different and wrong claim.
    }

    let persistent = false;
    try {
      persistent = (await navigator.storage.persisted?.()) ?? false;
    } catch {
      persistent = false;
    }

    return {
      supported: true,
      persistent,
      usedBytes,
      quotaBytes,
      models: await this.list(),
    };
  }

  /** Every model file currently stored, walked depth-first. */
  async list(): Promise<StoredModel[]> {
    const root = await this.root();
    if (!root) return [];
    const out: StoredModel[] = [];

    const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
      // `entries()` is async-iterable but not in every typing set; cast once.
      const iterable = dir as unknown as {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
      };
      for await (const [name, handle] of iterable.entries()) {
        const key = prefix ? `${prefix}/${name}` : name;
        if (handle.kind === "directory") {
          await walk(handle as FileSystemDirectoryHandle, key);
        } else {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            const meta = await this.readMeta(key);
            out.push({ key, bytes: file.size, verified: meta?.verified ?? false });
          } catch {
            /* A file that cannot be read is simply not listed. */
          }
        }
      }
    };

    try {
      await walk(root, "");
    } catch {
      return out;
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  /** Delete everything OCADE stored. Used by Settings › Storage. */
  async clear(): Promise<number> {
    const models = await this.list();
    let removed = 0;
    for (const model of models) {
      if (await this.remove(model.key)) removed += 1;
    }
    return removed;
  }
}

export const modelStore = new ModelStore();
