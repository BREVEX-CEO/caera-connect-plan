/** OCADE local-model lifecycle. All model traffic is loopback to the local runtime. */

export interface PullProgress {
  status: string;
  completedBytes: number;
  totalBytes: number;
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
  reason: string;
}
export type LifecycleResult<T> = ({ ok: true } & T) | LifecycleError;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const fail = (failure: LifecycleFailure, reason: string): LifecycleError => ({ ok: false, failure, reason });
const base = (bridgeUrl: string) => bridgeUrl.replace(/\/+$/, "");
const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

export const DISK_MARGIN = 1.15;
export interface DiskCheck {
  needBytes: number;
  freeBytes: number;
  sufficient: boolean;
  reason?: string;
}
export function checkDisk(modelBytes: number, freeStorageBytes: number): DiskCheck {
  const needBytes = Math.round(modelBytes * DISK_MARGIN);
  if (!Number.isFinite(freeStorageBytes) || freeStorageBytes <= 0)
    return { needBytes, freeBytes: freeStorageBytes, sufficient: true };
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

export interface PullRetryNotice {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason: string;
  message: string;
}
export interface PullOptions {
  onProgress?: (p: PullProgress) => void;
  onRetry?: (notice: PullRetryNotice) => void;
  signal?: AbortSignal;
  freeStorageBytes?: number;
  expectedBytes?: number;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export const DEFAULT_PULL_ATTEMPTS = 5;
export const DEFAULT_PULL_RETRY_BASE_MS = 750;

async function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function aborted(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

type PullLine = {
  status?: string;
  completed?: number;
  total?: number;
  digest?: string;
  error?: string;
};

function parsePullLine(
  line: string,
  currentStatus: string,
  onProgress?: (p: PullProgress) => void,
): { status: string; runtimeError: string | null } {
  if (!line.trim()) return { status: currentStatus, runtimeError: null };
  let obj: PullLine;
  try {
    obj = JSON.parse(line) as PullLine;
  } catch {
    // Ollama-compatible streams should be NDJSON, but one malformed progress
    // line must not make a valid later success impossible.
    return { status: currentStatus, runtimeError: null };
  }
  if (obj.error) return { status: currentStatus, runtimeError: obj.error };
  const status = obj.status ?? currentStatus;
  const completedBytes = obj.completed ?? 0;
  const totalBytes = obj.total ?? 0;
  onProgress?.({
    status,
    completedBytes,
    totalBytes,
    percent: totalBytes > 0 ? Math.min(100, (completedBytes / totalBytes) * 100) : null,
    digest: obj.digest,
  });
  return { status, runtimeError: null };
}

/**
 * Pull through Ollama-compatible /api/pull with bounded automatic retry.
 * Ollama keeps completed blobs, so sending the same pull after an interruption
 * resumes missing content rather than intentionally discarding progress.
 */
export async function pullModel(
  bridgeUrl: string,
  modelId: string,
  opts: PullOptions = {},
): Promise<LifecycleResult<{ modelId: string; elapsedMs: number; lastStatus: string; attempts: number }>> {
  const f = opts.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!f) return fail("unreachable", "No fetch implementation is available.");
  if (opts.expectedBytes !== undefined && opts.freeStorageBytes !== undefined) {
    const disk = checkDisk(opts.expectedBytes, opts.freeStorageBytes);
    if (!disk.sufficient) return fail("insufficient_disk", disk.reason!);
  }

  const started = Date.now();
  const maxAttempts = Math.max(1, Math.floor(opts.maxAttempts ?? DEFAULT_PULL_ATTEMPTS));
  const retryBase = Math.max(0, opts.retryBaseDelayMs ?? DEFAULT_PULL_RETRY_BASE_MS);
  const sleeper = opts.sleep ?? sleepWithSignal;
  let lastFailure = "The model download was interrupted.";
  let lastStatus = "";
  let sawResponse = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await f(`${base(bridgeUrl)}/api/pull`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: modelId, stream: true }),
        signal: opts.signal,
      });
      sawResponse = true;
      if (!res.ok || !res.body) {
        lastFailure = `The local engine refused the download (HTTP ${res.status}).`;
        if (res.status >= 400 && res.status < 500) return fail("runtime_error", lastFailure);
        throw new Error(lastFailure);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let semanticError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          const parsed = parsePullLine(line, lastStatus, opts.onProgress);
          lastStatus = parsed.status;
          if (parsed.runtimeError) {
            semanticError = parsed.runtimeError;
            break;
          }
        }
        if (semanticError) break;
      }

      // TextDecoder can hold a final multibyte fragment, and Ollama-compatible
      // servers are not required to end the last NDJSON object with `\n`.
      // Ignoring this tail used to turn a final `{error:...}` into false success.
      if (!semanticError) {
        buffer += decoder.decode();
        const tail = parsePullLine(buffer.trim(), lastStatus, opts.onProgress);
        lastStatus = tail.status;
        semanticError = tail.runtimeError;
      }

      if (semanticError) return fail("runtime_error", semanticError);
      return { ok: true, modelId, elapsedMs: Date.now() - started, lastStatus, attempts: attempt };
    } catch (error) {
      if (aborted(error, opts.signal)) {
        return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
      }
      lastFailure = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts) break;
      const delayMs = retryBase * 2 ** (attempt - 1);
      opts.onRetry?.({
        attempt: attempt + 1,
        maxAttempts,
        delayMs,
        reason: lastFailure,
        message: `Model download was interrupted. Retrying automatically (${attempt + 1}/${maxAttempts}); completed Ollama blobs will be reused.`,
      });
      try {
        await sleeper(delayMs, opts.signal);
      } catch (sleepError) {
        if (aborted(sleepError, opts.signal)) {
          return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
        }
        lastFailure = sleepError instanceof Error ? sleepError.message : String(sleepError);
      }
    }
  }

  return fail(
    sawResponse ? "runtime_error" : "unreachable",
    `${lastFailure} OCADE retried the local model download ${maxAttempts} times and preserved resumable progress.`,
  );
}

