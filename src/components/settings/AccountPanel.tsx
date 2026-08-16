import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { recordAction } from "@/lib/actions";
import { useSettingsAccess } from "./use-settings-access";
import { DeleteAccountCard } from "./DeleteAccountCard";

/**
 * Account.
 *
 * WHAT IT REPLACED. Four separate placeholder pages — Profile, Account,
 * Authentication and Security — none of which rendered anything but a notice
 * saying they were not built. Four destinations in the sidebar, four clicks,
 * four apologies. This is one page that shows the account that exists and the
 * one action anyone reliably wants from it.
 *
 * DELIBERATELY SMALL. Changing an email or a password is Supabase's own flow
 * and belongs behind the sign-in screen rather than reimplemented here; adding
 * fields that post nowhere would put the placeholders back with a different
 * shape. When those flows exist, they go here.
 */
export function AccountPanel() {
  const { canEdit: signedIn, reason } = useSettingsAccess();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    setBusy(true);
    // Audit first — recordAction resolves the user from the live session,
    // which signOut destroys.
    void recordAction({ actionId: "auth.sign_out" });
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      toast.error("Could not sign out.", { description: error.message });
      return;
    }
    toast.success("Signed out.");
    await navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
    <GlassPanel className="flex flex-col gap-4 p-5">
      <header className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Account</h3>
      </header>

      {signedIn ? (
        <>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 text-[14px] text-foreground">{email ?? "…"}</p>
          </div>

          <div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void signOut()}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {busy ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </>
      ) : (
        /*
          Signed out this is a statement, not a wall — the rest of Settings is
          readable, and this page is the one place where saying so is the whole
          content rather than a banner over something else.
        */
        <>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            An account keeps your conversations, files and approved devices between visits.
            Everything else in Settings is readable without one.
          </p>
          <p className="text-[12px] text-muted-foreground/70">{reason}</p>
          <div>
            <Link
              to="/auth"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
          </div>
        </>
      )}
    </GlassPanel>
    {signedIn ? <DeleteAccountCard /> : null}
    </div>
  );
}
