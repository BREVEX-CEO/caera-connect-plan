/**
 * THE ONE PLACE A TASK CHANGES AND AN ACTION IS QUEUED.
 *
 * A planning loop runs in an open OCADE surface, or — when the person closed
 * it and allowed Background Mode — is carried on by OCADE's own server for the
 * task's computer. Both go through these two functions, so ownership, the
 * loop's lease, permissions, Allowed Apps and confirmations are decided once.
 *
 * `db` is the client the task row is read and written with: the person's own
 * (row-level security decides) or the service role. Every statement also names
 * the account, so the service role is never wider than the person's own client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { commandClass, describeAction, type DeviceAction, type TaskStatus } from "./protocol";
import { needsConfirmation, refuseAction, type PermissionRow } from "./permissions";
import { TASK_COLUMNS, type JarvisTaskRow } from "./task-row";

type Db = SupabaseClient<Database>;

export async function permissionsOf(db: Db, userId: string): Promise<PermissionRow[]> {
  const { data, error } = await db
    .from("jarvis_permissions")
    .select("capability, allowed, device_id")
    .eq("user_id", userId)
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Browser work whose page content the model has read: a page may have written what follows. */
const READS_THE_WEB = [
  "docs",
  "observe",
  "look",
  "open",
  "new_tab",
  "click",
  "type",
  "select",
  "press",
  "click_at",
];

async function taskReadTheWeb(service: Db, userId: string, taskId: string): Promise<boolean> {
  const { data } = await service
    .from("jarvis_activity")
    .select("action")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .limit(500);
  return (data ?? []).some((row) =>
    READS_THE_WEB.includes((row.action as { action?: string } | null)?.action ?? ""),
  );
}

/** Did the person allow this exact command earlier in this task? */
async function allowedEarlier(
  service: Db,
  userId: string,
  taskId: string,
  command: string,
): Promise<boolean> {
  const { data } = await service
    .from("jarvis_activity")
    .select("action")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("confirmed", true)
    .limit(200);
  return (data ?? []).some((row) => {
    const action = row.action as { action?: string; command?: string } | null;
    return action?.action === "run" && action.command === command;
  });
}

export interface TaskChange {
  id: string;
  status?: TaskStatus;
  currentStep?: number;
  result?: string | null;
  blocker?: string | null;
  /** Claim the task for this planning loop; any other loop stops queueing. */
  controller?: string;
  /**
   * Write only while this loop still owns the task. A loop that lost it
   * (another tab, or the computer itself) changes nothing and is told so (null).
   * Alone, it is the loop's heartbeat.
   */
  owner?: string;
  checkpoint?: { step: number; lastAction: string; lastUrl: string | null; at: string };
}

