/**
 * THE JARVIS TASK AUTHORITY (plan.md §23, P02/P03/P13/P16).
 *
 * Server only. Every state change goes through one `jarvis_*` database function
 * that re-checks ownership, controller, permission and the owner's emergency
 * pause inside its own transaction; this module decides what to ask for and
 * proves who is asking. A browser reaches it only through `functions.ts` after
 * its session is checked; a device only through a request signed by the P-256
 * key it enrolled.
 *
 * REQUEST-DRIVEN. Each call makes at most one planning decision and returns.
 * The next decision is driven by the device's next receipt, so no in-memory
 * loop, timer or open connection is ever the only holder of a task.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { readBoundedRequestText } from "../read-bounded-request.ts";
import { JARVIS_CONSENT_NEEDED } from "./consent-needed.ts";
import { taskObjective } from "./objective.ts";
import {
  PROTOCOL_VERSION,
  actionIntent,
  actionReceipt,
  deviceRequest,
  intent,
  type OutcomeCheck,
} from "./contracts.ts";
import { ONLINE_CONSENT_VERSION } from "../intelligence/online-consent-version.ts";
import {
  effectInDoubt,
  open,
  unresolvedEffect,
  type Decision,
  type Step,
  type Milestone,
} from "./supervisor.ts";
import {
  PlannerUnavailable,
  compileGoal,
  planStep,
  plannerBusy,
  plannerMessage,
  type McpServer,
} from "./planner.server.ts";

export type Admin = Pick<SupabaseClient<Database>, "rpc">;

/** A computer that polls at least every 30 s and has been silent this long is unreachable. */
const DEVICE_SILENCE_MS = 90_000;

/** The first read-only look whose result the fixed checks are compiled from. */
const DISCOVERY = "discover";

export class JarvisRefusal extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Database refusals the person can act on, in their words. Anything else stays generic. */
const REFUSALS: Record<string, string> = {
  jarvis_paused: "JARVIS is paused by OCADE right now. Nothing was started.",
  conversation_not_found: "That conversation is not a JARVIS conversation of yours.",
  device_unavailable: "That computer is not paired with your account, or was removed.",
  permission_required:
    "Turn on file access (and any app or website it needs) for that computer first.",
  busy: "That computer or conversation is already running a task. Stop it or wait.",
  task_not_found: "That task does not exist.",
  unknown_code: "That pairing code is wrong or has expired.",
  too_many_enrollments:
    "Too many computers are waiting to pair from here. Try again in 10 minutes.",
  // Device-facing and race outcomes; never shown to a person.
  stale_controller: "That task changed; this decision is no longer current.",
  outcome_fixed: "That task's checks were already fixed.",
  milestone_changed: "That milestone already changed; this decision is no longer current.",
  actions_open: "That task still has a step in progress.",
  unknown_action: "That step is not this device's.",
  invalid_receipt: "That receipt is not valid.",
  receipt_conflict: "That step already has a different result.",
};

async function call<T>(admin: Admin, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    admin.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  if (error) {
    const code = Object.keys(REFUSALS).find((key) => error.message.includes(key));
    if (code) throw new JarvisRefusal(code, REFUSALS[code]);
    throw new Error(`JARVIS could not record that just now (${fn}).`);
  }
  return data as T;
}

/* ------------------------------ Planning ------------------------------ */

interface TaskState {
  id: string;
  userId: string;
  status: string;
  controller: string | null;
  title: string;
  outcome: OutcomeCheck[] | null;
  plan?: unknown;
  blocker: string | null;
  result: string | null;
  checkpoint: Record<string, unknown> | null;
  conversationId: string;
  deviceName: string | null;
  deviceSeenAt: string | null;
  grants: string[];
  mcp: McpServer[];
  engines: string[] | null;
  timing: {
    acceptedAt: string;
    finishedAt: string | null;
    now: string;
    pausedMs: number;
    modelCalls: number;
    modelMs: number;
  };
  steps: {
    id: string;
    summary: string;
    intent: unknown;
    status: string;
    controller?: string | null;
    receipt: unknown;
    createdAt: string;
    completedAt: string | null;
    confirmedAt: string | null;
    claimedAt?: string | null;
    resolution: "applied" | "not_applied" | null;
  }[];
}

