import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { OcadeBanner } from "@/components/ui/ocade-banner";
import { OcadeDataTable, type OcadeTableColumn } from "@/components/ui/ocade-data-table";
import { OcadeSkeleton } from "@/components/ui/ocade-skeleton";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { STATUS_COMPONENTS, STATUS_INDEPENDENCE } from "@/lib/status/catalogue";
import {
  activeIncidents,
  incidentsNote,
  loadPublishedIncidents,
  pastIncidents,
  upcomingMaintenance,
  IMPACT_LABEL,
  STATE_LABEL as INCIDENT_STATE_LABEL,
  type StatusIncident,
} from "@/lib/status/incidents";
import { browserEngineCapability, probeAll } from "@/lib/status/probe";
import {
  overallState,
  overallSummary,
  STATE_LABEL,
  type ComponentObservation,
  type ComponentState,
} from "@/lib/status/state";
import {
  describeWindow,
  readSamples,
  recordSample,
  summariseUptime,
  writeSamples,
  type UptimeSample,
} from "@/lib/status/uptime";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "OCADE status" },
      {
        name: "description",
        content:
          "Live checks of OCADE's components, run from OCADE's own origin. Not an independent status service.",
      },
    ],
  }),
  component: StatusPage,
});

/**
 * OCADE'S STATUS PAGE.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO. The previous page held four component
 * rows inside its own JSX. One of them ran a real check. The other three
 * asserted states nothing had measured — "Production Supabase target is not
 * verified in this build" was a sentence somebody wrote, not an observation —
 * and one sent people to the demo, which no longer exists. The page also
 * carried "The planned public launch remains 28 August 2026 at 8:28 AM
 * Asia/Kolkata", which was both a hard-coded launch date of the kind PLAN.md
 * §K asks to remove and, by the time anyone read it, in the past.
 *
 * Every row now comes from `STATUS_COMPONENTS` and every state from a check
 * that ran, so a row asserting something nothing measured has nowhere to live.
 *
 * WHAT IT REFUSES TO CLAIM. It is not independent, and says so at the top
 * rather than in a footnote. It publishes no incident history and states that
 * an empty list is not the same as no incidents. Its uptime figures are over
 * the checks THIS BROWSER has made, counted from the first one, and are labelled
 * as that rather than presented as a fleet-wide history.
 */

interface StatusRow {
  id: string;
  name: string;
  description: string;
  state: ComponentState;
  detail: string;
  observedAt: string;
  deviceSpecific: boolean;
  uptime: string;
}

const COLUMNS: readonly OcadeTableColumn<StatusRow>[] = [
  {
    key: "name",
    label: "Component",
    required: true,
    value: (row) => row.name,
    render: (row) => (
      <>
        <span className="font-medium text-foreground">{row.name}</span>
        <span className="block text-muted-foreground">{row.description}</span>
      </>
    ),
  },
  {
    key: "state",
    label: "State",
    value: (row) => STATE_LABEL[row.state],
    render: (row) => (
      <span className="inline-flex items-center gap-1.5">
        {/*
         * The dot carries no meaning on its own — the word beside it does.
         * Colour alone would leave the state unreadable to anybody who cannot
         * separate these hues, which is the "no colour-only meaning" rule the
         * accessibility section of the plan asks for.
         */}
        <span aria-hidden className={`h-2 w-2 rounded-full ${STATE_DOT[row.state]}`} />
        {STATE_LABEL[row.state]}
      </span>
    ),
  },
  { key: "detail", label: "Observation", value: (row) => row.detail },
  {
    key: "uptime",
    label: "Checks in this browser",
    value: (row) => row.uptime,
    sort: false,
  },
  {
    key: "observedAt",
    label: "Checked",
    sort: "date",
    value: (row) => (row.observedAt ? new Date(row.observedAt) : null),
    render: (row) =>
      row.observedAt ? (
        <time dateTime={row.observedAt}>{new Date(row.observedAt).toLocaleTimeString()}</time>
      ) : (
        "—"
      ),
  },
];

/*
 * The dot's colour, from OCADE's own state tokens rather than from Tailwind's
 * palette. A hard-coded Tailwind green is the same green in both themes, and
 * the light theme's success token is deliberately a darker sage so it holds
 * contrast on a pale ground — which is why the palette test refuses the literal.
 */
