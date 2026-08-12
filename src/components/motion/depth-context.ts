import { createContext, useContext } from "react";
import type { DepthMode } from "@/lib/motion/depth";

/**
 * The scene's state, shared with anything that needs to know.
 *
 * In its own module because `DepthScene.tsx` must export only a component:
 * mixing a hook in defeats React Fast Refresh for the whole file, so editing
 * the scene would force a full reload instead of a hot update. Same split the
 * shell makes between `shell-context.tsx` and `use-shell.ts`.
 */
export interface DepthContextValue {
  mode: DepthMode;
  /** True when surfaces should carry depth at all. */
  enabled: boolean;
  /** True when surfaces should also tilt with the pointer. */
  interactive: boolean;
}

export const DepthContext = createContext<DepthContextValue>({
  mode: "flat",
  enabled: false,
  interactive: false,
});

export function useDepth(): DepthContextValue {
  return useContext(DepthContext);
}
