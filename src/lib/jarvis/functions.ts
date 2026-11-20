/**
 * JARVIS for the signed-in person: Send, STOP, Take Over, Resume, confirm a
 * step, read a task, pair or remove a computer, and choose what it may use.
 *
 * THE ACCOUNT IS ALWAYS `context.userId`, NEVER AN INPUT. Every write goes
 * through the server-only task authority with the service role, after
 * `requireSession` has proved the session is live and meets its second factor.
 * Permission decisions are the person's own rows, written as them under RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { taskObjective } from "./objective";
import { appPermission, DEVICE_SILENCE_MS } from "./contracts";

const uuid = z.uuid();

function taskSessionId(claims: Record<string, unknown>): string {
  const session = uuid.safeParse(claims.session_id);
  if (!session.success) {
    throw new Error("Sign in again before starting or continuing a JARVIS task.");
  }
  return session.data;
}

async function authority() {
  const [module, { supabaseAdmin }] = await Promise.all([
    import("./authority.server"),
    import("@/integrations/supabase/client.server"),
  ]);
  return { ...module, admin: supabaseAdmin };
}

/** Database refusals become the person's words; everything else stays generic. */
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  const { JarvisRefusal } = await import("./authority.server");
  try {
    return await work();
  } catch (error) {
    if (error instanceof JarvisRefusal) throw new Error(error.message);
    throw new Error("JARVIS could not do that just now. Try again.");
  }
}

export const startJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
        deviceId: uuid,
        objective: taskObjective,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, startTask } = await authority();
    const sessionId = taskSessionId(context.claims);
    return guarded(() => startTask(admin, context.userId, { ...data, sessionId }));
  });

export const stopJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, stopTask } = await authority();
    return guarded(() => stopTask(admin, context.userId, data.taskId));
  });

/** Tell an open task something new, for the whole team or one agent (plan 14F.4.4). */
export const instructJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        taskId: uuid,
        text: z.string().trim().min(1).max(2000),
        lane: z.number().int().min(0).max(3).nullable().default(null),
        clientId: uuid,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, addInstruction } = await authority();
    return guarded(async () => ({
      id: await addInstruction(
        admin,
        context.userId,
        data.taskId,
        data.text,
        data.lane,
        data.clientId,
      ),
    }));
  });

export const getJarvisTask = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, taskView } = await authority();
    return guarded(() => taskView(admin, context.userId, data.taskId));
  });

export const pairJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^[0-9A-Fa-f]{16}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, approveDevice } = await authority();
    return { deviceId: await guarded(() => approveDevice(admin, context.userId, data.code)) };
  });

export const removeJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ deviceId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, revokeDevice } = await authority();
    return { removed: await guarded(() => revokeDevice(admin, context.userId, data.deviceId)) };
  });

export const takeOverJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, takeOver } = await authority();
    return { status: await guarded(() => takeOver(admin, context.userId, data.taskId)) };
  });

export const resumeJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, resumeTask } = await authority();
    const sessionId = taskSessionId(context.claims);
    await guarded(() => resumeTask(admin, context.userId, data.taskId, sessionId));
    return { resumed: true };
  });

export const confirmJarvisStep = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ activityId: uuid, scope: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, confirmAction } = await authority();
    return {
      confirmed: await guarded(() =>
        confirmAction(admin, context.userId, data.activityId, data.scope),
      ),
    };
  });

/** Answers to the short form JARVIS asked with (R12-06); the task continues with them. */
export const answerJarvisForm = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        taskId: uuid,
        values: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), z.string().max(1000)),
        clientId: uuid,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, answerForm } = await authority();
    await guarded(() => answerForm(admin, context.userId, data.taskId, data.values, data.clientId));
    return { answered: true };
  });

/** Live or Background (R12-01): switching keeps the task, its steps and its permissions. */
export const setJarvisTaskMode = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid, mode: z.enum(["live", "background"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, setTaskMode } = await authority();
    return {
      mode: await guarded(() => setTaskMode(admin, context.userId, data.taskId, data.mode)),
    };
  });

/** "Ask me again": steps allowed for the rest of a task ask one by one again. */
export const clearJarvisApprovals = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, clearApprovals } = await authority();
    return { cleared: await guarded(() => clearApprovals(admin, context.userId, data.taskId)) };
  });

/** The person says whether a step nobody could observe took effect. It is never run again. */
export const resolveJarvisStep = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z.object({ activityId: uuid, resolution: z.enum(["applied", "not_applied"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin, resolveEffect } = await authority();
    await guarded(() => resolveEffect(admin, context.userId, data.activityId, data.resolution));
    return { resolved: true };
  });

/** The newest task in one JARVIS conversation, if any (read as the person, under RLS). */
export const latestJarvisTask = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("jarvis_tasks")
      .select("id")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { taskId: row?.id ?? null };
  });

const capability = z.union([
  z.enum(["files", "apps", "browser", "screen", "computer_control", "mcp", "background"]),
  z.string().regex(/^mcp:[a-z][a-z0-9_]{1,30}$/),
  z.string().regex(/^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/),
  appPermission,
]);

