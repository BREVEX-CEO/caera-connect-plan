/**
 * The OPFS synchronous access handle, which no shipped lib.dom describes yet.
 *
 * `model-store.ts` uses it because it is the only way to write a
 * gigabyte-class file to OPFS without materialising it in memory, and it
 * previously type-checked only because an unrelated dependency happened to
 * declare it. That dependency is gone; the declaration OCADE depends on lives
 * here, where removing it fails the build rather than a first install.
 */
interface FileSystemSyncAccessHandle {
  read(buffer: BufferSource, options?: { at?: number }): number;
  write(buffer: BufferSource, options?: { at?: number }): number;
  truncate(newSize: number): void;
  getSize(): number;
  flush(): void;
  close(): void;
}

interface FileSystemFileHandle {
  createSyncAccessHandle?(): Promise<FileSystemSyncAccessHandle>;
}
