/**
 * JARVIS for the signed-in person: Send, STOP, read a task, pair or remove a
 * computer, turn its file access on or off.
 *
 * THE ACCOUNT IS ALWAYS `context.userId`, NEVER AN INPUT. Every write goes
 * through the server-only task authority with the service role, after
 * `requireSession` has proved the session is live and meets its second factor.
 * Permission decisions are the person's own rows, written as them under RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";

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
        objective: z.string().trim().min(1).max(1000),
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

/** File access for one paired computer: the master switch plus `files`, as the person's own rows. */
export const setJarvisFileAccess = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ deviceId: uuid, allowed: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const rows = [
      { user_id: context.userId, device_id: null, capability: "master", allowed: true },
      {
        user_id: context.userId,
        device_id: data.deviceId,
        capability: "files",
        allowed: data.allowed,
      },
    ];
    const { error } = await context.supabase
      .from("jarvis_permissions")
      .upsert(data.allowed ? rows : rows.slice(1), { onConflict: "user_id,device_id,capability" });
    if (error) throw new Error("JARVIS could not change that permission just now.");
    return { allowed: data.allowed };
  });

export const listJarvisDevices = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("jarvis_devices")
      .select("id, name, platform, last_seen_at, software_version")
      .is("revoked_at", null)
      .eq("kind", "agent")
      .order("created_at", { ascending: false });
    if (error) throw new Error("JARVIS could not list your computers just now.");
    return data ?? [];
  });
