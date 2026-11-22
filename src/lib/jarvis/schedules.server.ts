/**
 * RUN WHAT PEOPLE SCHEDULED, ONCE PER OCCURRENCE (REPO-60/70, plan Part 27).
 *
 * The every-minute cron calls `runDueSchedules`. Each due occurrence is claimed exactly once in
 * the database; then:
 *  - a reminder (no computer) is written into its conversation under the claim lock;
 *  - scheduled work uses normal task admission with the locked schedule's current scope.
 * The occurrence key is recorded in the same transaction. Paused, edited and reclaimed schedules
 * invalidate the old lease. Only the exact current lease may finish and publish a notice.
 * A transient failure leaves the claim, which the database hands out again after ten minutes,
 * for up to an hour; the occurrence key on the task stops a second task for the same run.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextOccurrence, type ScheduleRepeat } from "./schedule-time";
import type { NotificationToSend } from "@/lib/notifications/send.server";

type Admin = SupabaseClient;

interface Claimed {
  id: string;
  user_id: string;
  what: string;
  repeat: ScheduleRepeat;
  time_zone: string;
  occurrence: string;
  claim_token: string;
  occurrence_key: string;
}

/** How long a run that keeps failing for a technical reason is retried before it is given up. */
const RETRY_WINDOW_MS = 60 * 60 * 1000;

export interface ScheduleSweep {
  claimed: number;
  started: number;
  reminded: number;
  refused: number;
  retrying: number;
}

/** The task starter and notifier, injected so the sweep is testable without a provider. */
export interface SweepDeps {
  now?: Date;
  runOccurrence?: (
    admin: Admin,
    userId: string,
    claim: { id: string; occurrence: string; token: string },
  ) => Promise<{ kind: "stale" | "reminder" | "task" }>;
  /** True for a refusal the person can act on (permission, pause, removed computer …). */
  isRefusal?: (error: unknown) => boolean;
  notify?: (notice: NotificationToSend) => Promise<unknown>;
}

export async function runDueSchedules(admin: Admin, deps: SweepDeps = {}): Promise<ScheduleSweep> {
  const now = deps.now ?? new Date();
  const authority =
    deps.runOccurrence && deps.isRefusal ? null : await import("./authority.server");
  const runOccurrence =
    deps.runOccurrence ??
    (authority!.runScheduledOccurrence as NonNullable<SweepDeps["runOccurrence"]>);
  const refused = deps.isRefusal ?? ((error: unknown) => error instanceof authority!.JarvisRefusal);
  const notify =
    deps.notify ??
    (async (notice: NotificationToSend) =>
      (await import("@/lib/notifications/send.server")).sendNotification(notice));
  const sweep: ScheduleSweep = { claimed: 0, started: 0, reminded: 0, refused: 0, retrying: 0 };
  const { data, error } = await admin.rpc(
    "jarvis_claim_due_schedules" as never,
    {
      p_now: now.toISOString(),
      p_limit: 20,
    } as never,
  );
  if (error) throw new Error("schedules.claim");
  const rows = (data ?? []) as Claimed[];
  sweep.claimed = rows.length;

  for (const row of rows) {
    let outcome: string;
    let notice: { title: string; body: string };
    let counter: "started" | "reminded" | "refused";
    try {
      const run = await runOccurrence(admin, row.user_id, {
        id: row.id,
        occurrence: row.occurrence,
        token: row.claim_token,
      });
      if (run.kind === "stale") continue;
      if (run.kind === "reminder") {
        outcome = "Reminder sent";
        notice = { title: "Reminder", body: row.what };
        counter = "reminded";
      } else {
        outcome = "Task started";
        notice = { title: "Scheduled JARVIS task started", body: row.what };
        counter = "started";
      }
    } catch (failure) {
      if (failure instanceof Error && refused(failure)) {
        outcome = failure.message;
      } else if (now.getTime() - Date.parse(row.occurrence) < RETRY_WINDOW_MS) {
        sweep.retrying += 1;
        continue;
      } else {
        outcome = "JARVIS could not start this run. It will try again at the next one.";
      }
      notice = { title: "Scheduled JARVIS task did not start", body: outcome };
      counter = "refused";
    }

    const next = nextOccurrence(new Date(row.occurrence), row.repeat, row.time_zone, now);
    const finished = await admin.rpc(
      "jarvis_finish_schedule" as never,
      {
        p_id: row.id,
        p_occurrence: row.occurrence,
        p_claim_token: row.claim_token,
        p_next_at: next ? next.toISOString() : null,
        p_outcome: outcome,
      } as never,
    );
    if (finished.error) {
      sweep.retrying += 1;
      continue;
    }
    if (finished.data !== true) continue;
    sweep[counter] += 1;
    await notify({
      userId: row.user_id,
      category: "automation",
      title: notice.title,
      body: notice.body.slice(0, 300),
      deepLink: "/ocade-jarvis",
      idempotencyKey: row.occurrence_key,
    });
  }
  return sweep;
}