export async function changeTask(
  db: Db,
  service: Db,
  userId: string,
  data: TaskChange,
): Promise<JarvisTaskRow | null> {
  const patch: Record<string, unknown> = {};
  if (data.controller !== undefined) patch.controller = data.controller;
  else if (data.owner !== undefined) patch.controller = data.owner; // same value: a touch
  if (data.checkpoint !== undefined) patch.checkpoint = data.checkpoint;
  if (data.status !== undefined) patch.status = data.status;
  if (data.currentStep !== undefined) patch.current_step = data.currentStep;
  if (data.result !== undefined) patch.result = data.result;
  if (data.blocker !== undefined) patch.blocker = data.blocker;
  let write = db
    .from("jarvis_tasks")
    .update(patch as never)
    .eq("id", data.id)
    .eq("user_id", userId);
  if (data.owner !== undefined) write = write.eq("controller", data.owner);
  const { data: task, error } = await write.select(TASK_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  if (!task && data.owner !== undefined) return null; // control moved elsewhere
  if (!task) throw new Error("That task no longer exists.");
  if (data.controller !== undefined) {
    // A new loop took over: steps the old one queued or left for confirmation never run.
    await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("task_id", data.id)
      .eq("user_id", userId)
      .in("status", ["queued", "needs_confirmation"]);
  }
  if (data.status) {
    // Anything not yet run for a task that is no longer running never runs.
    if (data.status !== "running") {
      await service
        .from("jarvis_activity")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("task_id", data.id)
        .eq("user_id", userId)
        .in("status", ["queued", "needs_confirmation", "claimed"]);
    }
    const words: Record<TaskStatus, string> = {
      running: "Resumed",
      waiting: "Waiting for you",
      taken_over: "You took over",
      stopped: "Stopped",
      blocked: "Stopped: cannot safely continue",
      failed: "Failed",
      completed: "Completed",
    };
    await service.from("jarvis_activity").insert({
      user_id: userId,
      task_id: data.id,
      summary: words[data.status],
    });
    // A finished task is worth telling the person about wherever they are:
    // OCADE's own notification history, never the task's private result.
    if (data.status === "completed" || data.status === "failed" || data.status === "blocked") {
      const { sendNotification } = await import("@/lib/notifications/send.server");
      await sendNotification({
        userId,
        category: "task_outcomes",
        title: `JARVIS ${data.status === "completed" ? "finished" : "stopped"}: ${task.title.slice(0, 120)}`,
        deepLink: `/ocade-jarvis?c=${task.conversation_id}`,
        idempotencyKey: `jarvis-task-${data.status}:${task.id}`,
      });
    }
  }
  return task as JarvisTaskRow;
}

export type QueueResult =
  | { ok: true; id: string; needsConfirmation: boolean }
  | { ok: false; message: string; lost?: boolean };

export async function queueTaskAction(
  db: Db,
  service: Db,
  userId: string,
  data: { taskId: string; controller: string; action: DeviceAction },
): Promise<QueueResult> {
  const { data: task, error } = await db
    .from("jarvis_tasks")
    .select("id, status, device_id, browser_mode, controller")
    .eq("id", data.taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!task) throw new Error("That task no longer exists.");
  // One planning loop drives a task. Another tab or device that took it over
  // owns it now, and this loop stops rather than racing it.
  if (task.controller !== data.controller) {
    return {
      ok: false,
      lost: true,
      message:
        task.controller === task.device_id
          ? "Your computer carried on with this task while OCADE was closed here."
          : "Another device took control of this task.",
    };
  }
  if (task.status !== "running") return { ok: false, message: "The task is not running." };
  if (!task.device_id) return { ok: false, message: "The task has no device." };

  const { data: device } = await service
    .from("jarvis_devices")
    .select("id, capabilities, installed_apps")
    .eq("id", task.device_id)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!device) return { ok: false, message: "The task's device was removed." };

  const rows = await permissionsOf(db, userId);
  const refusal = refuseAction(rows, {
    deviceId: device.id,
    mode: task.browser_mode as "isolated" | "real",
    action: data.action,
    offered: (device.capabilities ?? {}) as Record<string, boolean>,
  });
  if (refusal) return { ok: false, message: refusal.message };
  if (data.action.action === "open_app") {
    const installed = (device.installed_apps ?? []) as string[];
    const wanted = data.action.name.toLowerCase();
    const exact = installed.find((name) => name.toLowerCase() === wanted);
    if (!exact) {
      const near = installed.filter((name) => name.toLowerCase().includes(wanted)).slice(0, 5);
      return {
        ok: false,
        message: near.length
          ? `No app is named "${data.action.name}" on this computer. Did you mean: ${near.join(", ")}?`
          : `No app named "${data.action.name}" is installed on this computer. Use the apps action to list them.`,
      };
    }
    data.action.name = exact;
  }
  // Deletions, system changes, commands and apps set to Ask wait for the
  // person before the device ever sees them.
  let ask = needsConfirmation(rows, data.action, device.id);
  const kind = data.action.action === "run" ? commandClass(data.action.command) : null;
  // A script or build after the task read a web page could be the page's: asked once.
  if (kind === "routine" && (await taskReadTheWeb(service, userId, task.id))) ask = true;
  /*
   * The exact command the person allowed earlier in this task runs again
   * without asking (a fix loop re-running its tests); one that publishes,
   * installs or destroys asks every time.
   */
  const repeat =
    ask &&
    data.action.action === "run" &&
    kind !== "ask" &&
    (await allowedEarlier(service, userId, task.id, data.action.command));
  if (repeat) ask = false;

  const { data: row, error: insertError } = await service
    .from("jarvis_activity")
    .insert({
      user_id: userId,
      task_id: task.id,
      device_id: device.id,
      summary: describeAction(data.action),
      action: data.action,
      status: ask ? "needs_confirmation" : "queued",
      // Model-issued actions are never pre-confirmed, but for that repeat.
      confirmed: repeat,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { ok: true, id: row.id as string, needsConfirmation: ask };
}
