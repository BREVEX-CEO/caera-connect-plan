import type { ReactNode } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import { LocalOnlyOfflineNotice } from "@/components/ocade/LocalOnlyOfflineNotice";

/** Unified authenticated OCADE shell with the local-only/offline boundary visible. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell variant="app">
      <LocalOnlyOfflineNotice />
      {children}
    </WorkspaceShell>
  );
}
