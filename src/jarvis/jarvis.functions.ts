/**
 * JARVIS server functions. Identity comes only from verified Supabase claims.
 *
 * Owner-writable rows (tasks, permissions, memories, JARVIS conversations) are
 * written through the caller's own client, so row-level security decides.
 * Device records and the action queue are written only here, with the service
 * role, after this code has checked ownership and permissions — so a model,
 * a page or a forged request cannot queue an action the account did not allow.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSession } from "@/lib/security/session-middleware";
import { HIGH_RISK, requireAssurance } from "@/lib/security/assurance-middleware";
import { supabaseCommercialLedger } from "@/lib/commercial/supabase-ledger";
import { resolveTierFor } from "@/lib/commercial/entitlement-resolver";
import { ALLOWANCES, describeUsage } from "@/lib/commercial/usage-policy";
import {
  CAPABILITIES,
  deviceAction,
  FINISHED,
  hostOf,
  TASK_STATUSES,
  type TaskStatus,
} from "./protocol";
import { appDecision, chooseTaskDevice, isAllowed, type PermissionRow } from "./permissions";
import { TASK_COLUMNS, type JarvisTaskRow } from "./task-row";

export type { JarvisTaskRow };

const uuid = z.string().uuid();
/** A device counts as online when it asked for work this recently. */
const ONLINE_MS = 60_000;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** The one read of a person's JARVIS permissions, scoped to them explicitly as well as by RLS. */
async function permissionsOf(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<PermissionRow[]> {
  return (await import("./task-authority.server")).permissionsOf(db, userId);
}

export interface JarvisState {
  conversations: {
    id: string;
    title: string;
    archived: boolean;
    updated_at: string;
    created_at: string;
  }[];
  tasks: JarvisTaskRow[];
  devices: {
    id: string;
    name: string;
    platform: string | null;
    capabilities: Record<string, boolean>;
    last_seen_at: string | null;
    revoked_at: string | null;
    created_at: string;
    kind: string;
    software_version: string | null;
    background_enabled: boolean;
    online: boolean;
    /** One summary a person can act on; the switches stay the detail. */
    status: "ready" | "busy" | "needs_permission" | "offline";
  }[];
  permissions: PermissionRow[];
  memories: { id: string; content: string; created_at: string }[];
  /** Reminders and scheduled work still to come. */
  schedules: {
    id: string;
    conversation_id: string;
    device_id: string | null;
    what: string;
    next_at: string;
    repeat: string;
    last_outcome: string | null;
  }[];
  activity: {
    id: string;
    task_id: string;
    summary: string;
    status: string;
    created_at: string;
  }[];
  sites: string[];
  /** Each computer's apps, with that computer's Allowed Apps rule for each. */
  apps: {
    deviceId: string;
    deviceName: string;
    apps: { name: string; rule: "always" | "ask" | "never" }[];
  }[];
  usage: { remaining: number; allowance: number; resetsInMs: number | null } | null;
}

export const readJarvisState = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ maintain: z.boolean().default(false) }).parse(i ?? {}))
  .handler(async ({ data: input, context }): Promise<JarvisState> => {
    const db = context.supabase;
    const service = await admin();
    // Retention housekeeping runs when JARVIS opens, not on every live refresh.
    if (input.maintain) {
      await service.rpc("jarvis_purge_expired_activity", { p_user_id: context.userId });
      const { pauseOrphanedTasks } = await import("./device.server");
      await pauseOrphanedTasks(service, { userId: context.userId });
    }
    const [conversations, tasks, devices, permissions, memories, activity, schedules] =
      await Promise.all([
        db
          .from("ocade_conversations")
          .select("id, title, archived, updated_at, created_at")
          .eq("surface", "jarvis")
          .order("updated_at", { ascending: false })
          .limit(200),
        db
          .from("jarvis_tasks")
          .select(TASK_COLUMNS)
          .order("updated_at", { ascending: false })
          .limit(100),
        db
          .from("jarvis_devices")
          .select(
            "id, name, platform, capabilities, last_seen_at, revoked_at, created_at, kind, software_version, background_enabled, installed_apps",
          )
          .order("created_at", { ascending: false })
          .limit(50),
        db.from("jarvis_permissions").select("capability, allowed, device_id").limit(500),
        db
          .from("jarvis_memories")
          .select("id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from("jarvis_activity")
          .select("id, task_id, summary, status, created_at, action")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from("jarvis_schedules")
          .select("id, conversation_id, device_id, what, next_at, repeat, last_outcome")
          .eq("active", true)
          .order("next_at", { ascending: true })
          .limit(100),
      ]);
    for (const result of [
      conversations,
      tasks,
      devices,
      permissions,
      memories,
      activity,
      schedules,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const permissionRows = (permissions.data ?? []) as PermissionRow[];
    const sites = new Set<string>();
    for (const row of permissionRows) {
      if (row.capability.startsWith("site:")) sites.add(row.capability.slice(5));
    }
    for (const row of activity.data ?? []) {
      const url = (row.action as { url?: unknown } | null)?.url;
      const host = typeof url === "string" ? hostOf(url) : null;
      if (host) sites.add(host);
    }

    // Allowed Apps per computer: the same app name on two computers is two
    // rules, and a rule for one computer never applies to another.
    const rule = (decided: boolean | null) =>
      decided === true
        ? ("always" as const)
        : decided === false
          ? ("never" as const)
          : ("ask" as const);
    const apps = (devices.data ?? [])
      .filter((device) => !device.revoked_at)
      .map((device) => ({
        deviceId: device.id,
        deviceName: device.name,
        apps: [...new Set((device.installed_apps ?? []) as string[])]
          .sort((a, b) => a.localeCompare(b))
          .slice(0, 300)
          .map((name) => ({ name, rule: rule(appDecision(permissionRows, name, device.id)) })),
      }));

    const entitlement = await resolveTierFor(context.userId);
    const ledger = supabaseCommercialLedger(service);
    const windows = ledger.readCurrent ? await ledger.readCurrent(context.userId, "jarvis") : [];
    const allowance = ALLOWANCES[entitlement.tier];
    const now = Date.now();
    const shown = windows
      .map((w) =>
        describeUsage(
          {
            kind: w.kind,
            used: w.used + w.reserved,
            allowance: w.kind === "session" ? allowance.session : allowance.week,
            window: { kind: w.kind, startsAt: w.startsAt, endsAt: w.endsAt },
          },
          now,
        ),
      )
      .filter((w) => w !== null)
      .sort((a, b) => a.remaining - b.remaining);

    return {
      conversations: conversations.data ?? [],
      tasks: (tasks.data ?? []) as JarvisTaskRow[],
      devices: (devices.data ?? []).map(({ installed_apps: _apps, ...d }) => {
        const online =
          !d.revoked_at && !!d.last_seen_at && now - Date.parse(d.last_seen_at) < ONLINE_MS;
        const busy = (tasks.data ?? []).some(
          (t) => t.device_id === d.id && !FINISHED.includes(t.status as TaskStatus),
        );
        const offers = (d.capabilities ?? {}) as Record<string, boolean>;
        // Ready: JARVIS is on and this computer can do at least one kind of work.
        const usable =
          isAllowed(permissionRows, "master") &&
          ((isAllowed(permissionRows, "browser", d.id) &&
            (offers.browser_isolated === true || offers.browser_real === true)) ||
            (offers.files === true && isAllowed(permissionRows, "files", d.id)) ||
            (offers.apps === true && isAllowed(permissionRows, "apps", d.id)));
        return {
          ...d,
          capabilities: (d.capabilities ?? {}) as Record<string, boolean>,
          online,
          status: !online
            ? ("offline" as const)
            : busy
              ? ("busy" as const)
              : usable
                ? ("ready" as const)
                : ("needs_permission" as const),
        };
      }),
      permissions: permissionRows,
      memories: memories.data ?? [],
      schedules: schedules.data ?? [],
      activity: (activity.data ?? []).map(({ action: _action, ...rest }) => rest),
      sites: [...sites].sort().slice(0, 100),
      apps,
      // Before the first use no window has started: the whole allowance is left.
      usage: shown[0]
        ? {
            remaining: shown[0].remaining,
            allowance: shown[0].allowance,
            resetsInMs: shown[0].resetsInMs,
          }
        : { remaining: allowance.session, allowance: allowance.session, resetsInMs: null },
    };
  });

export const createJarvisConversation = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .insert({ id: data.id, user_id: context.userId, title: "New chat", surface: "jarvis" })
      .select("id, title, archived, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Whether this account owns a JARVIS conversation with this id (not just "no messages"). */
export const jarvisConversationExists = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .select("id")
      .eq("id", data.id)
      .eq("surface", "jarvis")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { exists: Boolean(row) };
  });

/** What the planner may know about the task's computer: never ids or paths. */
export interface TaskDevice {
  name: string;
  platform: string | null;
  /** What this computer offers right now (a permission never adds to it). */
  can: string[];
}

export type StartTaskResult =
  | { ok: true; task: JarvisTaskRow; device: TaskDevice }
  | { ok: false; reason: "no_device" | "permission"; message: string };

export const startJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
        controller: uuid,
        /** Where the work happens: a browser, or the computer itself. */
        where: z.enum(["browser", "computer"]).default("browser"),
        /** The computer the person chose (Remote PC); otherwise the only one online. */
        deviceId: uuid.optional(),
        /** The device the person is using, when the OCADE app said so. */
        hereDeviceId: uuid.optional(),
        /** "computer" when the person named their PC or the work needs one. */
        on: z.enum(["here", "computer"]).optional(),
        title: z.string().trim().min(1).max(200),
        plan: z.array(z.string().trim().min(1).max(200)).max(12),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<StartTaskResult> => {
    const rows = await permissionsOf(context.supabase, context.userId);
    if (!isAllowed(rows, "master")) {
      return { ok: false, reason: "permission", message: "OCADE JARVIS is turned off." };
    }
    const service = await admin();
    const { executionDisabled } = await import("./device.server");
    if (await executionDisabled(service)) {
      return {
        ok: false,
        reason: "permission",
        message: "Working on computers is paused by OCADE right now. Answers still work.",
      };
    }
    const { data: devices, error } = await service
      .from("jarvis_devices")
      .select("id, name, platform, kind, capabilities, last_seen_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const online = (devices ?? []).filter(
      (d) => d.last_seen_at && now - Date.parse(d.last_seen_at) < ONLINE_MS,
    );
    const choice = chooseTaskDevice(online, rows, data.where, data.deviceId, {
      here: data.hereDeviceId,
      on: data.on,
    });
    if (!choice.ok) return { ok: false, reason: "no_device", message: choice.message };
    const { device, real } = choice;
    if (await executionDisabled(service, device.kind)) {
      return {
        ok: false,
        reason: "permission",
        message: "Work on this kind of device is paused by OCADE right now. Answers still work.",
      };
    }
    if (data.where === "browser" && !isAllowed(rows, "browser", device.id)) {
      return {
        ok: false,
        reason: "permission",
        message: "Browser control is turned off for this device.",
      };
    }
    const { data: task, error: insertError } = await context.supabase
      .from("jarvis_tasks")
      .insert({
        user_id: context.userId,
        conversation_id: data.conversationId,
        device_id: device.id,
        title: data.title,
        plan: data.plan.slice(0, 12),
        browser_mode: real ? "real" : "isolated",
        controller: data.controller,
      })
      .select(TASK_COLUMNS)
      .single();
    if (insertError?.code === "23505") {
      return {
        ok: false,
        reason: "permission",
        message: insertError.message.includes("per_device")
          ? "Your computer is already busy with another JARVIS task. Stop it or let it finish first."
          : "A task is already running in this conversation.",
      };
    }
    if (insertError) throw new Error(insertError.message);
    await service.from("jarvis_activity").insert({
      user_id: context.userId,
      task_id: task.id,
      device_id: device.id,
      summary: `Started “${data.title}”`,
    });
    const capabilities = (device.capabilities ?? {}) as Record<string, boolean>;
    return {
      ok: true,
      task: task as JarvisTaskRow,
      device: {
        name: device.name,
        platform: device.platform,
        can: Object.keys(capabilities).filter((key) => capabilities[key] === true),
      },
    };
  });

export const updateJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        id: uuid,
        status: z.enum(TASK_STATUSES).optional(),
        currentStep: z.number().int().min(0).max(12).optional(),
        result: z.string().max(8000).nullable().optional(),
        blocker: z.string().max(300).nullable().optional(),
        /** Claim the task for this planning loop; any other loop stops queueing. */
        controller: uuid.optional(),
        /**
         * Write only while this loop still owns the task. A loop that lost it
         * (another tab or device took over) changes nothing and is told so (null).
         * Alone, it is the loop's heartbeat.
         */
        owner: uuid.optional(),
        checkpoint: z
          .object({
            step: z.number().int().min(0).max(12),
            lastAction: z.string().max(300),
            lastUrl: z.string().max(2000).nullable(),
            at: z.string().max(40),
          })
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<JarvisTaskRow | null> => {
    const { changeTask } = await import("./task-authority.server");
    return changeTask(context.supabase, await admin(), context.userId, data);
  });