/**
 * One of a paired computer's permissions, as the person's own row (RLS). Turning
 * anything on also turns on the account's JARVIS master switch.
 */
export const setJarvisAccess = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ deviceId: uuid, capability, allowed: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: device, error: lookupError } = await context.supabase
      .from("jarvis_devices")
      .select("installed_apps")
      .eq("id", data.deviceId)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (lookupError || !device) throw new Error("That paired computer is unavailable.");
    if (data.allowed && data.capability.startsWith("app:")) {
      const app = data.capability.slice(4);
      const inventory = z.array(z.object({ exe: z.string() })).safeParse(device.installed_apps);
      if (!inventory.success || !inventory.data.some(({ exe }) => exe === app)) {
        throw new Error("That application is no longer reported on this computer.");
      }
    }
    const rows = [
      {
        user_id: context.userId,
        device_id: data.deviceId,
        capability: data.capability,
        allowed: data.allowed,
      },
      ...(data.allowed
        ? [{ user_id: context.userId, device_id: null, capability: "master", allowed: true }]
        : []),
    ];
    const { error } = await context.supabase
      .from("jarvis_permissions")
      .upsert(rows, { onConflict: "user_id,device_id,capability" });
    if (error) throw new Error("JARVIS could not change that permission just now.");
    return { allowed: data.allowed };
  });

export const listJarvisAccess = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ deviceId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("jarvis_permissions")
      .select("capability, allowed")
      .eq("device_id", data.deviceId);
    if (error) throw new Error("JARVIS could not read that computer's permissions just now.");
    return (rows ?? []).filter((row) => row.allowed).map((row) => row.capability);
  });

export const listJarvisDevices = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const account = context.userId;
    const [devices, permissions, tasks] = await Promise.all([
      context.supabase
        .from("jarvis_devices")
        .select(
          "id, name, platform, last_seen_at, revoked_at, software_version, installed_apps, capabilities",
        )
        .eq("user_id", account)
        .eq("kind", "agent")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("jarvis_permissions")
        .select("device_id, capability, allowed")
        .eq("user_id", account)
        .in("capability", ["master", "files"]),
      context.supabase
        .from("jarvis_tasks")
        .select("device_id")
        .eq("user_id", account)
        .in("status", ["running", "waiting", "taken_over"]),
    ]);
    if (devices.error || permissions.error || tasks.error)
      throw new Error("JARVIS could not list your computers just now.");
    const active = new Set(tasks.data?.map((task) => task.device_id));
    const granted = permissions.data ?? [];
    const master = granted.some(
      (permission) =>
        permission.device_id === null && permission.capability === "master" && permission.allowed,
    );
    const now = Date.now();
    return (devices.data ?? []).map((device) => {
      const allowed =
        master &&
        granted.some(
          (permission) =>
            permission.device_id === device.id &&
            permission.capability === "files" &&
            permission.allowed,
        );
      const state = device.revoked_at
        ? "removed"
        : !device.last_seen_at
          ? "disconnected"
          : now - Date.parse(device.last_seen_at) > DEVICE_SILENCE_MS
            ? "offline"
            : !allowed
              ? "permission_required"
              : active.has(device.id)
                ? "busy"
                : "ready";
      return { ...device, state };
    });
  });

/* ----------------------------- Schedules ----------------------------- */

const scheduleInput = z.object({
  id: uuid.optional(),
  /** Omitted: a new JARVIS conversation is made for it. */
  conversationId: uuid.optional(),
  /** Omitted: a reminder, which needs no computer. */
  deviceId: uuid.nullable(),
  what: taskObjective,
  /** The first run, as an instant the browser computed from the person's wall time. */
  nextAt: z.iso.datetime(),
  repeat: z.enum(["none", "daily", "weekdays", "weekly"]),
  timeZone: z.string().min(1).max(64),
});

const SCHEDULE_REFUSALS: Record<string, string> = {
  schedule_conversation_unavailable: "That conversation is not one of your JARVIS conversations.",
  schedule_device_unavailable: "That computer is not paired with your account, or was removed.",
  schedule_in_past: "Choose a time in the future.",
  schedule_limit: "You already have 50 schedules. Delete one first.",
  schedule_not_found: "That schedule no longer exists.",
};

function scheduleRefusal(message: string): Error {
  const code = Object.keys(SCHEDULE_REFUSALS).find((key) => message.includes(key));
  return new Error(
    code ? SCHEDULE_REFUSALS[code] : "JARVIS could not save that schedule just now.",
  );
}

/** The person's own schedules, soonest first (RLS: their rows only). */
export const listJarvisSchedules = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jarvis_schedules")
      .select(
        "id, conversation_id, device_id, what, next_at, repeat, time_zone, active, last_run_at, last_outcome",
      )
      .order("next_at", { ascending: true });
    if (error) throw new Error("Your schedules could not be loaded just now.");
    return data ?? [];
  });

