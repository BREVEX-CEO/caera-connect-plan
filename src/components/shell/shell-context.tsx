import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Workspace shell context (Plan §37).
 *
 * Lets a module inject its own contextual sidebar content (e.g. OCADE's
 * conversation list, which owns that state) and control the adaptive Copilot
 * panel, without the shell needing to know about each module's internals.
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

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [contextualNav, setContextualNav] = useState<ReactNode | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotContent, setCopilotContent] = useState<ReactNode | null>(null);

  const value = useMemo<ShellContextValue>(
    () => ({
      contextualNav,
      setContextualNav,
      copilotOpen,
      setCopilotOpen,
      copilotContent,
      setCopilotContent,
    }),
    [contextualNav, copilotOpen, copilotContent],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/**
 * Safe accessor — returns null outside a ShellProvider so pages that render
 * standalone (auth, onboarding, marketing) don't crash.
 */
export function useShell(): ShellContextValue | null {
  return useContext(ShellContext);
}
