/**
 * RUN WHAT PEOPLE SCHEDULED, ONCE PER OCCURRENCE (REPO-60/70, plan Part 27).
 *
 * The every-minute cron calls `runDueSchedules`. Each due occurrence is claimed exactly once in
 * the database; then:
 *  - a reminder (no computer) is written into its conversation and notified;
 *  - scheduled work starts a NEW task through the same `startTask` a person uses, so every
 *    permission, consent, pause and busy check runs fresh at that moment. Nothing is replayed
 *    from when the schedule was made, and a refusal is recorded and told, never retried around.
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
  conversation_id: string;
  device_id: string | null;
  what: string;
  repeat: ScheduleRepeat;
  time_zone: string;
  occurrence: string;
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
  startTask?: (
    admin: Admin,
    userId: string,
    input: { conversationId: string; deviceId: string; objective: string },
  ) => Promise<{ taskId: string; reused: boolean }>;
  /** True for a refusal the person can act on (permission, pause, removed computer …). */
  isRefusal?: (error: unknown) => boolean;
  notify?: (notice: NotificationToSend) => Promise<unknown>;
}

export async function runDueSchedules(admin: Admin, deps: SweepDeps = {}): Promise<ScheduleSweep> {
  const now = deps.now ?? new Date();
  const authority = deps.startTask && deps.isRefusal ? null : await import("./authority.server");
  const begin =
    deps.startTask ?? (authority!.startTask as unknown as NonNullable<SweepDeps["startTask"]>);
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
    const key = `schedule:${row.id}:${row.occurrence}`;
    let outcome: string;
    let notice: { title: string; body: string } | null = null;
    try {
      if (!row.device_id) {
        await remind(admin, row, key);
        outcome = "Reminder sent";
        notice = { title: "Reminder", body: row.what };
        sweep.reminded += 1;
      } else {
        outcome = await startScheduledTask(admin, row, key, begin);
        notice = { title: "Scheduled JARVIS task started", body: row.what };
        sweep.started += 1;
      }
    } catch (failure) {
      if (failure instanceof Error && (refused(failure) || failure instanceof Skipped)) {
        outcome = failure.message;
        notice = { title: "Scheduled JARVIS task did not start", body: failure.message };
        sweep.refused += 1;
      } else if (now.getTime() - Date.parse(row.occurrence) < RETRY_WINDOW_MS) {
        // Left claimed: the database offers it again in ten minutes.
        sweep.retrying += 1;
        continue;
      } else {
        outcome = "JARVIS could not start this run. It will try again at the next one.";
        notice = { title: "Scheduled JARVIS task did not start", body: outcome };
        sweep.refused += 1;
      }
    }

    const next = nextOccurrence(new Date(row.occurrence), row.repeat, row.time_zone, now);
    await admin.rpc(
      "jarvis_finish_schedule" as never,
      {
        p_id: row.id,
        p_occurrence: row.occurrence,
        p_next_at: next ? next.toISOString() : null,
        p_outcome: outcome,
      } as never,
    );
    if (notice) {
      await notify({
        userId: row.user_id,
        category: "automation",
        title: notice.title,
        body: notice.body.slice(0, 300),
        deepLink: "/ocade-jarvis",
        idempotencyKey: key,
      });
    }
  }
  return sweep;
}

/** A run that is deliberately not started, said in the person's words. */
class Skipped extends Error {}

async function remind(admin: Admin, row: Claimed, key: string): Promise<void> {
  // The message's client key is the occurrence, so a retried run writes it once.
  const { error } = await admin.from("ocade_messages").insert({
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    role: "assistant",
    content: `Reminder: ${row.what}`,
    client_key: key,
  } as never);
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error("schedules.remind");
}

async function startScheduledTask(
  admin: Admin,
  row: Claimed,
  key: string,
  startTask: NonNullable<SweepDeps["startTask"]>,
): Promise<string> {
  // A run that already started its task (and then died before finishing) is not started again.
  const { data: earlier } = await admin
    .from("jarvis_tasks")
    .select("id")
    .eq("schedule_occurrence" as never, key as never)
    .maybeSingle();
  if (earlier) return "Task started";

  const opened = await startTask(admin, row.user_id, {
    conversationId: row.conversation_id,
    deviceId: row.device_id!,
    objective: row.what,
  });
  if (opened.reused) {
    throw new Skipped(
      "That computer or conversation was already running a task, so this run was skipped.",
    );
  }
  await admin
    .from("jarvis_tasks")
    .update({ schedule_occurrence: key } as never)
    .eq("id", opened.taskId)
    .is("schedule_occurrence" as never, null);
  return "Task started";
}
