/**
 * "Preparing OCADE Intelligence" — the one place that knows how far along it is.
 *
 * WHY A MODULE-LEVEL STORE RATHER THAN REACT STATE.
 *
 * Both browser adapters already accept an `onProgress` callback, and both are
 * constructed inside a `useMemo` in `use-brain.ts` that passed no options at
 * all. So the progress existed, was emitted, and went nowhere: `EngineState`
 * had a `progress: number | null` field that nothing ever set, and a first
 * visit downloading 340 MB showed a spinner with no percentage and no size.
 *
 * The adapters are constructed once per hook instance and shared across tabs
 * by `shareAcrossTabs`, while the thing that wants to DISPLAY progress is
 * whichever component happens to be mounted. Threading a callback from the
 * display down through the registry would couple the two and would break the
 * moment a second surface wanted to watch. A small store that adapters publish
 * to and components subscribe to keeps both ends unaware of each other.
 *
 * Nothing here is persisted. Progress is about this moment; what survives a
 * reload is the bytes on disk, which `model-store.ts` owns.
 */

export type PreparationStage =
  /** Nothing started. */
  | "idle"
  /** Working out what this device can run and what is already stored. */
  | "checking"
  /** Bytes are moving. `fraction` is meaningful when not null. */
  | "downloading"
  /** Bytes are here; the runtime is compiling or loading them. */
  | "loading"
  /** An engine is ready to answer. */
  | "ready"
  /**
   * This device cannot prepare an engine at all.
   *
   * Distinct from a failure: a browser with no WebGPU and no WebAssembly
   * threads is not broken and retrying will not help, so the message must not
   * offer a retry.
   */
  | "unsupported"
  /**
   * Something went wrong and trying again is reasonable.
   *
   * Deliberately separate from `unsupported`, because the whole point of the
   * self-healing download is that an ordinary network interruption is NOT a
   * dead end — the bytes already on disk are kept and the next attempt resumes
   * from them.
   */
  | "retrying";

export interface PreparationState {
  stage: PreparationStage;
  /** 0–1 when the total is known, null when it genuinely is not. */
  fraction: number | null;
  /** Bytes received so far, when the runtime reports them. */
  receivedBytes: number | null;
  /** Total bytes, when known. */
  totalBytes: number | null;
  /**
   * One short line for a person, in product language.
   *
   * Never "GGUF", "q4f16_1", "WebGPU adapter" or a model repository path. A
   * user preparing OCADE for the first time is not debugging a runtime.
   */
  detail: string | null;
}

const INITIAL: PreparationState = {
  stage: "idle",
  fraction: null,
  receivedBytes: null,
  totalBytes: null,
  detail: null,
};

let current: PreparationState = INITIAL;
const listeners = new Set<(state: PreparationState) => void>();

export function preparationState(): PreparationState {
  return current;
}

export function subscribeToPreparation(fn: (state: PreparationState) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

/**
 * Publish a change.
 *
 * Partial on purpose: an adapter that knows only the fraction should not have
 * to restate the stage, and a stage change should not blank a byte count the
 * user is watching.
 */
export function publishPreparation(patch: Partial<PreparationState>): void {
  const next = { ...current, ...patch };
  if (
    next.stage === current.stage &&
    next.fraction === current.fraction &&
    next.receivedBytes === current.receivedBytes &&
    next.totalBytes === current.totalBytes &&
    next.detail === current.detail
  ) {
    return;
  }
  current = next;
  for (const fn of listeners) fn(current);
}

/** Reset, for tests and for a deliberate re-preparation. */
export function resetPreparation(): void {
  current = INITIAL;
  for (const fn of listeners) fn(current);
}

/**
 * Turn a runtime's own progress report into something a person can read.
 *
 * WebLLM reports a fraction and a sentence full of shard names; wllama reports
 * received and total bytes. Both are normalised here so the display never has
 * to know which engine it is watching, and so the runtime's own wording — which
 * names files and quantisation formats — never reaches the screen.
 */
export function describePreparation(state: PreparationState): string {
  switch (state.stage) {
    case "idle":
      return "OCADE is ready to start.";
    case "checking":
      return "Preparing OCADE Intelligence…";
    case "downloading": {
      const pct = state.fraction === null ? null : Math.round(state.fraction * 100);
      const size = formatSize(state.totalBytes);
      if (pct === null)
        return size ? `Preparing OCADE Intelligence — ${size}` : "Preparing OCADE Intelligence…";
      return size
        ? `Preparing OCADE Intelligence — ${pct}% of ${size}`
        : `Preparing OCADE Intelligence — ${pct}%`;
    }
    case "loading":
      return "Almost ready — starting OCADE Intelligence…";
    case "ready":
      return "OCADE Intelligence is ready.";
    case "retrying":
      return state.detail ?? "Connection interrupted. OCADE will carry on from where it stopped.";
    case "unsupported":
      return state.detail ?? "This browser cannot run OCADE's on-device intelligence.";
  }
}

function formatSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  const mb = bytes / 1_000_000;
  if (mb < 1000) return `${Math.round(mb)} MB`;
  return `${(mb / 1000).toFixed(1)} GB`;
}
