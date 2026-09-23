/**
 * Where browser-side model weights live.
 *
 * OPFS (the Origin Private File System) rather than IndexedDB or Cache
 * Storage, for reasons that matter at this size:
 *
 *  - It streams. A half-gigabyte artifact can be written chunk by chunk and read back as
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
  /** Stable key. Opaque: derived from the release id, never from a name. */
  key: string;
  bytes: number;
}

function opfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof FileSystemFileHandle !== "undefined"
  );
}

/**
 * A file kept open across a whole transfer, made durable at chosen moments.
 *
 * WHY THIS REPLACED open/write/close PER FLUSH. The previous `append()` did
 * exactly that, every four megabytes: `createWritable()` opens an OPFS swap
 * file, `close()` commits it. Across one install of a gigabyte-class engine
 * that is roughly 270 open-and-commit cycles, each of which asks the browser to
 * reconcile a swap file against a growing original, all on the main thread and
 * all while an animation is supposed to be running.
 *
 * Here the handle is opened once. `flush()` is the DURABILITY CHECKPOINT and
 * the caller chooses when to take one, because only the caller knows when it
 * has reached a point worth resuming from — a completed chunk whose digest
 * checkpoint has also been recorded. Writing continuously and committing
 * deliberately is the whole difference.
 */
export interface ModelFileWriter {
  write(chunk: Uint8Array, at: number): Promise<boolean>;
  flush(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * A writer over `createWritable`, batching commits into checkpoints.
 *
 * `keepExistingData: true` is what makes a resume possible: without it the
 * swap file starts empty and committing would truncate everything already
 * downloaded. Positioned writes mean chunks may arrive in any order, which is
 * exactly what a parallel ranged transfer produces.
 */
class WritableFileWriter implements ModelFileWriter {
  private writable: FileSystemWritableFileStream | null = null;
  private dirty = false;

  constructor(private readonly handle: FileSystemFileHandle) {}

  private async open(): Promise<FileSystemWritableFileStream | null> {
    if (this.writable) return this.writable;
    try {
      this.writable = await this.handle.createWritable({ keepExistingData: true });
      return this.writable;
    } catch {
      return null;
    }
  }

  async write(chunk: Uint8Array, at: number): Promise<boolean> {
    const writable = await this.open();
    if (!writable) return false;
    try {
      // Cast at the boundary: a Uint8Array's buffer is typed ArrayBufferLike,
      // which includes SharedArrayBuffer, and the write API accepts only a
      // plain ArrayBuffer view. Every chunk reaching here is over an ordinary
      // ArrayBuffer -- the transfer builds them that way deliberately.
      await writable.write({ type: "write", position: at, data: chunk as unknown as BufferSource });
      this.dirty = true;
      return true;
    } catch {
      /*
       * A failed write is usually a full quota. The handle is dropped rather
       * than reused: continuing to write into a stream the browser has already
       * rejected is how a file ends up with a hole in the middle that no digest
       * check will explain.
       */
      await this.discard();
      return false;
    }
  }

  async flush(): Promise<boolean> {
    if (!this.writable || !this.dirty) return true;
    const writable = this.writable;
    this.writable = null;
    this.dirty = false;
    try {
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }

  private async discard(): Promise<void> {
    const writable = this.writable;
    this.writable = null;
    this.dirty = false;
    try {
      await writable?.abort();
    } catch {
      /* Already gone. */
    }
  }
}

/**
 * A writer over `FileSystemSyncAccessHandle`, which is the fast path.
 *
 * Sync access handles write IN PLACE — no swap file, no commit-on-close — and
 * expose an explicit `flush()`. That is precisely the shape this transfer
 * wants, and it is the reason the installer runs inside a worker: the API is
 * only available there.
 *
 * The handle is exclusive for as long as it is held, which is also why exactly
 * one tab may install at a time. That constraint is enforced a level up by the
 * installation authority's cross-tab lock rather than discovered here as a
 * thrown exception.
 */
class SyncAccessWriter implements ModelFileWriter {
  constructor(private readonly handle: FileSystemSyncAccessHandle) {}

  async write(chunk: Uint8Array, at: number): Promise<boolean> {
    try {
      this.handle.write(chunk as unknown as BufferSource, { at });
      return true;
    } catch {
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      this.handle.flush();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      this.handle.flush();
    } catch {
      /* A handle that cannot flush still has to be released. */
    }
    try {
      this.handle.close();
    } catch {
      /* Already closed. */
    }
  }
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
   * Open a file for continuous writing.
   *
   * Prefers a sync access handle — in place, explicitly flushable, and only
   * available inside a worker — and falls back to a checkpointed writable
   * everywhere else. Returns null when there is no storage to write to, which
   * the caller reports rather than working around.
   */
  async openWriter(key: string): Promise<ModelFileWriter | null> {
    const handle = await this.fileHandle(key, true);
    if (!handle) return null;

    const createSync = (
      handle as FileSystemFileHandle & {
        createSyncAccessHandle?: () => Promise<FileSystemSyncAccessHandle>;
      }
    ).createSyncAccessHandle;
    if (typeof createSync === "function") {
      try {
        return new SyncAccessWriter(await createSync.call(handle));
      } catch {
        /*
         * Unavailable on this thread, or another context holds it. The
         * writable path below is correct everywhere, just slower — a busy
         * handle must not turn into a failed install.
         */
      }
    }
    return new WritableFileWriter(handle);
  }

  /**
   * Replace a small file whole. `createWritable()` without `keepExistingData`
   * commits a truncated swap file atomically; the sync handle is the worker
   * fallback. A manifest written over a longer one must not keep its tail.
   */
  async writeFile(key: string, bytes: Uint8Array): Promise<boolean> {
    const handle = await this.fileHandle(key, true);
    if (!handle) return false;
    try {
      const writable = await handle.createWritable();
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
      return true;
    } catch {
      try {
        const sync = await (
          handle as FileSystemFileHandle & {
            createSyncAccessHandle: () => Promise<FileSystemSyncAccessHandle>;
          }
        ).createSyncAccessHandle();
        sync.truncate(0);
        sync.write(bytes as unknown as BufferSource, { at: 0 });
        sync.flush();
        sync.close();
        return true;
      } catch {
        return false;
      }
    }
  }

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
      return true;
    } catch {
      return false;
    }
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
            out.push({ key, bytes: file.size });
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
}

export const modelStore = new ModelStore();
