import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { AlertCircle, Check, Loader2, LogIn } from "lucide-react";
import { AuthShell } from "@/components/shell/AuthShell";
import { Button } from "@/components/ui/button";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { acceptOrganizationInvite } from "@/lib/organizations/authority";
import { hashInviteToken } from "@/lib/organizations/invite-token";

/**
 * ACCEPTING AN INVITATION — PLAN.md §F, "accept into the correct organization"
 * and "existing-account and new-account invitation paths".
 *
 * PUBLIC, DELIBERATELY. The recipient of an invitation frequently has no
 * account yet, and a route behind the authentication guard would bounce them to
 * a sign-in page that had forgotten why they came. This one keeps the token,
 * sends them to sign in or sign up, and finishes the acceptance when they
 * return — which is the same path for both cases, so there is nothing to get
 * out of step between them.
 *
 * THE TOKEN IS HASHED HERE AND THE PLAINTEXT NEVER LEAVES THE BROWSER. The
 * function that accepts takes a hash, and it reads the organization FROM THE
 * ROW the hash matches — there is no organization id in this URL for anybody to
 * change, and no way to present a valid token alongside a different workspace.
 *
 * ACCEPTANCE BINDS TO THE SIGNED-IN ACCOUNT, never to the address the
 * invitation was sent to. The address only says who it was meant for; the
 * token is what admits, and `auth.uid()` is what it admits.
 */

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/invite")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Join an organization — CARCC CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Phase =
  | { kind: "checking" }
  | { kind: "no_token" }
  | { kind: "sign_in_required" }
  | { kind: "accepting" }
  | { kind: "accepted" }
  | { kind: "refused"; message: string };

function InvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  const accept = useCallback(async () => {
    if (!token) {
      setPhase({ kind: "no_token" });
      return;
    }
    setPhase({ kind: "accepting" });
    const result = await acceptOrganizationInvite(await hashInviteToken(token));
    setPhase(result.ok ? { kind: "accepted" } : { kind: "refused", message: result.message });
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        if (!cancelled) setPhase({ kind: "no_token" });
        return;
      }
      const supabase = await loadSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setPhase({ kind: "sign_in_required" });
        return;
      }
      await accept();
    })();
    return () => {
      cancelled = true;
    };
  }, [token, accept]);

  useEffect(() => {
    if (phase.kind !== "accepted") return;
    // Long enough to read the confirmation, short enough not to feel stuck.
    const timer = window.setTimeout(() => void navigate({ to: "/organization" }), 1_400);
    return () => window.clearTimeout(timer);
  }, [phase.kind, navigate]);

  return (
    <AuthShell
      title="Join an organization"
      subtitle="An invitation admits one account. Signing in decides which."
    >
      {phase.kind === "checking" || phase.kind === "accepting" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {phase.kind === "checking" ? "Checking your invitation…" : "Joining…"}
        </p>
      ) : null}

      {phase.kind === "no_token" ? (
        <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This link is missing its invitation code. Ask whoever invited you to resend it.
        </p>
      ) : null}

      {phase.kind === "sign_in_required" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to accept this invitation. You will come straight back
            here, and the invitation will be applied to the account you sign in with.
          </p>
          <Button asChild>
            <Link to="/auth" search={{ next: `/invite?token=${encodeURIComponent(token ?? "")}` }}>
              <LogIn aria-hidden="true" />
              Sign in to continue
            </Link>
          </Button>
        </div>
      ) : null}

      {phase.kind === "accepted" ? (
        <p
          className="flex items-start gap-2 text-sm text-[color:var(--state-success)]"
          role="status"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          You are in. Taking you to the organization…
        </p>
      ) : null}

      {phase.kind === "refused" ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {phase.message}
          </p>
          <Button variant="outline" onClick={() => void accept()}>
            Try again
          </Button>
        </div>
      ) : null}
    </AuthShell>
  );
}
