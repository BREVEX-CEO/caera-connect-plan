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
import {
  PROTOCOL_VERSION,
  actionIntent,
  actionReceipt,
  deviceRequest,
  type OutcomeCheck,
} from "./contracts.ts";
import type { Decision, Step } from "./supervisor.ts";
import {
  PlannerUnavailable,
  compileGoal,
  planStep,
  plannerMessage,
  type McpServer,
} from "./planner.server.ts";

export type Admin = Pick<SupabaseClient<Database>, "rpc">;

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
  blocker: string | null;
  result: string | null;
  checkpoint: Record<string, unknown> | null;
  conversationId: string;
  deviceName: string | null;
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
    receipt: unknown;
    createdAt: string;
    completedAt: string | null;
    confirmedAt: string | null;
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
    };
  });
  const measured = steps.flatMap((step) => (step.durationMs === null ? [] : [step.durationMs]));
  const done = task.status === "completed";
  return {
    acceptedAt: timing.acceptedAt,
    finishedAt: timing.finishedAt,
    verifiedAt: done ? timing.finishedAt : null,
    deliveredAt: done ? timing.finishedAt : null,
    totalElapsedMs: ms(timing.acceptedAt, timing.finishedAt ?? timing.now),
    userWaitMs: timing.pausedMs + steps.reduce((sum, step) => sum + (step.confirmWaitMs ?? 0), 0),
    activeExecutionMs: measured.length ? Math.round(measured.reduce((a, b) => a + b, 0)) : null,
    modelCalls: timing.modelCalls,
    modelMs: timing.modelMs,
    stepDurationsMs: steps.map((step) => step.durationMs),
  };
}

function readTask(admin: Admin, taskId: string) {
  return call<TaskState | null>(admin, "jarvis_task_state", { p_task: taskId });
}

/**
 * One bounded planning turn. Only a running task with a live controller can be
 * advanced; a STOP in between makes the queue or settle call fail closed.
 */
export async function advance(admin: Admin, taskId: string, now = new Date()): Promise<void> {
  const task = await readTask(admin, taskId);
  if (!task || task.status !== "running" || !task.controller) return;
  const steps: Step[] = task.steps.map((step) => ({
    intent: actionIntent.parse(step.intent),
    status: step.status,
    receipt: step.receipt ? (actionReceipt.safeParse(step.receipt).data ?? null) : null,
  }));
  const checks = task.outcome ?? [];
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
    await call(admin, "jarvis_task_wait", {
      p_task: taskId,
      p_controller: task.controller,
      p_reason: `${plannerMessage(error.message)} Your task is saved; resume it later.`,
    });
    return;
  }
  for (const ms of modelCalls) await noteModel(admin, taskId, ms);
  try {
    if (decision.kind === "queue") {
      await call(admin, "jarvis_queue_actions", {
        p_task: taskId,
        p_controller: task.controller,
        p_actions: [
          { summary: decision.summary, action: decision.intent },
          ...(decision.more ?? []).map((next) => ({ summary: next.summary, action: next.intent })),
        ] as unknown as Json,
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
    if (error instanceof JarvisRefusal && error.code === "stale_controller") return;
    throw error;
  }
}

const noteModel = (admin: Admin, taskId: string, elapsed: number) =>
  call(admin, "jarvis_note_model", { p_task: taskId, p_ms: Math.round(elapsed) });

/* --------------------------- Customer actions --------------------------- */

export async function startTask(
  admin: Admin,
  userId: string,
  input: { conversationId: string; deviceId: string; objective: string },
) {
  const objective = input.objective.replace(/\s+/g, " ").trim().slice(0, 200);
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
  let checks: OutcomeCheck[];
  let goalMs: number | null = null;
  try {
    checks = await compileGoal(userId, objective, grants, (ms) => (goalMs = ms));
  } catch (error) {
    if (!(error instanceof PlannerUnavailable)) throw error;
    throw new JarvisRefusal(
      "planner_unavailable",
      `${plannerMessage(error.message)} Nothing was started.`,
    );
  }
  const [opened] = await call<{ task_id: string; status: string; reused: boolean }[]>(
    admin,
    "jarvis_open_task",
    {
      p_user: userId,
      p_conversation: input.conversationId,
      p_device: input.deviceId,
      p_title: objective,
      p_outcome: checks as unknown as Json,
      p_plan: checks.map((c) => c.description) as unknown as Json,
    },
  );
  if (!opened.reused) {
    if (goalMs !== null) await noteModel(admin, opened.task_id, goalMs);
    await advance(admin, opened.task_id);
  }
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
    steps: task.steps.map((step, index) => ({
      id: step.id,
      durationMs: timing.stepDurationsMs[index],
      summary: step.summary,
      status: step.status,
      needsConfirmation: step.status === "needs_confirmation",
    })),
    device: task.deviceName,
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
    const publicKey = await call<string | null>(admin, "jarvis_device_key", { p_device: deviceId });
    if (!publicKey || !(await verifySignature(publicKey, signature, text))) {
      // Pending, revoked and unknown devices read the same as a bad signature.
      return refuse(401, "signature_invalid");
    }
    if (
      !(await call<boolean>(admin, "jarvis_device_seen", {
        p_device: deviceId,
        p_timestamp_ms: timestamp,
      }))
    ) {
      return refuse(409, "replayed");
    }

    if (parsed.op === "inventory") {
      await call(admin, "jarvis_device_inventory", {
        p_device: deviceId,
        p_apps: parsed.apps as unknown as Json,
        p_mcp: parsed.mcp as unknown as Json,
        p_engines: parsed.engines as unknown as Json,
      });
      return { status: 200, body: { inventory: "recorded" } };
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
      return { status: 200, body: { receipt: recorded.outcome } };
    }
    return { status: 200, body: await call(admin, "jarvis_claim_action", { p_device: deviceId }) };
  } catch (error) {
    if (error instanceof JarvisRefusal) {
      return refuse(error.code === "device_unavailable" ? 401 : 409, error.code);
    }
    throw error;
  }
}
