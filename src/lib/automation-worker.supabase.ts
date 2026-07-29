/**
 * Supabase persistence adapter for the shared automation worker contract.
 *
 * The RPCs are authored in the READY-TO-APPLY worker migration. This adapter
 * does not start a worker or install a native executor; it only translates the
 * typed lifecycle into atomic database calls.
 */
import type {
  AutomationRunCompletion,
  AutomationRunApprovalWait,
  AutomationRunRetry,
  AutomationRunPause,
  AutomationStepReceipt,
  AutomationWorkerStore,
  CancellationWatch,
  ClaimedAutomationRun,
} from "./automation-worker";
import type { RunStep } from "./ocade-automations";
import { riskOf, type CompanionAction } from "./native/companion-bridge";
import type {
  AutomationSupervisorPersistence,
  InspectableAutomationRun,
} from "./automation-supervisor";
import type { AutomationQueueSource } from "./automation-worker-controller";

interface PersistenceError {
  message: string;
}

interface RpcResult<T> {
  data: T | null;
  error: PersistenceError | null;
}

export type CancellationState = "active" | "requested" | "paused" | "lost_claim";

export interface AutomationWorkerPersistenceClient {
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult<unknown>>;
  cancellationState(runId: string, claimToken: string): Promise<CancellationState>;
}

interface ClaimRow {
  id: string;
  claim_token: string;
  execution_steps: unknown;
  attempt: number;
  max_attempts: number;
  next_step_index: number;
  confirmed: boolean;
  deadline_at: string | null;
  approval_expires_at: string | null;
}

function asClaimRow(data: ClaimRow | ClaimRow[] | null): ClaimRow | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0)
  );
}

function isCompanionAction(value: unknown): value is CompanionAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  switch (action.kind) {
    case "screen.read":
    case "window.list":
    case "clipboard.read":
    case "selection.read":
      return true;
    case "window.focus":
      return boundedString(action.target, 300);
    case "window.arrange":
      return (
        ["left", "right", "maximize", "restore"].includes(String(action.layout)) &&
        (action.target === undefined || boundedString(action.target, 300))
      );
    case "app.open":
      return boundedString(action.appId, 300);
    case "file.open":
      return boundedString(action.path, 1_000);
    case "text.type":
    case "selection.replace":
    case "clipboard.write":
      return boundedString(action.text, 5_000, true);
    default:
      return false;
  }
}

function isRunStep(value: unknown): value is RunStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Partial<RunStep>;
  if (!isCompanionAction(step.action)) return false;
  const canonicalRisk = riskOf(step.action);
  if (canonicalRisk === "prohibited") return false;
  const requiresConfirmation = canonicalRisk === "confirm" || canonicalRisk === "high";
  if (
    step.risk !== canonicalRisk ||
    step.requiresConfirmation !== requiresConfirmation ||
    !boundedString(step.summary, 4_000)
  ) {
    return false;
  }
  if (
    step.estimatedDurationMs !== undefined &&
    (!Number.isFinite(step.estimatedDurationMs) ||
      step.estimatedDurationMs < 0 ||
      step.estimatedDurationMs > 86_400_000)
  ) {
    return false;
  }
  if (step.rollbackAction !== undefined) {
    if (
      canonicalRisk === "read_only" ||
      !isCompanionAction(step.rollbackAction) ||
      riskOf(step.rollbackAction) === "prohibited"
    ) {
      return false;
    }
  }
  if (step.rollbackSummary !== undefined && !boundedString(step.rollbackSummary, 4_000)) {
    return false;
  }
  return step.rollbackAction !== undefined || step.rollbackSummary === undefined;
}

