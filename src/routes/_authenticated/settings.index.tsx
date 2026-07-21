import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Shield, Laptop, ChevronRight, Palette } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PrivacyBadge } from "@/components/shell/PrivacyBadge";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "Settings — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await recordAction({ actionId: "auth.sign_out" });
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your identity, privacy and devices."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GlassPanel className="flex flex-col gap-3 p-5">
          <h3 className="text-sm font-semibold text-foreground">Signed in as</h3>
          <p className="text-sm text-muted-foreground">
            {user?.email ?? user?.phone ?? "Unknown account"}
          </p>
          <div>
            <PrivacyBadge mode="private_sync" />
          </div>
          <button
            onClick={signOut}
            disabled={busy}
            className="mt-2 inline-flex items-center justify-center gap-2 self-start rounded-lg border border-border/60 bg-background/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </GlassPanel>

        <Link to="/settings/privacy" className="group">
          <GlassPanel className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
            <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
              <Shield className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Privacy</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose Device Only or Private Sync per data class.
              </p>
            </div>
          </GlassPanel>
        </Link>

        <Link to="/settings/devices" className="group">
          <GlassPanel className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
            <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
              <Laptop className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Devices</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Two desktop and two mobile devices per account. Revoke anytime.
              </p>
            </div>
          </GlassPanel>
        </Link>

        <Link to="/settings/appearance" className="group">
          <GlassPanel className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
            <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
              <Palette className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Theme, motion, cursor and accessibility preferences.
              </p>
            </div>
          </GlassPanel>
        </Link>

        <SetupRequiredState
          title="Roles & organizations ship next"
          description="Multi-tenant orgs, role assignment and audit trail arrive with FICIA slice P20+."
        />
      </div>
    </AppShell>
  );
}
