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
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseCommercialLedger } from "@/lib/commercial/supabase-ledger";
import { resolveTierFor } from "@/lib/commercial/entitlement-resolver";
import { ALLOWANCES, describeUsage } from "@/lib/commercial/usage-policy";
import {
  CAPABILITIES,
  deviceAction,
  describeAction,
  FINISHED,
  hostOf,
  TASK_STATUSES,
  type TaskStatus,
} from "./protocol";
import {
  appDecision,
  isAllowed,
  needsConfirmation,
  refuseAction,
  type PermissionRow,
} from "./permissions";

const uuid = z.string().uuid();
/** A device counts as online when it asked for work this recently. */
const ONLINE_MS = 60_000;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function permissionsOf(db: SupabaseClient<Database>): Promise<PermissionRow[]> {
  const { data, error } = await db
    .from("jarvis_permissions")
    .select("capability, allowed, device_id")
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface JarvisTaskRow {
  id: string;
  conversation_id: string;
  device_id: string | null;
  title: string;
  plan: string[];
  current_step: number;
  status: TaskStatus;
  blocker: string | null;
  result: string | null;
  browser_mode: "isolated" | "real";
  checkpoint: {
    step: number;
    lastAction: string;
    lastUrl: string | null;
    at: string;
  } | null;
  created_at: string;
  updated_at: string;
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

const TASK_COLUMNS =
  "id, conversation_id, device_id, title, plan, current_step, status, blocker, result, browser_mode, checkpoint, created_at, updated_at";

export const readJarvisState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ maintain: z.boolean().default(false) }).parse(i ?? {}))
  .handler(async ({ data: input, context }): Promise<JarvisState> => {
    const db = context.supabase;
    const service = await admin();
    // Retention housekeeping runs when JARVIS opens, not on every live refresh.
    if (input.maintain) {
      await service.rpc("jarvis_purge_expired_activity", { p_user_id: context.userId });
    }
    const [conversations, tasks, devices, permissions, memories, activity] = await Promise.all([
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
    ]);
    for (const result of [conversations, tasks, devices, permissions, memories, activity]) {
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
      .filter((device) => !device.revoked_at && device.kind === "agent")
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
        controller: uuid,
        /** Where the work happens: a browser, or the computer itself. */
        where: z.enum(["browser", "computer"]).default("browser"),
        /** The computer the person chose (Remote PC); otherwise the only one online. */
        deviceId: uuid.optional(),
        title: z.string().trim().min(1).max(200),
        plan: z.array(z.string().trim().min(1).max(200)).max(12),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<StartTaskResult> => {
    const rows = await permissionsOf(context.supabase);
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
    const offers = (d: (typeof online)[number], capability: string) =>
      (d.capabilities as Record<string, boolean> | null)?.[capability] === true;
    // The computer's own work needs its Device Agent. Browser work prefers the
    // person's own browser only where they allowed it, else the isolated one.
    const chosen = data.deviceId ? online.filter((d) => d.id === data.deviceId) : online;
    if (data.deviceId && chosen.length === 0) {
      return {
        ok: false,
        reason: "no_device",
        message: "That computer is not online. Open OCADE on it or choose another in Devices.",
      };
    }
    const agents = chosen.filter((d) => d.kind === "agent");
    const ownBrowser = chosen.find(
      (d) => offers(d, "browser_real") && isAllowed(rows, "browser_real", d.id),
    );
    // Work never goes to a computer the person did not mean: with several
    // online and none chosen, they choose.
    if (!data.deviceId && data.where === "computer" && agents.length > 1) {
      return {
        ok: false,
        reason: "no_device",
        message: `More than one computer is online (${agents
          .map((d) => d.name)
          .join(", ")}). Choose one in Devices, then ask again.`,
      };
    }
    const device =
      data.where === "computer"
        ? agents[0]
        : (ownBrowser ?? agents.find((d) => offers(d, "browser_isolated")) ?? agents[0]);
    if (!device) {
      return {
        ok: false,
        reason: "no_device",
        message:
          data.where === "computer"
            ? "No computer with the OCADE Device Agent is online. Connect one in Devices."
            : "No JARVIS device is online. Connect one in Devices to run browser tasks.",
      };
    }
    if (data.where === "browser" && !isAllowed(rows, "browser", device.id)) {
      return {
        ok: false,
        reason: "permission",
        message: "Browser control is turned off for this device.",
      };
    }
    const real = device === ownBrowser;
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
  .middleware([requireSupabaseAuth])
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
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.controller !== undefined) patch.controller = data.controller;
    if (data.checkpoint !== undefined) patch.checkpoint = data.checkpoint;
    if (data.status !== undefined) patch.status = data.status;
    if (data.currentStep !== undefined) patch.current_step = data.currentStep;
    if (data.result !== undefined) patch.result = data.result;
    if (data.blocker !== undefined) patch.blocker = data.blocker;
    const { data: task, error } = await context.supabase
      .from("jarvis_tasks")
      .update(patch as never)
      .eq("id", data.id)
      .select(TASK_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("That task no longer exists.");
    if (data.status) {
      const service = await admin();
      // Anything not yet run for a task that is no longer running never runs.
      if (data.status !== "running") {
        await service
          .from("jarvis_activity")
          .update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("task_id", data.id)
          .eq("user_id", context.userId)
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
        user_id: context.userId,
        task_id: data.id,
        summary: words[data.status],
      });
      // A finished task is worth telling the person about wherever they are:
      // OCADE's own notification history, never the task's private result.
      if (data.status === "completed" || data.status === "failed" || data.status === "blocked") {
        const { sendNotification } = await import("@/lib/notifications/send.server");
        await sendNotification({
          userId: context.userId,
          category: "task_outcomes",
          title: `JARVIS ${data.status === "completed" ? "finished" : "stopped"}: ${task.title.slice(0, 120)}`,
          deepLink: `/ocade-jarvis?c=${task.conversation_id}`,
          idempotencyKey: `jarvis-task-${data.status}:${task.id}`,
        });
      }
    }
    return task as JarvisTaskRow;
  });

export const queueJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ taskId: uuid, controller: uuid, action: deviceAction }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: task, error } = await context.supabase
      .from("jarvis_tasks")
      .select("id, status, device_id, browser_mode, controller")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("That task no longer exists.");
    // One planning loop drives a task. Another tab or device that took it over
    // owns it now, and this loop stops rather than racing it.
    if (task.controller !== data.controller) {
      return {
        ok: false as const,
        lost: true,
        message: "Another device took control of this task.",
      };
    }
    if (task.status !== "running")
      return { ok: false as const, message: "The task is not running." };
    if (!task.device_id) return { ok: false as const, message: "The task has no device." };

    const service = await admin();
    const { data: device } = await service
      .from("jarvis_devices")
      .select("id, capabilities, installed_apps")
      .eq("id", task.device_id)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!device) return { ok: false as const, message: "The task's device was removed." };

    const rows = await permissionsOf(context.supabase);
    const refusal = refuseAction(rows, {
      deviceId: device.id,
      mode: task.browser_mode as "isolated" | "real",
      action: data.action,
      offered: (device.capabilities ?? {}) as Record<string, boolean>,
    });
    if (refusal) return { ok: false as const, message: refusal.message };
    if (data.action.action === "open_app") {
      const installed = (device.installed_apps ?? []) as string[];
      const wanted = data.action.name.toLowerCase();
      const exact = installed.find((name) => name.toLowerCase() === wanted);
      if (!exact) {
        const near = installed.filter((name) => name.toLowerCase().includes(wanted)).slice(0, 5);
        return {
          ok: false as const,
          message: near.length
            ? `No app is named "${data.action.name}" on this computer. Did you mean: ${near.join(", ")}?`
            : `No app named "${data.action.name}" is installed on this computer. Use the apps action to list them.`,
        };
      }
      data.action.name = exact;
    }
    // Deletions, system changes, risky commands and apps set to Ask wait for the
    // person before the device ever sees them.
    const ask = needsConfirmation(rows, data.action, device.id);

    const { data: row, error: insertError } = await service
      .from("jarvis_activity")
      .insert({
        user_id: context.userId,
        task_id: task.id,
        device_id: device.id,
        summary: describeAction(data.action),
        action: data.action,
        status: ask ? "needs_confirmation" : "queued",
        // Model-issued actions are never pre-confirmed.
        confirmed: false,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    return { ok: true as const, id: row.id as string };
  });

