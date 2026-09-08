/**
 * INCIDENTS AND MAINTENANCE, AS THE PAGE AND THE FEED NEED THEM — PLAN.md §K.
 *
 * The rules are pure and the read is one function, for the reason the rest of
 * the status system is written that way: what counts as "currently affecting
 * OCADE" has to be answerable in a test without a database, and the page, the
 * JSON feed and the Atom feed must not each decide it differently.
 *
 * ACTIVE IS NOT "UNRESOLVED". A maintenance window announced for next Tuesday
 * is unresolved and is not affecting anybody, and showing it beside a live
 * outage would make the page cry wolf. `activeIncidents` is what is happening
 * NOW; `upcomingMaintenance` is what is coming; everything else is history.
 *
 * NOTHING HERE INVENTS ANYTHING. §K is explicit that measurement begins at the
 * first verified observation, so an empty list is an empty list — and the note
 * beside it says whether that means "nothing has happened" or "nothing is
 * published", because those are different claims and only one of them is
 * OCADE's to make.
 */

import type { AssuranceRefusal } from "@/lib/security/assurance";
import { assuranceRefusalOf } from "@/lib/security/reauthentication";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

export const INCIDENT_STATES = [
  "scheduled",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export const INCIDENT_IMPACTS = ["degraded", "outage", "maintenance"] as const;
export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number];

export type IncidentKind = "incident" | "maintenance";

export interface IncidentUpdate {
  id: string;
  state: IncidentState;
  body: string;
  createdAt: string;
}

export interface StatusIncident {
  id: string;
  kind: IncidentKind;
  title: string;
  impact: IncidentImpact;
  state: IncidentState;
  componentIds: readonly string[];
  startedAt: string;
  scheduledEnd: string | null;
  resolvedAt: string | null;
  updates: readonly IncidentUpdate[];
}