export const queueJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid, controller: uuid, action: deviceAction }).parse(i))
  .handler(async ({ data, context }) => {
    const { queueTaskAction } = await import("./task-authority.server");
    return queueTaskAction(context.supabase, await admin(), context.userId, data);
  });

export const readJarvisTask = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jarvis_tasks")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { status: (row?.status ?? "stopped") as TaskStatus };
  });

export const readJarvisAction = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jarvis_activity")
      .select("id, task_id, status, summary, result")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That action no longer exists.");
    const { data: task } = await context.supabase
      .from("jarvis_tasks")
      .select("status")
      .eq("id", row.task_id)
      .maybeSingle();
    return { ...row, taskStatus: (task?.status ?? "stopped") as TaskStatus };
  });

/** A step the planner stopped waiting for: it never runs, and a late result never counts. */
export const cancelJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const { data: row, error } = await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["queued", "claimed", "needs_confirmation"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { cancelled: Boolean(row) };
  });

/** Only a person's click reaches this. The planning loop never calls it. */
export const decideJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid, accept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const { data: row, error } = await service
      .from("jarvis_activity")
      .update(
        data.accept
          ? // Queued from the moment the person confirmed, so it is not already stale.
            { status: "queued", confirmed: true, created_at: new Date().toISOString() }
          : { status: "cancelled", completed_at: new Date().toISOString() },
      )
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "needs_confirmation")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { decided: Boolean(row) };
  });

