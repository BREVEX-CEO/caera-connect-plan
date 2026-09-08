import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { Loader2 } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};

async function oauth(): Promise<OAuthNamespace> {
  // The client is loaded on demand: this route is statically reachable from the
  // route tree, so a top-level import put the whole auth stack on the entry
  // chunk's graph for a consent screen almost nobody opens.
  const supabase = await loadSupabaseClient();
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    const supabase = await loadSupabaseClient();
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await (await oauth()).getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  /*
   * A BLANK SCREEN IS THE WORST THING TO SHOW DURING AN AUTHORISATION.
   *
   * The loader is a network round trip to fetch the authorisation details.
   * Without a pending state the route renders nothing at all while it runs, so
   * on a slow connection somebody who has just been redirected here from
   * another product sees an empty page and no reason to believe the redirect
   * worked. That is the moment they close the tab.
   */
  pendingComponent: () => (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-8"
    >
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Checking this authorization request…</p>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-8">
      <h1 className="text-lg font-medium">Authorization request unavailable</h1>
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decisionError } = approve
      ? await (await oauth()).approveAuthorization(authorization_id)
      : await (await oauth()).denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-8">
      <div className="space-y-2">
        <h1 className="text-lg font-medium">Connect {clientName} to your account</h1>
        <p className="text-sm text-muted-foreground">
          {clientName} will be able to use CARCC CADANE agent tools as you: read your OCADE
          conversations and projects, and create new projects. It cannot see anything your account
          cannot.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-60"
        >
          Deny
        </button>
      </div>
    </main>
  );
}
