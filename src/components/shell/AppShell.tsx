import type { ReactNode } from "react";
import { WorkspaceShell } from "./WorkspaceShell";

/**
 * Compatibility wrapper. `WorkspaceShell` is now the single OCADE shell
 * (Plan §37); every authenticated page keeps importing `AppShell` and renders
 * the unified shell without any call-site change.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <WorkspaceShell variant="app">{children}</WorkspaceShell>;
}
