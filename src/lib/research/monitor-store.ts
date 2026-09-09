/**
 * MONITORS, IN THE ACCOUNT.
 *
 * They were a JSON blob in `localStorage`, so a monitor somebody configured on
 * a laptop did not exist on their phone and was gone when they cleared their
 * browser. They are ordinary user content — the things a person asked OCADE to
 * watch — and `PLAN.md` Phase 2 gives that one persistent authority.
 *
 * THE RULES STAY IN `WorldScan`. It is the domain model: a monitor must name at
 * least one source, and a requested interval below the per-topic floor is
 * RAISED rather than honoured. Those are decisions about what a monitor may be,
 * they are pure, and they are tested without a database. This file is the
 * requests, and it runs every new monitor past `WorldScan` before writing it —
 * so the refusals hold whichever surface asks.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { randomUuid } from "@/lib/ids";
import { LIST_CAP } from "@/lib/supabase/read-all";
import { MIN_INTERVAL_MS, WorldScan, type Monitor, type ScanTopic } from "./world-scan";

const COLUMNS = "id, topic, subject, sources, interval_ms, state, created_at, last_checked_at";

interface MonitorRow {
  id: string;
  topic: ScanTopic;
  subject: string;
  sources: string[];
  interval_ms: number;
  state: Monitor["state"];
  created_at: string;
  last_checked_at: string | null;
}

function toMonitor(row: MonitorRow): Monitor {
  return {
    id: row.id,
    topic: row.topic,
    subject: row.subject,
    sources: row.sources,
    intervalMs: row.interval_ms,
    state: row.state,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
  };
}

/** Every monitor the account has, newest first. */
export async function listMonitors(): Promise<Monitor[]> {
  const supabase = await loadSupabaseClient();
  /*
   * Bounded. A person configures monitors by hand, so the cap is far above any
   * real account — but the table grows with use, and a list with no bound is a
   * screen that gets slower the longer somebody uses the product.
   */
  const { data, error } = await supabase
    .from("ocade_monitors")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  if (error) throw new Error(error.message);
  return ((data as MonitorRow[] | null) ?? []).map(toMonitor);
}

export interface CreateMonitor {
  topic: ScanTopic;
  subject: string;
  sources: string[];
}

/**
 * Create a monitor, after `WorldScan` agrees it is one.
 *
 * The validation runs against a scan holding only the new monitor: nothing here
 * depends on what else exists, and building one from every stored row just to
 * check one input would put a read in front of a write for no reason.
 */
export async function createMonitor(
  input: CreateMonitor,
): Promise<{ ok: true; data: Monitor } | { ok: false; reason: string }> {
  const id = randomUuid();
  const checked = new WorldScan().create({
    id,
    topic: input.topic,
    subject: input.subject,
    sources: input.sources,
    intervalMs: MIN_INTERVAL_MS[input.topic],
  });
  if (!checked.ok) return checked;

  try {
    const supabase = await loadSupabaseClient();
    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) return { ok: false, reason: "Sign in before creating a monitor." };

    const { data, error } = await supabase
      .from("ocade_monitors")
      .insert({
        id,
        user_id: userId,
        topic: checked.data.topic,
        subject: checked.data.subject,
        sources: checked.data.sources,
        // The floored interval, not the requested one. Writing the request
        // would let a stored row ask for a poll rate the rules refused.
        interval_ms: checked.data.intervalMs,
        state: checked.data.state,
      })
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, data: toMonitor(data as MonitorRow) };
  } catch (cause) {
    return {
      ok: false,
      reason: `That monitor was not saved: ${
        cause instanceof Error ? cause.message : "your account could not be reached"
      }. Nothing was changed.`,
    };
  }
}

/** Pause or resume a monitor. Returns null when nothing was changed. */
export async function setMonitorState(
  id: string,
  state: Monitor["state"],
): Promise<Monitor | null> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_monitors")
      .update({ state })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toMonitor(data as MonitorRow) : null;
  } catch {
    return null;
  }
}

/**
 * Revoke a monitor.
 *
 * Deleted rather than tombstoned: unlike a device, a monitor carries no trust,
 * so there is nothing a re-created one could silently inherit.
 */
export async function revokeMonitor(id: string): Promise<boolean> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_monitors")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
