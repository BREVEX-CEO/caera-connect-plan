import { useCallback, useMemo } from "react";
import { installationAuthority } from "./installation-browser";
import { authorityBackedAdapter } from "./runtime-activation";
import { REMEDY_LABELS, type BrainAdapter, type BrainMessage, type RemedyAction } from "./adapter";

/**
 * The on-device engine, as Chat sees it.
 *
 * WHAT THIS USED TO BE. A registry of four adapters — a desktop bridge, a
 * paired computer, a WebGPU engine and a WebAssembly one — a device-mode
 * resolver deciding their order, and a `warm` that probed the bridge, asked for
 * persistent storage and could start a download of its own. It was one of five
 * independent things in the product that could each begin downloading the same
 * model.
 *
 * There is one engine now, the installation authority is the only thing that
 * may start it, and `adapter` holds no engine of its own: it forwards to
 * whatever the authority has running and otherwise says, in preparation
 * language, that the device is still being prepared.
 */
export interface BrainHandle {
  /** Forwards to the running engine; never starts one. */
  adapter: BrainAdapter;
  /**
   * Ask for the engine to be ready.
   *
   * A REQUEST TO JOIN, NOT A SECOND INSTALLER: `install()` attaches to whatever
   * is already in flight rather than starting anything, so the composer may ask
   * on a keystroke without that being able to create a download.
   */
  warm: (pending?: BrainMessage[]) => void;
  /** Labels for the remedy buttons a refusal offers. */
  remedyLabel: (remedy: RemedyAction) => string;
}

export function useBrain(): BrainHandle {
  const adapter = useMemo(() => authorityBackedAdapter(), []);

  const warm = useCallback((pending?: BrainMessage[]) => {
    /*
     * `pending` is deliberately unused. It existed so the runtime could be
     * warmed at the context window the next message would need; the authority
     * decides the window from the artifact and the device, and re-warming at a
     * different one per keystroke was work the user paid for twice.
     */
    void pending;
    void installationAuthority().install({ reason: "warm" });
  }, []);

  const remedyLabel = useCallback((remedy: RemedyAction) => REMEDY_LABELS[remedy], []);

  /*
   * MEMOISED, and that is not a micro-optimisation. A fresh object literal on
   * every render gives every caller that puts the handle in a dependency array
   * a new identity each render — effect, set state, re-render, "Maximum update
   * depth exceeded".
   */
  return useMemo(() => ({ adapter, warm, remedyLabel }), [adapter, warm, remedyLabel]);
}
