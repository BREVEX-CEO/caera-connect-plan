import { modelStore, ModelStore } from "./model-store";

/**
 * Fetching model weights into OCADE-managed storage.
 *
 * WHY THIS EXISTS RATHER THAN `await fetch(url)`. A 400 MB download over a
 * phone connection is not a request, it is a session: it gets interrupted, the
 * user wants it paused, the tab gets closed, the file arrives corrupt, and the
 * disk fills up halfway. Each of those is a real state this has to handle,
 * and none of them is expressible with a single fetch.
 *
 * THE RULES
 *
 * 1. **Resume from bytes on disk, not from a remembered offset.** The file's
 *    own size is the truth; a counter in memory disagrees with reality the
 *    moment a write fails.
 * 2. **A digest that cannot be checked is UNVERIFIED, never verified.** Absence
 *    of a check is not a passing check.
 * 3. **A failed verification deletes the file.** Keeping corrupt weights so the
 *    next attempt can "resume" them produces a model that loads and answers
 *    nonsense — far worse than downloading again.
 * 4. **Disk is checked before starting, not after failing.** Filling someone's
 *    device and then apologising is not a refusal path.
 */

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  /** 0–1, or null until a total is known. */
  fraction: number | null;
  /** Bytes already present when this attempt started. */
  resumedFromBytes: number;
}

export type DownloadFailure =
  | "cancelled"
  | "paused"
  | "network"
  | "insufficient_storage"
  | "digest_mismatch"
  | "storage_unavailable"
  | "range_unsupported";

export type DownloadResult =
  | { ok: true; key: string; bytes: number; verified: boolean; resumed: boolean }
  | { ok: false; failure: DownloadFailure; reason: string };

export interface DownloadRequest {
  /** Stable storage key. */
  key: string;
  url: string;
  /** Declared size, used for the pre-flight disk check. */
  expectedBytes?: number;
  /** Lowercase hex SHA-256 the finished file must match. */
  sha256?: string;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Injected for tests; defaults to the global. */
  fetchImpl?: typeof fetch;
  store?: ModelStore;
}

const CHUNK_FLUSH_BYTES = 4 * 1024 * 1024;