const ms = (from: string, to: string | null) => (to ? Date.parse(to) - Date.parse(from) : null);

/**
 * Elapsed time from durable server timestamps (plan.md M3). Step durations are the
 * device's own monotonic measurement; null when it did not report one. Steps run one
 * at a time, so their sum is active execution, never a sum of concurrent work.
 */
export function taskTiming(task: Pick<TaskState, "status" | "timing" | "steps">) {
  const { timing } = task;
  const steps = task.steps.map((step) => {
    const measured = (step.receipt as { evidence?: { durationMs?: unknown } } | null)?.evidence
      ?.durationMs;
    return {
      durationMs: typeof measured === "number" ? measured : null,
      confirmWaitMs: ms(step.createdAt, step.confirmedAt),
      // Queued (or confirmed) until the device picked it up.
      pickupMs: step.claimedAt ? ms(step.confirmedAt ?? step.createdAt, step.claimedAt) : null,
    };
  });
  const measured = steps.flatMap((step) => (step.durationMs === null ? [] : [step.durationMs]));
  const done = task.status === "completed";
  const sum = (values: (number | null)[]) => values.reduce<number>((a, b) => a + (b ?? 0), 0);
  const totalElapsedMs = ms(timing.acceptedAt, timing.finishedAt ?? timing.now);
  const pickupMs = sum(steps.map((step) => step.pickupMs));
  const userWaitMs = sum(steps.map((step) => step.confirmWaitMs));
  const activeExecutionMs = measured.length ? Math.round(sum(measured)) : null;
  return {
    acceptedAt: timing.acceptedAt,
    finishedAt: timing.finishedAt,
    verifiedAt: done ? timing.finishedAt : null,
    deliveredAt: done ? timing.finishedAt : null,
    totalElapsedMs,
    // Waiting on the person is their confirmations; other pauses (Take Over, a busy planner,
    // an uncertain step to check) are reported as paused, not blamed on the person.
    userWaitMs,
    pausedMs: timing.pausedMs,
    activeExecutionMs,
    modelCalls: timing.modelCalls,
    modelMs: timing.modelMs,
    pickupMs,
    // What no phase explains (transport, receipt delivery, server work); the W2 target is ≤10%.
    unaccountedMs:
      totalElapsedMs === null
        ? null
        : Math.max(
            0,
            totalElapsedMs -
              timing.modelMs -
              (activeExecutionMs ?? 0) -
              timing.pausedMs -
              userWaitMs -
              pickupMs,
          ),
    stepDurationsMs: steps.map((step) => step.durationMs),
    // The first step's pickup is the idle pickup; later ones are claims while the task runs.
    stepPickupMs: steps.map((step) => step.pickupMs),
  };
}

function readTask(admin: Admin, taskId: string) {
  return call<TaskState | null>(admin, "jarvis_task_state", { p_task: taskId });
}

/**
 * One bounded planning turn. Only a running task with a live controller can be
 * advanced; a STOP in between makes the queue or settle call fail closed.
 */
/**
 * Where an idle companion listens for "work is waiting" (W2). The broadcast is content-free and
 * public on a random per-device topic; the device answers it only with its usual signed claim.
 * Null when Realtime is not configured: the device then polls.
 */
async function nudgeChannel(admin: Admin, deviceId: string) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const topic = await call<string | null>(admin, "jarvis_device_topic", { p_device: deviceId });
  if (!base || !key || !topic) return null;
  return { url: `${base.replace(/^http/, "ws")}/realtime/v1/websocket`, key, topic };
}

