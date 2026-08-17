import { createFileRoute, Outlet, redirect, useRouter, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mayUseCachedSession, cachedSessionIsCurrent } from "@/lib/auth/session-failure";

import { registerDeviceForCurrentSession } from "@/lib/devices";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { FirstRunEngineSetup } from "@/components/ocade/FirstRunEngineSetup";
import { SettingsAccessProvider } from "@/components/settings/SettingsGate";

/**
 * Integration-managed protected layout. Runs client-only because the Supabase
 * session lives in localStorage. All routes under src/routes/_authenticated/
 * inherit this gate, plus the onboarding gate below.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    /*
     * OFFLINE MUST NOT MEAN SIGNED OUT.
     *
     * `getUser()` is a network round trip to the auth server -- it validates
     * the token rather than decoding it. With no network it returns an error,
     * which read as "not signed in", which redirected to /auth. Every chat
     * route lives under this layout, so a local-first assistant running a local
     * model on the user's own machine became unusable the moment the wifi
     * dropped. That is the opposite of what this product claims to be.
     *
     * So the check degrades instead of failing: the server is asked first and
     * remains authoritative, and only when it cannot be REACHED does the
     * locally persisted session stand in (`persistSession: true` keeps it).
     *
     * The security property is preserved exactly. A session that the server
     * REJECTS still signs the user out -- that is an answer, not a failure to
     * get one. A cached session that has EXPIRED is refused here without
     * asking anybody, because expiry is a timestamp and needs no network to
     * evaluate. Offline grace covers unreachability alone.
     */
    const { data, error } = await supabase.auth.getUser();
    let user = error ? null : data.user;
    let offline = false;

    /*
     * The distinction that makes this safe lives in `classifyAuthFailure`:
     * only a request that never got an answer may degrade to the cached
     * session. A 401/403/400, a revoked refresh token, a banned user or a
     * missing session are ANSWERS and fail closed to /auth.
     */
    if (error && !user && mayUseCachedSession(error)) {
      const { data: cached } = await supabase.auth.getSession();
      const session = cached.session;
      // expires_at is a timestamp; expiry needs no network and gets no grace.
      const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
      if (session?.user && cachedSessionIsCurrent(session) && expiresAt > Date.now()) {
        user = session.user;
        offline = true;
      }
    }

    const signedIn = Boolean(user);

    /*
     * SETTINGS ARE READABLE WITHOUT AN ACCOUNT.
     *
     * Every other route under this layout redirects. A settings screen behind
     * a sign-in wall means the one question a prospective user actually has —
     * what can this thing be made to do? — cannot be answered before handing
     * over an email address. That is a trust problem as much as a conversion
     * one: the product looks like it has something to hide.
     *
     * `SettingsAccessProvider` then renders every control disabled with "Sign
     * in to change this setting". Read-only is enforced twice: the panels are
     * `inert`, and the server functions behind them still require a session.
     */
    const isSettings = location.pathname.startsWith("/settings");
    if (!signedIn && !isSettings) {
      throw redirect({
        to: "/auth",
        reloadDocument: true,
        // Pass a same-origin path — auth.safeNext() accepts both absolute and relative.
        search: { next: location.pathname + location.searchStr },
      });
    }
    if (!signedIn) return { user: null };

    // Onboarding gate (G1). Everyone must finish onboarding before app routes.
    if (!location.pathname.startsWith("/onboarding")) {
      /*
       * The onboarding gate is a database read, so it cannot run offline
       * either. Someone already past onboarding must not be sent back through
       * it because their wifi dropped -- and someone who has NOT finished it
       * cannot complete it offline anyway, since onboarding writes to the same
       * database. Skipping the gate while unreachable is therefore both the
       * kinder and the only useful behaviour; it re-asserts on the next
       * online navigation.
       */
      if (!offline) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user!.id)
          .maybeSingle();
        if (!profileError && !profile?.onboarding_completed) {
          throw redirect({ to: "/onboarding" });
        }
      }
    }

    return { user };
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
});

function AuthedLayout() {
  /*
   * `beforeLoad` returns three shapes — a bare context on the server, `{ user:
   * null }` for a signed-out settings view, and `{ user }` otherwise — so the
   * property is read defensively rather than destructured.
   */
  const context = Route.useRouteContext() as { user?: unknown } | undefined;
  const signedIn = Boolean(context?.user);

  useEffect(() => {
    // Only for a real session. Registering a device for nobody would write a
    // row against no account and fail on every signed-out settings view.
    if (!signedIn) return;
    registerDeviceForCurrentSession().catch((e) =>
      reportLovableError(e, { boundary: "device_registration" }),
    );
  }, [signedIn]);

  return (
    <SettingsAccessProvider canEdit={signedIn}>
      {/* Detects the machine and installs the matching engine on first launch.
          Renders nothing once a model exists — and nothing at all without an
          account, since there is no account to install it for. */}
      {signedIn ? <FirstRunEngineSetup /> : null}
      <Outlet />
    </SettingsAccessProvider>
  );
}

function AuthedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "authenticated_route" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Something went wrong loading this section of your workspace."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/home"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
