import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Integration-managed protected layout. Runs client-only because the Supabase
 * session lives in localStorage. All routes under src/routes/_authenticated/
 * inherit this gate.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { next: location.href },
      });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
