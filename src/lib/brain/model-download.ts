import { modelStore, ModelStore } from "./model-store";

/** Browser-model download state. Partial bytes are deliberately resumable. */
export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  fraction: number | null;
  resumedFromBytes: number;
}

export type DownloadFailure =
  | "cancelled"
  | "paused"
  | "network"
  | "insufficient_storage"
  | "digest_mismatch"
  | "verification_unavailable"
  | "storage_unavailable"
  | "range_unsupported";

export type DownloadResult =
  | { ok: true; key: string; bytes: number; verified: boolean; resumed: boolean }
  | { ok: false; failure: DownloadFailure; reason: string };

export interface DownloadRequest {
  key: string;
  url: string;
  expectedBytes?: number;
  sha256?: string;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  store?: ModelStore;
}

const CHUNK_FLUSH_BYTES = 4 * 1024 * 1024;

export async function sha256OfBlob(blob: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export async function checkRoom(
  expectedBytes: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { ok: true };
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota === undefined) return { ok: true };
    const remaining = estimate.quota - (estimate.usage ?? 0);
    const needed = Math.ceil(expectedBytes * 1.1);
    if (remaining < needed) {
      const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;
      return {
        ok: false,
        reason: `This needs about ${mb(needed)} and the browser will only allow ${mb(remaining)} more.`,
      };
    }
  } catch {
    // Unknown quota is not evidence that the disk is full.
  }
  return { ok: true };
}

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
      // Never run weights whose published digest could not actually be checked.
      await store.writeMeta(request.key, {
        verified: false,
        // Bind metadata to the physical file size, never a catalogue estimate.
        expectedBytes: finalBytes,
        sha256: request.sha256,
      });
      return {
        ok: false,
        failure: "verification_unavailable",
        reason:
          "OCADE downloaded the engine but this browser could not verify its fingerprint, so the engine was not executed.",
      };
    }
    if (actual.toLowerCase() !== request.sha256.toLowerCase()) {
      await store.remove(request.key);
      return {
        ok: false,
        failure: "digest_mismatch",
        reason:
          "The downloaded engine did not match its published fingerprint, so OCADE deleted it rather than run it.",
      };
    }
    verified = true;
  }

  await store.writeMeta(request.key, {
    verified,
    // A verified flag is valid only for this exact physical length. This also
    // invalidates stale metadata if a file was removed but localStorage could
    // not be cleared and a later partial download reused the same key.
    expectedBytes: finalBytes,
    sha256: request.sha256,
  });
  return { ok: true, key: request.key, bytes: finalBytes, verified, resumed };
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
  if (!doFetch) return { ok: false, failure: "network", reason: "No network client is available." };

  if (request.expectedBytes !== undefined) {
    const room = await checkRoom(request.expectedBytes);
    if (!room.ok) return { ok: false, failure: "insufficient_storage", reason: room.reason };
  }

  const alreadyHave = await store.sizeOf(request.key);
  const resumed = alreadyHave > 0;
  const existingMeta = await store.readMeta(request.key);

  // A stale `verified:true` alone is not enough. It must describe the exact
  // bytes presently on disk; otherwise the file is re-verified below.
  if (
    alreadyHave > 0 &&
    existingMeta?.verified === true &&
    existingMeta.expectedBytes === alreadyHave &&
    (!request.sha256 || existingMeta.sha256?.toLowerCase() === request.sha256.toLowerCase())
  ) {
    return { ok: true, key: request.key, bytes: alreadyHave, verified: true, resumed: true };
  }

  // Legacy verified metadata did not bind the flag to the file size. Re-check
  // it locally before going to the network; correct existing files remain cheap.
  if (alreadyHave > 0 && existingMeta?.verified && request.sha256) {
    const localCheck = await finishVerified(store, request, alreadyHave, true);
    if (localCheck.ok || localCheck.failure !== "digest_mismatch") return localCheck;
    // A mismatch deleted the file. Continue below from zero so a fresh download
    // can repair it during this same attempt.
  }

  const resumeAt = await store.sizeOf(request.key);
  let response: Response;
  try {
    response = await doFetch(request.url, {
      signal: request.signal,
      headers: resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : undefined,
    });
  } catch (error) {
    if (request.signal?.aborted) {
      return { ok: false, failure: "cancelled", reason: "Download stopped; saved bytes can resume later." };
    }
    return {
      ok: false,
      failure: "network",
      reason: `The download could not start: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response.status === 416 && resumeAt > 0) {
    return finishVerified(store, request, resumeAt, true);
  }

  // IMPORTANT: do not delete a partial download merely because the retry got
  // a 404/500/503. Only a SUCCESSFUL 200 response proves the server ignored our
  // Range header and is sending the whole file from byte zero.
  if (!response.ok && response.status !== 206) {
    return {
      ok: false,
      failure: "network",
      reason: `The model server answered ${response.status}. Saved partial bytes were kept for retry.`,
    };
  }

  let writeAt = resumeAt;
  if (resumeAt > 0 && response.status === 200) {
    writeAt = 0;
    await store.remove(request.key);
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
    if (!buffered) return true;
    const merged = new Uint8Array(new ArrayBuffer(buffered));
    let offset = 0;
    for (const part of buffer) {
      merged.set(part, offset);
      offset += part.length;
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
        await flush();
        return { ok: false, failure: "cancelled", reason: "Download stopped; saved bytes can resume later." };
      }
      buffer.push(value);
      buffered += value.length;
      received += value.length;
      if (buffered >= CHUNK_FLUSH_BYTES && !(await flush())) {
        return {
          ok: false,
          failure: "insufficient_storage",
          reason: "The browser stopped accepting data, which usually means storage is full.",
        };
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
      return { ok: false, failure: "cancelled", reason: "Download stopped; saved bytes can resume later." };
    }
    return {
      ok: false,
      failure: "network",
      reason: `The download was interrupted: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return finishVerified(store, request, await store.sizeOf(request.key), resumed);
}

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
    // Fall through to the reviewed publisher URL.
  }
  return { url: remoteUrl, local: false };
}

