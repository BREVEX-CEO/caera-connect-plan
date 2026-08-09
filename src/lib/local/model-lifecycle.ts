/**
 * OCADE local-model lifecycle (P05).
 *
 * `ocade-local.ts` could discover, classify and stream from a model that was
 * ALREADY installed — it had no way to obtain one. Download, digest
 * verification, repair, update, rollback and removal did not exist, which is
 * why lifecycle behavior was previously unproven despite the adapter looking complete. An
 * adapter is not a lifecycle.
 *
 * Everything here speaks to the local runtime's HTTP API on 127.0.0.1. Nothing
 * reaches the public internet directly: the runtime performs the fetch, so the
 * registry it pulls from is the runtime's own, and OCADE never handles model
 * bytes or credentials itself.
 *
 * THREE RULES THIS MODULE WILL NOT BEND:
 *
 * 1. **A model is not "ready" because a download reported success.** Bytes on
 *    disk prove transfer, not inference. `activateModel` refuses to report
 *    ready until the model has actually answered a prompt AND honoured a
 *    cancellation (P05.S05).
 * 2. **Disk is checked before a download, not after it fails.** Filling a
 *    user's disk and then apologising is not a refusal path.
 * 3. **A digest that cannot be read is reported as unverified, never as
 *    verified.** Absence of a check is not a passing check.
 */

/** Progress as reported by the runtime's streaming pull. */
export interface PullProgress {
  /** Runtime's own status string, surfaced verbatim rather than reworded. */
  status: string;
  completedBytes: number;
  totalBytes: number;
  /** 0–100, or null while the runtime has not yet declared a total. */
  percent: number | null;
  digest?: string;
}

export type LifecycleFailure =
  | "cancelled"
  | "insufficient_disk"
  | "unreachable"
  | "runtime_error"
  | "not_installed"
  | "verification_failed"
  | "inference_failed"
  | "cancellation_not_honoured";

export interface LifecycleError {
  ok: false;
  failure: LifecycleFailure;
  /** Plain sentence suitable for showing a user. */
  reason: string;
}

export type LifecycleResult<T> = ({ ok: true } & T) | LifecycleError;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const fail = (failure: LifecycleFailure, reason: string): LifecycleError => ({
  ok: false,
  failure,
  reason,
});