export async function advance(admin: Admin, taskId: string, now = new Date()): Promise<void> {
  const task = await readTask(admin, taskId);
  if (!task || task.status !== "running" || !task.controller) return;
  const steps: Step[] = task.steps.map((step) => {
    const raw = step.receipt;
    const receipt = raw ? (actionReceipt.safeParse(raw).data ?? null) : null;
    return {
      intent: actionIntent.parse(step.intent),
      status: step.status,
      controller: step.controller,
      completedAt: step.completedAt,
      receipt,
      // Durable STOP/crash records may be incomplete. Keep their uncertainty for the shared fence.
      unparsedReceipt: receipt === null ? raw : undefined,
      resolution: step.resolution,
    };
  });
  const unknown = unresolvedEffect(steps);
  if (unknown) {
    await call(admin, "jarvis_task_wait", {
      p_task: taskId,
      p_controller: task.controller,
      p_reason: unknown,
    });
    return;
  }
  let checks = task.outcome ?? [];
  let plan = task.plan;
  if (!checks.length) {
    // The checks are fixed after a first read-only look at the JARVIS folder, not guessed.
    const look = steps.find((step) => step.intent.key === DISCOVERY);
    if (!look) {
      await call(admin, "jarvis_queue_actions", {
        p_task: taskId,
        p_controller: task.controller,
        p_actions: [
          {
            summary: "Looking at your JARVIS folder",
            action: intent("fs.list", DISCOVERY, { path: "." }, new Date(now.getTime() + 600_000)),
          },
        ] as unknown as Json,
      });
      return;
    }
    if (open(look)) return;
    let goalMs: number | null = null;
    try {
      checks = await compileGoal(
        task.userId,
        task.title,
        task.grants,
        (ms) => (goalMs = ms),
        look.status === "done" ? (look.receipt?.evidence as { entries?: [] }) : null,
        (milestones: Milestone[]) => (plan = milestones),
      );
    } catch (error) {
      if (goalMs !== null) await noteModel(admin, taskId, goalMs);
      if (!(error instanceof PlannerUnavailable)) throw error;
      await plannerWait(admin, taskId, task.controller, error);
      return;
    }
    if (goalMs !== null) await noteModel(admin, taskId, goalMs);
    try {
      await call(admin, "jarvis_set_outcome", {
        p_task: taskId,
        p_controller: task.controller,
        p_outcome: checks as unknown as Json,
        p_plan: plan as Json,
      });
    } catch (error) {
      // Lost a race to STOP or to another turn that fixed the checks first.
      if (
        error instanceof JarvisRefusal &&
        ["stale_controller", "outcome_fixed"].includes(error.code)
      )
        return;
      throw error;
    }
  }
  let decision: Decision;
  // Every model call of this turn is counted (a refused proposal may cost a second one).
  const modelCalls: number[] = [];
  try {
    // No special-case customer journey: every request uses the same AI planner.
    decision = await planStep({
      userId: task.userId,
      objective: task.title,
      checks,
      steps,
      plan,
      checkpoint: task.checkpoint,
      controller: task.controller,
      grants: task.grants,
      mcp: task.mcp ?? [],
      engines: task.engines,
      turnKey: `jarvis-plan:${taskId}:${task.controller}:${steps.length}`,
      now,
      onModelCall: (ms) => void modelCalls.push(ms),
    });
  } catch (error) {
    if (!(error instanceof PlannerUnavailable)) throw error;
    for (const ms of modelCalls) await noteModel(admin, taskId, ms);
    await plannerWait(admin, taskId, task.controller, error);
    return;
  }
  // Model time is recorded alongside the decision rather than before it: one round trip less.
  const noted = Promise.all(modelCalls.map((ms) => noteModel(admin, taskId, ms)));
  try {
    if (decision.kind === "queue") {
      await call(admin, "jarvis_queue_actions", {
        p_task: taskId,
        p_controller: task.controller,
        p_actions: [
          {
            summary: decision.summary,
            action: decision.intent,
            milestone: Number(
              (task.checkpoint?.milestones as { index?: number } | undefined)?.index ?? 0,
            ),
          },
          ...(decision.more ?? []).map((next) => ({
            summary: next.summary,
            action: next.intent,
            milestone: Number(
              (task.checkpoint?.milestones as { index?: number } | undefined)?.index ?? 0,
            ),
          })),
        ] as unknown as Json,
      });
    } else if (decision.kind === "milestone") {
      await call(admin, "jarvis_complete_milestone", {
        p_task: taskId,
        p_controller: task.controller,
        p_index: decision.index,
      });
    } else if (decision.kind === "settle") {
      await call(admin, "jarvis_settle_task", {
        p_task: taskId,
        p_controller: task.controller,
        p_verification: decision.verification as unknown as Json,
        p_summary: decision.summary,
      });
    } else if (decision.kind === "block") {
      await call(admin, "jarvis_settle_task", {
        p_task: taskId,
        p_controller: task.controller,
        p_verification: { passed: [], failed: [], unverified: [] },
        p_summary: decision.reason,
      });
    }
  } catch (error) {
    // Lost a race to STOP or another planner: the database already holds the truth.
    if (
      error instanceof JarvisRefusal &&
      ["stale_controller", "milestone_changed"].includes(error.code)
    )
      return;
    if (error instanceof JarvisRefusal && error.code === "permission_required") {
      // Grants can change while the planner is running. No action was admitted;
      // keep the saved task resumable after the person restores its permissions.
      try {
        await call(admin, "jarvis_task_wait", {
          p_task: taskId,
          p_controller: task.controller,
          p_reason: REFUSALS.permission_required,
        });
      } catch (waitError) {
        if (!(waitError instanceof JarvisRefusal && waitError.code === "stale_controller")) {
          throw waitError;
        }
      }
      return;
    }
    throw error;
  } finally {
    await noted;
  }
}