export const readJarvisTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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

/** Only a person's click reaches this. The planning loop never calls it. */
export const decideJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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

/** What a person sees before approving a device: never its key, only its fingerprint. */
export const readJarvisEnrollment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const service = await admin();
    const { data: row, error } = await service
      .from("jarvis_devices")
      .select("id, name, platform, kind, public_key, enrollment_expires_at")
      .eq("id", data.id)
      .is("user_id", null)
      .gt("enrollment_expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.public_key) return null;
    const { fingerprint } = await import("./device.server");
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      kind: row.kind as "agent" | "extension",
      fingerprint: await fingerprint(row.public_key),
    };
  });

/**
 * The person's one click that makes a pending device theirs. The account is
 * the caller's verified identity, never a parameter; a device already claimed
 * or expired cannot be claimed again.
 */
export const approveJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const { data: row, error } = await service
      .from("jarvis_devices")
      .update({ user_id: context.userId, enrollment_expires_at: null })
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

/** Refuse a pending request that is not the person's. */
export const declineJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data }) => {
    const service = await admin();
    await service.from("jarvis_devices").delete().eq("id", data.id).is("user_id", null);
    return { ok: true as const };
  });

export const revokeJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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

export const rememberJarvis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ content: z.string().trim().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!isAllowed(await permissionsOf(context.supabase), "memory")) {
      return { ok: false as const, message: "JARVIS memory is turned off." };
    }
    const { error } = await context.supabase
      .from("jarvis_memories")
      .insert({ user_id: context.userId, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const forgetJarvis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("jarvis_memories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const readJarvisFrame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
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