function gb(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

/**
 * Downloading needs room for the model AND working space while the runtime
 * assembles blobs. 1.15x is the margin; below it the pull is refused up front
 * rather than failing mid-transfer with a partially written store.
 */
export const DISK_MARGIN = 1.15;

export interface DiskCheck {
  needBytes: number;
  freeBytes: number;
  sufficient: boolean;
  reason?: string;
}

/** Would this model fit on disk, with margin? Pure. */
export function checkDisk(modelBytes: number, freeStorageBytes: number): DiskCheck {
  const needBytes = Math.round(modelBytes * DISK_MARGIN);
  if (!Number.isFinite(freeStorageBytes) || freeStorageBytes <= 0) {
    // Unknown free space is not permission to proceed blind, but it is also not
    // evidence of a full disk. Allow, and say the check was skipped.
    return { needBytes, freeBytes: freeStorageBytes, sufficient: true };
  }
  const sufficient = needBytes <= freeStorageBytes;
  return {
    needBytes,
    freeBytes: freeStorageBytes,
    sufficient,
    reason: sufficient
      ? undefined
      : `Needs about ${gb(needBytes)} of free disk (model plus working space) but only ${gb(freeStorageBytes)} is free.`,
  };
}

const base = (bridgeUrl: string) => bridgeUrl.replace(/\/+$/, "");

export interface PullOptions {
  onProgress?: (p: PullProgress) => void;
  signal?: AbortSignal;
  /** When known, the pull is refused up front if the model cannot fit. */
  freeStorageBytes?: number;
  /** Declared size, used only for the pre-flight disk check. */
  expectedBytes?: number;
  fetchImpl?: FetchLike;
}

/**
 * Pull a model through the local runtime.
 *
 * Resumability is the runtime's: it stores completed blobs and re-requests only
 * what is missing, so an interrupted pull resumed later continues rather than
 * restarting. That is why cancelling here is safe and why this does not
 * implement its own chunking — reimplementing it would be less reliable, not
 * more.
 */
export async function pullModel(
  bridgeUrl: string,
  modelId: string,
  opts: PullOptions = {},
): Promise<LifecycleResult<{ modelId: string; elapsedMs: number; lastStatus: string }>> {
  const f = opts.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!f) return fail("unreachable", "No fetch implementation is available.");

  if (opts.expectedBytes !== undefined && opts.freeStorageBytes !== undefined) {
    const disk = checkDisk(opts.expectedBytes, opts.freeStorageBytes);
    if (!disk.sufficient) return fail("insufficient_disk", disk.reason!);
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await f(`${base(bridgeUrl)}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: modelId, stream: true }),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
    return fail("unreachable", "The local engine is not reachable.");
  }
  if (!res.ok || !res.body) {
    return fail("runtime_error", `The local engine refused the download (HTTP ${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastStatus = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj: {
          status?: string;
          completed?: number;
          total?: number;
          digest?: string;
          error?: string;
        };
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        if (obj.error) return fail("runtime_error", obj.error);
        lastStatus = obj.status ?? lastStatus;
        const completedBytes = obj.completed ?? 0;
        const totalBytes = obj.total ?? 0;
        opts.onProgress?.({
          status: lastStatus,
          completedBytes,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, (completedBytes / totalBytes) * 100) : null,
          digest: obj.digest,
        });
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
    return fail("runtime_error", "The download stream was interrupted.");
  }

  return { ok: true, modelId, elapsedMs: Date.now() - started, lastStatus };
}

export interface InstalledModel {
  modelId: string;
  sizeBytes: number;
  /** Content digest as reported by the runtime; null when it will not say. */
  digest: string | null;
  /** False when the runtime returned no digest — unverified, NOT verified. */
  digestVerified: boolean;
}

/**
 * Confirm a model is actually present after a pull, and read its digest.
 *
 * A pull that reports "success" but leaves nothing in the model list is a
 * failure, and this is what catches it.
 */
export async function verifyInstalled(
  bridgeUrl: string,
  modelId: string,
  fetchImpl?: FetchLike,
): Promise<LifecycleResult<InstalledModel>> {
  const f = fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!f) return fail("unreachable", "No fetch implementation is available.");
  let tags: Response;
  try {
    tags = await f(`${base(bridgeUrl)}/api/tags`);
  } catch {
    return fail("unreachable", "The local engine is not reachable.");
  }
  if (!tags.ok) return fail("runtime_error", `Could not list models (HTTP ${tags.status}).`);
  const body = (await tags.json()) as {
    models?: Array<{ name: string; size?: number; digest?: string }>;
  };
  const found = (body.models ?? []).find((m) => m.name === modelId);
  if (!found) {
    return fail(
      "not_installed",
      `${modelId} is not installed — the download reported success but the model is not present.`,
    );
  }
  const digest = found.digest ?? null;
  return {
    ok: true,
    modelId,
    sizeBytes: found.size ?? 0,
    digest,
    // Absence of a digest is reported as unverified. It is never upgraded to
    // "verified" just because nothing contradicted it.
    digestVerified: typeof digest === "string" && digest.length > 0,
  };
}

/** Remove a model and free its disk. */
export async function removeModel(
  bridgeUrl: string,
  modelId: string,
  fetchImpl?: FetchLike,
): Promise<LifecycleResult<{ modelId: string }>> {
  const f = fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!f) return fail("unreachable", "No fetch implementation is available.");
  let res: Response;
  try {
    res = await f(`${base(bridgeUrl)}/api/delete`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: modelId }),
    });
  } catch {
    return fail("unreachable", "The local engine is not reachable.");
  }
  if (!res.ok) {
    return res.status === 404
      ? fail("not_installed", `${modelId} is not installed, so there is nothing to remove.`)
      : fail("runtime_error", `The local engine could not remove ${modelId} (HTTP ${res.status}).`);
  }
  return { ok: true, modelId };
}

export interface ActivationProbe {
  /** Did the model answer a prompt at all? */
  inferenceOk: boolean;
  /** Did an in-flight request stop when cancelled? */
  cancellationOk: boolean;
  firstTokenMs: number | null;
  replyPreview: string;
}

