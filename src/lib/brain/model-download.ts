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

  /*
   * ALREADY COMPLETE? THE DIGEST DECIDES, NOT THE BYTE COUNT.
   *
   * This used to require `alreadyHave >= request.expectedBytes`, which made a
   * catalogue constant load-bearing for correctness. When that constant was
   * 382,112 bytes too large — a rounded `469 * MB` beside a comment giving the
   * exact size — the check never passed for a file that was genuinely finished.
   * Every launch re-requested `Range: bytes=<full size>-`, the server answered
   * 416, and on-device inference reported a network failure forever. The
   * engine broke precisely BECAUSE the download had succeeded.
   *
   * A stored `verified: true` means the bytes on disk were hashed and matched
   * the published fingerprint. That is a strictly stronger statement than any
   * length comparison, so it is the one that decides. `expectedBytes` is now
   * advisory: it drives the progress bar and the free-space check, and a wrong
   * value there is cosmetic rather than fatal.
   */
  const existingMeta = await store.readMeta(request.key);
  if (alreadyHave > 0 && existingMeta?.verified) {
    return { ok: true, key: request.key, bytes: alreadyHave, verified: true, resumed: true };
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
   * 416 RANGE NOT SATISFIABLE MEANS THERE IS NOTHING LEFT TO FETCH.
   *
   * It is the server saying "you asked past the end of this file" — which, on
   * a resume, is the signature of a COMPLETE download, not a broken one.
   * Reporting it as a network failure is how a finished engine presents itself
   * as unreachable. Verification then settles it: correct bytes are accepted,
   * wrong ones are deleted and re-fetched from zero next time.
   *
   * CHECKED BEFORE THE RANGE-IGNORED RESET BELOW, and the order matters. That
   * block treats any non-206 as "the server sent the whole file" and deletes
   * what is on disk — which would throw away the completed download this
   * branch exists to rescue, then hash a file that no longer exists.
   */
  if (response.status === 416 && alreadyHave > 0) {
    return await finishVerified(store, request, alreadyHave, true);
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

  return await finishVerified(store, request, await store.sizeOf(request.key), resumed);
}

/**
 * Prefer weights this deployment serves itself over the publisher's host.
 *
 * A HEAD, not a GET: the question is only "is it there", and asking it with a
 * GET would start pulling hundreds of megabytes just to find out. A deployment
 * that does not self-host answers 404 in a millisecond on its own origin and
 * the remote URL is used exactly as before.
 *
 * Any failure — 404, an origin that rejects HEAD, no network at all — falls
 * through to `remoteUrl`. This can only ever AVOID an external request; it can
 * never cause one, and it can never be the reason a download fails.
 */
export async function preferredWeightsUrl(
  sameOriginUrl: string | null,
  remoteUrl: string,
  fetchImpl?: typeof fetch,
): Promise<{ url: string; local: boolean }> {
  const doFetch = fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!sameOriginUrl || !doFetch) return { url: remoteUrl, local: false };
  try {
    const probe = await doFetch(sameOriginUrl, { method: "HEAD" });
    if (probe.ok) return { url: sameOriginUrl, local: true };
  } catch {
    /* Not self-hosted, or unreachable. The remote URL is the answer. */
  }
  return { url: remoteUrl, local: false };
}

export type ImportFailure = "storage_unavailable" | "insufficient_storage" | "digest_mismatch";

export type ImportResult =
  | { ok: true; key: string; bytes: number; verified: boolean }
  | { ok: false; failure: ImportFailure; reason: string };

export interface ImportRequest {
  /** Stable storage key — the same one `downloadModel` would have written. */
  key: string;
  /** The weights, chosen by the user from their own disk. */
  file: Blob;
  /** Lowercase hex SHA-256 the file must match. */
  sha256?: string;
  onProgress?: (p: { receivedBytes: number; totalBytes: number; fraction: number }) => void;
  store?: ModelStore;
}

