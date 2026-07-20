import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PrivacyBadge } from "@/components/shell/PrivacyBadge";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/settings")({
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

        <SetupRequiredState
          title="Device management ships in the next slice"
          description="You'll approve up to two mobile and two desktop devices, revoke any device, and replay important actions per device."
        />

        <SetupRequiredState
          title="Advanced privacy controls ship next"
          description="Per-project privacy modes, cloud-processing consent history, and export/delete-my-data land in the P4 slice."
        />

        <SetupRequiredState
          title="Roles & organizations ship next"
          description="Multi-tenant orgs, role assignment and audit trail arrive after the Foundation Alpha slice."
        />
      </div>
    </AppShell>
  );
}