const capability = z.union([
  z.enum(CAPABILITIES),
  z
    .string()
    .regex(/^site:[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/)
    .max(260),
  z
    .string()
    .regex(/^app:[A-Za-z0-9_ .+&()'-]{1,80}$/)
    .transform((value) => value.toLowerCase()),
]);

export const setJarvisPermission = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        capability,
        /** null returns the capability to its default (for an app: Ask). */
        allowed: z.boolean().nullable(),
        deviceId: uuid.nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const device = data.deviceId ?? null;
    if (data.allowed === null) {
      let clear = context.supabase
        .from("jarvis_permissions")
        .delete()
        .eq("capability", data.capability);
      clear = device ? clear.eq("device_id", device) : clear.is("device_id", null);
      const { error } = await clear;
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    let existing = context.supabase
      .from("jarvis_permissions")
      .select("id")
      .eq("capability", data.capability);
    existing = device ? existing.eq("device_id", device) : existing.is("device_id", null);
    const { data: found, error } = await existing.maybeSingle();
    if (error) throw new Error(error.message);
    const write = found
      ? context.supabase
          .from("jarvis_permissions")
          .update({ allowed: data.allowed, updated_at: new Date().toISOString() })
          .eq("id", found.id)
      : context.supabase.from("jarvis_permissions").insert({
          user_id: context.userId,
          device_id: device,
          capability: data.capability,
          allowed: data.allowed,
        });
    const { error: writeError } = await write;
    if (writeError) throw new Error(writeError.message);
    return { ok: true as const };
  });

/** A pending enrollment, and whether it asked from the network this request comes from. */
async function pendingEnrollment(service: Awaited<ReturnType<typeof admin>>, id: string) {
  const { data: row, error } = await service
    .from("jarvis_devices")
    .select("id, name, platform, kind, public_key, enrollment_source")
    .eq("id", id)
    .is("user_id", null)
    .gt("enrollment_expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.public_key) return null;
  const { enrollmentSource, fingerprint } = await import("./device.server");
  const { getRequest } = await import("@tanstack/react-start/server");
  return {
    row,
    fingerprint: await fingerprint(row.public_key),
    sameNetwork: (await enrollmentSource(getRequest())) === row.enrollment_source,
  };
}

/**
 * What a person sees before approving a device: never its key. From the
 * network the device asked from, its fingerprint to compare; from anywhere
 * else nothing to copy, because the person must read it off the device itself.
 */
export const readJarvisEnrollment = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const pending = await pendingEnrollment(await admin(), data.id);
    if (!pending) return null;
    return {
      id: pending.row.id,
      name: pending.row.name,
      platform: pending.row.platform,
      kind: pending.row.kind as "agent" | "android",
      fingerprint: pending.sameNetwork ? pending.fingerprint : null,
    };
  });

const sameCode = (typed: string, fingerprint: string) =>
  typed.replace(/[^0-9a-f]/gi, "").toUpperCase() === fingerprint.replace(/-/g, "");

/**
 * The person's confirmation that makes a pending device theirs. The account is
 * the caller's verified identity, never a parameter; a device already claimed
 * or expired cannot be claimed again.
 *
 * A LINK ALONE IS NOT ENOUGH. Anyone can enroll a computer of their own and
 * send its approve link. So the proof is recent (a stolen, older session cannot
 * attach a computer that outlives "sign out everywhere"), and a request from
 * another network than the device's needs the fingerprint the device shows,
 * typed by the person — a sender would have to talk them into typing it too.
 */
export const approveJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((i) => z.object({ id: uuid, code: z.string().max(40).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const pending = await pendingEnrollment(service, data.id);
    if (!pending) return { ok: false as const, message: "That connection request has expired." };
    if (!pending.sameNetwork && !sameCode(data.code ?? "", pending.fingerprint)) {
      return {
        ok: false as const,
        message:
          "That is not the fingerprint this device shows. Check it on the device and try again.",
      };
    }
    const { data: row, error } = await service
      .from("jarvis_devices")
      // Approved: where it asked from is no longer anybody's business.
      .update({ user_id: context.userId, enrollment_expires_at: null, enrollment_source: null })
      .eq("id", data.id)
      .is("user_id", null)
      .gt("enrollment_expires_at", new Date().toISOString())
      .select("id, name, kind")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, message: "That connection request has expired." };
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "A new device was connected to OCADE JARVIS",
      body: `“${row.name}” can now run JARVIS tasks you start. Remove it in JARVIS Devices if this was not you.`,
      deepLink: "/ocade-jarvis",
      idempotencyKey: `jarvis-device-connected:${row.id}`,
    });
    return { ok: true as const };
  });

