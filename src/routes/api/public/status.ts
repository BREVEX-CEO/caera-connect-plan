import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import { buildSnapshot, toAtom } from "@/lib/status/feed";
import { probeAll } from "@/lib/status/probe";

/**
 * OCADE'S PUBLIC STATUS, FOR MACHINES.
 *
 * PLAN.md §K asks for a public feed and a machine-readable format. Both are
 * this endpoint: `/api/public/status` answers JSON, and `?format=atom` answers
 * the same snapshot as an Atom feed, so a monitor and a reader cannot be told
 * two different things.
 *
 * IT RUNS THE REAL CHECKS. The rows are produced by the same `probeAll` the
 * page uses, against this deployment, at the moment of the request — not read
 * from a table somebody updates by hand.
 *
 * IT CANNOT REPORT ITS OWN ABSENCE, and says so in every response. A status
 * endpoint served by the thing it reports on is unreachable exactly when the
 * outage is total, which is why `independent: false` is a field rather than a
 * footnote: a machine consuming this must be able to see the limitation.
 *
 * NO CACHE. A cached status response is a status page reporting the past.
 */

const NO_STORE = {
  "cache-control": "no-store, max-age=0",
  // Public by design: this is the one endpoint whose whole purpose is to be
  // readable by an outside monitor.
  "access-control-allow-origin": "*",
} as const;

/**
 * When OCADE began keeping an incident history.
 *
 * Stated so an empty list can say what it means. Before this date OCADE
 * published nothing, and "no incidents" would be a claim about a period nobody
 * was recording — which `PLAN.md` §K forbids in as many words: do not invent
 * historical uptime or incidents; begin from the first verified observation.
 */
const PUBLISHING_SINCE = "4 September 2026";

/**
 * The published incidents, read as a signed-out visitor would read them.
 *
 * The anonymous key, not the service role: the incident tables are the one
 * public-read pair in the schema, and reading them with a privileged key here
 * would hide the day somebody accidentally removed that policy — the endpoint
 * would keep working while every actual visitor saw nothing.
 */
async function publishedIncidents() {
  const configuration = getSupabaseBrowserConfiguration();
  // `configured` guarantees both fields, but only to a reader — the type keeps
  // them optional, and narrowing on the values themselves is what makes that
  // guarantee something the compiler also holds.
  if (!configuration.url || !configuration.publishableKey) return null;
  const [{ createClient }, { loadPublishedIncidents }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("@/lib/status/incidents"),
  ]);
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return loadPublishedIncidents(client);
}

async function snapshotForRequest(request: Request) {
  const url = new URL(request.url);
  return buildSnapshot(
    await probeAll({
      origin: url.origin,
      fetch: globalThis.fetch,
      now: () => new Date(),
      accountBindingConfigured: getSupabaseBrowserConfiguration().configured,
      /*
       * No browser here. Passing nothing is what makes the device-specific
       * component report "not checked here" rather than a guess about hardware
       * this process cannot see.
       */
    }),
    new Date(),
    await publishedIncidents(),
    PUBLISHING_SINCE,
  );
}

export const Route = createFileRoute("/api/public/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const snapshot = await snapshotForRequest(request);

        if (url.searchParams.get("format") === "atom") {
          return new Response(toAtom(snapshot, url.origin), {
            headers: { "content-type": "application/atom+xml; charset=utf-8", ...NO_STORE },
          });
        }

        return new Response(JSON.stringify(snapshot, null, 2), {
          headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE },
        });
      },
      /* A monitor that only needs reachability should not pay for the probes. */
      HEAD: async () => new Response(null, { status: 200, headers: NO_STORE }),
    },
  },
});