export const STATE_LABEL: Record<IncidentState, string> = {
  scheduled: "Scheduled",
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

export const IMPACT_LABEL: Record<IncidentImpact, string> = {
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
};

export function isIncidentState(value: unknown): value is IncidentState {
  return typeof value === "string" && (INCIDENT_STATES as readonly string[]).includes(value);
}

export function isIncidentImpact(value: unknown): value is IncidentImpact {
  return typeof value === "string" && (INCIDENT_IMPACTS as readonly string[]).includes(value);
}

/** Which lifecycle states an incident of this kind may open in. */
export function openingStateFor(kind: IncidentKind): IncidentState {
  return kind === "maintenance" ? "scheduled" : "investigating";
}

/**
 * Happening now.
 *
 * A maintenance window counts only once it has started, and stops counting once
 * its announced end has passed even if nobody has posted the closing update —
 * a page still announcing yesterday's window as current is a page nobody
 * trusts. An unresolved INCIDENT keeps counting whatever the clock says,
 * because an outage does not end because somebody expected it to.
 */
export function activeIncidents(
  incidents: readonly StatusIncident[],
  now: number = Date.now(),
): StatusIncident[] {
  return incidents.filter((incident) => {
    if (incident.resolvedAt) return false;
    if (Date.parse(incident.startedAt) > now) return false;
    if (incident.kind === "maintenance" && incident.scheduledEnd) {
      return Date.parse(incident.scheduledEnd) > now;
    }
    return true;
  });
}

/** Announced, not started. */
export function upcomingMaintenance(
  incidents: readonly StatusIncident[],
  now: number = Date.now(),
): StatusIncident[] {
  return incidents
    .filter(
      (incident) =>
        incident.kind === "maintenance" &&
        !incident.resolvedAt &&
        Date.parse(incident.startedAt) > now,
    )
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/** Over, newest first. */
export function pastIncidents(
  incidents: readonly StatusIncident[],
  now: number = Date.now(),
): StatusIncident[] {
  const live = new Set(activeIncidents(incidents, now).map((incident) => incident.id));
  const upcoming = new Set(upcomingMaintenance(incidents, now).map((incident) => incident.id));
  return incidents
    .filter((incident) => !live.has(incident.id) && !upcoming.has(incident.id))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/**
 * The sentence beside an empty list.
 *
 * Two different truths, and saying the wrong one is the difference between an
 * honest status page and a reassuring one. Before anything had ever been
 * published, "no incidents" would have been a claim OCADE could not support;
 * now that the history is real, an empty list means what a reader assumes it
 * means — and it still says since when.
 */
export function incidentsNote(
  incidents: readonly StatusIncident[],
  publishingSince: string | null,
): string {
  if (incidents.length > 0) {
    return "Every incident and maintenance window OCADE has published, newest first.";
  }
  if (!publishingSince) {
    return "No incident or maintenance window has been published. OCADE began keeping this history when the incident authority was added; an empty list is not a claim about anything before that.";
  }
  return `No incident or maintenance window has been published since ${publishingSince}. An empty list is not a claim about anything before that date; it is not a claim that there have been no incidents.`;
}

/**
 * The only Supabase-facing read.
 *
 * Returns an empty list rather than throwing when the tables cannot be reached.
 * The status page's own reachability is not the thing it reports on — a page
 * that fails to render because its incident query failed tells a visitor
 * nothing about whether OCADE is up, which is the one question they came with.
 * The note beside the list is what stays honest.
 */
export async function loadPublishedIncidents(client: unknown): Promise<StatusIncident[]> {
  type Reader = {
    from: (table: string) => {
      select: (columns: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => { limit: (count: number) => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
  };
  const reader = client as Reader;

  try {
    const [incidents, updates] = await Promise.all([
      reader
        .from("ocade_status_incidents")
        .select(
          "id, kind, title, impact, state, component_ids, started_at, scheduled_end, resolved_at",
        )
        .order("started_at", { ascending: false })
        .limit(INCIDENT_LIMIT),
      reader
        .from("ocade_status_incident_updates")
        .select("id, incident_id, state, body, created_at")
        .order("created_at", { ascending: true })
        .limit(UPDATE_LIMIT),
    ]);
    if (incidents.error || !Array.isArray(incidents.data)) return [];

    const byIncident = new Map<string, IncidentUpdate[]>();
    if (Array.isArray(updates.data)) {
      for (const row of updates.data as Record<string, unknown>[]) {
        const key = String(row["incident_id"] ?? "");
        const list = byIncident.get(key) ?? [];
        list.push({
          id: String(row["id"] ?? ""),
          state: isIncidentState(row["state"]) ? row["state"] : "investigating",
          body: String(row["body"] ?? ""),
          createdAt: String(row["created_at"] ?? ""),
        });
        byIncident.set(key, list);
      }
    }

    return (incidents.data as Record<string, unknown>[]).map((row) => {
      const id = String(row["id"] ?? "");
      return {
        id,
        kind: row["kind"] === "maintenance" ? ("maintenance" as const) : ("incident" as const),
        title: String(row["title"] ?? ""),
        impact: isIncidentImpact(row["impact"]) ? row["impact"] : "degraded",
        state: isIncidentState(row["state"]) ? row["state"] : "investigating",
        componentIds: Array.isArray(row["component_ids"])
          ? (row["component_ids"] as unknown[]).filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
        startedAt: String(row["started_at"] ?? ""),
        scheduledEnd: row["scheduled_end"] ? String(row["scheduled_end"]) : null,
        resolvedAt: row["resolved_at"] ? String(row["resolved_at"]) : null,
        updates: byIncident.get(id) ?? [],
      };
    });
  } catch {
    return [];
  }
}

/**
 * How far back the page reads.
 *
 * A status page is read for what is happening and what happened recently; the
 * whole history of a long-lived service is an archive, and an unbounded read is
 * one that works until there is enough history to matter.
 */
export const INCIDENT_LIMIT = 100;
export const UPDATE_LIMIT = 1_000;

/* --------------------------------------------------------------- writing -- */

/**
 * The result of anything an administrator asks for.
 *
 * Same shape as the organization authority's, and for the same reason: every
 * refusal these functions can meet is a sentence written for a person — "that
 * incident is resolved, open a new one if it has recurred" — and swallowing it
 * into a generic failure would hide the only useful part. `reason` is present
 * when the database declined on assurance grounds, so the screen can offer a
 * password rather than an apology.
 */
export type IncidentOutcome<T> =
  { ok: true; value: T } | { ok: false; message: string; reason?: AssuranceRefusal };

function failed(cause: unknown): { ok: false; message: string; reason?: AssuranceRefusal } {
  const reason = assuranceRefusalOf(cause);
  const message =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : "Something went wrong. Try again.";
  return reason ? { ok: false, message, reason } : { ok: false, message };
}

/** Open an incident, or announce a maintenance window. */
export async function openIncident(input: {
  kind: IncidentKind;
  title: string;
  impact: IncidentImpact;
  componentIds: readonly string[];
  body: string;
  startedAt?: string | null;
  scheduledEnd?: string | null;
}): Promise<IncidentOutcome<string>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_open_status_incident", {
      p_kind: input.kind,
      p_title: input.title,
      p_impact: input.impact,
      p_component_ids: [...input.componentIds],
      p_body: input.body,
      p_started_at: input.startedAt ?? null,
      p_scheduled_end: input.scheduledEnd ?? null,
    });
    if (error) return failed(error);
    return { ok: true, value: String(data) };
  } catch (cause) {
    return failed(cause);
  }
}

/** Post an update, and move the incident to the state that update describes. */
export async function postIncidentUpdate(input: {
  incidentId: string;
  state: IncidentState;
  body: string;
}): Promise<IncidentOutcome<number>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase.rpc("ocade_post_status_incident_update", {
      p_incident_id: input.incidentId,
      p_state: input.state,
      p_body: input.body,
    });
    if (error) return failed(error);
    return { ok: true, value: Number(data ?? 0) };
  } catch (cause) {
    return failed(cause);
  }
}