/** Lowercase hex SHA-256 of a blob, using the platform's own crypto. */
export async function sha256OfBlob(blob: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/**
 * Is there room for this download?
 *
 * Uses the origin's remaining quota, which is what actually bounds a browser
 * download — free disk is invisible to a page. A browser that will not report
 * a quota is treated as unknown and allowed to proceed, because refusing on no
 * evidence would block every Firefox user.
 */
export async function checkRoom(
  expectedBytes: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { ok: true };
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota === undefined) return { ok: true };
    const remaining = estimate.quota - (estimate.usage ?? 0);
    // A margin, because writing to the exact quota edge fails in practice.
    const needed = Math.ceil(expectedBytes * 1.1);
    if (remaining < needed) {
      const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;
      return {
        ok: false,
        reason: `This needs about ${mb(needed)} and the browser will only allow ${mb(remaining)} more.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function downloadModel(request: DownloadRequest): Promise<DownloadResult> {
  const store = request.store ?? modelStore;
  const doFetch = request.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);

  if (!ModelStore.isSupported()) {
    return {
      ok: false,
      failure: "storage_unavailable",
      reason: "This browser cannot store a model between visits, so OCADE will not download one.",
    };
  }
  if (!doFetch) {
    return { ok: false, failure: "network", reason: "No network client is available." };
  }

  if (request.expectedBytes !== undefined) {
    const room = await checkRoom(request.expectedBytes);
    if (!room.ok) {
      return { ok: false, failure: "insufficient_storage", reason: room.reason };
    }
  }

  // Bytes already on disk ARE the resume offset.
  const alreadyHave = await store.sizeOf(request.key);
  const resumed = alreadyHave > 0;

  // Already complete and verified? Then this is a no-op, not a re-download.
  if (request.expectedBytes !== undefined && alreadyHave >= request.expectedBytes) {
    const meta = await store.readMeta(request.key);
    if (meta?.verified) {
      return { ok: true, key: request.key, bytes: alreadyHave, verified: true, resumed: true };
    }
  }

  let response: Response;
  try {
    response = await doFetch(request.url, {
      signal: request.signal,
      headers: alreadyHave > 0 ? { Range: `bytes=${alreadyHave}-` } : undefined,
    });
  } catch (error) {
    if (request.signal?.aborted) {
      return { ok: false, failure: "cancelled", reason: "Download stopped." };
    }
    return {
      ok: false,
      failure: "network",
      reason: `The download could not start: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  /*
   * A server that ignores Range answers 200 with the WHOLE file. Appending
   * that to what is already stored would silently produce a corrupt double-
   * length file, so the offset is reset to zero and the transfer restarts.
   */
  let writeAt = alreadyHave;
  if (alreadyHave > 0 && response.status !== 206) {
    writeAt = 0;
    await store.remove(request.key);
  }

  if (!response.ok && response.status !== 206) {
    return {
      ok: false,
      failure: "network",
      reason: `The model server answered ${response.status}.`,
    };
  }
  if (!response.body) {
    return { ok: false, failure: "network", reason: "The model server sent no data." };
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  const totalBytes =
    request.expectedBytes ?? (Number.isFinite(declared) ? declared + writeAt : null);

  const reader = response.body.getReader();
  let received = writeAt;
  let buffer: Uint8Array[] = [];
  let buffered = 0;

  const flush = async (): Promise<boolean> => {
    if (buffered === 0) return true;
    // Backed by a plain ArrayBuffer, not ArrayBufferLike: the file-system
    // write API will not accept a view that might be over a SharedArrayBuffer.
    const merged = new Uint8Array(new ArrayBuffer(buffered));
    let at = 0;
    for (const part of buffer) {
      merged.set(part, at);
      at += part.length;
    }
    const wroteAt = received - buffered;
    buffer = [];
    buffered = 0;
    return store.append(request.key, merged, wroteAt);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (request.signal?.aborted) {
        // Flush first: the bytes already received are kept so a resume does
        // not re-fetch them. Stopping is not the same as discarding.
        await flush();
        return { ok: false, failure: "cancelled", reason: "Download stopped." };
      }
      buffer.push(value);
      buffered += value.length;
      received += value.length;
      if (buffered >= CHUNK_FLUSH_BYTES) {
        if (!(await flush())) {
          return {
            ok: false,
            failure: "insufficient_storage",
            reason: "The browser stopped accepting data, which usually means storage is full.",
          };
        }
      }
      request.onProgress?.({
        receivedBytes: received,
        totalBytes,
        fraction: totalBytes ? Math.min(1, received / totalBytes) : null,
        resumedFromBytes: writeAt,
      });
    }
    if (!(await flush())) {
      return {
        ok: false,
        failure: "insufficient_storage",
        reason: "The browser stopped accepting data, which usually means storage is full.",
      };
    }
  } catch (error) {
    await flush();
    if (request.signal?.aborted) {
      return { ok: false, failure: "cancelled", reason: "Download stopped." };
    }
    return {
      ok: false,
      failure: "network",
      reason: `The download was interrupted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  /* ------------------------------------------------------------ verify -- */

  let verified = false;
  if (request.sha256) {
    const blob = await store.readBlob(request.key);
    const actual = blob ? await sha256OfBlob(blob) : null;
    if (actual === null) {
      // Could not check. Reported as unverified — never upgraded to verified
      // just because nothing contradicted it.
      verified = false;
    } else if (actual.toLowerCase() !== request.sha256.toLowerCase()) {
      // Corrupt weights that "resume" next time would load and answer
      // nonsense. Deleting is the only safe outcome.
      await store.remove(request.key);
      return {
        ok: false,
        failure: "digest_mismatch",
        reason:
          "The downloaded engine did not match its published fingerprint, so OCADE deleted it rather than run it.",
      };
    } else {
      verified = true;
    }
  }

  const finalBytes = await store.sizeOf(request.key);
  await store.writeMeta(request.key, {
    verified,
    expectedBytes: request.expectedBytes ?? finalBytes,
    sha256: request.sha256,
  });

  return { ok: true, key: request.key, bytes: finalBytes, verified, resumed };
}
