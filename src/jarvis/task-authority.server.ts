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
import {
  commandClass,
  describeAction,
  BROWSER_ACTION_NAMES,
  NOT_VERIFIED,
  outcomeChecks,
  readsBack,
  type DeviceAction,
  type OutcomeCheck,
  type TaskStatus,
} from "./protocol";
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

/**
 * What brings outside words into the task — web pages, documentation, documents, another
 * app's screen — after which a script could be one those words asked for.
 */
const READS_THE_WEB = [
  "docs",
  "app_info", // an app's README and documentation found on the computer
  "file_extract",
  "sheet_inspect",
  "screen",
  "ui_inspect",
  "observe",
  "look",
  "find_text",
  "media",
  "research",
  "open",
  "new_tab",
  "click",
  "type",
  "select",
  "press",
  "click_at",
  "drag_at",
];

async function taskReadTheWeb(service: Db, userId: string, taskId: string): Promise<boolean> {
  const { data, error } = await service
    .from("jarvis_activity")
    .select("action")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .in("action->>action", READS_THE_WEB)
    .limit(1);
  // Unreadable is treated as read: the person is asked rather than nobody.
  return Boolean(error) || (data ?? []).length > 0;
}

/** Has this task changed any file in the work folder? Unreadable counts as changed. */
async function taskChangedFiles(service: Db, userId: string, taskId: string): Promise<boolean> {
  const { data, error } = await service
    .from("jarvis_activity")
    .select("id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .in("action->>action", CHANGES_FILES)
    .limit(1);
  return Boolean(error) || (data ?? []).length > 0;
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
    .select("action, created_at")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .eq("confirmed", true)
    .limit(200);
  const allowed = (data ?? [])
    .filter((row) => {
      const action = row.action as { action?: string; command?: string } | null;
      return action?.action === "run" && action.command === command;
    })
    .map((row) => (row as { created_at?: string }).created_at ?? "")
    .sort()
    .pop();
  if (!allowed) return false;
  // Anything written since (a script, a config, a document) could be what runs now.
  const { data: since, error } = await service
    .from("jarvis_activity")
    .select("id")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .gt("created_at", allowed)
    .in("action->>action", CHANGES_FILES)
    .limit(1);
  return !error && (since ?? []).length === 0;
}

/** Actions that change files in the work folder. */
const CHANGES_FILES = [
  "file_write",
  "file_move",
  "file_copy",
  "file_rename",
  "file_mkdir",
  "file_trash",
  "file_delete",
  "file_import",
  "sheet_edit",
  "doc_edit",
  "deck_edit",
  "pdf_export",
  "download",
];

type ActionRow = {
  action: { action?: string; path?: unknown; to?: unknown; op?: unknown } | null;
  status: string;
  /** As the exchange stores it: what the device returned beyond its status is under `detail`. */
  result: {
    status?: string;
    detail?: { workbook?: unknown; media?: { paused?: unknown; currentTime?: unknown } } | null;
  } | null;
};

const PAGE = 1000;

/** Every action of the task, in order, all pages: a later one is never judged from a prefix. */
async function taskActions(
  service: Db,
  userId: string,
  taskId: string,
): Promise<ActionRow[] | null> {
  const rows: ActionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await service
      .from("jarvis_activity")
      .select("action, status, result")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .neq("status", "note")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return null;
    rows.push(...((data ?? []) as ActionRow[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/**
 * Why these actions cannot stand as a checked result, or null when they can.
 *
 * The model's word is not evidence. Every action settled; a successful read of the device
 * after its last change; each changed file's content read after its change; an action whose
 * outcome is unknown read back after it; and, when `checks` is given, each of the task's
 * fixed checks passed by what the device read (never by what the model says it saw).
 */
function verificationGap(all: ActionRow[], checks?: readonly OutcomeCheck[] | null): string | null {
  // A refused or skipped action never ran on the device, nor did one cancelled before
  // the device reported anything (a step the person declined): none changed anything.
  const rows = all.filter(
    (row) =>
      !["refused", "skipped"].includes(row.result?.status ?? "") &&
      !(row.status === "cancelled" && row.result == null),
  );
  if (rows.some((row) => ["queued", "claimed", "needs_confirmation"].includes(row.status))) {
    return "an action has not finished. Wait for its result before finishing.";
  }
  const read = (row: ActionRow) => readsBack(row.action) && row.status === "done";
  let since = rows.length;
  while (since > 0 && readsBack(rows[since - 1]!.action)) since -= 1;
  if (!rows.slice(since).some(read)) {
    return "nothing has read the result back since the last change. Check it with a fresh read (file_info, sheet_inspect, observe or ui_inspect), then finish.";
  }
  for (const [at, row] of rows.entries()) {
    const path = typeof row.action?.path === "string" ? row.action.path : null;
    const later = rows.slice(at + 1);
    // Stopped while the device held it: it may have acted. Read what it could have changed.
    if (row.result?.status === "unknown" && !readsBack(row.action)) {
      if (!later.some((next) => read(next) && (!path || samePath(next, path)))) {
        return `an action's outcome is unknown (it was stopped while the device held it). Read ${path ?? "the result"} again, then finish.`;
      }
    }
    // Each file whose content changed is itself read back after its last change, not another one.
    if (!EDITS_CONTENT.has(row.action?.action ?? "") || !path) continue;
    const onIt = later.filter((next) => samePath(next, path));
    if (onIt.some((next) => EDITS_CONTENT.has(next.action?.action ?? ""))) continue;
    if (!onIt.some((next) => READS_FILE.has(next.action?.action ?? "") && next.status === "done")) {
      return `${path} was changed but its content was never read back. Read it (file_read, file_extract or sheet_inspect), then finish.`;
    }
    // A workbook this task made or changed holds data on every sheet, as the device last read
    // it: whatever checks were chosen, an empty sheet is never a finished result (WF-18-04).
    if (row.action?.action !== "sheet_edit") continue;
    const book = onIt
      .filter((next) => next.action?.action === "sheet_inspect" && next.status === "done")
      .map((next) => next.result?.detail?.workbook as { sheets?: SheetRead[] })
      .filter(Boolean)
      .at(-1);
    if (!book) return `${path} was changed but not read with sheet_inspect. Read it, then finish.`;
    const empty = (book.sheets ?? []).find((sheet) => filledRows(sheet) < 2);
    if (empty) {
      return `the ${empty.name} sheet of ${path} has no rows below its header. Fill it, or finish as failed and say why it is empty.`;
    }
  }
  if (checks === undefined) return null;
  if (!checks?.length) {
    return "this task has no checks for its result, so OCADE cannot confirm it. Finish it as failed, or start it again with checks.";
  }
  for (const check of checks) {
    const failed = checkGap(rows, check);
    if (failed) return failed;
  }
  return null;
}

/** Why one fixed check is not met by the device's own reads, or null. */
function checkGap(rows: ActionRow[], check: OutcomeCheck): string | null {
  const path = check.path ?? null;
  // What could have changed the target last: the file itself, or anything on the computer
  // without a path (a command, an app's window); for the screen or page, anything without a path.
  let last = -1;
  rows.forEach((row, at) => {
    if (readsBack(row.action) || (path && BROWSER_ACTION_NAMES.has(row.action?.action ?? "")))
      return;
    if (path ? samePath(row, path) || pathless(row) : pathless(row)) last = at;
  });
  const after = rows
    .slice(last + 1)
    .filter(
      (row) =>
        readsBack(row.action) &&
        row.status === "done" &&
        (path ? samePath(row, path) : pathless(row)),
    );
  const target = path ?? "the screen or page";
  if (check.pausedAt !== undefined) {
    // The player's own record, read after the last change to the page: never the model's word.
    const media = after
      .filter((row) => row.action?.action === "media")
      .map((row) => row.result?.detail?.media)
      .filter(Boolean)
      .at(-1);
    if (!media || typeof media.currentTime !== "number") {
      return "the page's video was not read with media state after its last change. Read it, then finish.";
    }
    if (media.paused !== true || Math.abs(media.currentTime - check.pausedAt) > 0.5) {
      return `the page's video is ${media.paused === true ? "paused" : "playing"} at ${media.currentTime} s, not paused at ${check.pausedAt} s. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  if (check.cell !== undefined) {
    const cell = check.cell.toUpperCase();
    const shows = after
      .filter((row) => row.action?.action === "sheet_inspect")
      .map((row) => cellIn(row.result?.detail?.workbook, check.sheet, cell))
      .filter((found) => found !== undefined);
    const latest = shows[shows.length - 1];
    if (!latest) {
      return `${cell} of ${target}${check.sheet ? ` (${check.sheet})` : ""} was not read after its last change. Read it with sheet_inspect, then finish.`;
    }
    if (!sameValue(latest.value, check.equals!) && !sameValue(latest.formula, check.equals!)) {
      return `${cell} of ${target} shows ${JSON.stringify(latest.value ?? latest.formula ?? null)}, not ${JSON.stringify(check.equals)}. Fix it, or finish as failed and say what differs.`;
    }
    return null;
  }
  const sheet = check.sheet;
  if (sheet !== undefined) {
    // A sheet the person asked for, as the device last read the workbook: there, and not empty.
    const book = after
      .filter((row) => row.action?.action === "sheet_inspect")
      .map((row) => row.result?.detail?.workbook as { sheets?: SheetRead[] })
      .filter(Boolean)
      .at(-1);
    if (!book) {
      return `${target} was not read with sheet_inspect after its last change. Read it, then finish.`;
    }
    const found = book.sheets?.find((s) => normal(String(s.name ?? "")) === normal(sheet));
    if (!found) return `${target} has no sheet named ${sheet}. Add it, or finish as failed.`;
    if (filledRows(found) < 2) {
      return `the ${sheet} sheet of ${target} has no rows below its header. Fill it, or finish as failed and say why it is empty.`;
    }
    return null;
  }
  const reads =
    path && check.contains?.length
      ? after.filter((row) => READS_FILE.has(row.action?.action ?? ""))
      : after;
  if (!reads.length) {
    return `${target} was not read${path && check.contains?.length ? " for its content" : ""} after its last change. Read it again, then finish.`;
  }
  const seen = normal(reads.map((row) => textOf(row.result)).join(" "));
  const missing = check.contains?.find((text) => !seen.includes(normal(text)));
  return missing === undefined
    ? null
    : `"${missing.slice(0, 80)}" is not in ${target} as the device read it after its last change. Fix it, or finish as failed and say what differs.`;
}

/**
 * Why this task cannot be recorded completed yet, or null when it can (see verificationGap).
 * Without `checks`, only the structural rules apply (a recipe is kept for checked work).
 */
export async function completionGap(
  service: Db,
  userId: string,
  taskId: string,
  checks?: readonly OutcomeCheck[] | null,
): Promise<string | null> {
  const rows = await taskActions(service, userId, taskId);
  return rows ? verificationGap(rows, checks) : "the task's actions could not be read back.";
}

/** Actions that change a file's content in place, and the reads that check that content. */
const EDITS_CONTENT = new Set(["file_write", "sheet_edit", "doc_edit", "deck_edit", "pdf_export"]);
const READS_FILE = new Set(["file_read", "file_extract", "file_compare", "sheet_inspect"]);

type SheetRead = { name?: string; rows?: number; filledRows?: number };
/** Rows that hold a value; a device older than filledRows reports only its extent. */
const filledRows = (sheet: SheetRead) => sheet.filledRows ?? sheet.rows ?? 0;
const normal = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const normalPath = (path: string) =>
  path.trim().replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
const pathless = (row: ActionRow) =>
  typeof row.action?.path !== "string" && typeof row.action?.to !== "string";
const samePath = (row: ActionRow, path: string) =>
  [row.action?.path, row.action?.to].some(
    (value) => typeof value === "string" && normalPath(value) === normalPath(path),
  );

/** A cell as sheet_inspect read it: of the named sheet, or the first when none is named. */
function cellIn(
  workbook: unknown,
  sheet: string | undefined,
  cell: string,
): { value?: unknown; formula?: unknown } | undefined {
  const book = workbook as {
    sheet?: string;
    sheets?: { name?: string }[];
    cells?: { cell?: string; value?: unknown; formula?: unknown }[][];
  } | null;
  const wanted = sheet ?? book?.sheets?.[0]?.name;
  if (!book || !wanted || normal(String(book.sheet ?? "")) !== normal(wanted)) return undefined;
  for (const row of book.cells ?? []) {
    const found = row.find((item) => String(item.cell ?? "").toUpperCase() === cell);
    if (found) return found;
  }
  return {}; // read, and empty
}

/** Numbers by value, anything else as words. */
function sameValue(actual: unknown, wanted: string): boolean {
  if (actual === undefined || actual === null || typeof actual === "boolean") {
    return actual != null && normal(String(actual)) === normal(wanted);
  }
  const a = Number(actual);
  const w = Number(wanted);
  if (String(actual).trim() && wanted.trim() && Number.isFinite(a) && Number.isFinite(w)) {
    return Math.abs(a - w) <= 1e-9 * Math.max(1, Math.abs(w));
  }
  return normal(String(actual)) === normal(wanted);
}

/** Every string and number a result holds, for matching expected words. */
function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
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
  checkpoint?: NonNullable<JarvisTaskRow["checkpoint"]>;
}

export async function changeTask(
  db: Db,
  service: Db,
  userId: string,
  data: TaskChange,
): Promise<JarvisTaskRow | null> {
  const patch: Record<string, unknown> = {};
  if (data.status === "completed") {
    const { data: fixed } = await service
      .from("jarvis_tasks")
      .select("outcome")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    const checks = outcomeChecks.safeParse(fixed?.outcome);
    const rows = await taskActions(service, userId, data.id);
    const gap = rows
      ? verificationGap(rows, checks.success ? checks.data : null)
      : "the task's actions could not be read back.";
    if (gap) throw new Error(NOT_VERIFIED + gap);
    // The database refuses completed if the task holds any other actions when it is written.
    patch.verified_actions = rows!.length;
  }
  if (data.controller !== undefined) patch.controller = data.controller;
  else if (data.owner !== undefined) patch.controller = data.owner; // same value: a touch
  if (data.checkpoint !== undefined) patch.checkpoint = data.checkpoint;
  if (data.status !== undefined) patch.status = data.status;
  if (data.currentStep !== undefined) patch.current_step = data.currentStep;
  if (data.result !== undefined) patch.result = data.result;
  if (data.blocker !== undefined) patch.blocker = data.blocker;
  // Only the server records completed, after the check above: the database refuses it from
  // the person's own client, which could otherwise mark its task done with nothing checked.
  let write = (data.status === "completed" ? service : db)
    .from("jarvis_tasks")
    .update(patch as never)
    .eq("id", data.id)
    .eq("user_id", userId);
  if (data.owner !== undefined) write = write.eq("controller", data.owner);
  const { data: task, error } = await write.select(TASK_COLUMNS).maybeSingle();
  // The database found an action added between the check above and this write.
  if (error?.message.includes("changed after its result was checked")) {
    throw new Error(
      NOT_VERIFIED + "an action was added after the check. Read the result again, then finish.",
    );
  }
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
    .select("id, kind, capabilities, installed_apps")
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
    phone: device.kind === "android",
  });
  if (refusal) return { ok: false, message: refusal.message };
  // A recipe is kept only for work that was checked: the same evidence completion needs.
  if (data.action.action === "recipe_save" && data.action.worked !== false) {
    const gap = await completionGap(service, userId, task.id);
    if (gap)
      return { ok: false, message: `Save a recipe only after the result is checked: ${gap}` };
  }
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
  // Where nothing confines a command, code the task itself changed runs only once the person
  // has seen it: nothing else keeps that code inside the work folder.
  const confined = (device.capabilities as Record<string, boolean> | null)?.terminal_sandbox;
  if (kind === "routine" && !confined && (await taskChangedFiles(service, userId, task.id))) {
    ask = true;
  }
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
      // The database queues it only if this loop still controls the running task (20261016100000).
      controller: data.controller,
      status: ask ? "needs_confirmation" : "queued",
      // Model-issued actions are never pre-confirmed, but for that repeat.
      confirmed: repeat,
    })
    .select("id")
    .single();
  // STOP, a takeover or completion landed after the checks above: nothing was queued.
  if (insertError?.message.includes("Another loop controls that task")) {
    return { ok: false, lost: true, message: "Another device took control of this task." };
  }
  if (/That task is (not running|completed)/.test(insertError?.message ?? "")) {
    return { ok: false, message: "The task is not running." };
  }
  if (insertError) throw new Error(insertError.message);
  return { ok: true, id: row.id as string, needsConfirmation: ask };
}
