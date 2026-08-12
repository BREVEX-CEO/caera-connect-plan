import { useMemo, useState, type ReactNode } from "react";
import { ShellContext, type ShellContextValue } from "./use-shell";

/**
 * Provider for the workspace shell context.
 *
 * The context object, its type and `useShell` live in `./use-shell` — see the
 * note there for why the split exists.
 */
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
