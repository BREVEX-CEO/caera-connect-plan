/**
 * THE MACHINE-READABLE STATUS FEED.
 *
 * PLAN.md §K asks for "RSS/Atom or equivalent machine feed" and a "public
 * API/feed". Both are the same snapshot in two encodings, produced here so the
 * JSON endpoint, the Atom endpoint and the page can never disagree about what
 * OCADE currently claims.
 *
 * NO PROMPT, NO CUSTOMER DATA, NO CREDENTIAL — §K again, and it is enforced by
 * shape rather than by review: a snapshot is built from the catalogue and the
 * observations, and there is no field here that could carry anything else.
 *
 * ESCAPING IS NOT OPTIONAL. Component names and details end up inside XML
 * elements, so anything unescaped is a broken feed at best. Everything text
 * goes through `xmlText`.
 */

import { STATUS_COMPONENTS, STATUS_INDEPENDENCE } from "./catalogue";
import {
  overallState,
  overallSummary,
  STATE_LABEL,
  type ComponentObservation,
  type OverallState,
} from "./state";
import {
  activeIncidents,
  incidentsNote as noteFor,
  pastIncidents,
  upcomingMaintenance,
  IMPACT_LABEL,
  STATE_LABEL as INCIDENT_STATE_LABEL,
  type StatusIncident,
} from "./incidents";

export interface StatusSnapshot {
  generatedAt: string;
  overall: OverallState;
  summary: string;
  independent: boolean;
  independenceStatement: string;
  components: {
    id: string;
    name: string;
    description: string;
    state: string;
    stateLabel: string;
    detail: string;
    observedAt: string;
    deviceSpecific: boolean;
  }[];
  /**
   * What OCADE has published, and nothing else.
   *
   * Three lists rather than one, because a reader needs to tell them apart and
   * a machine consuming this should not have to re-derive the distinction:
   * `incidents` is what is happening now, `upcoming` is announced maintenance
   * that has not started, and `history` is over. A field that mixed them would
   * make next Tuesday's window look like a live outage.
   *
   * An empty list is never a claim that nothing has happened. `incidentsNote`
   * says which of the two empties this is.
   */
  incidents: PublishedIncident[];
  upcoming: PublishedIncident[];
  history: PublishedIncident[];
  incidentsNote: string;
}

/** One incident, flattened for JSON and for the feed. */
export interface PublishedIncident {
  id: string;
  kind: "incident" | "maintenance";
  title: string;
  impact: string;
  impactLabel: string;
  state: string;
  stateLabel: string;
  componentIds: readonly string[];
  startedAt: string;
  scheduledEnd: string | null;
  resolvedAt: string | null;
  updates: { id: string; state: string; stateLabel: string; body: string; createdAt: string }[];
}

/**
 * The sentence the page carried before any incident could be published.
 *
 * Kept, and still used — `incidentsNote(…, null)` says the same thing — because
 * a deployment whose incident tables have not been migrated is exactly the case
 * it was written for, and the claim it refuses to make is still not OCADE's to
 * make there.
 */
export const INCIDENTS_NOTE =
  "OCADE does not publish an incident history yet. An empty list is not a claim that there have been no incidents.";

function publish(incident: StatusIncident): PublishedIncident {
  return {
    id: incident.id,
    kind: incident.kind,
    title: incident.title,
    impact: incident.impact,
    impactLabel: IMPACT_LABEL[incident.impact],
    state: incident.state,
    stateLabel: INCIDENT_STATE_LABEL[incident.state],
    componentIds: incident.componentIds,
    startedAt: incident.startedAt,
    scheduledEnd: incident.scheduledEnd,
    resolvedAt: incident.resolvedAt,
    updates: incident.updates.map((update) => ({
      id: update.id,
      state: update.state,
      stateLabel: INCIDENT_STATE_LABEL[update.state],
      body: update.body,
      createdAt: update.createdAt,
    })),
  };
}