function parseClaim(data: ClaimRow | ClaimRow[] | null): ClaimedAutomationRun | null {
  const row = asClaimRow(data);
  if (!row) return null;
  if (
    typeof row.id !== "string" ||
    !row.id.trim() ||
    row.id.length > 300 ||
    typeof row.claim_token !== "string" ||
    !row.claim_token.trim() ||
    row.claim_token.length > 300 ||
    !Array.isArray(row.execution_steps) ||
    row.execution_steps.length === 0 ||
    row.execution_steps.length > 50 ||
    !row.execution_steps.every(isRunStep) ||
    !Number.isInteger(row.attempt) ||
    !Number.isInteger(row.max_attempts) ||
    !Number.isInteger(row.next_step_index) ||
    row.attempt < 1 ||
    row.max_attempts < 1 ||
    row.max_attempts > 10 ||
    row.attempt > row.max_attempts ||
    typeof row.confirmed !== "boolean" ||
    (row.deadline_at !== null &&
      (typeof row.deadline_at !== "string" || !Number.isFinite(Date.parse(row.deadline_at)))) ||
    (row.approval_expires_at !== null &&
      (typeof row.approval_expires_at !== "string" ||
        !Number.isFinite(Date.parse(row.approval_expires_at)))) ||
    row.next_step_index < 0 ||
    row.next_step_index > row.execution_steps.length
  ) {
    throw new Error("Supabase returned an invalid automation worker claim.");
  }
  return {
    id: row.id,
    claimToken: row.claim_token,
    steps: row.execution_steps,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    nextStepIndex: row.next_step_index,
    confirmed: row.confirmed,
    deadlineAt: row.deadline_at,
    approvalExpiresAt: row.approval_expires_at,
  };
}

function parseSteps(value: unknown): RunStep[] {
  if (!Array.isArray(value) || !value.every(isRunStep)) {
    throw new Error("Supabase returned invalid automation execution steps.");
  }
  return value;
}

function unwrapBoolean(result: RpcResult<unknown>, operation: string): boolean {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data === true;
}

export class SupabaseAutomationWorkerStore implements AutomationWorkerStore {
  constructor(
    private readonly client: AutomationWorkerPersistenceClient,
    private readonly cancellationPollMs = 750,
  ) {}

  async claim(input: {
    runId: string;
    workerId: string;
    now: string;
  }): Promise<ClaimedAutomationRun | null> {
    const result = await this.client.rpc("ocade_claim_automation_run", {
      p_run_id: input.runId,
      p_worker_id: input.workerId,
    });
    if (result.error) throw new Error(`Could not claim automation run: ${result.error.message}`);
    return parseClaim(result.data as ClaimRow | ClaimRow[] | null);
  }

  watchCancellation(claim: ClaimedAutomationRun): CancellationWatch {
    const controller = new AbortController();
    let reason: "requested" | "paused" | "unavailable" | null = null;
    let disposed = false;

    const poll = async () => {
      try {
        const state = await this.client.cancellationState(claim.id, claim.claimToken);
        if (disposed || state === "active") return;
        reason =
          state === "requested" ? "requested" : state === "paused" ? "paused" : "unavailable";
        controller.abort();
      } catch {
        if (disposed) return;
        reason = "unavailable";
        controller.abort();
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), this.cancellationPollMs);
    return {
      signal: controller.signal,
      reason: () => reason,
      dispose: () => {
        disposed = true;
        clearInterval(timer);
      },
    };
  }

  async heartbeat(claim: ClaimedAutomationRun, _now: string): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_heartbeat_automation_run", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
      }),
      "Could not heartbeat automation run",
    );
  }

  async appendReceipt(
    claim: ClaimedAutomationRun,
    receipt: AutomationStepReceipt,
  ): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_append_automation_receipt", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
        p_step_index: receipt.stepIndex,
        p_phase: receipt.phase,
        p_operation_id: receipt.operationId,
        p_action_kind: receipt.actionKind,
        p_status: receipt.status,
        p_execution_ok: receipt.executionOk,
        p_verified: receipt.verified,
        p_detail: receipt.detail,
        p_started_at: receipt.startedAt,
        p_finished_at: receipt.finishedAt,
      }),
      "Could not append automation receipt",
    );
  }

  async complete(
    claim: ClaimedAutomationRun,
    completion: AutomationRunCompletion,
  ): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_complete_automation_run", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
        p_status: completion.status,
        p_error: completion.error,
        p_finished_at: completion.finishedAt,
      }),
      "Could not finalize automation run",
    );
  }

  async requeue(claim: ClaimedAutomationRun, retry: AutomationRunRetry): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_requeue_automation_run", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
        p_attempt: retry.attempt,
        p_next_attempt_at: retry.nextAttemptAt,
        p_error: retry.error,
      }),
      "Could not requeue automation run",
    );
  }

  async suspend(claim: ClaimedAutomationRun, pause: AutomationRunPause): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_suspend_automation_run", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
        p_reason: pause.reason,
        p_paused_at: pause.pausedAt,
      }),
      "Could not pause automation run",
    );
  }

  async awaitApproval(
    claim: ClaimedAutomationRun,
    wait: AutomationRunApprovalWait,
  ): Promise<boolean> {
    return unwrapBoolean(
      await this.client.rpc("ocade_expire_automation_approval", {
        p_run_id: claim.id,
        p_claim_token: claim.claimToken,
        p_reason: wait.reason,
        p_requested_at: wait.requestedAt,
      }),
      "Could not renew automation approval",
    );
  }
}