/** Between 30 s and 15 min: the provider's own Retry-After when it gave one. */
const BUSY_RETRY_MS = { min: 30_000, max: 900_000 } as const;

/**
 * The planner could not answer: the task waits. When it was only busy (free capacity), it
 * tries again by itself once the retry time passes (D10); anything else waits for the person.
 */
async function plannerWait(
  admin: Admin,
  taskId: string,
  controller: string,
  error: PlannerUnavailable,
) {
  // The same planning turn is already being answered (a resent receipt started a second
  // advance with the same permit key): that turn owns the task, this one changes nothing.
  if (error.message === "permit_refused") return;
  if (plannerBusy(error.message)) {
    const wait = Math.min(Math.max(error.retryAfterMs ?? 0, BUSY_RETRY_MS.min), BUSY_RETRY_MS.max);
    await call(admin, "jarvis_task_wait_until", {
      p_task: taskId,
      p_controller: controller,
      p_reason: `${plannerMessage(error.message)} JARVIS tries again by itself shortly; nothing is lost.`,
      p_retry_at: new Date(Date.now() + wait).toISOString(),
    });
    return;
  }
  await call(admin, "jarvis_task_wait", {
    p_task: taskId,
    p_controller: controller,
    p_reason: `${plannerMessage(error.message)} Your task is saved; resume it later.`,
  });
}

const noteModel = (admin: Admin, taskId: string, elapsed: number) =>
  call(admin, "jarvis_note_model", { p_task: taskId, p_ms: Math.round(elapsed) });

/* --------------------------- Customer actions --------------------------- */

export async function startTask(
  admin: Admin,
  userId: string,
  input: { conversationId: string; deviceId: string; objective: string },
) {
  const accepted = taskObjective.safeParse(input.objective);
  if (!accepted.success)
    throw new JarvisRefusal("invalid_objective", accepted.error.issues[0].message);
  const objective = accepted.data;
  const grants = await call<string[]>(admin, "jarvis_grants", {
    p_user: userId,
    p_device: input.deviceId,
  });
  // Fail closed before requesting a potentially quota-consuming model turn.
  // The database still re-checks account, conversation, device and permissions
  // atomically when opening the task; this is an early inexpensive guard.
  if (!grants.includes("files")) {
    throw new JarvisRefusal("permission_required", REFUSALS.permission_required);
  }
  // Early, inexpensive: the person agreed to online AI (the service checks again).
  if (
    !(await call<boolean>(admin, "jarvis_online_consented", {
      p_user: userId,
      p_version: ONLINE_CONSENT_VERSION,
    }))
  ) {
    throw new JarvisRefusal("online_not_consented", JARVIS_CONSENT_NEEDED);
  }
  // Opened without checks: they are fixed after a first read-only look (see `advance`).
  const [opened] = await call<{ task_id: string; status: string; reused: boolean }[]>(
    admin,
    "jarvis_open_task",
    {
      p_user: userId,
      p_conversation: input.conversationId,
      p_device: input.deviceId,
      p_title: objective,
      p_outcome: null as unknown as Json,
      p_plan: [] as unknown as Json,
    },
  );
  if (!opened.reused) await advance(admin, opened.task_id);
  return { taskId: opened.task_id, reused: opened.reused };
}

