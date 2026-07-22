import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { WorkspaceShell } from "./WorkspaceShell";
import { useDemo } from "@/lib/demo/context";

/**
 * Demo variant of the single OCADE shell. Demo isolation is unchanged: state
 * lives in DemoProvider (in-memory, never Supabase); this only supplies the
 * demo chrome — badge, sign-in CTA, reset/exit.
 */
export function DemoShell({ children }: { children: ReactNode }) {
  const { reset, exit } = useDemo();
  const navigate = useNavigate();

  return (
    <WorkspaceShell
      variant="demo"
      onDemoReset={() => reset()}
      onDemoExit={() => {
        exit();
        void navigate({ to: "/" });
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
