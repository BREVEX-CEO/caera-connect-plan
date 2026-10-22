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
import { appDecision, needsConfirmation, refuseAction, type PermissionRow } from "./permissions";
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
  "video_edit",
  "pdf_export",
  "download",
];

export type ActionRow = {
  action: {
    action?: string;
    path?: unknown;
    to?: unknown;
    from?: unknown;
    op?: unknown;
    content?: unknown;
    size?: unknown;
    /** file_deliver: the Library item OCADE's server named for it when it was queued. */
    item?: unknown;
  } | null;
  status: string;
  /** As the exchange stores it: what the device returned beyond its status is under `detail`. */
  result: {
    status?: string;
    observation?: unknown;
    answer?: unknown;
    text?: unknown;
    detail?: {
      workbook?: unknown;
      media?: { paused?: unknown; currentTime?: unknown };
      [key: string]: unknown;
    } | null;
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
export function verificationGap(
  all: ActionRow[],
  checks?: readonly OutcomeCheck[] | null,
  claim?: string | null,
): string | null {
  // A refused or skipped action never ran on the device, nor did one cancelled before
  // the device reported anything (a step the person declined): none changed anything.
  // Research and documentation are read on OCADE's server: they change nothing either.
  const rows = all.filter(
    (row) =>
      !["refused", "skipped"].includes(row.result?.status ?? "") &&
      !(row.status === "cancelled" && row.result == null) &&
      !OFF_DEVICE.has(row.action?.action ?? ""),
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
    // A helper in .jarvis is judged by what it made, not read back itself.
    if (
      !EDITS_CONTENT.has(row.action?.action ?? "") ||
      !path ||
      normalPath(path).startsWith(".jarvis/")
    )
      continue;
    if (later.some((next) => samePath(next, path) && EDITS_CONTENT.has(next.action?.action ?? "")))
      continue;
    // A later command or directory change can invalidate an earlier content read too.
    const lastChange = later.reduce(
      (last, next, index) => (!readsBack(next.action) && affectsPath(next, path) ? index : last),
      -1,
    );
    const onIt = later.slice(lastChange + 1).filter((next) => samePath(next, path));
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
    if (!book?.sheets?.length)
      return `${path} was changed but not read with sheet_inspect. Read its sheets, then finish.`;
    for (const sheet of book.sheets) {
      const gap = sheetDataGap(sheet, path);
      if (gap) return gap;
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
  return claim ? claimGap(all, claim) : null;
}

const OFF_DEVICE = new Set(["research", "docs"]);
/** Actions that leave a file behind, and the field naming it. */
const MAKES_FILE: Record<string, "path" | "to"> = {
  file_write: "path",
  sheet_edit: "path",
  doc_edit: "path",
  deck_edit: "path",
  video_edit: "path",
  pdf_export: "path",
  file_copy: "to",
  file_move: "to",
  file_rename: "to",
  file_import: "to",
};
const NUMBER = /\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * A figure or a made file the result tells the person about that nothing this task read shows
 * (VER-01-01): checks cover what the model foresaw at start_task; this covers what it says at the
 * end. Figures count from three digits or with decimals (years 1900–2099 and small counts are
 * left alone); a figure matches a read value at the precision written, or as a percent of it.
 * ponytail: words, not meaning. A wrong figure that also appears somewhere in the reads passes;
 * outcome templates per workflow close that.
 */
function claimGap(rows: ActionRow[], claim: string): string | null {
  const reads = rows.filter(
    (row) =>
      row.status === "done" && (readsBack(row.action) || OFF_DEVICE.has(row.action?.action ?? "")),
  );
  const latest = new Map<string, ActionRow>();
  rows.forEach((row, at) => {
    if (
      ["refused", "skipped"].includes(row.result?.status ?? "") ||
      (row.status === "cancelled" && row.result == null)
    )
      return;
    const path = row.action?.path;
    if (OFF_DEVICE.has(row.action?.action ?? "")) {
      if (row.status === "done") latest.set(`source:${at}`, row);
    } else if (!readsBack(row.action)) {
      if (pathless(row)) {
        for (const key of latest.keys()) if (!key.startsWith("source:")) latest.delete(key);
      } else {
        for (const target of [path, row.action?.to]) {
          if (typeof target !== "string") continue;
          const name = normalPath(target).replace(/\/+$/, "");
          for (const key of latest.keys()) {
            if (
              key === `file:${name}` ||
              key.startsWith(`file:${name}/`) ||
              ((!name || name === ".") && key.startsWith("file:"))
            )
              latest.delete(key);
          }
        }
        latest.delete("screen");
      }
    } else if (row.status === "done") {
      latest.set(typeof path === "string" ? `file:${normalPath(path)}` : "screen", row);
    }
  });
  const seen = [...latest.values()].map((row) => contentOf(row, true)).join(" ");
  const values = (seen.match(NUMBER) ?? []).map((n) => Number(n.replace(/,/g, "")));
  // A file's name is what the task worked on, not a figure it states ("report-20261020.txt").
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = rows
    .flatMap((row) => [row.action?.path, row.action?.to, row.action?.from])
    .filter((path): path is string => typeof path === "string" && path.trim() !== "")
    .flatMap((path) => [path, path.split(/[\\/]/).pop()!])
    .sort((a, b) => b.length - a.length);
  const figures = named.reduce(
    (text, name) => text.replace(new RegExp(escape(name), "gi"), " "),
    claim,
  );
  for (const written of figures.match(NUMBER) ?? []) {
    const [whole, fraction = ""] = written.replace(/,/g, "").split(".");
    const n = Number(written.replace(/,/g, ""));
    if (!fraction && (whole!.length < 3 || (n >= 1900 && n <= 2099))) continue;
    const step = 0.5 * 10 ** -fraction.length + 1e-9 * Math.abs(n);
    if (!values.some((v) => Math.abs(v - n) <= step || Math.abs(v * 100 - n) <= step)) {
      return `${written} is not in anything this task read. Say only what the device read, or read it first, then finish.`;
    }
  }
  const said = normal(claim);
  for (const [at, row] of rows.entries()) {
    const field = MAKES_FILE[row.action?.action ?? ""];
    const path = field && row.action?.[field];
    if (typeof path !== "string") continue;
    const name = normalPath(path).split("/").pop()!;
    const named = new RegExp(
      `(^|[^\\w.-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w-])`,
    );
    if (!named.test(said)) continue;
    const later = rows.slice(at + 1);
    if (later.some((next) => MAKES_FILE[next.action?.action ?? ""] && samePath(next, path)))
      continue;
    if (!later.some((next) => reads.includes(next) && samePath(next, path))) {
      return `${name} was not read after this task last changed it. Read it, or do not say it is there, then finish.`;
    }
  }
  // A file the result names is one the device saw: acted on, made by a command or a page,
  // or listed (MEDIA-22-01: an editor project was reported that no step ever made).
  const shown: string[] = [];
  for (const row of rows) {
    if (row.status !== "done") continue;
    const detail = row.result?.detail ?? {};
    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    for (const value of [
      row.action?.path,
      row.action?.to,
      ...(Array.isArray(detail.wrote) ? detail.wrote : []),
      ...(Array.isArray(detail.saved) ? detail.saved : []),
      ...entries.flatMap((entry: { name?: unknown; path?: unknown }) => [entry?.name, entry?.path]),
    ])
      if (typeof value === "string") shown.push(normalPath(value));
  }
  for (const [file] of said.matchAll(FILE_NAME)) {
    // "costs - completed.xlsx" is matched by its last word: the name the device saw ends with it.
    const ends = (seen: string) => seen === file || /[/ (-]$/.test(seen.slice(0, -file.length));
    if (!shown.some((seen) => seen.endsWith(file) && ends(seen)))
      return `${file} is named in the result, but nothing this task did shows it. Check it with file_info, or leave it out, then finish.`;
  }
  return null;
}
/** A file name as a result states it: a deliverable's extension, not part of a web address. */
const FILE_NAME =
  /(?<![\w./:-])[\w-]+(?:\.[\w-]+)*\.(?:mp4|mov|mkv|webm|avi|mlt|kdenlive|osp|json|xml|png|jpe?g|gif|webp|tiff?|svg|psd|kra|xcf|ora|pdf|docx?|odt|rtf|xlsx?|ods|csv|pptx?|odp|txt|md|html?|stl|step|stp|obj|3mf|scad|wav|mp3|m4a|flac|ogg|srt|vtt|zip)(?![\w-]|\.\w)/g;

/** Why one fixed check is not met by the device's own reads, or null. */
function checkGap(rows: ActionRow[], check: OutcomeCheck): string | null {
  const path = check.path ?? null;
  // What could have changed the target last: the file itself, or anything on the computer
  // without a path (a command, an app's window); for the screen or page, anything without a path.
  let last = -1;
  rows.forEach((row, at) => {
    if (readsBack(row.action) || (path && BROWSER_ACTION_NAMES.has(row.action?.action ?? "")))
      return;
    if (path ? affectsPath(row, path) : pathless(row)) last = at;
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
    return sheetDataGap(found, target);
  }
  if (path && (check.minWords ?? check.maxWords) !== undefined) {
    // The device's own count of the saved file, never the model's or its generator's.
    const read = after.filter((row) => READS_FILE.has(row.action?.action ?? "")).at(-1);
    const detail = read?.result?.detail;
    const counted =
      typeof detail?.bodyWords === "number"
        ? detail.bodyWords
        : detail?.truncated || /\.(docx|docm|dotx|odt)$/i.test(path)
          ? undefined
          : textOf(detail?.content).split(/\s+/).filter(Boolean).length;
    if (!read || counted === undefined) {
      return `${target} was not read for its word count after its last change. Read it with file_extract (on an up-to-date connected device), then finish.`;
    }
    if (counted < (check.minWords ?? 0) || counted > (check.maxWords ?? Infinity)) {
      return `${target} holds ${counted} body words, not ${check.maxWords === undefined ? `at least ${check.minWords}` : check.minWords === undefined ? `at most ${check.maxWords}` : `${check.minWords} to ${check.maxWords}`}. Fix it, or finish as failed and say what differs.`;
    }
    if (!check.contains?.length) return null;
  }
  // There but holding nothing (no bytes, a model with no triangles) is not a finished result,
  // whatever else is checked (CAD-22-01: an empty export was reported done).
  const shape = after
    .filter((row) => row.action?.action === "file_info")
    .map(
      (row) =>
        row.result?.detail?.info as {
          size?: unknown;
          properties?: { triangles?: unknown; [name: string]: unknown };
        },
    )
    .filter(Boolean)
    .at(-1);
  if (path && shape && (shape.size === 0 || shape.properties?.triangles === 0)) {
    return `${target} is empty. Make it again, or finish as failed and say why.`;
  }
  // What the device measured in the saved file (length, frame size, loudness, true peak):
  // a requested property is checked in the result, never taken from the model's word.
  for (const { name, ...range } of check.measures ?? []) {
    const value = (shape?.properties as Record<string, unknown> | undefined)?.[name];
    if (typeof value !== "number") {
      return `${target} was not measured for ${name} after its last change. Read it with file_info${/loudness|peak/i.test(name) ? " (audio: true)" : ""}, then finish.`;
    }
    if (value < (range.min ?? -Infinity) || value > (range.max ?? Infinity)) {
      return `${target} measures ${name} ${value}, not ${range.min ?? "…"} to ${range.max ?? "…"}. Fix it, or finish as failed and say what differs.`;
    }
  }
  const reads =
    path && check.contains?.length
      ? after.filter((row) => READS_FILE.has(row.action?.action ?? ""))
      : after;
  if (!reads.length) {
    return `${target} was not read${path && check.contains?.length ? " for its content" : ""} after its last change. Read it again, then finish.`;
  }
  // The latest read can contradict an earlier one even without a task mutation
  // (the person may have edited the file, or the page may have refreshed).
  const seen = normal(contentOf(reads[reads.length - 1]!));
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

/**
 * Library items for the files this task delivered (the device confirmed each upload), written
 * once the result is verified: a failed or stopped task offers nothing. Their bytes are already
 * in the person's own folder of the private bucket, under the name the server gave them.
 * ponytail: an upload whose task never completes stays in storage with no item; a sweep of
 * item-less objects closes that.
 */
async function keepDelivered(
  service: Db,
  userId: string,
  taskId: string,
  rows: ActionRow[],
): Promise<{ id: string; name: string }[]> {
  const sent = rows.filter(
    (row) =>
      row.action?.action === "file_deliver" &&
      row.status === "done" &&
      typeof row.action.item === "string" &&
      typeof row.action.path === "string",
  );
  if (!sent.length) return [];
  const { data: task } = await service
    .from("jarvis_tasks")
    .select("conversation_id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  const items = [
    ...new Map(
      sent.map((row) => {
        const name = String(row.action!.path).split(/[\\/]/).pop()!.slice(0, 300);
        const image = /\.(png|jpe?g|gif|webp)$/i.test(name);
        return [
          name,
          {
            id: String(row.action!.item),
            user_id: userId,
            kind: image ? "image" : "file",
            source: "generated",
            name,
            mime: "application/octet-stream",
            size_bytes: Number(row.action!.size) || 0,
            storage_path: `${userId}/${String(row.action!.item)}`,
            conversation_id: task?.conversation_id ?? null,
          },
        ] as const;
      }),
    ).values(),
  ];
  const { error } = await service
    .from("ocade_library_items")
    .upsert(items as never, { onConflict: "id", ignoreDuplicates: true });
  return error ? [] : items.map(({ id, name }) => ({ id, name }));
}

/** Actions that change a file's content in place, and the reads that check that content. */
const EDITS_CONTENT = new Set(["file_write", "sheet_edit", "doc_edit", "deck_edit", "pdf_export"]);
// A comparison contains removed/reference values too; it cannot prove the target's content.
const READS_FILE = new Set(["file_read", "file_extract", "sheet_inspect"]);

type SheetRead = { name?: string; rows?: number; filledRows?: number };
/** Extent includes formatted blanks; only a measured populated-row count can prove data. */
function sheetDataGap(sheet: SheetRead, path: string): string | null {
  const count = sheet.filledRows;
  if (!Number.isSafeInteger(count) || count! < 0) {
    return `the ${sheet.name} sheet of ${path} did not report a valid filledRows count. Update the connected device and read it with sheet_inspect, then finish.`;
  }
  return count! < 2
    ? `the ${sheet.name} sheet of ${path} has no rows below its header. Fill it, or finish as failed and say why it is empty.`
    : null;
}
const normal = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const normalPath = (path: string) =>
  path.trim().replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
const pathless = (row: ActionRow) =>
  typeof row.action?.path !== "string" && typeof row.action?.to !== "string";
const samePath = (row: ActionRow, path: string) =>
  [row.action?.path, row.action?.to].some(
    // A proof must name the same submitted path. Case, whitespace and even
    // backslashes can distinguish files on a supported filesystem; without a
    // device-canonical identity the server must not equate those names.
    // Invalidation below remains broader, so aliases cannot preserve stale proof.
    (value) => typeof value === "string" && value === path,
  );

/**
 * Commands can touch any file, unless the device listed every file a finished command touched
 * (`wroteAll`, RATE-21-01); a directory mutation also affects its descendants.
 */
const affectsPath = (row: ActionRow, path: string) =>
  (pathless(row) && !untouchedBy(row, path)) ||
  [row.action?.path, row.action?.to].some((value) => {
    if (typeof value !== "string") return false;
    const changed = normalPath(value).replace(/\/+$/, "");
    const target = normalPath(path);
    return !changed || changed === "." || target === changed || target.startsWith(`${changed}/`);
  });

/**
 * A command that finished and whose complete list of touched work-folder files leaves path out.
 * Only a plain relative path is compared: anything an alias could hide behind counts as touched.
 */
function untouchedBy(row: ActionRow, path: string): boolean {
  const detail = row.result?.detail;
  if (row.action?.action !== "run" || row.status !== "done" || detail?.wroteAll !== true)
    return false;
  const wrote = detail.wrote ?? [];
  const target = normalPath(path);
  if (!Array.isArray(wrote) || /^([a-z]:)?\/|(^|\/)\.{1,2}(\/|$)|\/\//.test(target)) return false;
  return !wrote.some((name) => typeof name !== "string" || normalPath(name) === target);
}

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

/** Semantic device data only: status, timing, tabs and geometry are never content. */
function contentOf(row: ActionRow, numericProperties = false): string {
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result = row.result;
  const detail = result?.detail;
  const action = row.action?.action;
  if (action === "file_read" || action === "file_extract") return textOf(detail?.content);
  if (action === "sheet_inspect") {
    const cells = object(detail?.workbook).cells;
    return Array.isArray(cells)
      ? textOf(
          cells.flatMap((line) =>
            Array.isArray(line)
              ? line.map((cell) => {
                  const value = object(cell);
                  return [value.value, value.formula];
                })
              : [],
          ),
        )
      : "";
  }
  if (action === "research") return textOf(result?.answer);
  if (action === "docs") return textOf(result?.text);
  if (action === "find_text") return textOf(detail?.found);
  if (action === "media") {
    const media = object(detail?.media);
    return textOf([
      media.captions,
      ...(numericProperties ? [media.currentTime, media.duration] : []),
    ]);
  }
  if (action === "file_info" && numericProperties) {
    const info = object(detail?.info);
    const properties = object(info.properties);
    return textOf([
      info.size,
      ...["seconds", "width", "height", "fps", "audioChannels", "pages"].map(
        (key) => properties[key],
      ),
    ]);
  }
  const observation = object(result?.observation);
  const elements = observation.elements;
  return textOf([
    observation.text,
    observation.facts,
    ...(Array.isArray(elements)
      ? elements.map((element) => {
          const value = object(element);
          return [value.name, value.value];
        })
      : []),
  ]);
}

export interface TaskChange {
  id: string;
  status?: TaskStatus;
  /** Compare-and-set admission: a stale resume cannot overwrite STOP or a newer state. */
  expectedStatus?: TaskStatus;
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
  let deliverables: { id: string; name: string }[] = [];
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
      ? verificationGap(rows, checks.success ? checks.data : null, data.result)
      : "the task's actions could not be read back.";
    if (gap) throw new Error(NOT_VERIFIED + gap);
    // The database refuses completed if the task holds any other actions when it is written.
    patch.verified_actions = rows!.length;
    deliverables = await keepDelivered(service, userId, data.id, rows!);
  }
  if (data.controller !== undefined) patch.controller = data.controller;
  else if (data.owner !== undefined) patch.controller = data.owner; // same value: a touch
  if (data.checkpoint !== undefined) {
    // Old clients omit the mode; later checkpoints cannot change the task's opt-in.
    const { data: stored, error } = await service
      .from("jarvis_tasks")
      .select("checkpoint")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !stored) return null;
    const checkpoint = stored.checkpoint as JarvisTaskRow["checkpoint"];
    patch.checkpoint = {
      ...data.checkpoint,
      intelligenceQuality: checkpoint?.intelligenceQuality ?? "standard",
    };
  }
  // The finished files, as Library items the card opens and downloads.
  if (deliverables.length && patch.checkpoint) {
    patch.checkpoint = { ...(patch.checkpoint as object), deliverables };
  }
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
  if (data.expectedStatus !== undefined) write = write.eq("status", data.expectedStatus);
  // STOP or a pause may land after verification. Only a still-running task can complete.
  if (data.status === "completed") write = write.eq("status", "running");
  const { data: task, error } = await write.select(TASK_COLUMNS).maybeSingle();
  // The database found an action added between the check above and this write.
  if (error?.message.includes("changed after its result was checked")) {
    throw new Error(
      NOT_VERIFIED + "an action was added after the check. Read the result again, then finish.",
    );
  }
  if (error) throw new Error(error.message);
  if (
    !task &&
    (data.owner !== undefined || data.expectedStatus !== undefined || data.status === "completed")
  )
    return null;
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
  // One output per intent: the same content already written under another name is that output
  // (HX-02: a replan wrote a second copy with a changed spelling). Copies are file_copy.
  if (data.action.action === "file_write") {
    const { path, content } = data.action;
    const twin = (await taskActions(service, userId, task.id))?.find(
      (row) =>
        row.action?.action === "file_write" &&
        row.status === "done" &&
        row.action.content === content &&
        row.action.path !== path,
    );
    if (twin) {
      return {
        ok: false,
        message: `This task already wrote exactly this content to ${twin.action!.path}. Use that file; to make a copy on purpose, use file_copy.`,
      };
    }
  }
  // Where a finished file goes is OCADE's to say: one new object in the person's own folder of
  // the private Library bucket, writable once, so no model or page can send it anywhere else.
  if (data.action.action === "file_deliver") {
    const item = crypto.randomUUID();
    const { data: signed, error: signError } = await service.storage
      .from("library")
      .createSignedUploadUrl(`${userId}/${item}`);
    if (signError || !signed)
      return { ok: false, message: "The Library could not take a file now." };
    data.action = { ...data.action, upload: signed.signedUrl, item } as DeviceAction;
  }
  if (data.action.action === "open_app") {
    const installed = (device.installed_apps ?? []) as string[];
    const wanted = data.action.name.toLowerCase();
    // "Microsoft Word" for an app listed as "Word", or the other way round, when only one fits.
    const words = (name: string) => new Set(name.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const within = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((w) => b.has(w));
    const asked = words(wanted);
    const fits = installed.filter(
      (name) => within(asked, words(name)) || within(words(name), asked),
    );
    const exact =
      installed.find((name) => name.toLowerCase() === wanted) ??
      (fits.length === 1 ? fits[0] : undefined);
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
  // So could an app it opens then (apps open unasked otherwise), unless the person set Always.
  if (
    data.action.action === "open_app" &&
    !ask &&
    appDecision(rows, data.action.name, device.id) !== true &&
    (await taskReadTheWeb(service, userId, task.id))
  )
    ask = true;
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
