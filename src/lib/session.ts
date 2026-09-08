import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

/**
 * Client-only session hook. Reads and subscribes to Supabase auth changes.
 * Do NOT use inside a route beforeLoad — the _authenticated gate owns SSR-safe access.
 */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  /*
   * SUPABASE IS LOADED ON DEMAND, NOT IMPORTED.
   *
   * This hook has 27 callers and every one of them is a screen; a static import
   * here therefore put the 203 KiB Supabase client on the STATIC import graph of
   * the entry chunk, so a visitor who opened the landing page and never signed
   * in downloaded and parsed the whole auth stack before the page could respond
   * to a tap. It was the single largest remaining contributor to the landing
   * route's blocking time, measured at four-times CPU throttling.
   *
   * Nothing here needed it at module scope: every use is inside the effect
   * below, which runs after the first paint. The type-only import above costs
   * nothing at runtime.
   *
   * `loading` STAYS TRUE UNTIL THE MODULE ARRIVES, which is correct rather than
   * incidental: "still checking" is exactly what is happening, and a hook that
   * reported `user: null, loading: false` for those few milliseconds would tell
   * every screen the person is signed out.
   */
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    /*
     * RESOLVE EVEN WHEN THIS FAILS, BECAUSE OFFLINE IT CAN.
     *
     * `getSession` reads the stored token, and when that token is near its
     * expiry it tries to refresh it — over the network. With no network the
     * promise rejected, this `.then` never ran, and `loading` stayed true
     * forever with `user` null. Nothing downstream can tell that state apart
     * from "still checking", so every screen that waits for a user id waited
     * for one that was never coming: Projects sat on "Loading projects…" while
     * the projects themselves were on the same machine.
     *
     * A failed refresh does not invalidate the token already in storage, so
     * the session it carries is still the right answer. Falling back to it
     * keeps the signed-in half of the product usable on a train, and a token
     * that really has expired is rejected by the next request that uses it —
     * which is where that belongs, rather than in a hook that cannot tell.
     */
    const settle = (session: Session | null) => {
      if (!mounted) return;
      setState({ user: session?.user ?? null, session, loading: false });
    };

    void loadSupabaseClient()
      .then((supabase) => {
        if (!mounted) return;
        supabase.auth
          .getSession()
          .then(({ data }) => settle(data.session))
          .catch(() => settle(null));

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          setState({
            user: session?.user ?? null,
            session,
            loading: false,
          });
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      })
      /*
       * A CLIENT THAT CANNOT LOAD IS "SIGNED OUT", NOT "STILL CHECKING".
       *
       * The module is same-origin and cached, so this is the offline-first-load
       * case. Leaving `loading` true there would hang every screen that waits
       * for a user id — the exact failure the comment above describes, arrived
       * at from a different direction.
       */
      .catch(() => settle(null));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return state;
}
