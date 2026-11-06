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
    return guarded(() => startTask(admin, context.userId, data));
  });

export const stopJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, stopTask } = await authority();
    return guarded(() => stopTask(admin, context.userId, data.taskId));
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
    await guarded(() => resumeTask(admin, context.userId, data.taskId));
    return { resumed: true };
  });

export const confirmJarvisStep = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ activityId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin, confirmAction } = await authority();
    return {
      confirmed: await guarded(() => confirmAction(admin, context.userId, data.activityId)),
    };
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
  z.enum(["files", "apps", "browser", "screen", "computer_control", "mcp"]),
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