export interface InstalledModel {
  modelId: string;
  sizeBytes: number;
  digest: string | null;
  digestVerified: boolean;
}
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
  const body = (await tags.json()) as { models?: Array<{ name: string; size?: number; digest?: string }> };
  const found = (body.models ?? []).find((m) => m.name === modelId);
  if (!found)
    return fail(
      "not_installed",
      `${modelId} is not installed — the download reported success but the model is not present.`,
    );
  const digest = found.digest ?? null;
  return { ok: true, modelId, sizeBytes: found.size ?? 0, digest, digestVerified: !!digest };
}

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
  if (!res.ok)
    return res.status === 404
      ? fail("not_installed", `${modelId} is not installed, so there is nothing to remove.`)
      : fail("runtime_error", `The local engine could not remove ${modelId} (HTTP ${res.status}).`);
  return { ok: true, modelId };
}

export interface ActivationProbe {
  inferenceOk: boolean;
  cancellationOk: boolean;
  firstTokenMs: number | null;
  replyPreview: string;
}
export interface ActivateDeps {
  runInference: (modelId: string, prompt: string) => Promise<{ ok: boolean; text: string }>;
  runCancellable: (modelId: string) => Promise<{ cancelled: boolean }>;
}
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
  if (!inference.ok || inference.text.trim().length === 0)
    return fail("inference_failed", `${modelId} was installed but returned no answer.`);
  let cancel: { cancelled: boolean };
  try {
    cancel = await deps.runCancellable(modelId);
  } catch {
    return fail(
      "cancellation_not_honoured",
      `${modelId} answered but did not stop when cancelled, so it will not be used.`,
    );
  }
  if (!cancel.cancelled)
    return fail(
      "cancellation_not_honoured",
      `${modelId} answered but did not stop when cancelled, so it will not be used.`,
    );
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
export function planRepair(input: {
  runtimeReachable: boolean;
  modelInstalled: boolean;
  modelId: string;
  lastInferenceOk: boolean;
  freeStorageBytes: number;
  modelBytes: number;
}): RepairAction {
  if (!input.runtimeReachable) return { kind: "start_runtime", why: "The local engine is not running." };
  if (!input.modelInstalled) {
    const disk = checkDisk(input.modelBytes, input.freeStorageBytes);
    if (!disk.sufficient)
      return {
        kind: "free_disk",
        needBytes: disk.needBytes,
        freeBytes: input.freeStorageBytes,
        why: disk.reason!,
      };
    return {
      kind: "reinstall",
      modelId: input.modelId,
      why: `${input.modelId} is missing and needs to be downloaded again.`,
    };
  }
  if (!input.lastInferenceOk)
    return {
      kind: "reinstall",
      modelId: input.modelId,
      why: `${input.modelId} is installed but failed to answer, which usually means a damaged download.`,
    };
  return { kind: "none", why: "The local engine is healthy." };
}

export interface RollbackPlan {
  target: string | null;
  reason: string;
}
export function planRollback(input: {
  failedModelId: string;
  previousModelId: string | null;
  installedModelIds: string[];
}): RollbackPlan {
  if (!input.previousModelId) return { target: null, reason: "There is no earlier model to go back to." };
  if (!input.installedModelIds.includes(input.previousModelId))
    return {
      target: null,
      reason: `The earlier model ${input.previousModelId} is no longer installed, so rolling back would leave no engine at all.`,
    };
  return {
    target: input.previousModelId,
    reason: `Going back to ${input.previousModelId}, which was working before ${input.failedModelId}.`,
  };
}
