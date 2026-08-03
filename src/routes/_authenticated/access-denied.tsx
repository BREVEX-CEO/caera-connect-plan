import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { GlassPanel } from "@/components/shell/GlassPanel";

const searchSchema = z.object({
  area: z.string().optional(),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/access-denied")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Access denied — CAERA CADANE" },
      { name: "description", content: "You do not have permission to open this area of your CAERA CADANE workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { area, reason } = Route.useSearch();
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col items-center py-16">
        <GlassPanel className="w-full p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reason ??
              `You are signed in, but your account does not have permission to open ${area ?? "this area"}.`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ask a workspace owner or administrator to grant you the required role. This attempt was
            not recorded as a failure of your account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              to="/home"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to Home
            </Link>
            <Link
              to="/settings"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Open Settings
            </Link>
          </div>
        </GlassPanel>
      </div>
    </AppShell>
  );
}
