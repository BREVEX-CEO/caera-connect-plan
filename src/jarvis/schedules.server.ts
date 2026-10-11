/**
 * OCADE'S CLOCK FOR JARVIS: reminders and work a person asked for later.
 *
 * A reminder (a notification at a time) and work that starts by itself are
 * one schedule table and OCADE's own task authority, not a second system. The
 * Worker's cron calls `runDueSchedules` every minute.
 *
 * A REMINDER notifies the person and appears in its conversation. SCHEDULED
 * WORK starts a task on the computer the person chose, which then carries it on
 * (see `background.server.ts`) — only while that computer is online and the
 * person keeps both Background Mode and Scheduled work on for it, and never
 * over another open task. Anything that stops it is told to the person.
 *
 * Each run is claimed with the row's own `next_at`, so two clocks overlapping
 * cannot run it twice, and a run missed while OCADE was down is skipped.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { executionDisabled } from "./device.server";
import { isAllowed } from "./permissions";
import { nextOccurrence, type Repeat } from "./schedule-time";
import { permissionsOf } from "./task-authority.server";

type Admin = SupabaseClient<Database>;

/** How recently a computer must have asked for work to count as online. */
const ONLINE_MS = 60_000;
/** Due schedules handled per tick; the rest are next minute's. */
const PER_TICK = 50;

interface Schedule {
  id: string;
  user_id: string;
  conversation_id: string;
  device_id: string | null;
  what: string;
  next_at: string;
  repeat: Repeat;
  time_zone: string;
}

export async function runDueSchedules(admin: Admin, now = new Date()): Promise<number> {
  const { data: due, error } = await admin
    .from("jarvis_schedules")
    .select("id, user_id, conversation_id, device_id, what, next_at, repeat, time_zone")
    .eq("active", true)
    .lte("next_at", now.toISOString())
    .order("next_at", { ascending: true })
    .limit(PER_TICK);
  if (error || !due) return 0;
  let ran = 0;
  for (const schedule of due as Schedule[]) {
    const next = nextOccurrence(
      new Date(schedule.next_at),
      schedule.repeat,
      schedule.time_zone,
      now,
    );
    const { data: claimed } = await admin
      .from("jarvis_schedules")
      .update({
        next_at: (next ?? new Date(schedule.next_at)).toISOString(),
        active: next !== null,
        last_run_at: now.toISOString(),
      })
      .eq("id", schedule.id)
      .eq("active", true)
      .eq("next_at", new Date(schedule.next_at).toISOString())
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another tick ran it
    let outcome: string;
    try {
      outcome = schedule.device_id
        ? await startScheduledWork(admin, schedule, now)
        : await remind(admin, schedule);
    } catch {
      // Nothing durable came of this run (the instruction could not be saved): it goes back
      // to the next tick rather than being used up. Its message and notification are keyed.
      await admin
        .from("jarvis_schedules")
        .update({ next_at: schedule.next_at, active: true })
        .eq("id", schedule.id)
        .eq("last_run_at", now.toISOString());
      continue;
    }
    await admin
      .from("jarvis_schedules")
      .update({ last_outcome: outcome.slice(0, 300) })
      .eq("id", schedule.id);
    ran += 1;
  }
  return ran;
}

/** The person hears about it wherever they are: a reminder, or work that could not start. */
async function notify(schedule: Schedule, refused: boolean) {
  const { sendNotification } = await import("@/lib/notifications/send.server");
  const what = schedule.what.slice(0, 120);
  await sendNotification({
    userId: schedule.user_id,
    category: "task_outcomes",
    title: `${refused ? "JARVIS could not start" : "Reminder"}: ${what}`,
    deepLink: `/ocade-jarvis?c=${schedule.conversation_id}`,
    idempotencyKey: `jarvis-schedule-${refused ? "refused" : "reminder"}:${schedule.id}:${schedule.next_at}`,
  });
}

async function say(admin: Admin, schedule: Schedule, role: "user" | "assistant", content: string) {
  const { error } = await admin.from("ocade_messages").insert({
    conversation_id: schedule.conversation_id,
    user_id: schedule.user_id,
    role,
    content,
    client_key: `jarvis-schedule-${schedule.id}-${schedule.next_at}-${role}`,
  });
  // Already there from a retried tick is said; anything else is not.
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function remind(admin: Admin, schedule: Schedule): Promise<string> {
  await say(admin, schedule, "assistant", `Reminder: ${schedule.what}`);
  await notify(schedule, false);
  return "Reminded";
}

async function startScheduledWork(admin: Admin, schedule: Schedule, now: Date): Promise<string> {
  const refuse = async (reason: string) => {
    await say(admin, schedule, "assistant", `I could not start “${schedule.what}”: ${reason}`);
    await notify(schedule, true);
    return reason;
  };
  const [rows, { data: device }] = await Promise.all([
    permissionsOf(admin, schedule.user_id),
    admin
      .from("jarvis_devices")
      .select("id, name, kind, background_enabled, last_seen_at")
      .eq("id", schedule.device_id!)
      .eq("user_id", schedule.user_id)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);
  if (!device) return refuse("that computer is no longer connected to OCADE.");
  if (!isAllowed(rows, "master")) return refuse("OCADE JARVIS is turned off.");
  if (await executionDisabled(admin, device.kind)) {
    return refuse("work on computers is paused by OCADE right now.");
  }
  if (!device.background_enabled) return refuse(`Background Mode is off on ${device.name}.`);
  if (!isAllowed(rows, "autonomous", device.id)) {
    return refuse(`Scheduled work is off on ${device.name}.`);
  }
  if (!device.last_seen_at || now.getTime() - Date.parse(device.last_seen_at) > ONLINE_MS) {
    return refuse(`${device.name} was not online.`);
  }
  // The person's instruction, in their conversation, at the time they chose.
  await say(admin, schedule, "user", `Scheduled for now: ${schedule.what}`);
  const { data: task, error } = await admin
    .from("jarvis_tasks")
    .insert({
      user_id: schedule.user_id,
      conversation_id: schedule.conversation_id,
      device_id: device.id,
      title: schedule.what.slice(0, 200),
      plan: [],
      browser_mode: "isolated",
      // The computer holds the loop from the first step: nobody else is driving it.
      controller: device.id,
    })
    .select("id")
    .single();
  // One open task per computer and per conversation (a unique index says so); any other
  // refusal is a failed write, retried by the next tick rather than reported as busy.
  if (error?.code === "23505") return refuse(`${device.name} was busy with another task.`);
  if (error || !task) throw new Error(error?.message ?? "The task was not saved");
  await admin.from("jarvis_activity").insert({
    user_id: schedule.user_id,
    task_id: task.id,
    device_id: device.id,
    summary: "Started on schedule",
  });
  return "Started";
}