export async function stopTask(admin: Admin, userId: string, taskId: string) {
  const [stopped] = await call<{ status: string; cancelled: number; in_flight: number }[]>(
    admin,
    "jarvis_stop_task",
    { p_user: userId, p_task: taskId },
  );
  // "Stopped" is the fence; a step already running on the computer may still finish.
  return { status: stopped.status, cancelled: stopped.cancelled, inFlight: stopped.in_flight };
}

export async function takeOver(admin: Admin, userId: string, taskId: string) {
  return call<string>(admin, "jarvis_take_over", { p_user: userId, p_task: taskId });
}

export async function resumeTask(admin: Admin, userId: string, taskId: string) {
  await call<string>(admin, "jarvis_resume_task", { p_user: userId, p_task: taskId });
  await advance(admin, taskId);
}

export async function resolveEffect(
  admin: Admin,
  userId: string,
  activityId: string,
  resolution: "applied" | "not_applied",
) {
  const answered = await call<boolean>(admin, "jarvis_resolve_effect", {
    p_user: userId,
    p_activity: activityId,
    p_resolution: resolution,
  });
  if (!answered) throw new JarvisRefusal("task_not_found", REFUSALS.task_not_found);
}

export function confirmAction(admin: Admin, userId: string, activityId: string) {
  return call<boolean>(admin, "jarvis_confirm_action", { p_user: userId, p_activity: activityId });
}

/** The owner's view: status, checks and each step's summary — no controller, no raw evidence. */
export async function taskView(admin: Admin, userId: string, taskId: string) {
  const task = await readTask(admin, taskId);
  if (!task || task.userId !== userId)
    throw new JarvisRefusal("task_not_found", REFUSALS.task_not_found);
  const verification = (task.checkpoint?.verification ?? null) as {
    passed?: string[];
    failed?: string[];
    unverified?: string[];
  } | null;
  const timing = taskTiming(task);
  const open = ["waiting", "taken_over"].includes(task.status);
  return {
    id: task.id,
    status: task.status,
    title: task.title,
    blocker: task.blocker,
    result: task.result,
    checks: (task.outcome ?? []).map((check) => ({
      ...check,
      state: verification?.passed?.includes(check.id)
        ? "passed"
        : verification?.failed?.includes(check.id)
          ? "failed"
          : "unchecked",
    })),
    steps: task.steps.map((step, index) => {
      const receipt = step.receipt ? (actionReceipt.safeParse(step.receipt).data ?? null) : null;
      const intent = actionIntent.safeParse(step.intent);
      // The person answers whether a step whose effect nobody observed took effect.
      const needsAnswer =
        open &&
        !step.resolution &&
        !["queued", "claimed", "needs_confirmation"].includes(step.status) &&
        (!intent.success ||
          effectInDoubt({
            intent: intent.data,
            status: step.status,
            receipt,
            unparsedReceipt: receipt === null ? step.receipt : undefined,
          }));
      return {
        id: step.id,
        durationMs: timing.stepDurationsMs[index],
        summary: step.summary,
        status: step.status,
        needsConfirmation: step.status === "needs_confirmation",
        needsAnswer,
        resolution: step.resolution,
        // What the person allows or answers about is the exact operation and arguments.
        effect:
          step.status === "needs_confirmation" || needsAnswer
            ? exactEffect(step.intent)
            : undefined,
      };
    }),
    device: task.deviceName,
    // An outage is said plainly: the step in hand stays put and nothing new starts until contact.
    deviceOffline:
      task.status === "running" &&
      (!task.deviceSeenAt ||
        Date.parse(task.timing.now) - Date.parse(task.deviceSeenAt) > DEVICE_SILENCE_MS),
    timing,
    // Files JARVIS wrote and saw land, named as they are in the computer's JARVIS folder.
    artifacts: task.steps.flatMap((step) => {
      const parsed = actionIntent.safeParse(step.intent);
      if (step.status !== "done" || !parsed.success || parsed.data.risk === "read") return [];
      return ["output", "docx", "pdf", "path"]
        .map((name) => parsed.data.arguments[name])
        .filter((value): value is string => typeof value === "string");
    }),
  };
}