export function buildSnapshot(
  observations: readonly ComponentObservation[],
  now: Date = new Date(),
  /*
   * Absent on any caller that has no incident store to read — a deployment
   * whose migrations have not been applied, or a test about component states.
   * The note below then says the honest thing for that case rather than
   * claiming an empty history.
   */
  incidents: readonly StatusIncident[] | null = null,
  /** When OCADE began keeping this history, for the note beside an empty list. */
  publishingSince: string | null = null,
): StatusSnapshot {
  const overall = overallState(observations);
  return {
    generatedAt: now.toISOString(),
    overall,
    summary: overallSummary(overall, observations),
    independent: STATUS_INDEPENDENCE.independent,
    independenceStatement: STATUS_INDEPENDENCE.statement,
    components: observations.map((observation) => {
      const component = STATUS_COMPONENTS.find((entry) => entry.id === observation.componentId);
      return {
        id: observation.componentId,
        name: component?.name ?? observation.componentId,
        description: component?.description ?? "",
        state: observation.state,
        stateLabel: STATE_LABEL[observation.state],
        detail: observation.detail,
        observedAt: observation.observedAt,
        deviceSpecific: Boolean(observation.deviceSpecific),
      };
    }),
    incidents: incidents ? activeIncidents(incidents, now.getTime()).map(publish) : [],
    upcoming: incidents ? upcomingMaintenance(incidents, now.getTime()).map(publish) : [],
    history: incidents ? pastIncidents(incidents, now.getTime()).map(publish) : [],
    incidentsNote: incidents ? noteFor(incidents, publishingSince) : INCIDENTS_NOTE,
  };
}

/** XML text content. Ampersand first, or the escapes escape each other. */
export function xmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The snapshot as an Atom feed.
 *
 * Atom rather than RSS because its `updated` element is a required, unambiguous
 * timestamp — RSS's `pubDate` is optional and RFC-822, which readers disagree
 * about — and because a status reader needs "when was this true" more than it
 * needs anything else in the format.
 *
 * ONE ENTRY PER COMPONENT plus a summary entry. The ids are stable URNs so a
 * reader updates an entry rather than announcing the same component as new on
 * every poll.
 */
export function toAtom(snapshot: StatusSnapshot, siteUrl: string): string {
  /*
   * INCIDENTS FIRST, because a reader scanning a feed sees the top and a live
   * outage is the thing they are subscribed for. Their ids are the incident's
   * own, so an update to an incident updates that entry rather than announcing
   * the same outage again on every poll; the component entries below keep the
   * behaviour they had.
   */
  const incidentEntries = [...snapshot.incidents, ...snapshot.upcoming, ...snapshot.history]
    .map((incident) => {
      const latest = incident.updates[incident.updates.length - 1];
      return `  <entry>
    <id>urn:ocade:status:incident:${xmlText(incident.id)}</id>
    <title>${xmlText(`${incident.impactLabel}: ${incident.title} (${incident.stateLabel})`)}</title>
    <updated>${xmlText(latest?.createdAt ?? incident.startedAt)}</updated>
    <summary type="text">${xmlText(latest?.body ?? incident.title)}</summary>
  </entry>`;
    })
    .join("\n");

  const entries = snapshot.components
    .map(
      (component) => `  <entry>
    <id>urn:ocade:status:${xmlText(component.id)}</id>
    <title>${xmlText(`${component.name}: ${component.stateLabel}`)}</title>
    <updated>${xmlText(component.observedAt)}</updated>
    <summary type="text">${xmlText(component.detail)}</summary>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:ocade:status</id>
  <title>OCADE status</title>
  <updated>${xmlText(snapshot.generatedAt)}</updated>
  <link rel="alternate" href="${xmlText(`${siteUrl}/status`)}"/>
  <link rel="self" href="${xmlText(`${siteUrl}/api/public/status.xml`)}"/>
  <subtitle type="text">${xmlText(snapshot.independenceStatement)}</subtitle>
  <entry>
    <id>urn:ocade:status:overall</id>
    <title>${xmlText(`OCADE: ${STATE_LABEL[snapshot.overall]}`)}</title>
    <updated>${xmlText(snapshot.generatedAt)}</updated>
    <summary type="text">${xmlText(`${snapshot.summary} ${snapshot.incidentsNote}`)}</summary>
  </entry>
${incidentEntries}${incidentEntries ? "\n" : ""}${entries}
</feed>
`;
}
