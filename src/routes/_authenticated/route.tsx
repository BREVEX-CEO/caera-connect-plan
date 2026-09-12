import { createFileRoute, Outlet, redirect, useRouter, Link } from "@tanstack/react-router";
import { useEffect } from "react";
/*
 * ON DEMAND, and this one module is why the whole public site used to pay for
 * Supabase.
 *
 * TanStack's route tree imports every route's DEFINITION eagerly — the guards,
 * split apart from the components — so a static import here puts 200 KiB of
 * auth, PostgREST, realtime and storage in the entry bundle. A visitor reading
 * `/about` would parse all of it to serve a gate that only runs when somebody
 * navigates into the signed-in product.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { mayUseCachedSession, cachedSessionIsCurrent } from "@/lib/auth/session-failure";
import { reportRuntimeError } from "@/lib/runtime-error-reporting";

/**
 * The gate every signed-in destination inherits.
 *
 * Chat is deliberately NOT under it: `/` renders for a signed-out visitor and
 * asks for an account at the moment they press Send.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return { user: null };

    /*
     * OFFLINE MUST NOT MEAN SIGNED OUT.
     *
     * `getUser()` is a network round trip — it validates the token rather than
     * decoding it. With no network it returns an error, which reads as "not
     * signed in", which redirects to /auth. A product that answers on the
     * user's own device would then be unusable the moment the wifi dropped.
     *
     * So the check degrades rather than failing: the server is asked first and
     * stays authoritative, and only when it cannot be REACHED does the locally
     * persisted session stand in. A session the server REJECTS still signs the
     * user out — that is an answer, not a failure to get one — and a cached
     * session that has EXPIRED is refused without asking anybody, because
     * expiry is a timestamp and needs no network to evaluate.
     */
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    let user = error ? null : data.user;

    if (error && !user && mayUseCachedSession(error)) {
      const { data: cached } = await supabase.auth.getSession();
      const session = cached.session;
      const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
      if (session?.user && cachedSessionIsCurrent(session) && expiresAt > Date.now()) {
        user = session.user;
      }
    }

    if (!user) {
      throw redirect({
        to: "/auth",
        reloadDocument: true,
        // A same-origin path — safeNext() accepts absolute and relative alike.
        search: { next: location.pathname + location.searchStr },
      });
    }

    return { user };
  },
  component: AuthedLayout,
  errorComponent: AuthedError,
});

function AuthedLayout() {
  return <Outlet />;
}

function AuthedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "authenticated_route" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="text-lg font-semibold text-foreground">This page didn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "Something went wrong loading this part of your workspace."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Open Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
