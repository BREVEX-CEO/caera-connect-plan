import { createContext, useContext, type ReactNode } from "react";

/**
 * Workspace shell context (Plan §37).
 *
 * Lets a module inject its own contextual sidebar content (e.g. OCADE's
 * conversation list, which owns that state) and control the adaptive Copilot
 * panel, without the shell needing to know about each module's internals.
 *
 * The context and its accessor live here, apart from the provider component,
 * so that editing the provider does not force a full reload: a module that
 * exports both a component and a hook cannot be hot-replaced, and the shell is
 * the one component in the app that is mounted on every single screen.
 */
export interface ShellContextValue {
  /** Module-provided contextual sidebar content, rendered under the module nav. */
  contextualNav: ReactNode | null;
  setContextualNav: (node: ReactNode | null) => void;
  /** Adaptive right-hand Copilot panel. */
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotContent: ReactNode | null;
  setCopilotContent: (node: ReactNode | null) => void;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

/**
 * Safe accessor — returns null outside a ShellProvider so pages that render
 * standalone (auth, onboarding, marketing) don't crash.
 */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}