/**
 * Refuse a pending request that is not the person's. Deleted only from the
 * network it asked from, so knowing a request's id is not a way to cancel
 * somebody else's setup; elsewhere it is simply left to expire.
 */
export const declineJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const service = await admin();
    const pending = await pendingEnrollment(service, data.id);
    if (pending?.sameNetwork) {
      await service.from("jarvis_devices").delete().eq("id", data.id).is("user_id", null);
    }
    return { ok: true as const };
  });

export const revokeJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const now = new Date().toISOString();
    const { error } = await service
      .from("jarvis_devices")
      .update({ revoked_at: now, public_key: null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    // A lost device stops at once: its unfinished tasks end with it.
    await service
      .from("jarvis_tasks")
      .update({ status: "stopped", blocker: "The device was removed." })
      .eq("device_id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["running", "waiting", "taken_over"]);
    await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: now })
      .eq("device_id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["queued", "claimed", "needs_confirmation"]);
    return { ok: true as const };
  });

/**
 * Background Mode for one computer: explicitly started work may continue while
 * OCADE is closed. Device records are not browser-writable, so this is the door.
 */
export const setJarvisBackground = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid, enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const { error } = await service
      .from("jarvis_devices")
      .update({ background_enabled: data.enabled })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** STOP JARVIS: every unfinished task of this account, on every device, ends now. */
