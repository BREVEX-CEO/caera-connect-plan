import {
  createFileRoute,
  isRedirect,
  Outlet,
  redirect,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";
/*
 * ON DEMAND, and this one module is why the whole public site was paying for
 * Supabase.
 *
 * TanStack's route tree imports every route's DEFINITION eagerly — the loaders
 * and `beforeLoad` guards, split apart from the components — so a static import
 * here put 200 KiB of auth, PostgREST, realtime and storage in the entry
 * bundle. A visitor reading `/about` parsed all of it before the page could
 * answer a tap, to serve a gate that only runs when somebody navigates into the
 * signed-in product.
 *
 * `beforeLoad` is already async and already does a network round trip, so
 * resolving a module first costs nothing measurable — and by the time this
 * gate runs a second time the module is in the registry.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { mayUseCachedSession, cachedSessionIsCurrent } from "@/lib/auth/session-failure";

import { reportRuntimeError } from "@/lib/runtime-error-reporting";
import { OfflineIntelligenceProgress } from "@/components/ocade/setup/OfflineIntelligenceProgress";
import { OfflineUsageBridge } from "@/components/commercial/OfflineUsageBridge";
import { SettingsAccessProvider } from "@/components/settings/SettingsGate";
import { OcadeMobileBottomNav } from "@/components/shell/OcadeMobileBottomNav";
import { UnsyncedTurnsBridge } from "@/components/ocade/chat/UnsyncedTurnsBridge";

/**
 * Integration-managed protected layout. Runs client-only because the Supabase
 * session lives in localStorage. All routes under src/routes/_authenticated/
 * inherit this gate.
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
    const supabase = await loadSupabaseClient();
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

    /*
     * SECOND-FACTOR GATE (PLAN §B: "login challenge before protected
     * application access").
     *
     * An enrolled account whose session is only `aal1` has proved one factor
     * and not the other. Supabase will happily leave it there — raising to
     * `aal2` is the application's job, and an application that never asks has
     * MFA as an ornament: the factor exists, and a stolen password still
     * reaches every screen.
     *
     * ONLY WHEN A VERIFIED FACTOR EXISTS. `nextLevel` is `aal2` exactly when
     * this session COULD complete a challenge, so accounts without a factor
     * are untouched and cannot be trapped by a prompt they are unable to
     * answer.
     *
     * NOT OFFLINE: this is a network read, and somebody whose wifi dropped
     * must not be locked out of a product that can still answer on-device. The cached session was already checked for expiry
     * and rejection above, and the gate re-asserts on the next online
     * navigation.
     *
     * FAILS OPEN ON AN UNREADABLE ANSWER, deliberately. If the assurance call
     * errors, the person is let through rather than held at a challenge they
     * may be unable to pass — an outage must not become an account lockout.
     * The server-side `requireAssurance` middleware is what actually protects
     * the dangerous operations, and it fails CLOSED. This gate is the prompt,
     * not the lock.
     */
    if (!offline && !location.pathname.startsWith("/challenge")) {
      try {
        /*
         * Through the shared authority, not `supabase.auth.mfa` directly.
         *
         * `currentAssurance` passes the access token so the factor list is read
         * from the account rather than from this browser's stored session —
         * which is frozen at sign-in and would report "no factor" on every
         * device except the one that enrolled. Calling the library here would
         * quietly reintroduce exactly that.
         */
        const { currentAssurance } = await import("@/lib/security/mfa");
        const level = await currentAssurance();
        if (level.next === "aal2" && level.current !== "aal2") {
          throw redirect({
            to: "/challenge",
            search: { next: location.pathname + location.searchStr },
          });
        }
      } catch (error) {
        /*
         * THE REDIRECT MUST GET OUT OF HERE.
         *
         * TanStack signals a redirect by THROWING it, and this catch exists to
         * fail open on an unreadable assurance answer — so without re-throwing,
         * the gate silently never fires.
         *
         * `isRedirect` rather than a hand-rolled shape check. This was written
         * as `"to" in error` first, which is false for every redirect: the
         * thrown value is a `Response` carrying its navigation options under
         * `.options`, with no `to` at the top level. The gate was swallowed,
         * an enrolled account walked straight into the product, and the
         * source-reading test passed because it asserted the same wrong shape.
         * A browser run is what caught it.
         */
        if (isRedirect(error)) throw error;
      }
    }

    /*
     * THERE IS NO ONBOARDING GATE, AND ITS ABSENCE IS THE DESIGN.
     *
     * A `profiles.onboarding_completed` read used to stand here and send every
     * account that had not finished the wizard to `/onboarding`. `PLAN.md` and
     * `docs/APP_FLOW.md` removed the wizard: a new account goes to Chat, and
     * profile, appearance, Offline Intelligence and permissions are configured
     * in Settings afterwards, by somebody who has seen the product and has an
     * opinion about it.
     *
     * The column still exists and is not read here. Removing it is a schema
     * change and belongs to the migration phase, not to a routing gate.
     */
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

  return (
    <SettingsAccessProvider canEdit={signedIn}>
      <div className={signedIn ? "pb-16 md:pb-0" : undefined}>
        <Outlet />
      </div>
      {signedIn ? <OcadeMobileBottomNav /> : null}
      {signedIn ? <OfflineUsageBridge /> : null}
      {/*
        A turn held in this tab because the account could not be reached. Here
        rather than in Chat so the warning survives navigating away from it —
        somebody who writes offline and opens Settings has not abandoned it.
      */}
      {signedIn ? <UnsyncedTurnsBridge /> : null}
      {/*
        Preparation REPORTS from the lower-left corner; it does not take the
        product away. This replaced a full-screen modal that covered the whole
        signed-in application for the duration of the first install and stayed
        there when the install failed — which trapped a new account on the
        setup wizard with a Continue button it could see and could not press.
        See `PLAN.md` Phase 5: preparation starts on first visit and never
        blocks the product.
      */}
      {signedIn ? <OfflineIntelligenceProgress /> : null}
    </SettingsAccessProvider>
  );
}

function AuthedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "authenticated_route" });
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
            to="/ocade"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
