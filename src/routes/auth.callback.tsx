import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/shell/AuthShell";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";
import { safeNext } from "@/lib/auth/safe-next";

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
    meta: [{ title: "Signing you in — CAERA CADANE" }, { name: "robots", content: "noindex" }],
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
    const target = safeNext(next) ?? "/home";

    let cancelled = false;
    let done = false;

    const fail = (cause: unknown) => {
      if (cancelled || done) return;
      const friendly = describeOAuthError("google", cause);
      setError(friendly.message);
      setHint(friendly.hint ?? null);
    };

    /**
     * Where the user should land. Onboarding is gated downstream anyway, but
     * resolving it here avoids bouncing through a page the gate will reject.
     * A failed read is not fatal — the gate re-asserts on the next navigation.
     */
    const resolveDestination = async (userId: string) => {
      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();
        if (!profileError && !data?.onboarding_completed) return "/onboarding";
      } catch {
        /* fall through to the requested destination */
      }
      return target;
    };

    const finish = async () => {
      if (cancelled || done) return;
      // getUser() revalidates the token with the auth server, so a stale or
      // partially written session cannot send someone into the app.
      const { data, error: userError } = await supabase.auth.getUser();
      if (cancelled || done) return;
      if (userError || !data.user) return;
      done = true;
      const destination = await resolveDestination(data.user.id);
      if (cancelled) return;
      navigate({ to: destination, replace: true });
    };

    const restore = async () => {
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
        const url = typeof window !== "undefined" ? window.location.href : "";
        const authCode = code ?? new URLSearchParams(window.location.search).get("code");
        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || done || !session) return;
      void finish();
    });

    // Late safety net: poll in case the storage write landed without an event.
    const poll = window.setInterval(() => {
      if (cancelled || done) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) void finish();
      });
    }, 1200);

    const timeout = window.setTimeout(() => {
      if (!cancelled && !done) {
        setError("Sign-in is taking longer than expected.");
        setHint("Your connection may have dropped. Please return to sign-in and try again.");
      }
    }, 15000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
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