export const stopAllJarvis = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const at = new Date().toISOString();
    const { data: stopped, error } = await context.supabase
      .from("jarvis_tasks")
      .update({ status: "stopped", blocker: "You stopped JARVIS." })
      .in("status", ["running", "waiting", "taken_over"])
      .select("id");
    if (error) throw new Error(error.message);
    const service = await admin();
    // Running actions too: the device learns it on its next check (about a
    // second) and kills them; a late result is never counted as done.
    const { data: running } = await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: at })
      .eq("user_id", context.userId)
      .eq("status", "claimed")
      .select("id");
    await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: at })
      .eq("user_id", context.userId)
      .in("status", ["queued", "needs_confirmation"]);
    return {
      stopped: stopped?.length ?? 0,
      /** Actions a device was running: the UI waits for each device to confirm. */
      running: (running ?? []).map((row) => row.id as string),
    };
  });

/**
 * A public documentation page, read by OCADE's server for the person's JARVIS.
 * Read inside a task, it is recorded on the task: what JARVIS does next may
 * follow from a page, so a script after it is shown to the person first.
 */
export const readJarvisDocs = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ url: z.string().max(2000), taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    // Only for the caller's own running task, with JARVIS on: never a free fetching service.
    if (!isAllowed(await permissionsOf(context.supabase, context.userId), "master")) {
      return { ok: false as const, message: "OCADE JARVIS is turned off." };
    }
    const service = await admin();
    const { data: task } = await service
      .from("jarvis_tasks")
      .select("id")
      .eq("id", data.taskId)
      .eq("user_id", context.userId)
      .eq("status", "running")
      .maybeSingle();
    if (!task) return { ok: false as const, message: "Documentation is read for a running task." };
    const { count } = await service
      .from("jarvis_activity")
      .select("id", { count: "exact", head: true })
      .eq("task_id", task.id)
      .in("action->>action", ["docs"]);
    if ((count ?? 0) >= DOCS_PER_TASK) {
      return { ok: false as const, message: "This task has read enough documentation already." };
    }
    const { readPublicPage } = await import("./docs.server");
    const page = await readPublicPage(data.url);
    // Recorded either way: what JARVIS does next may follow from a page it read.
    await service.from("jarvis_activity").insert({
      user_id: context.userId,
      task_id: task.id,
      summary: (page.ok ? `Read the documentation at ${page.host}` : page.message).slice(0, 300),
      action: { action: "docs", url: data.url.slice(0, 2000) },
      status: page.ok ? "done" : "failed",
      result: page.ok ? { status: "done", title: page.title } : { status: "failed" },
      completed_at: new Date().toISOString(),
    });
    return page;
  });