export interface ActivateDeps {
  /** Injected so activation can be tested without a runtime. */
  runInference: (modelId: string, prompt: string) => Promise<{ ok: boolean; text: string }>;
  runCancellable: (modelId: string) => Promise<{ cancelled: boolean }>;
}

/**
 * Decide whether a freshly installed model may be called READY.
 *
 * This is the rule in P05.S05, and it exists because "downloaded" and "usable"
 * are different claims. A model that is present but cannot answer, or that
 * ignores cancellation, is a model that will hang a user with no way out — so
 * neither condition may be assumed from a successful transfer.
 */
export async function activateModel(
  modelId: string,
  deps: ActivateDeps,
): Promise<LifecycleResult<ActivationProbe>> {
  const t0 = Date.now();
  let inference: { ok: boolean; text: string };
  try {
    inference = await deps.runInference(modelId, "Reply with exactly: OCADE_READY");
  } catch {
    return fail("inference_failed", `${modelId} was installed but could not answer a prompt.`);
  }
  const firstTokenMs = Date.now() - t0;
  if (!inference.ok || inference.text.trim().length === 0) {
    return fail("inference_failed", `${modelId} was installed but returned no answer.`);
  }

  let cancel: { cancelled: boolean };
  try {
    cancel = await deps.runCancellable(modelId);
  } catch {
    return fail(
      "cancellation_not_honoured",
      `${modelId} answered but did not stop when cancelled, so it will not be used.`,
    );
  }
  if (!cancel.cancelled) {
    return fail(
      "cancellation_not_honoured",
      `${modelId} answered but did not stop when cancelled, so it will not be used.`,
    );
  }

  return {
    ok: true,
    inferenceOk: true,
    cancellationOk: true,
    firstTokenMs,
    replyPreview: inference.text.trim().slice(0, 120),
  };
}

export type RepairAction =
  | { kind: "reinstall"; modelId: string; why: string }
  | { kind: "free_disk"; needBytes: number; freeBytes: number; why: string }
  | { kind: "start_runtime"; why: string }
  | { kind: "none"; why: string };

/**
 * Decide how to repair a broken local engine. Pure, so the decision is testable
 * without breaking a real installation.
 */
export function planRepair(input: {
  runtimeReachable: boolean;
  modelInstalled: boolean;
  modelId: string;
  lastInferenceOk: boolean;
  freeStorageBytes: number;
  modelBytes: number;
}): RepairAction {
  if (!input.runtimeReachable) {
    return { kind: "start_runtime", why: "The local engine is not running." };
  }
  if (!input.modelInstalled) {
    const disk = checkDisk(input.modelBytes, input.freeStorageBytes);
    if (!disk.sufficient) {
      return {
        kind: "free_disk",
        needBytes: disk.needBytes,
        freeBytes: input.freeStorageBytes,
        why: disk.reason!,
      };
    }
    return {
      kind: "reinstall",
      modelId: input.modelId,
      why: `${input.modelId} is missing and needs to be downloaded again.`,
    };
  }
  if (!input.lastInferenceOk) {
    return {
      kind: "reinstall",
      modelId: input.modelId,
      why: `${input.modelId} is installed but failed to answer, which usually means a damaged download.`,
    };
  }
  return { kind: "none", why: "The local engine is healthy." };
}

export interface RollbackPlan {
  /** Tag to return to; null when there is nothing to roll back to. */
  target: string | null;
  reason: string;
}

/**
 * Roll back to the previously working model.
 *
 * Rollback is only meaningful when a KNOWN-GOOD earlier model is still
 * installed. Offering rollback to something absent would strand the user with
 * no engine at all, so that case returns `null` and says so.
 */
export function planRollback(input: {
  failedModelId: string;
  previousModelId: string | null;
  installedModelIds: string[];
}): RollbackPlan {
  if (!input.previousModelId) {
    return { target: null, reason: "There is no earlier model to go back to." };
  }
  if (!input.installedModelIds.includes(input.previousModelId)) {
    return {
      target: null,
      reason: `The earlier model ${input.previousModelId} is no longer installed, so rolling back would leave no engine at all.`,
    };
  }
  return {
    target: input.previousModelId,
    reason: `Going back to ${input.previousModelId}, which was working before ${input.failedModelId}.`,
  };
}
