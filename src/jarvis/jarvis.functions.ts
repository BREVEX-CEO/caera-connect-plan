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
  browserAction,
  CAPABILITIES,
  describeAction,
  FINISHED,
  hostOf,
  TASK_STATUSES,
  type TaskStatus,
} from "./protocol";
import { isAllowed, refuseAction, type PermissionRow } from "./permissions";

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
    online: boolean;
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
  usage: { remaining: number; allowance: number; resetsInMs: number } | null;
}

const TASK_COLUMNS =
  "id, conversation_id, device_id, title, plan, current_step, status, blocker, result, browser_mode, created_at, updated_at";

export const readJarvisState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JarvisState> => {
    const db = context.supabase;
    const service = await admin();
    await service.rpc("jarvis_purge_expired_activity", { p_user_id: context.userId });
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
        .select("id, name, platform, capabilities, last_seen_at, revoked_at, created_at")
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
      devices: (devices.data ?? []).map((d) => ({
        ...d,
        capabilities: (d.capabilities ?? {}) as Record<string, boolean>,
        online: !d.revoked_at && !!d.last_seen_at && now - Date.parse(d.last_seen_at) < ONLINE_MS,
      })),
      permissions: permissionRows,
      memories: memories.data ?? [],
      activity: (activity.data ?? []).map(({ action: _action, ...rest }) => rest),
      sites: [...sites].sort().slice(0, 100),
      usage: shown[0]
        ? {
            remaining: shown[0].remaining,
            allowance: shown[0].allowance,
            resetsInMs: shown[0].resetsInMs,
          }
        : null,
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

export type StartTaskResult =
  | { ok: true; task: JarvisTaskRow }
  | { ok: false; reason: "no_device" | "permission"; message: string };

export const startJarvisTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
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
    const { data: devices, error } = await service
      .from("jarvis_devices")
      .select("id, capabilities, last_seen_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const now = Date.now();
    const device = (devices ?? []).find(
      (d) => d.last_seen_at && now - Date.parse(d.last_seen_at) < ONLINE_MS,
    );
    if (!device) {
      return {
        ok: false,
        reason: "no_device",
        message: "No JARVIS device is online. Connect one in Devices to run browser tasks.",
      };
    }
    if (!isAllowed(rows, "browser", device.id)) {
      return {
        ok: false,
        reason: "permission",
        message: "Browser control is turned off for this device.",
      };
    }
    const real =
      isAllowed(rows, "browser_real", device.id) &&
      (device.capabilities as Record<string, boolean> | null)?.browser_real === true;
    const { data: task, error: insertError } = await context.supabase
      .from("jarvis_tasks")
      .insert({
        user_id: context.userId,
        conversation_id: data.conversationId,
        device_id: device.id,
        title: data.title,
        plan: data.plan.slice(0, 12),
        browser_mode: real ? "real" : "isolated",
      })
      .select(TASK_COLUMNS)
      .single();
    if (insertError?.code === "23505") {
      return {
        ok: false,
        reason: "permission",
        message: "A task is already running in this conversation.",
      };
    }
    if (insertError) throw new Error(insertError.message);
    await service.from("jarvis_activity").insert({
      user_id: context.userId,
      task_id: task.id,
      device_id: device.id,
      summary: `Started “${data.title}”`,
    });
    return { ok: true, task: task as JarvisTaskRow };
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
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
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
          .in("status", ["queued", "needs_confirmation"]);
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
    }
    return task as JarvisTaskRow;
  });

export const queueJarvisAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ taskId: uuid, action: browserAction }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: task, error } = await context.supabase
      .from("jarvis_tasks")
      .select("id, status, device_id, browser_mode")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("That task no longer exists.");
    if (task.status !== "running")
      return { ok: false as const, message: "The task is not running." };
    if (!task.device_id) return { ok: false as const, message: "The task has no device." };

    const service = await admin();
    const { data: device } = await service
      .from("jarvis_devices")
      .select("id")
      .eq("id", task.device_id)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!device) return { ok: false as const, message: "The task's device was removed." };

    const url =
      data.action.action === "open" || data.action.action === "new_tab"
        ? data.action.url
        : undefined;
    const refusal = refuseAction(await permissionsOf(context.supabase), {
      deviceId: device.id,
      mode: task.browser_mode as "isolated" | "real",
      url,
    });
    if (refusal) return { ok: false as const, message: refusal.message };

    const { data: row, error: insertError } = await service
      .from("jarvis_activity")
      .insert({
        user_id: context.userId,
        task_id: task.id,
        device_id: device.id,
        summary: describeAction(data.action),
        action: data.action,
        status: "queued",
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
]);

export const setJarvisPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z.object({ capability, allowed: z.boolean(), deviceId: uuid.nullable().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const device = data.deviceId ?? null;
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

const PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const createJarvisPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const raw = [...bytes].map((b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join("");
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const service = await admin();
    const { sha256Hex } = await import("./device.server");
    // Codes that expired unused leave nothing behind.
    await service
      .from("jarvis_devices")
      .delete()
      .eq("user_id", context.userId)
      .is("token_hash", null)
      .lt("pairing_expires_at", new Date().toISOString());
    const { error } = await service.from("jarvis_devices").insert({
      user_id: context.userId,
      pairing_code_hash: await sha256Hex(raw),
      pairing_expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);
    return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt };
  });

export const revokeJarvisDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const service = await admin();
    const now = new Date().toISOString();
    const { error } = await service
      .from("jarvis_devices")
      .update({ revoked_at: now, token_hash: null, pairing_code_hash: null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await service
      .from("jarvis_activity")
      .update({ status: "cancelled", completed_at: now })
      .eq("device_id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["queued", "claimed", "needs_confirmation"]);
    return { ok: true as const };
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