/**
 * Narrow bridge around the generated Supabase client. Remove the casts after
 * the READY-TO-APPLY migration is applied and database types are regenerated.
 */
export function createSupabaseAutomationWorkerClient(
  supabase: unknown,
): AutomationWorkerPersistenceClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as { rpc: (name: string, args: Record<string, unknown>) => any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (supabase as { from: (table: string) => any }).from.bind(supabase);

  return {
    rpc: (name, args) => client.rpc(name, args),
    async cancellationState(runId, claimToken) {
      const { data, error } = await from("ocade_automation_runs")
        .select("status, claim_token, lease_expires_at, cancel_requested_at, pause_requested_at")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || data.status !== "running" || data.claim_token !== claimToken) {
        return "lost_claim";
      }
      if (!data.lease_expires_at || Date.parse(data.lease_expires_at) <= Date.now()) {
        return "lost_claim";
      }
      if (data.pause_requested_at) return "paused";
      return data.cancel_requested_at ? "requested" : "active";
    },
  };
}

export function createSupabaseAutomationSupervisorPersistence(
  supabase: unknown,
): AutomationSupervisorPersistence {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as { rpc: (name: string, args: Record<string, unknown>) => any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (supabase as { from: (table: string) => any }).from.bind(supabase);

  return {
    async inspectEligibleRun(runId): Promise<InspectableAutomationRun | null> {
      const { data, error } = await from("ocade_automation_runs")
        .select("id, status, execution_steps, next_attempt_at, deadline_at, cancel_requested_at")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (
        !data ||
        data.status !== "pending" ||
        data.cancel_requested_at ||
        (data.deadline_at && Date.parse(data.deadline_at) <= Date.now()) ||
        (data.next_attempt_at && Date.parse(data.next_attempt_at) > Date.now())
      ) {
        return null;
      }
      return { id: data.id, steps: parseSteps(data.execution_steps) };
    },
    async recoverStale(staleBefore) {
      const { data, error } = await client.rpc("ocade_recover_stale_automation_runs", {
        p_stale_before: staleBefore,
      });
      if (error) throw new Error(error.message);
      return {
        paused: Number(data?.paused ?? 0),
        expired: Number(data?.expired ?? 0),
        cancelled: Number(data?.cancelled ?? 0),
        failed: Number(data?.failed ?? 0),
        requeued: Number(data?.requeued ?? 0),
      };
    },
  };
}

export function createSupabaseAutomationQueueSource(supabase: unknown): AutomationQueueSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (supabase as { from: (table: string) => any }).from.bind(supabase);

  return {
    async listEligibleRunIds({ limit, now }) {
      const parsedNow = new Date(now);
      if (!Number.isFinite(parsedNow.getTime()) || parsedNow.toISOString() !== now) {
        throw new Error("Automation queue polling requires a valid timestamp.");
      }
      const requestedLimit = Number.isFinite(limit) ? Math.floor(limit) : 20;
      const safeLimit = Math.max(1, Math.min(requestedLimit, 100));
      const { data, error } = await from("ocade_automation_runs")
        .select("id")
        .eq("status", "pending")
        .is("cancel_requested_at", null)
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
        .or(`deadline_at.is.null,deadline_at.gt.${now}`)
        .order("created_at", { ascending: true })
        .limit(safeLimit);
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) {
        throw new Error("Supabase returned an invalid automation queue response.");
      }
      return data.map((row) => row?.id).filter((id): id is string => typeof id === "string");
    },
  };
}