export function exactEffect(intent: unknown): string {
  const parsed = actionIntent.safeParse(intent);
  if (!parsed.success) return "An action that could not be read: do not allow it.";
  return `${parsed.data.operation} ${JSON.stringify(parsed.data.arguments, null, 2)}`;
}

export function approveDevice(admin: Admin, userId: string, code: string) {
  return call<string>(admin, "jarvis_approve_device", { p_user: userId, p_code: code });
}

export function revokeDevice(admin: Admin, userId: string, deviceId: string) {
  return call<boolean>(admin, "jarvis_revoke_device", { p_user: userId, p_device: deviceId });
}

/* ---------------------------- Signed devices ---------------------------- */

// A receipt may carry one 64 KB preview image for the planner.
const SIGNING = { prefix: "OCADE-JARVIS-1", skewMs: 300_000, maxBody: 160_000 } as const;
export const HEADERS = {
  device: "x-ocade-device",
  timestamp: "x-ocade-timestamp",
  signature: "x-ocade-signature",
  protocol: "x-ocade-protocol",
} as const;

const fromBase64Url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The exact text a device signs. The companion builds the same lines. */
export async function canonical(parts: {
  method: string;
  path: string;
  deviceId: string;
  timestamp: number;
  body: string;
}) {
  return [
    SIGNING.prefix,
    String(PROTOCOL_VERSION),
    parts.method.toUpperCase(),
    parts.path,
    parts.deviceId,
    String(parts.timestamp),
    await sha256Hex(parts.body),
  ].join("\n");
}

/** P-256 ECDSA over SHA-256; the key is base64url SPKI, the signature base64url r‖s. */
async function verifySignature(publicKey: string, signature: string, text: string) {
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      fromBase64Url(publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(text),
    );
  } catch {
    return false;
  }
}

/**
 * An approved device's public key, remembered briefly to save a database round trip per
 * request (W2). It grants nothing on its own: `jarvis_device_seen` below still refuses a
 * revoked or removed device on every request, so revocation stays immediate.
 */
const DEVICE_KEY_CACHE = { ms: 300_000, entries: 1_000 } as const;
const deviceKeys = new Map<string, { key: string; until: number }>();

type Reply = { status: number; body: Record<string, unknown> };
const refuse = (status: number, error: string): Reply => ({ status, body: { error } });

/**
 * The one door a device uses. Order matters: the signature and freshness are
 * proved before any task state is read, and a request is accepted once.
 */