/**
 * Install weights from a file the user already has, with NO NETWORK AT ALL.
 *
 * WHY THIS EXISTS. Everything else in this module assumes the engine arrives
 * over a connection, and `downloadModel` is careful about every way that can
 * go wrong. What it cannot do is help the case where there is no connection to
 * be careful with: an air-gapped machine, a locked-down site network, a
 * metered link nobody will spend 470 MB on, or a fleet that must not fetch
 * from a third-party host on first run. Those deployments could not obtain an
 * engine at all, so "works offline once downloaded" quietly meant "does not
 * work here, ever" — the first download was the one step that could not be
 * done offline.
 *
 * This closes that. The bytes come from a file the operator already has, and
 * the ONLY difference from a completed download is where they came from:
 *
 *  - it is written to the same key, so the adapter finds it with no special
 *    case and the storage screen lists it like any other engine;
 *  - it is hashed against the SAME committed digest, so an imported file is
 *    held to exactly the standard a downloaded one is. A file someone was
 *    handed on a USB stick deserves more scrutiny than one fetched over TLS,
 *    not less;
 *  - a mismatch DELETES it, for the reason given at the top of this file —
 *    weights that are almost right load happily and answer nonsense.
 *
 * It calls no fetch and takes no URL, so it cannot silently fall back to the
 * network. That is a property worth keeping deliberately: this function is the
 * evidence that OCADE can reach a working engine with the radio off.
 */
export async function importModelFile(request: ImportRequest): Promise<ImportResult> {
  const store = request.store ?? modelStore;

  if (!ModelStore.isSupported()) {
    return {
      ok: false,
      failure: "storage_unavailable",
      reason: "This browser cannot store a model between visits, so OCADE will not import one.",
    };
  }

  const totalBytes = request.file.size;
  const room = await checkRoom(totalBytes);
  if (!room.ok) {
    return { ok: false, failure: "insufficient_storage", reason: room.reason };
  }

  // Replace rather than append: an import is a complete file, and appending it
  // to a partial download would produce a longer, corrupt one.
  await store.remove(request.key);

  /*
   * Streamed in chunks rather than read whole. `file.arrayBuffer()` on a
   * 470 MB GGUF materialises the entire model in memory at once, which is the
   * documented way to kill a tab on a phone — the same reason model-store.ts
   * chose OPFS over IndexedDB.
   */
  const reader = request.file.stream().getReader();
  let written = 0;
  let buffer: Uint8Array[] = [];
  let buffered = 0;

  const flush = async (): Promise<boolean> => {
    if (buffered === 0) return true;
    const merged = new Uint8Array(new ArrayBuffer(buffered));
    let at = 0;
    for (const part of buffer) {
      merged.set(part, at);
      at += part.length;
    }
    const wroteAt = written - buffered;
    buffer = [];
    buffered = 0;
    return store.append(request.key, merged, wroteAt);
  };

  const outOfRoom = async (): Promise<ImportResult> => {
    await store.remove(request.key);
    return {
      ok: false,
      failure: "insufficient_storage",
      reason: "The browser stopped accepting data, which usually means storage is full.",
    };
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.push(value);
    buffered += value.length;
    written += value.length;
    if (buffered >= CHUNK_FLUSH_BYTES && !(await flush())) return await outOfRoom();
    request.onProgress?.({
      receivedBytes: written,
      totalBytes,
      fraction: totalBytes > 0 ? Math.min(1, written / totalBytes) : 1,
    });
  }
  if (!(await flush())) return await outOfRoom();

  const finished = await finishVerified(
    store,
    { key: request.key, url: "", sha256: request.sha256, expectedBytes: totalBytes },
    await store.sizeOf(request.key),
    false,
  );

  return finished.ok
    ? { ok: true, key: finished.key, bytes: finished.bytes, verified: finished.verified }
    : { ok: false, failure: "digest_mismatch", reason: finished.reason };
}

/**
 * Hash what is on disk, record the result, and decide whether it may be used.
 *
 * Shared by the normal completion path and the 416 path, so a download that
 * turned out to be already complete gets the SAME scrutiny as one that just
 * finished streaming. Verifying in one place and trusting in the other is how
 * a corrupt file ends up loaded.
 */
async function finishVerified(
  store: ModelStore,
  request: DownloadRequest,
  finalBytes: number,
  resumed: boolean,
): Promise<DownloadResult> {
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

  await store.writeMeta(request.key, {
    verified,
    expectedBytes: request.expectedBytes ?? finalBytes,
    sha256: request.sha256,
  });

  return { ok: true, key: request.key, bytes: finalBytes, verified, resumed };
}