/** Create or edit a schedule; the database checks the conversation and computer are the person's. */
export const saveJarvisSchedule = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => scheduleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { isTimeZone } = await import("./schedule-time");
    if (!isTimeZone(data.timeZone)) throw new Error("That time zone is not recognised.");
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: made, error } = await context.supabase
        .from("ocade_conversations")
        .insert({
          user_id: context.userId,
          surface: "jarvis",
          title: `Scheduled: ${data.what}`.slice(0, 200),
        })
        .select("id")
        .single();
      if (error || !made) throw new Error("JARVIS could not save that schedule just now.");
      conversationId = made.id;
    }
    const { admin } = await authority();
    const { data: id, error } = await admin.rpc(
      "jarvis_save_schedule" as never,
      {
        p_user: context.userId,
        p_id: data.id ?? null,
        p_conversation: conversationId,
        p_device: data.deviceId,
        p_what: data.what,
        p_next_at: data.nextAt,
        p_repeat: data.repeat,
        p_zone: data.timeZone,
      } as never,
    );
    if (error) throw scheduleRefusal(error.message);
    return { id: id as unknown as string };
  });

/** Pause or resume. Resuming moves a past run to its next future slot in the person's zone. */
export const setJarvisScheduleActive = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid, active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("jarvis_schedules")
      .select("next_at, repeat, time_zone")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error(SCHEDULE_REFUSALS.schedule_not_found);
    let nextAt: string | null = null;
    if (data.active) {
      const { nextOccurrence } = await import("./schedule-time");
      const now = new Date();
      const due = new Date(row.next_at);
      const next =
        due.getTime() > now.getTime()
          ? due
          : nextOccurrence(due, row.repeat as "none", row.time_zone, now);
      if (!next)
        throw new Error("That one-time schedule has passed. Edit it to choose a new time.");
      nextAt = next.toISOString();
    }
    const { admin } = await authority();
    const { data: done, error } = await admin.rpc(
      "jarvis_set_schedule_active" as never,
      {
        p_user: context.userId,
        p_id: data.id,
        p_active: data.active,
        p_next_at: nextAt,
      } as never,
    );
    if (error || !done) throw new Error(SCHEDULE_REFUSALS.schedule_not_found);
    return { active: data.active };
  });

export const deleteJarvisSchedule = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("jarvis_schedules").delete().eq("id", data.id);
    if (error) throw new Error("That schedule could not be deleted just now.");
    return { deleted: true };
  });

/* Watched folders (REPO-61/71): a new file in one folder of a computer's JARVIS folder starts
 * one scheduled run. The person's own rows (RLS); creation through the server step. */
export const listJarvisWatches = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jarvis_watches")
      .select("id, device_id, folder, what, active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error("Your watched folders could not be loaded just now.");
    return data ?? [];
  });

export const addJarvisWatch = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        deviceId: uuid,
        folder: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine(
            (f) => !/(^|[\\/])\.\.([\\/]|$)/.test(f) && !/^([\\/]|[A-Za-z]:)/.test(f),
            "Choose a folder inside the computer's JARVIS folder, such as Invoices.",
          ),
        what: z.string().trim().min(1).max(400),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: made, error: madeError } = await context.supabase
      .from("ocade_conversations")
      .insert({
        user_id: context.userId,
        surface: "jarvis",
        title: `When a file arrives in ${data.folder}`.slice(0, 200),
      })
      .select("id")
      .single();
    if (madeError || !made) throw new Error("JARVIS could not save that watch just now.");
    const { admin } = await authority();
    const { data: id, error } = await admin.rpc(
      "jarvis_add_watch" as never,
      {
        p_user: context.userId,
        p_conversation: made.id,
        p_device: data.deviceId,
        p_folder: data.folder,
        p_what: data.what,
      } as never,
    );
    if (error) {
      throw new Error(
        error.message.includes("watch_limit")
          ? "That computer already has 10 watched folders."
          : error.message.includes("device_unavailable")
            ? "That computer is not paired with your account."
            : "JARVIS could not save that watch just now.",
      );
    }
    return { id: id as unknown as string };
  });

export const setJarvisWatchActive = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid, active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("jarvis_watches")
      .update({ active: data.active })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error || !row) throw new Error("That watched folder is no longer there.");
    return { active: data.active };
  });

export const deleteJarvisWatch = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("jarvis_watches").delete().eq("id", data.id);
    if (error) throw new Error("That watched folder could not be removed.");
    return { deleted: true };
  });

/**
 * PRIVATE HABITS (plan 27.2.10 R12-10, opt-in): outcomes this person asked for at least twice
 * and that JARVIS finished with every check passed, offered as "do again" suggestions. Only
 * while their memory is on (off: nothing is derived), only from their own tasks (RLS), and a
 * suggestion only fills the composer: running it is a new task with the usual checks.
 */
export const listJarvisHabits = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("memory_enabled")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.memory_enabled) return [];
    const { data, error } = await context.supabase
      .from("jarvis_tasks")
      .select("title, checkpoint, outcome")
      .eq("user_id", context.userId)
      .eq("status", "completed")
      .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return [];
    const { habits } = await import("./habits");
    return habits(data ?? []);
  });