/** Documentation pages one task may read. */
const DOCS_PER_TASK = 20;

export const rememberJarvis = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ content: z.string().trim().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!isAllowed(await permissionsOf(context.supabase, context.userId), "memory")) {
      return { ok: false as const, message: "JARVIS memory is turned off." };
    }
    const { error } = await context.supabase
      .from("jarvis_memories")
      .insert({ user_id: context.userId, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** A person can have this many reminders and scheduled tasks waiting at once. */
export const MAX_SCHEDULES = 50;

/**
 * A reminder, or work JARVIS starts later on a computer, as the person asked.
 * Only from the person's own turn: the planning loop refuses it once a page's
 * content has been read, so nothing a page says can set up future work.
 */
export const scheduleJarvis = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
        what: z.string().trim().min(1).max(500),
        when: z.string().datetime({ offset: true }),
        repeat: z.enum(["none", "daily", "weekdays", "weekly"]).default("none"),
        timeZone: z.string().max(64).default("UTC"),
        onComputer: z.boolean().default(false),
        deviceId: uuid.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const at = Date.parse(data.when);
    if (at < Date.now() - 60_000) return { ok: false, message: "That time has already passed." };
    if (at > Date.now() + 366 * 86_400_000) {
      return { ok: false, message: "Schedules can be at most a year ahead." };
    }
    const { data: conversation } = await context.supabase
      .from("ocade_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("surface", "jarvis")
      .maybeSingle();
    if (!conversation) return { ok: false, message: "That conversation does not exist." };
    const service = await admin();
    const { count } = await service
      .from("jarvis_schedules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("active", true);
    if ((count ?? 0) >= MAX_SCHEDULES) {
      return {
        ok: false,
        message: `You already have ${MAX_SCHEDULES} reminders and scheduled tasks. Remove one first.`,
      };
    }
    let deviceId: string | null = null;
    let computer = "";
    if (data.onComputer) {
      const { data: agents } = await service
        .from("jarvis_devices")
        .select("id, name")
        .eq("user_id", context.userId)
        .eq("kind", "agent")
        .is("revoked_at", null)
        .limit(20);
      const chosen = data.deviceId
        ? (agents ?? []).filter((d) => d.id === data.deviceId)
        : (agents ?? []);
      if (chosen.length !== 1) {
        return {
          ok: false,
          message: chosen.length
            ? "More than one computer could do it. Choose one in Devices, then ask again."
            : "No computer with the OCADE Device Agent is connected. Connect one in Devices.",
        };
      }
      deviceId = chosen[0]!.id;
      computer = chosen[0]!.name;
    }
    const { safeZone } = await import("./schedule-time");
    const { error } = await service.from("jarvis_schedules").insert({
      user_id: context.userId,
      conversation_id: data.conversationId,
      device_id: deviceId,
      what: data.what,
      next_at: new Date(at).toISOString(),
      repeat: data.repeat,
      time_zone: safeZone(data.timeZone),
    });
    if (error) throw new Error(error.message);
    return {
      ok: true,
      message: deviceId
        ? `Scheduled on ${computer}. It starts only while Background Mode and Scheduled work are on for that computer.`
        : "Reminder set.",
    };
  });

export const removeJarvisSchedule = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("jarvis_schedules")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { removed: true };
  });

export const forgetJarvis = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("jarvis_memories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const readJarvisFrame = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((i) => z.object({ taskId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jarvis_tasks")
      .select("live_frame, status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const live = row && !FINISHED.includes(row.status as TaskStatus);
    return { frame: live ? (row.live_frame as string | null) : null };
  });
