import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    let mounted = true;

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

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
