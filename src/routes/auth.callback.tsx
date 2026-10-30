import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { AuthShell } from "@/components/shell/AuthShell";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";
import { DEFAULT_NEXT, rememberedNext, safeNext } from "@/lib/auth/safe-next";

const searchSchema = z.object({
  next: z.string().optional(),
  // PKCE authorisation code + state, kept in the schema so the router does not
  // discard them before the session exchange runs.
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Signing you in — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { next, code, error: providerError, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const inbound = readOAuthErrorFromUrl(
    { error: providerError, error_description },
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const inboundFriendly = inbound
    ? describeOAuthError("google", inbound.code, inbound.description)
    : null;
  const [error, setError] = useState<string | null>(inboundFriendly?.message ?? null);
  const [hint, setHint] = useState<string | null>(inboundFriendly?.hint ?? null);

  useEffect(() => {
    if (error) return;
    const target = safeNext(next ?? rememberedNext()) ?? DEFAULT_NEXT;

    let cancelled = false;
    let done = false;

    const fail = (cause: unknown) => {
      if (cancelled || done) return;
      const friendly = describeOAuthError("google", cause);
      setError(friendly.message);
      setHint(friendly.hint ?? null);
    };

    const finish = async () => {
      const supabase = await loadSupabaseClient();
      if (cancelled || done) return;
      // getUser() revalidates the token with the auth server, so a stale or
      // partially written session cannot send someone into the app.
      const { data, error: userError } = await supabase.auth.getUser();
      if (cancelled || done) return;
      if (userError || !data.user) return;
      done = true;
      /*
       * Straight to where they were going. This used to read
       * `profiles.onboarding_completed` first and divert to the setup wizard;
       * `docs/PRD.md` now sends a verified session to the intended deep
       * link, or to Chat when there is none.
       */
      navigate({ to: target, replace: true });
    };

    const restore = async () => {
      const supabase = await loadSupabaseClient();
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          await finish();
          return;
        }
        // No session yet: complete the PKCE exchange ourselves when the
        // provider returned an authorisation code and the client's automatic
        // detection did not consume it (for example after a full page reload).
        const authCode = code ?? new URLSearchParams(window.location.search).get("code");
        if (authCode) {
          // The SDK sends what it is given as the auth code itself: the code, never the whole URL.
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (cancelled) return;
          if (exchangeError && !/code verifier|already/i.test(exchangeError.message)) {
            fail(exchangeError.message);
            return;
          }
          await finish();
        }
        // Otherwise wait for onAuthStateChange from the implicit-flow handler.
      } catch (e) {
        fail(e);
      }
    };

    void restore();

    /*
     * BOTH LISTENERS ATTACH ONCE THE CLIENT ARRIVES.
     *
     * The client is loaded on demand rather than imported: this route is
     * statically reachable from the route tree, so a top-level import put the
     * whole auth stack on the entry chunk's graph. The `restore()` above
     * already awaits it, so by the time this resolves the module is in memory
     * and the wait is a resolved promise.
     */
    let unsubscribe: (() => void) | undefined;
    void loadSupabaseClient().then((supabase) => {
      if (cancelled || done) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled || done || !session) return;
        void finish();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    // Late safety net: poll in case the storage write landed without an event.
    const poll = window.setInterval(() => {
      if (cancelled || done) return;
      void loadSupabaseClient()
        .then((supabase) => supabase.auth.getSession())
        .then(({ data }) => {
          if (data.session) void finish();
        })
        .catch(() => undefined);
    }, 1200);

    const timeout = window.setTimeout(() => {
      if (!cancelled && !done) {
        setError("Sign-in is taking longer than expected.");
        setHint("Your connection may have dropped. Please return to sign-in and try again.");
      }
    }, 15000);

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
  }, [code, error, navigate, next]);

  return (
    <AuthShell
      title="Signing you in"
      subtitle="Completing your sign-in — this should only take a moment."
    >
      {error ? (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <p className="font-medium">{error}</p>
            {hint ? <p className="mt-1 text-destructive/85">{hint}</p> : null}
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Back to sign-in
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Verifying your session…
        </div>
      )}
    </AuthShell>
  );
}
