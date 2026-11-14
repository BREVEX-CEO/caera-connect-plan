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
  DEVICE_SILENCE_MS,
  PROTOCOL_VERSION,
  actionIntent,
  actionReceipt,
  deviceRequest,
  effectPossible,
  intent,
  type OutcomeCheck,
} from "./contracts.ts";
import { ONLINE_CONSENT_VERSION } from "../intelligence/online-consent-version.ts";
import {
  effectInDoubt,
  milestonePlan,
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
  type PermitKey,
  type PlannerMeasurement,
  type Precedent,
} from "./planner.server.ts";

export type Admin = Pick<SupabaseClient<Database>, "rpc">;

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
  session_ended: "Your sign-in ended. Sign in again before starting or continuing a JARVIS task.",
  conversation_not_found: "That conversation is not a JARVIS conversation of yours.",
  device_unavailable: "That computer is not paired with your account, or was removed.",
  permission_required:
    "Turn on file access (and any app or website it needs) for that computer first.",
  busy: "That computer or conversation is already running a task. Stop it or wait.",
  queue_full: "That task already has steps waiting. Let them finish before trying again.",
  app_out_of_scope:
    "This task is limited to the apps its request names with @. Name the app there, or start a new task.",
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
  sessionLive?: boolean;
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
    providerUsage?: {
      inputTokens: number | null;
      outputTokens: number | null;
      inputMeasuredCalls: number;
      outputMeasuredCalls: number;
      goalMs: number;
      decisionMs: number;
      limitReached: boolean;
    };
    plannerAutoRetries?: number;
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
  const milliseconds = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const steps = task.steps.map((step) => {
    const evidence = (step.receipt as { evidence?: Record<string, unknown> } | null)?.evidence;
    const intent = step.intent as { operation?: string; risk?: string } | null;
    return {
      durationMs: milliseconds(evidence?.durationMs),
      workerReadyMs: milliseconds(evidence?.workerReadyMs),
      toolMs: milliseconds(evidence?.toolMs),
      phase:
        typeof intent?.operation === "string" && intent.operation.startsWith("verify.")
          ? "verification"
          : intent?.risk === "read"
            ? "observation"
            : "execution",
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
  const availableTotal = (values: (number | null)[]) =>
    values.some((value) => value !== null) ? Math.round(sum(values)) : null;
  const toolTime = (phase: string) =>
    availableTotal(steps.filter((step) => step.phase === phase).map((step) => step.toolMs));
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
    workerReadyMs: availableTotal(steps.map((step) => step.workerReadyMs)),
    observationMs: toolTime("observation"),
    executionMs: toolTime("execution"),
    verificationMs: toolTime("verification"),
    modelCalls: timing.modelCalls,
    modelMs: timing.modelMs,
    providerUsage: timing.providerUsage ?? null,
    plannerAutoRetries: timing.plannerAutoRetries ?? null,
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
  if (!task || task.status !== "running" || !task.controller || task.sessionLive === false) return;
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
  const turn = plannerTurn(admin, taskId, task.controller);
  try {
    turn.answered = await decide(admin, { ...task, controller: task.controller }, steps, turn, now);
  } finally {
    await turn.end();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Hands a task to its next planning turn. */
export type Plan = (taskId: string) => Promise<void>;

type PlannerQueue = { send(body: { taskId: string }): Promise<unknown> };

/**
 * WHERE A PLANNING TURN RUNS (P2). A model turn takes seconds to minutes; inside the device's
 * request it held the companion's connection open (up to 170 s) and died with it. Where the
 * deployment binds the Cloudflare Queue `JARVIS_PLANNER`, the turn runs in its consumer
 * (`planQueued`, 15 min wall clock) and the database nudges the device when a step is queued.
 * Without the binding (local runs, tests) the turn runs inline, exactly as before.
 */
export function planner(admin: Admin): Plan {
  const env = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const queue = env?.JARVIS_PLANNER as PlannerQueue | undefined;
  if (queue && typeof queue.send === "function")
    return (taskId) => queue.send({ taskId }).then(() => undefined);
  return (taskId) => advance(admin, taskId);
}

type QueuedMessage = { body: unknown; ack(): void; retry(): void };

/**
 * The background planner's consumer: one task id per message. A message that names no task is
 * dropped; a turn that failed is retried by the queue. A retried turn is safe: it re-reads the
 * task, its fences and the turn lease, so a duplicate changes nothing.
 */
export async function planQueued(messages: readonly QueuedMessage[], plan: Plan): Promise<void> {
  for (const message of messages) {
    const taskId = (message.body as { taskId?: unknown } | null)?.taskId;
    if (typeof taskId !== "string" || !UUID.test(taskId)) {
      message.ack();
      continue;
    }
    try {
      await plan(taskId);
      message.ack();
    } catch {
      message.retry(); // the queue's own retry count and dead-letter record the failure
    }
  }
}

/** A model call may take this long (the planner's own 145 s limit, plus settling its answer). */
const PLANNER_TURN_SECONDS = 160;

/**
 * Who may ask the model for this task right now (20261110090000). The first model call takes
 * the turn; a later call of the same request keeps it. Every call gets a key no other call
 * ever had, so a retry is never refused as a duplicate of the attempt it replaces.
 */
function plannerTurn(admin: Admin, taskId: string, controller: string) {
  let held: number | null = null;
  let calls = 0;
  const turn = {
    /** The request reached a decision: the next unanswered turn starts its retries afresh. */
    answered: false,
    permitKey: async () => {
      held = await call<number | null>(admin, "jarvis_planner_turn", {
        p_task: taskId,
        p_controller: controller,
        p_seconds: PLANNER_TURN_SECONDS,
        ...(held === null ? {} : { p_held: held }),
      });
      // Another request is asking the model for this task (or it was stopped): that one owns it.
      if (held === null) throw new PlannerUnavailable("turn_held");
      calls += 1;
      return `jarvis-plan:${taskId}:${held}:${calls}`;
    },
    end: async () => {
      if (held === null) return;
      await call(admin, "jarvis_planner_turn_end", {
        p_task: taskId,
        p_turn: held,
        p_answered: turn.answered,
      });
    },
  };
  return turn;
}

/**
 * One planning decision for a running task, admitted through the database's own fences.
 * False when the planner gave no answer and the task now waits.
 */
async function decide(
  admin: Admin,
  task: TaskState & { controller: string },
  steps: Step[],
  { permitKey }: { permitKey: PermitKey },
  now: Date,
): Promise<boolean> {
  const taskId = task.id;
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
      return true;
    }
    if (open(look)) return true;
    const goalCalls: TimedPlannerCall[] = [];
    try {
      checks = await compileGoal(
        task.userId,
        task.title,
        task.grants,
        (ms, measurement) => goalCalls.push({ ms, measurement }),
        look.status === "done" ? (look.receipt?.evidence as { entries?: [] }) : null,
        (milestones: Milestone[]) => (plan = milestones),
        permitKey,
      );
    } catch (error) {
      await notePlannerCalls(admin, taskId, "goal", goalCalls);
      if (!(error instanceof PlannerUnavailable)) throw error;
      await plannerWait(admin, taskId, task.controller, error);
      return false;
    }
    await notePlannerCalls(admin, taskId, "goal", goalCalls);
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
        return true;
      throw error;
    }
  }
  let decision: Decision;
  // Every model call of this turn is counted (a refused proposal may cost a second one).
  const modelCalls: TimedPlannerCall[] = [];
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
      experience: () => call<Precedent[]>(admin, "jarvis_experience", { p_task: taskId }),
      engines: task.engines,
      permitKey,
      now,
      onModelCall: (ms, measurement) => modelCalls.push({ ms, measurement }),
    });
  } catch (error) {
    if (!(error instanceof PlannerUnavailable)) throw error;
    await notePlannerCalls(admin, taskId, "decision", modelCalls);
    await plannerWait(admin, taskId, task.controller, error);
    return false;
  }
  // Admission and measurements share the round trip, with rejection handled immediately.
  const noted = notePlannerCalls(admin, taskId, "decision", modelCalls).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  // Admission and measurement both finish; an admission error wins over a measurement error.
  const admitted = (async () => {
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
      } else if (decision.kind === "wait" && decision.reason) {
        await call(admin, "jarvis_task_wait", {
          p_task: taskId,
          p_controller: task.controller,
          p_reason: decision.reason,
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
      if (
        error instanceof JarvisRefusal &&
        (error.code === "permission_required" || error.code === "app_out_of_scope")
      ) {
        // Grants can change while the planner is running. No action was admitted;
        // keep the saved task resumable after the person restores its permissions.
        try {
          await call(admin, "jarvis_task_wait", {
            p_task: taskId,
            p_controller: task.controller,
            p_reason: REFUSALS[error.code],
          });
        } catch (waitError) {
          if (!(waitError instanceof JarvisRefusal && waitError.code === "stale_controller")) {
            throw waitError;
          }
        }
        return;
      }
      throw error;
    }
  })().then(
    () => null,
    (error: unknown) => ({ error }),
  );
  const [failure, measurement] = await Promise.all([admitted, noted]);
  if (failure) throw failure.error;
  if (!measurement.ok) throw measurement.error;
  return true;
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
  // Another request holds this planning turn (a resent receipt, a poll during a long model
  // call): that one owns the task, this one changes nothing.
  if (error.message === "turn_held") return;
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

type TimedPlannerCall = { ms: number; measurement: PlannerMeasurement };

async function notePlannerCalls(
  admin: Admin,
  taskId: string,
  phase: "goal" | "decision",
  calls: TimedPlannerCall[],
) {
  if (!calls.length) return;
  const samples = await Promise.all(
    calls.map(async ({ ms, measurement }) => ({
      call: await sha256Hex(measurement.permitId),
      ms: Math.round(ms),
      input: measurement.usage?.inputTokens ?? null,
      output: measurement.usage?.outputTokens ?? null,
    })),
  );
  const { error } = await admin.rpc("jarvis_note_model_metrics", {
    p_task: taskId,
    p_phase: phase,
    p_samples: samples,
  });
  if (error) throw new Error("JARVIS could not record that just now (jarvis_note_model_metrics).");
}

/* --------------------------- Customer actions --------------------------- */

export async function startTask(
  admin: Admin,
  userId: string,
  input: { conversationId: string; deviceId: string; objective: string; sessionId?: string },
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
      ...(input.sessionId ? { p_session: input.sessionId } : {}),
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

export async function resumeTask(admin: Admin, userId: string, taskId: string, sessionId?: string) {
  await call<string>(admin, "jarvis_resume_task", {
    p_user: userId,
    p_task: taskId,
    ...(sessionId ? { p_session: sessionId } : {}),
  });
  await planner(admin)(taskId);
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
  const savedMilestones = milestonePlan.safeParse(task.plan);
  const cursor = (task.checkpoint?.milestones as { index?: unknown } | undefined)?.index;
  const milestoneIndex = typeof cursor === "number" && Number.isInteger(cursor) ? cursor : 0;
  const milestones =
    savedMilestones.success && savedMilestones.data.length > 1
      ? savedMilestones.data.map((milestone, index) => ({
          description: milestone.description,
          state:
            index < milestoneIndex ? "verified" : index === milestoneIndex ? "current" : "pending",
        }))
      : [];
  const canRetry =
    ["blocked", "stopped", "failed"].includes(task.status) &&
    task.steps.every((step) => {
      const intent = actionIntent.safeParse(step.intent);
      const result = actionReceipt.safeParse(step.receipt);
      return (
        intent.success &&
        (!effectPossible(intent.data) ||
          step.resolution === "not_applied" ||
          (result.success && result.data.status === "not_applied" && !result.data.maybeChanged))
      );
    });
  const delivered = new Map<string, { path: string; sha256: string; recovery: boolean }>();
  const recordFile = (path: unknown, digest: unknown, recovery = false) => {
    if (
      typeof path === "string" &&
      path.length <= 260 &&
      !path.startsWith("/") &&
      path.split("/").every((part) => part && part !== "." && part !== "..") &&
      // eslint-disable-next-line no-control-regex -- control characters are refused in delivered paths
      !/[:\\\u0000-\u001f]/.test(path) &&
      typeof digest === "string" &&
      /^[0-9a-f]{64}$/.test(digest)
    ) {
      delivered.set(path, { path, sha256: digest, recovery });
    }
  };
  for (const step of task.steps) {
    const action = actionIntent.safeParse(step.intent);
    const receipt = actionReceipt.safeParse(step.receipt);
    if (
      step.status !== "done" ||
      !action.success ||
      action.data.risk === "read" ||
      !receipt.success ||
      receipt.data.status !== "observed" ||
      receipt.data.errorCode
    )
      continue;
    const evidence = receipt.data.evidence;
    const hash = evidence.sha256;
    const args = action.data.arguments;
    if (typeof hash === "string") {
      recordFile(args.output ?? args.path, hash);
    } else if (hash && typeof hash === "object") {
      const hashes = hash as Record<string, unknown>;
      for (const name of ["docx", "pdf", "project", "interchange"])
        recordFile(args[name], hashes[name]);
      recordFile(args.output, hashes.image);
    }
    const project = evidence.project as { path?: unknown; sha256?: unknown } | undefined;
    if (project?.path === args.project) recordFile(project?.path, project?.sha256);
    if (
      typeof evidence.original === "string" &&
      evidence.original.startsWith("OCADE output/originals/")
    )
      recordFile(evidence.original, evidence.sha256Before, true);
  }
  const artifactFiles = [...delivered.values()];
  return {
    id: task.id,
    status: task.status,
    title: task.title,
    canRetry,
    milestones,
    finalVerification: milestones.length > 0 && milestoneIndex >= milestones.length,
    blocker: task.blocker,
    result: task.result,
    checks: (task.outcome ?? []).map((check) => ({
      ...check,
      state: verification?.passed?.includes(check.id)
        ? "passed"
        : verification?.failed?.includes(check.id)
          ? "failed"
          : verification?.unverified?.includes(check.id)
            ? "unverified"
            : "unchecked",
    })),
    steps: task.steps.map((step, index) => {
      const receipt = step.receipt ? (actionReceipt.safeParse(step.receipt).data ?? null) : null;
      const intent = actionIntent.safeParse(step.intent);
      // The person answers whether a step whose effect nobody observed took effect.
      const uncertain =
        !step.resolution &&
        !["queued", "claimed", "needs_confirmation"].includes(step.status) &&
        (!intent.success ||
          effectInDoubt({
            intent: intent.data,
            status: step.status,
            receipt,
            unparsedReceipt: receipt === null ? step.receipt : undefined,
          }));
      const needsAnswer = open && uncertain;
      const disposition = receiptDisposition(
        step,
        receipt,
        uncertain,
        task.status === "completed" &&
          index === task.steps.length - 1 &&
          intent.success &&
          intent.data.operation === "verify.checks" &&
          Boolean(
            task.outcome?.length &&
            task.outcome.every((check) => verification?.passed?.includes(check.id)),
          ),
      );
      return {
        id: step.id,
        durationMs: timing.stepDurationsMs[index],
        summary: step.summary,
        status: step.status,
        disposition,
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
    artifacts: artifactFiles.map((file) => file.path),
    artifactFiles,
  };
}

function receiptDisposition(
  step: TaskState["steps"][number],
  receipt: ReturnType<typeof actionReceipt.parse> | null,
  uncertain: boolean,
  verified: boolean,
): string | null {
  if (["queued", "claimed", "needs_confirmation"].includes(step.status)) return null;
  if (uncertain || (!step.resolution && receipt?.status === "unknown")) return "outcome unknown";
  if (step.resolution === "applied") return "executed";
  if (step.status === "cancelled" && receipt?.status !== "observed") return "cancelled";
  if (receipt?.errorCode === "stopped") return "cancelled";
  if (receipt?.status === "observed" && !receipt.errorCode)
    return verified ? "verified" : "executed";
  if (receipt?.evidence.executionDisposition === "refused" || step.status === "blocked")
    return "refused";
  return receipt?.status === "not_applied" || step.status === "failed"
    ? "failed"
    : "outcome unknown";
}

export function exactEffect(intent: unknown): string {
  const parsed = actionIntent.safeParse(intent);
  if (!parsed.success) return "An action that could not be read: do not allow it.";
  const details = JSON.stringify(parsed.data.arguments, null, 2);
  if (parsed.data.operation === "system.install_dependency") {
    return [
      "Install a verified vendor runtime in OCADE's private application data.",
      "The startup check runs vendor code with your account's permissions.",
      details,
    ].join("\n");
  }
  return `${parsed.data.operation} ${details}`;
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

// Local overload brake before any database work. The per-device budget, freshness and replay
// protection are decided once, in the database, for every server instance (165).
const REQUEST_WINDOW_MS = 10_000;
const DEVICE_REQUEST_BUDGET = 30;
const REQUEST_BUCKETS = 2_048;
const requestBuckets = new Map<string, { expires: number; count: number }>();

function allowDeviceRequest(key: string, limit: number, now: number): boolean {
  const bucket = requestBuckets.get(key);
  if (bucket && bucket.expires > now) {
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }
  if (!bucket && requestBuckets.size >= REQUEST_BUCKETS) {
    for (const [id, active] of requestBuckets) {
      if (active.expires <= now) requestBuckets.delete(id);
    }
    if (requestBuckets.size >= REQUEST_BUCKETS) return false;
  }
  requestBuckets.set(key, { expires: now + REQUEST_WINDOW_MS, count: 1 });
  return true;
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
  plan: Plan = planner(admin),
): Promise<Reply> {
  if (request.method !== "POST") return refuse(405, "method_not_allowed");
  if (!allowDeviceRequest(`source:${source.slice(0, 64)}`, 240, now)) {
    return refuse(429, "rate_limited");
  }
  if (Number(request.headers.get(HEADERS.protocol)) !== PROTOCOL_VERSION) {
    return {
      status: 426,
      body: {
        error: "update_required",
        protocol: PROTOCOL_VERSION,
        message: "Update the OCADE companion from the JARVIS device page, then reconnect.",
      },
    };
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

    if (!UUID.test(deviceId)) return refuse(401, "signature_invalid");
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
    // Receipts are always recorded; every other request spends the device's shared budget.
    const admission = await call<string>(admin, "jarvis_device_admit", {
      p_device: deviceId,
      p_timestamp_ms: timestamp,
      p_limit: parsed.op === "receipt" ? null : DEVICE_REQUEST_BUDGET,
      p_window_ms: REQUEST_WINDOW_MS,
    });
    if (admission === "rate_limited") return refuse(429, "rate_limited");
    if (admission !== "admitted") {
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
      await plan(recorded.task_id);
      // The next step rides on this answer when it is already queued (W2).
      const next = await call<Record<string, unknown>>(admin, "jarvis_claim_action", {
        p_device: deviceId,
      });
      return { status: 200, body: { receipt: recorded.outcome, ...next } };
    }
    let state = await call<{
      task?: { id?: string; status?: string } | null;
      action?: unknown;
      paused?: boolean;
    }>(admin, "jarvis_claim_action", { p_device: deviceId });
    if (!state.paused && state.task?.status === "waiting") {
      // A task that waited only for a busy planner and is now due runs again (D10).
      const due = await call<string | null>(admin, "jarvis_resume_due", { p_device: deviceId });
      if (due) {
        await plan(due);
        state = await call(admin, "jarvis_claim_action", { p_device: deviceId });
      }
    }
    if (!state.paused && state.task?.status === "running" && state.task.id && !state.action) {
      // A milestone can advance without a queued device action.
      await plan(state.task.id);
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