export async function handleDeviceRequest(
  admin: Admin,
  request: Request,
  source: string,
  now = Date.now(),
): Promise<Reply> {
  if (request.method !== "POST") return refuse(405, "method_not_allowed");
  if (Number(request.headers.get(HEADERS.protocol)) !== PROTOCOL_VERSION) {
    return refuse(426, "update_required");
  }
  const timestamp = Number(request.headers.get(HEADERS.timestamp));
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNING.skewMs) {
    return refuse(409, "clock_skew");
  }
  const body = await readBoundedRequestText(request, SIGNING.maxBody);
  if (body === null) return refuse(413, "too_large");
  let parsed;
  try {
    parsed = deviceRequest.parse(JSON.parse(body));
  } catch {
    return refuse(400, "invalid_request");
  }
  const deviceId = request.headers.get(HEADERS.device) ?? "";
  const signature = request.headers.get(HEADERS.signature) ?? "";
  const text = await canonical({
    method: request.method,
    path: new URL(request.url).pathname,
    deviceId,
    timestamp,
    body,
  });

  try {
    if (parsed.op === "enroll") {
      // Proves possession of the private key; the row belongs to nobody until approved.
      if (deviceId !== "-" || !(await verifySignature(parsed.publicKey, signature, text))) {
        return refuse(401, "signature_invalid");
      }
      const [enrolled] = await call<{ device_id: string; code: string; expires_at: string }[]>(
        admin,
        "jarvis_enroll_device",
        {
          p_public_key: parsed.publicKey,
          p_name: parsed.name,
          p_platform: parsed.platform,
          p_software_version: parsed.softwareVersion,
          p_source: await sha256Hex(source),
        },
      );
      return {
        status: 200,
        body: { deviceId: enrolled.device_id, code: enrolled.code, expiresAt: enrolled.expires_at },
      };
    }

    if (!/^[0-9a-f-]{36}$/.test(deviceId)) return refuse(401, "signature_invalid");
    const cached = deviceKeys.get(deviceId);
    if (!cached || cached.until < now || !(await verifySignature(cached.key, signature, text))) {
      const publicKey = await call<string | null>(admin, "jarvis_device_key", {
        p_device: deviceId,
      });
      if (!publicKey || !(await verifySignature(publicKey, signature, text))) {
        // Pending, revoked and unknown devices read the same as a bad signature.
        deviceKeys.delete(deviceId);
        return refuse(401, "signature_invalid");
      }
      if (deviceKeys.size >= DEVICE_KEY_CACHE.entries) deviceKeys.clear();
      deviceKeys.set(deviceId, { key: publicKey, until: now + DEVICE_KEY_CACHE.ms });
    }
    if (
      !(await call<boolean>(admin, "jarvis_device_seen", {
        p_device: deviceId,
        p_timestamp_ms: timestamp,
      }))
    ) {
      // Replayed, or revoked since its key was remembered: only the database can tell.
      deviceKeys.delete(deviceId);
      const still = await call<string | null>(admin, "jarvis_device_key", { p_device: deviceId });
      return still ? refuse(409, "replayed") : refuse(401, "signature_invalid");
    }

    if (parsed.op === "inventory") {
      await call(admin, "jarvis_device_inventory", {
        p_device: deviceId,
        p_apps: parsed.apps as unknown as Json,
        p_mcp: parsed.mcp as unknown as Json,
        p_engines: parsed.engines as unknown as Json,
      });
      return {
        status: 200,
        body: { inventory: "recorded", nudge: await nudgeChannel(admin, deviceId) },
      };
    }
    if (parsed.op === "receipt") {
      const [recorded] = await call<{ outcome: string; task_id: string }[]>(
        admin,
        "jarvis_submit_receipt",
        {
          p_device: deviceId,
          p_activity: parsed.activityId,
          p_receipt: parsed.receipt as unknown as Json,
        },
      );
      await advance(admin, recorded.task_id);
      // The next step rides on this answer, saving the device a round trip (W2).
      const next = await call<Record<string, unknown>>(admin, "jarvis_claim_action", {
        p_device: deviceId,
      });
      return { status: 200, body: { receipt: recorded.outcome, ...next } };
    }
    let state = await call<{
      task?: { id?: string; status?: string } | null;
      action?: unknown;
    }>(admin, "jarvis_claim_action", { p_device: deviceId });
    if (state.task?.status === "waiting") {
      // A task that waited only for a busy planner and is now due runs again (D10).
      const due = await call<string | null>(admin, "jarvis_resume_due", { p_device: deviceId });
      if (due) {
        await advance(admin, due);
        state = await call(admin, "jarvis_claim_action", { p_device: deviceId });
      }
    }
    if (state.task?.status === "running" && state.task.id && !state.action) {
      // A milestone can advance without a queued device action.
      await advance(admin, state.task.id);
      state = await call(admin, "jarvis_claim_action", { p_device: deviceId });
    }
    return { status: 200, body: state };
  } catch (error) {
    if (error instanceof JarvisRefusal) {
      return refuse(error.code === "device_unavailable" ? 401 : 409, error.code);
    }
    throw error;
  }
}