const STATE_DOT: Record<ComponentState, string> = {
  operational: "bg-[color:var(--state-success)]",
  degraded: "bg-[color:var(--state-warning)]",
  outage: "bg-destructive",
  unknown: "bg-muted-foreground",
};

const BANNER_KIND: Record<ComponentState, "info" | "warning" | "error" | "success"> = {
  operational: "success",
  degraded: "warning",
  outage: "error",
  unknown: "warning",
};

/**
 * When OCADE began keeping an incident history.
 *
 * The same date the JSON feed states, and stated for the same reason: an empty
 * list has to say whether it means "nothing happened" or "nothing was being
 * recorded", and only one of those is a claim OCADE can make. PLAN.md §K:
 * begin from the first verified observation, and do not invent what came
 * before it.
 */
const PUBLISHING_SINCE = "4 September 2026";

/**
 * One incident, with the updates that were posted about it.
 *
 * The updates read newest-first, because somebody arriving mid-incident wants
 * the latest thing OCADE said, and the history below it is what they read next
 * if they want to know how it developed.
 */
function IncidentEntry({ incident }: { incident: StatusIncident }) {
  const updates = [...incident.updates].reverse();
  return (
    <article className="mt-4 rounded-md border border-border/50 p-4">
      <h4 className="text-sm font-semibold text-foreground">{incident.title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {IMPACT_LABEL[incident.impact]} · {INCIDENT_STATE_LABEL[incident.state]} · started{" "}
        {new Date(incident.startedAt).toLocaleString()}
        {incident.resolvedAt
          ? ` · resolved ${new Date(incident.resolvedAt).toLocaleString()}`
          : incident.scheduledEnd
            ? ` · until ${new Date(incident.scheduledEnd).toLocaleString()}`
            : ""}
      </p>
      <ol className="mt-3 space-y-2">
        {updates.map((update) => (
          <li key={update.id} className="text-sm">
            <span className="text-xs text-muted-foreground">
              {new Date(update.createdAt).toLocaleString()} · {INCIDENT_STATE_LABEL[update.state]}
            </span>
            <p className="mt-0.5 whitespace-pre-line text-foreground">{update.body}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}

function StatusPage() {
  const [observations, setObservations] = useState<ComponentObservation[] | null>(null);
  /*
   * Null until the read finishes, and null forever on a deployment with no
   * Supabase binding — which is why `incidentsNote` is given an empty array
   * rather than null below. A page that had not finished loading incidents
   * must not print "no incidents"; a page that cannot read them must not
   * either, and both of those are the note's job to say.
   */
  const [incidents, setIncidents] = useState<StatusIncident[] | null>(null);
  const [samples, setSamples] = useState<Record<string, UptimeSample[]>>({});
  const [checkFailed, setCheckFailed] = useState<string | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const configuration = getSupabaseBrowserConfiguration();
      if (!configuration.configured) return;
      try {
        const published = await loadPublishedIncidents(await loadSupabaseClient());
        if (!cancelled) setIncidents(published);
      } catch {
        /*
         * Left null. The status page's own ability to read a table is not the
         * thing a visitor came to find out, and a page that failed to render
         * because its incident query failed would answer the one question they
         * had with nothing at all.
         */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const live = incidents ? activeIncidents(incidents) : [];
  const upcoming = incidents ? upcomingMaintenance(incidents) : [];
  const history = incidents ? pastIncidents(incidents) : [];

  const check = useCallback(async () => {
    /*
     * One check at a time. The Refresh control and the mount effect can both
     * fire, and two overlapping passes write two samples for one observation,
     * which quietly inflates every uptime figure on the page.
     */
    if (checking.current) return;
    checking.current = true;
    setObservations(null);
    setCheckFailed(null);
    try {
      const results = await probeAll({
        origin: window.location.origin,
        fetch: window.fetch.bind(window),
        now: () => new Date(),
        accountBindingConfigured: getSupabaseBrowserConfiguration().configured,
        browserCapability: browserEngineCapability,
      });
      setObservations(results);

      const history = readSamples();
      for (const observation of results) {
        history[observation.componentId] = recordSample(history[observation.componentId] ?? [], {
          at: observation.observedAt,
          state: observation.state,
        });
      }
      writeSamples(history);
      setSamples(history);
    } catch (cause) {
      /*
       * THE CHECKER ITSELF FAILING IS A STATE THIS PAGE HAS TO RENDER.
       *
       * Every individual probe already turns its own failure into an
       * observation, so reaching here means the pass could not be made at all.
       * Without this the page kept its skeleton on screen and said "Checking
       * OCADE's components…" forever — the one state a status page must never
       * get stuck in, and the one this file's own probe module says so about.
       */
      setCheckFailed(
        cause instanceof Error && cause.message
          ? cause.message
          : "OCADE could not run its checks from this browser.",
      );
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    setSamples(readSamples());
    void check();
  }, [check]);

  const overall = observations ? overallState(observations) : "unknown";
  const rows = useMemo<StatusRow[]>(() => {
    if (!observations) return [];
    return observations.map((observation) => {
      const component = STATUS_COMPONENTS.find((entry) => entry.id === observation.componentId);
      return {
        id: observation.componentId,
        name: component?.name ?? observation.componentId,
        description: component?.description ?? "",
        state: observation.state,
        detail: observation.detail,
        observedAt: observation.observedAt,
        deviceSpecific: Boolean(observation.deviceSpecific),
        uptime: describeWindow(summariseUptime(samples[observation.componentId] ?? [])),
      };
    });
  }, [observations, samples]);

  return (
    <PublicPage
      eyebrow="Service checks"
      title="OCADE status"
      summary="Live checks of OCADE's components, run from this browser against this deployment at the moment you loaded the page."
    >
      <OcadeBanner
        title={`OCADE: ${STATE_LABEL[overall]}`}
        kind={BANNER_KIND[overall]}
        action={{ label: "Check again", onClick: () => void check() }}
      >
        {observations
          ? overallSummary(overall, observations)
          : checkFailed
            ? "OCADE could not run these checks from this browser."
            : "Checking OCADE's components from this browser…"}
      </OcadeBanner>

      <p className="text-sm text-muted-foreground">{STATUS_INDEPENDENCE.statement}</p>

      {checkFailed ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          <p>OCADE could not run these checks from this browser.</p>
          <p className="mt-1 text-muted-foreground">{checkFailed}</p>
          <button
            type="button"
            onClick={() => void check()}
            className="mt-2 min-h-9 rounded-md border border-border/70 px-3 text-xs"
          >
            Try again
          </button>
        </div>
      ) : observations === null ? (
        <OcadeSkeleton label="Checking OCADE components" lines={5} />
      ) : (
        <OcadeDataTable<StatusRow>
          caption="OCADE component status"
          tableId="public-status"
          columns={COLUMNS}
          rows={rows}
          defaultPageSize={10}
          pageSizeOptions={[5, 10, 25]}
          freezeFirstColumn
          exportFileName="ocade-status"
          emptyMessage="No component matches that search."
        />
      )}

      <PublicSection title="Machine-readable feed">
        <p>
          The same checks are available as JSON at{" "}
          <a className="underline" href="/api/public/status">
            /api/public/status
          </a>{" "}
          and as an Atom feed at{" "}
          <a className="underline" href="/api/public/status?format=atom">
            /api/public/status?format=atom
          </a>
          . Both run the checks when they are asked and are never cached.
        </p>
      </PublicSection>

      <PublicSection title="Incidents and uptime">
        {live.length > 0 ? (
          <>
            <p>
              {live.length === 1 ? "One incident is" : `${live.length} incidents are`} affecting
              OCADE now.
            </p>
            {live.map((incident) => (
              <IncidentEntry key={incident.id} incident={incident} />
            ))}
          </>
        ) : null}

        <p>{incidentsNote(incidents ?? [], PUBLISHING_SINCE)}</p>

        {history.length > 0 ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-foreground">Past incidents</h3>
            {history.map((incident) => (
              <IncidentEntry key={incident.id} incident={incident} />
            ))}
          </>
        ) : null}

        <p>
          The uptime column counts only the checks this browser has made, from the first one. It is
          not a fleet-wide history, and no historical uptime percentage is claimed.
        </p>
      </PublicSection>

      <PublicSection title="Scheduled maintenance">
        {upcoming.length > 0 ? (
          upcoming.map((incident) => <IncidentEntry key={incident.id} incident={incident} />)
        ) : (
          <p>
            No maintenance window is declared. When one is scheduled it will appear here before it
            starts.
          </p>
        )}
      </PublicSection>

      <PublicSection title="Status updates by email, and independent hosting">
        <p>
          Status email subscriptions and a separate status domain are not offered, because neither a
          verified delivery provider nor an independently hosted status service is connected to this
          deployment. Both controls are absent rather than shown and inert.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
