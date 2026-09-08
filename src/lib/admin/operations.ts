/**
 * WHAT AN OPERATOR CAN SEE, AND WHERE IT COMES FROM — PLAN.md §G.
 *
 * §G asks the admin panel for a usage overview, commercial-usage windows, an
 * audit log and notification delivery status. This is the one place those reads
 * are made, so the screen holds no queries of its own and nothing else in the
 * product grows a second way to ask.
 *
 * THE AUTHORISATION IS NOT HERE. Row-level security decides what comes back:
 * an account without the admin role selecting from these tables gets its own
 * rows or none, whatever this module does. `requireAdminRole` decides what to
 * RENDER, and these functions decide what to ask — neither is the boundary.
 *
 * NOTIFICATION DELIVERY IS COUNTS, NOT MESSAGES. The question §G asks is
 * operational — is delivery working? — and answering it from raw rows would
 * hand an operator every title and body in the deployment: somebody's security
 * alerts, somebody's support correspondence. The aggregate answers the question
 * without any of that, and there is no admin policy on the notification table
 * for anything else to fall back to.
 *
 * EVERY READ IS BOUNDED. These tables grow with use, and a query with no bound
 * is one that works until the deployment gets busy. Each cap is stated, and the
 * screen says when it was reached rather than showing a prefix as though it
 * were the whole thing.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

export const OPERATIONS_LIMITS = {
  usageWindows: 500,
  auditEvents: 500,
  /** Delivery is already aggregated server-side; this bounds the categories. */
  deliveryRows: 200,
} as const;

export interface UsageWindowRow {
  /*
   * The row's own natural key, because the canonical table needs one and this
   * table has no surrogate worth surfacing. `(user, kind, start)` is the unique
   * constraint the schema already enforces, so it cannot collide.
   */
  id: string;
  userId: string;
  windowKind: string;
  windowStart: string;
  /** Standard Work Equivalents, converted from the hundredths stored. */
  used: number;
  updatedAt: string;
}

export interface AuditEventRow {
  id: string;
  organizationId: string;
  organizationName: string | null;
  event: string;
  actorId: string | null;
  subjectId: string | null;
  createdAt: string;
}

export interface DeliveryRow {
  /** The grouping itself: the aggregate returns one row per combination. */
  id: string;
  category: string;
  channel: string;
  state: string;
  occurrences: number;
}

export interface Bounded<T> {
  rows: T[];
  /** True when the read came back at its cap, so the screen can say so. */
  truncated: boolean;
}

/**
 * Commercial usage windows, newest first.
 *
 * Stored in hundredths for exact fractional accounting; converted once, here,
 * so no screen has to remember the unit and none of them can divide by a
 * different number.
 */
export async function loadUsageWindows(): Promise<Bounded<UsageWindowRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_commercial_usage")
    .select("user_id, window_kind, window_start, used_hundredths, updated_at")
    .order("window_start", { ascending: false })
    .limit(OPERATIONS_LIMITS.usageWindows);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    id: `${row.user_id}:${row.window_kind}:${row.window_start}`,
    userId: row.user_id,
    windowKind: row.window_kind,
    windowStart: row.window_start,
    used: Number(row.used_hundredths ?? 0) / 100,
    updatedAt: row.updated_at,
  }));
  return { rows, truncated: rows.length >= OPERATIONS_LIMITS.usageWindows };
}

/**
 * The organization audit trail, across every organization.
 *
 * The organizations are read alongside because a log of events against opaque
 * identifiers is not a log anybody can read. A missing name is left null rather
 * than filled with the id: an operator reading "—" knows something is absent,
 * and one reading a uuid has to work out that it is not a name.
 */
export async function loadAuditEvents(): Promise<Bounded<AuditEventRow>> {
  const supabase = await loadSupabaseClient();
  const [events, organizations] = await Promise.all([
    supabase
      .from("ocade_organization_events")
      .select("id, organization_id, event, actor_id, subject_id, created_at")
      .order("created_at", { ascending: false })
      .limit(OPERATIONS_LIMITS.auditEvents),
    supabase.from("ocade_organizations").select("id, name").limit(OPERATIONS_LIMITS.auditEvents),
  ]);
  if (events.error) throw events.error;

  const names = new Map<string, string>();
  for (const row of organizations.data ?? []) names.set(row.id, row.name);

  const rows = (events.data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    organizationName: names.get(row.organization_id) ?? null,
    event: row.event,
    actorId: row.actor_id,
    subjectId: row.subject_id,
    createdAt: row.created_at,
  }));
  return { rows, truncated: rows.length >= OPERATIONS_LIMITS.auditEvents };
}

/** How long a delivery report looks back. Seven days is what an operator asks about. */
export const DELIVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadNotificationDelivery(
  now: number = Date.now(),
): Promise<Bounded<DeliveryRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.rpc("ocade_admin_notification_delivery", {
    p_since: new Date(now - DELIVERY_WINDOW_MS).toISOString(),
  });
  if (error) throw error;

  const rows = ((data ?? []) as Record<string, unknown>[])
    .slice(0, OPERATIONS_LIMITS.deliveryRows)
    .map((row) => {
      const category = String(row["category"] ?? "");
      const channel = String(row["channel"] ?? "");
      const state = String(row["state"] ?? "");
      return {
        id: `${category}:${channel}:${state}`,
        category,
        channel,
        state,
        occurrences: Number(row["occurrences"] ?? 0),
      };
    });
  return {
    rows,
    truncated: ((data ?? []) as unknown[]).length > OPERATIONS_LIMITS.deliveryRows,
  };
}

/**
 * Delivery states that mean somebody has to do something.
 *
 * `unavailable` is deliberately NOT here. It means the deployment has no sender
 * configured for that channel, which is a truthful state rather than a failure,
 * and putting it in the same count as a dead letter would have an operator
 * chasing a provider that was never meant to exist.
 */
const NEEDS_ATTENTION = new Set(["failed", "dead_letter"]);

export function attentionCount(rows: readonly DeliveryRow[]): number {
  return rows
    .filter((row) => NEEDS_ATTENTION.has(row.state))
    .reduce((total, row) => total + row.occurrences, 0);
}
