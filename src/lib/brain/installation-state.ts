/**
 * The published installation state, and NOTHING ELSE.
 *
 * WHY THIS IS ITS OWN MODULE, WHICH LOOKS LIKE A SPLIT FOR ITS OWN SAKE.
 *
 * Every surface that shows preparation has to read this synchronously — a
 * progress line, a setup screen, a settings panel — and `useSyncExternalStore`
 * needs a snapshot available on the very first render. Reading it from
 * `installation-browser.ts` gives you that, and it also drags in the transfer
 * engine, the streaming digest, the vault, the storage layer, the capability
 * probes and the model catalogue, all statically, into whichever chunk did the
 * reading. Mounted at the application root, that chunk is the entry bundle.
 *
 * Measured: it pushed the largest eager asset from 507 KiB to 557 KiB and the
 * production budget gate refused the build — correctly. First paint is a text
 * box and a landing page; none of that machinery is needed to draw it, and
 * shipping an installer to somebody who has not yet decided to stay is bytes
 * spent before the product has done anything.
 *
 * So the state lives here, in a module with no imports at all beyond a type,
 * and the machinery is loaded on an idle callback afterwards. Components read
 * this; the authority publishes into it. Neither has to know about the other,
 * which is the same reason `preparation.ts` was a module-level store — except
 * that this one has a single writer, and that is what stopped two surfaces
 * being able to disagree.
 */

import type { InstallStage, InstallState } from "./installation-authority";

export const IDLE_INSTALL_STATE: InstallState = {
  stage: "idle",
  fraction: null,
  etaSeconds: null,
  detail: null,
  problem: null,
  remedies: [],
  observing: false,
  retries: 0,
  path: null,
};

let current: InstallState = IDLE_INSTALL_STATE;
const listeners = new Set<(state: InstallState) => void>();

/** The current state. A stable reference between changes, as the store hook needs. */
export function installState(): InstallState {
  return current;
}

export function subscribeToInstallState(listener: (state: InstallState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Publish a new state.
 *
 * CALLED ONLY BY THE AUTHORITY. A second writer would recreate exactly the
 * defect this whole change removed: two things with opinions about whether
 * OCADE is preparing, and a screen able to render both at once.
 */
export function publishInstallState(state: InstallState): void {
  if (state === current) return;
  current = state;
  for (const listener of listeners) listener(state);
}

/**
 * ONE SHORT LINE FOR A PERSON, DERIVED FROM THE STATE.
 *
 * `PLAN.md` Phase 7 fixes the vocabulary a normal customer may see —
 * `Preparing OCADE`, `Downloading <percent>`, `Verifying`, `Ready`,
 * `Repairing`, `Removed` — and the words are chosen to describe what OCADE is
 * doing rather than what is running. Never a model name, a vendor, a file name,
 * a quantisation, a parameter count, a download size, or the words WebGPU or
 * WebAssembly. Somebody meeting OCADE for the first time is not debugging a
 * runtime.
 *
 * The early stages all read `Preparing OCADE` on purpose: checking a device,
 * checking storage, compiling a runtime and choosing a source are four things
 * to an engineer and one thing to everybody else.
 */
export function describeInstall(state: InstallState): string {
  if (state.problem && isErrorStage(state.stage)) return state.problem;
  switch (state.stage) {
    case "idle":
      /*
       * Idle means two different things, and only the detail tells them apart:
       * nothing has started yet, or somebody removed it. It used to say
       * "Starting OCADE…" for both, which is untrue in exactly the case where
       * the person is looking at the screen to check it worked.
       */
      return state.detail ?? "Preparing OCADE";
    case "checking_device":
    case "checking_storage":
    case "preparing_runtime":
    case "waiting_for_source":
      return "Preparing OCADE";
    case "downloading": {
      const pct = state.fraction === null ? null : Math.round(state.fraction * 100);
      return pct === null ? "Preparing OCADE" : `Downloading ${pct}%`;
    }
    case "paused":
      return state.detail ?? "Paused";
    case "retrying":
      return "Reconnecting — OCADE will carry on from where it stopped";
    case "verifying":
      return "Verifying";
    case "loading":
    case "warming":
      return "Almost ready";
    case "ready":
      return "Ready";
    case "repairing":
      return "Repairing";
    case "insufficient_storage":
      return "OCADE needs more local storage on this device.";
    case "recoverable_error":
      return state.problem ?? "OCADE could not finish preparing this device.";
    case "fatal_error":
      return state.problem ?? "OCADE cannot run its intelligence on this device.";
  }
}

/** What a removal publishes, and the one line that says it happened. */
export const REMOVED_DETAIL = "Removed";

export function isErrorStage(stage: InstallStage): boolean {
  return (
    stage === "insufficient_storage" || stage === "recoverable_error" || stage === "fatal_error"
  );
}

/** True while setup is genuinely in progress — the setup screen's condition. */
export function isPreparing(stage: InstallStage): boolean {
  return (
    stage === "checking_device" ||
    stage === "checking_storage" ||
    stage === "preparing_runtime" ||
    stage === "waiting_for_source" ||
    stage === "downloading" ||
    stage === "retrying" ||
    stage === "verifying" ||
    stage === "loading" ||
    stage === "warming" ||
    stage === "repairing"
  );
}