export type ImportFailure =
  | "storage_unavailable"
  | "insufficient_storage"
  | "digest_mismatch"
  | "verification_unavailable";

export type ImportResult =
  | { ok: true; key: string; bytes: number; verified: boolean }
  | { ok: false; failure: ImportFailure; reason: string };

export interface ImportRequest {
  key: string;
  file: Blob;
  sha256?: string;
  onProgress?: (p: { receivedBytes: number; totalBytes: number; fraction: number }) => void;
  store?: ModelStore;
}

export async function importModelFile(request: ImportRequest): Promise<ImportResult> {
  const store = request.store ?? modelStore;
  if (!ModelStore.isSupported()) {
    return {
      ok: false,
      failure: "storage_unavailable",
      reason: "This browser cannot store a model between visits, so OCADE will not import one.",
    };
  }
  const room = await checkRoom(request.file.size);
  if (!room.ok) return { ok: false, failure: "insufficient_storage", reason: room.reason };

  await store.remove(request.key);
  const reader = request.file.stream().getReader();
  let written = 0;
  let buffer: Uint8Array[] = [];
  let buffered = 0;
  const flush = async () => {
    if (!buffered) return true;
    const merged = new Uint8Array(new ArrayBuffer(buffered));
    let offset = 0;
    for (const part of buffer) {
      merged.set(part, offset);
      offset += part.length;
    }
    const at = written - buffered;
    buffer = [];
    buffered = 0;
    return store.append(request.key, merged, at);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.push(value);
    buffered += value.length;
    written += value.length;
    if (buffered >= CHUNK_FLUSH_BYTES && !(await flush())) {
      await store.remove(request.key);
      return { ok: false, failure: "insufficient_storage", reason: "The browser ran out of storage while importing the engine." };
    }
    request.onProgress?.({
      receivedBytes: written,
      totalBytes: request.file.size,
      fraction: request.file.size ? Math.min(1, written / request.file.size) : 1,
    });
  }
  if (!(await flush())) {
    await store.remove(request.key);
    return { ok: false, failure: "insufficient_storage", reason: "The browser ran out of storage while importing the engine." };
  }

  const result = await finishVerified(
    store,
    { key: request.key, url: "", sha256: request.sha256, expectedBytes: request.file.size },
    await store.sizeOf(request.key),
    false,
  );
  if (result.ok) return { ok: true, key: result.key, bytes: result.bytes, verified: result.verified };
  return {
    ok: false,
    failure:
      result.failure === "verification_unavailable" ? "verification_unavailable" : "digest_mismatch",
    reason: result.reason,
  };
}
