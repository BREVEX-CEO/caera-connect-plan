import { createContext, useContext } from "react";

/**
 * Whether settings on this screen can be changed, and why not when they cannot.
 *
 * Split from `SettingsGate.tsx` so that file exports components only — a module
 * exporting both a component and a hook cannot be hot-replaced, and settings
 * panels are exactly the screens someone iterates on.
 */
export interface SettingsAccess {
  /** False when nobody is signed in. */
  canEdit: boolean;
  /** Shown on every disabled control. One sentence, one action. */
  reason: string;
}

export const SettingsAccessContext = createContext<SettingsAccess>({
  // Defaults to read-only. If a provider is forgotten, the failure mode is a
  // screen that will not save — not one that pretends to.
  canEdit: false,
  reason: "Sign in to change this setting.",
});

export function useSettingsAccess(): SettingsAccess {
  return useContext(SettingsAccessContext);
}
