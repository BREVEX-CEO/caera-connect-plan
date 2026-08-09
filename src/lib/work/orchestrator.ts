/**
 * Durable Work/Cowork mission orchestration.
 *
 * This is deliberately above individual skill execution. It resolves a task
 * graph, dispatches specialised roles, runs only dependency-ready reads in a
 * bounded parallel batch, serialises mutations, checkpoints before every host
 * call, and derives one Evidence Ledger at the end.
 *
 * The crash rule is the important one: an in-flight mutation is never executed
 * again merely because its acknowledgement was lost. Recovery queries the
 * host's durable operation journal with the same operation id. If the host
 * cannot answer, the mission stays `recovery_required`.
 */
import {
  buildTaskLedger,
  saveLedgerArtifact,
  serialiseLedger,
  type LedgerStep,
  type TaskLedger,
} from "../artifacts/evidence-ledger";
import { listArtifacts, sha256 } from "../artifacts/store";
import type { EvidenceReceipt } from "../skills/skill-pack";
import {
  createProgressState,
  checkProgress,
  describeHalt,
  DEFAULT_PROGRESS_LIMITS,
} from "../skills/progress-monitor";

export type WorkRole = "planner" | "researcher" | "operator" | "verifier" | "recovery";
export type WorkStepKind = "read" | "mutation";

export interface WorkStep {
  id: string;
  intent: string;
  kind: WorkStepKind;
  role: WorkRole;
  dependsOn: string[];
  estimatedMs: number;
  /** Includes the first attempt. Mutations are still protected by operation recovery. */
  maxAttempts: number;
}

export interface WorkBudget {
  maxDurationMs: number;
  maxParallelReads: number;
  maxMutations: number;
}

export interface WorkMissionSpec {
  id: string;
  intent: string;
  initialState: string;
  finalState: string;
  steps: WorkStep[];
  budget: WorkBudget;
}

export type WorkNodeStatus = "pending" | "in_flight" | "done" | "failed" | "skipped";

export interface WorkNodeCheckpoint {
  status: WorkNodeStatus;
  attempts: number;
  operationId: string | null;
  receipt: EvidenceReceipt | null;
  reason: string | null;
  recovered: boolean;
}

export type WorkMissionStatus =
  "ready" | "running" | "paused" | "recovery_required" | "blocked" | "cancelled" | "succeeded";

export interface WorkHistoryEntry {
  at: string;
  kind:
    | "created"
    | "command"
    | "batch_started"
    | "batch_finished"
    | "retry"
    | "recovered"
    | "redirected"
    | "paused"
    | "blocked"
    | "completed";
  detail: string;
}

export interface WorkCheckpoint {
  schemaVersion: 1;
  missionId: string;
  specSha256: string;
  revision: number;
  status: WorkMissionStatus;
  reason: string | null;
  nodes: Record<string, WorkNodeCheckpoint>;
  elapsedMs: number;
  completedBatches: number;
  lastSupervisorSequence: number;
  receiptArtifactId: string | null;
  receiptEvidence: string | null;
  history: WorkHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkCheckpointStore {
  load(missionId: string): Promise<WorkCheckpoint | null>;
  /**
   * Compare-and-set. `null` creates a mission only when none exists; otherwise
   * the durable revision must equal `expectedRevision`.
   */
  save(checkpoint: WorkCheckpoint, expectedRevision: number | null): Promise<void>;
}

export type WorkHostRecovery =
  WorkHostObservation | { outcome: "not_found" | "unknown"; evidence: string };

export interface WorkHostObservation {
  operationId: string;
  outcome: "succeeded" | "failed";
  /** True only when the host observed the result after execution. */
  observed: boolean;
  /** True only when an independent check confirmed the requested result. */
  verified: boolean;
  /** Whether a mutation reached durable external state. False for reads. */
  committed: boolean;
  evidence: string;
  durationMs: number;
}

export interface WorkHost {
  execute(step: WorkStep, operationId: string, signal?: AbortSignal): Promise<WorkHostObservation>;
  /**
   * Query the host's durable operation journal. `not_found` authoritatively
   * means it did not run; `unknown` means OCADE must not repeat a mutation.
   */
  recover(operationId: string, step: WorkStep): Promise<WorkHostRecovery>;
}

export interface WorkSupervisorCommand {
  sequence: number;
  source: "local" | "mobile";
  kind: "pause" | "resume" | "cancel";
  issuedAt: string;
}

export interface WorkRedirectCommand {
  sequence: number;
  source: "local" | "mobile";
  kind: "redirect";
  issuedAt: string;
  /** User-visible reason for superseding the previous branch. */
  reason: string;
}

export interface WorkGraphPlan {
  waves: string[][];
  specSha256: string;
}

export type WorkOutcome<T> =
  | { ok: true; data: T; evidence: string }
  | { ok: false; reason: string; checkpoint?: WorkCheckpoint };

export type WorkReceiptRecording =
  | { status: "not_requested" }
  | { status: "saved"; artifactId: string; evidence: string }
  | { status: "failed"; reason: string };

export interface WorkRunData {
  checkpoint: WorkCheckpoint;
  ledger: TaskLedger | null;
  receiptRecording: WorkReceiptRecording;
}

export interface RunWorkMissionInput {
  spec: WorkMissionSpec;
  host: WorkHost;
  store: WorkCheckpointStore;
  supervisorCommand?: WorkSupervisorCommand;
  /**
   * Pause after this many newly completed batches. Used by the UI to expose an
   * actual stepwise run and by tests to prove durable pause/resume.
   */
  checkpointLimit?: number;
  recordReceipt?: boolean;
  signal?: AbortSignal;
  now?: () => Date;
}

const STORAGE_PREFIX = "ocade.work.mission.v1:";
const MAX_STEPS = 200;
const MAX_HISTORY = 500;
const WORK_MISSION_STATUSES = new Set<WorkMissionStatus>([
  "ready",
  "running",
  "paused",
  "recovery_required",
  "blocked",
  "cancelled",
  "succeeded",
]);
const WORK_NODE_STATUSES = new Set<WorkNodeStatus>([
  "pending",
  "in_flight",
  "done",
  "failed",
  "skipped",
]);
const WORK_HISTORY_KINDS = new Set<WorkHistoryEntry["kind"]>([
  "created",
  "command",
  "batch_started",
  "batch_finished",
  "retry",
  "recovered",
  "redirected",
  "paused",
  "blocked",
  "completed",
]);

function nowIso(now: () => Date): string {
  return now().toISOString();
}

function appendHistory(checkpoint: WorkCheckpoint, entry: WorkHistoryEntry): WorkCheckpoint {
  return {
    ...checkpoint,
    history: [...checkpoint.history, entry].slice(-MAX_HISTORY),
    updatedAt: entry.at,
  };
}

function canonicalSpec(spec: WorkMissionSpec): string {
  return JSON.stringify({
    id: spec.id,
    intent: spec.intent,
    initialState: spec.initialState,
    finalState: spec.finalState,
    steps: spec.steps.map((step) => ({
      id: step.id,
      intent: step.intent,
      kind: step.kind,
      role: step.role,
      dependsOn: [...step.dependsOn],
      estimatedMs: step.estimatedMs,
      maxAttempts: step.maxAttempts,
    })),
    budget: spec.budget,
  });
}

function canonicalStep(step: WorkStep): string {
  return JSON.stringify({
    id: step.id,
    intent: step.intent,
    kind: step.kind,
    role: step.role,
    dependsOn: [...step.dependsOn],
    estimatedMs: step.estimatedMs,
    maxAttempts: step.maxAttempts,
  });
}

/** Validate identities, edges, budgets, and cycles before any checkpoint exists. */
export async function validateWorkGraph(
  spec: WorkMissionSpec,
): Promise<WorkOutcome<WorkGraphPlan>> {
  if (!spec.id.trim() || !spec.intent.trim()) {
    return { ok: false, reason: "A work mission needs a stable id and intent." };
  }
  if (!spec.initialState.trim() || !spec.finalState.trim()) {
    return { ok: false, reason: "A work mission must name its initial and expected final state." };
  }
  if (spec.steps.length === 0 || spec.steps.length > MAX_STEPS) {
    return {
      ok: false,
      reason: `A work mission needs 1-${MAX_STEPS} bounded steps.`,
    };
  }
  if (
    !Number.isFinite(spec.budget.maxDurationMs) ||
    spec.budget.maxDurationMs <= 0 ||
    !Number.isInteger(spec.budget.maxParallelReads) ||
    spec.budget.maxParallelReads < 1 ||
    !Number.isInteger(spec.budget.maxMutations) ||
    spec.budget.maxMutations < 0
  ) {
    return { ok: false, reason: "The mission resource budget is invalid." };
  }

  const ids = new Set<string>();
  for (const step of spec.steps) {
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(step.id)) {
      return { ok: false, reason: `Step id "${step.id}" is not stable or safe.` };
    }
    if (ids.has(step.id)) {
      return { ok: false, reason: `The graph contains duplicate step id "${step.id}".` };
    }
    ids.add(step.id);
    if (!step.intent.trim()) return { ok: false, reason: `Step ${step.id} has no intent.` };
    if (!Number.isFinite(step.estimatedMs) || step.estimatedMs < 0) {
      return { ok: false, reason: `Step ${step.id} has no valid duration estimate.` };
    }
    if (!Number.isInteger(step.maxAttempts) || step.maxAttempts < 1 || step.maxAttempts > 5) {
      return { ok: false, reason: `Step ${step.id} has an unsafe retry limit.` };
    }
  }

  const mutations = spec.steps.filter((step) => step.kind === "mutation").length;
  if (mutations > spec.budget.maxMutations) {
    return {
      ok: false,
      reason: `The graph declares ${mutations} mutations but the mutation budget permits ${spec.budget.maxMutations}.`,
    };
  }

  for (const step of spec.steps) {
    const edgeSet = new Set<string>();
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency)) {
        return {
          ok: false,
          reason: `Step ${step.id} depends on unknown step "${dependency}".`,
        };
      }
      if (dependency === step.id) {
        return { ok: false, reason: `Step ${step.id} cannot depend on itself.` };
      }
      if (edgeSet.has(dependency)) {
        return {
          ok: false,
          reason: `Step ${step.id} repeats dependency "${dependency}".`,
        };
      }
      edgeSet.add(dependency);
    }
  }

  const remaining = new Set(spec.steps.map((step) => step.id));
  const completed = new Set<string>();
  const waves: string[][] = [];
  while (remaining.size > 0) {
    const wave = spec.steps
      .filter(
        (step) =>
          remaining.has(step.id) && step.dependsOn.every((dependency) => completed.has(dependency)),
      )
      .map((step) => step.id);
    if (wave.length === 0) {
      return { ok: false, reason: "The work graph contains a dependency cycle." };
    }
    waves.push(wave);
    for (const id of wave) {
      remaining.delete(id);
      completed.add(id);
    }
  }

  const fingerprint = await sha256(canonicalSpec(spec));
  if (!fingerprint.ok) return { ok: false, reason: fingerprint.reason };
  return {
    ok: true,
    data: { waves, specSha256: fingerprint.data },
    evidence: `${spec.steps.length} steps validated in ${waves.length} dependency waves.`,
  };
}

export async function createWorkCheckpoint(
  spec: WorkMissionSpec,
  now: Date = new Date(),
): Promise<WorkOutcome<WorkCheckpoint>> {
  const graph = await validateWorkGraph(spec);
  if (!graph.ok) return graph;
  const at = now.toISOString();
  const nodes = Object.fromEntries(
    spec.steps.map((step) => [
      step.id,
      {
        status: "pending",
        attempts: 0,
        operationId: null,
        receipt: null,
        reason: null,
        recovered: false,
      } satisfies WorkNodeCheckpoint,
    ]),
  );
  return {
    ok: true,
    data: {
      schemaVersion: 1,
      missionId: spec.id,
      specSha256: graph.data.specSha256,
      revision: 0,
      status: "ready",
      reason: null,
      nodes,
      elapsedMs: 0,
      completedBatches: 0,
      lastSupervisorSequence: 0,
      receiptArtifactId: null,
      receiptEvidence: null,
      history: [{ at, kind: "created", detail: "Mission graph validated and checkpointed." }],
      createdAt: at,
      updatedAt: at,
    },
    evidence: `Checkpoint created for ${spec.id}.`,
  };
}

/**
 * Strict local checkpoint persistence. Corruption is an error, never an empty
 * mission, because treating a lost checkpoint as new could repeat mutations.
 */
export class BrowserWorkCheckpointStore implements WorkCheckpointStore {
  constructor(private readonly storage: Storage | undefined = globalThis.localStorage) {}

  async load(missionId: string): Promise<WorkCheckpoint | null> {
    if (!this.storage) throw new Error("Work checkpoint storage is unavailable.");
    const raw = this.storage.getItem(`${STORAGE_PREFIX}${missionId}`);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isCheckpoint(parsed) || parsed.missionId !== missionId) {
        throw new Error("invalid checkpoint shape");
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `Work checkpoint is corrupt; OCADE will not restart the mission: ${
          error instanceof Error ? error.message : "invalid data"
        }`,
      );
    }
  }

  async save(checkpoint: WorkCheckpoint, expectedRevision: number | null): Promise<void> {
    if (!this.storage) throw new Error("Work checkpoint storage is unavailable.");
    const key = `${STORAGE_PREFIX}${checkpoint.missionId}`;
    const raw = this.storage.getItem(key);
    if (expectedRevision === null) {
      if (raw !== null) {
        throw new Error("Checkpoint creation lost a concurrency race.");
      }
    } else {
      if (raw === null) throw new Error("Checkpoint disappeared before compare-and-set.");
      let current: unknown;
      try {
        current = JSON.parse(raw);
      } catch {
        throw new Error("Current checkpoint is corrupt; compare-and-set refused.");
      }
      if (!isCheckpoint(current) || current.revision !== expectedRevision) {
        throw new Error(
          `Checkpoint revision conflict; expected ${expectedRevision}. Another supervisor advanced the mission.`,
        );
      }
    }
    this.storage.setItem(key, JSON.stringify(checkpoint));
  }
}

function isCheckpoint(value: unknown): value is WorkCheckpoint {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WorkCheckpoint>;
  const isCounter = (counter: unknown): counter is number =>
    Number.isSafeInteger(counter) && (counter as number) >= 0;
  const isNullableString = (entry: unknown): entry is string | null =>
    entry === null || typeof entry === "string";
  const isTimestamp = (entry: unknown): entry is string =>
    typeof entry === "string" && Number.isFinite(Date.parse(entry));
  const nodes =
    item.nodes && typeof item.nodes === "object"
      ? Object.values(item.nodes as Record<string, unknown>)
      : [];
  const validNodes =
    nodes.length > 0 &&
    nodes.every((value) => {
      if (!value || typeof value !== "object") return false;
      const node = value as Partial<WorkNodeCheckpoint>;
      const receipt = node.receipt;
      const validReceipt =
        receipt === null ||
        (typeof receipt === "object" &&
          receipt !== null &&
          typeof receipt.appId === "string" &&
          typeof receipt.capabilityId === "string" &&
          receipt.method === "adapter" &&
          isTimestamp(receipt.at) &&
          typeof receipt.verified === "boolean" &&
          typeof receipt.evidence === "string");
      return (
        WORK_NODE_STATUSES.has(node.status as WorkNodeStatus) &&
        isCounter(node.attempts) &&
        isNullableString(node.operationId) &&
        validReceipt &&
        isNullableString(node.reason) &&
        typeof node.recovered === "boolean"
      );
    });
  const validHistory =
    Array.isArray(item.history) &&
    item.history.length > 0 &&
    item.history.length <= MAX_HISTORY &&
    item.history.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        isTimestamp(entry.at) &&
        WORK_HISTORY_KINDS.has(entry.kind) &&
        typeof entry.detail === "string" &&
        entry.detail.length > 0,
    );
  return (
    item.schemaVersion === 1 &&
    typeof item.missionId === "string" &&
    item.missionId.length > 0 &&
    /^[0-9a-f]{64}$/.test(item.specSha256 ?? "") &&
    isCounter(item.revision) &&
    WORK_MISSION_STATUSES.has(item.status as WorkMissionStatus) &&
    isNullableString(item.reason) &&
    validNodes &&
    isCounter(item.elapsedMs) &&
    isCounter(item.completedBatches) &&
    isCounter(item.lastSupervisorSequence) &&
    isNullableString(item.receiptArtifactId) &&
    isNullableString(item.receiptEvidence) &&
    validHistory &&
    isTimestamp(item.createdAt) &&
    isTimestamp(item.updatedAt)
  );
}

function checkpointShapeError(spec: WorkMissionSpec, checkpoint: WorkCheckpoint): string | null {
  const expectedIds = new Set(spec.steps.map((step) => step.id));
  const storedIds = Object.keys(checkpoint.nodes);
  if (storedIds.length !== expectedIds.size || storedIds.some((id) => !expectedIds.has(id))) {
    return "The work checkpoint does not contain the exact mission step set.";
  }
  for (const step of spec.steps) {
    const node = checkpoint.nodes[step.id];
    if (!node || node.attempts > step.maxAttempts) {
      return `The work checkpoint state for ${step.id} is invalid.`;
    }
    if (node.status === "pending" && node.operationId !== null) {
      return `Pending step ${step.id} retains an unsafe operation id.`;
    }
    if (node.status === "in_flight" && node.operationId === null) {
      return `In-flight step ${step.id} has no recoverable operation id.`;
    }
    if (
      node.receipt &&
      (node.receipt.appId !== `ocade.work.${step.role}` ||
        node.receipt.capabilityId !== step.id ||
        !node.receipt.verified)
    ) {
      return `The verified receipt for ${step.id} does not match the mission step.`;
    }
    if (node.status === "done" && !node.receipt) {
      return `Completed step ${step.id} has no verified receipt.`;
    }
    if (node.status !== "done" && node.receipt) {
      return `Incomplete step ${step.id} contains a success receipt.`;
    }
  }
  if (
    checkpoint.status === "succeeded" &&
    spec.steps.some((step) => checkpoint.nodes[step.id].status !== "done")
  ) {
    return "The checkpoint claims mission success before every step is complete.";
  }
  if ((checkpoint.receiptArtifactId === null) !== (checkpoint.receiptEvidence === null)) {
    return "The mission receipt reference is incomplete.";
  }
  return null;
}

async function persist(
  store: WorkCheckpointStore,
  checkpoint: WorkCheckpoint,
  expectedRevision: number | null = checkpoint.revision,
): Promise<WorkOutcome<WorkCheckpoint>> {
  const next = { ...checkpoint, revision: checkpoint.revision + 1 };
  try {
    await store.save(next, expectedRevision);
    return { ok: true, data: next, evidence: `Checkpoint revision ${next.revision} saved.` };
  } catch (error) {
    return {
      ok: false,
      reason: `The work checkpoint could not be saved: ${
        error instanceof Error ? error.message : "storage refused it"
      }. No new host action was started.`,
      checkpoint,
    };
  }
}

/**
 * Supersede an active mission graph without replaying already verified work.
 *
 * Redirection is deliberately a checkpoint-bound operation: an in-flight host
 * mutation must first be reconciled by `runWorkMission`, so a user steering the
 * task can never strand or duplicate an irreversible action. Completed steps
 * are reused only when their full deterministic definition is unchanged.
 */
export async function redirectWorkMission(input: {
  previousSpec: WorkMissionSpec;
  revisedSpec: WorkMissionSpec;
  store: WorkCheckpointStore;
  command: WorkRedirectCommand;
}): Promise<WorkOutcome<WorkCheckpoint>> {
  const { previousSpec, revisedSpec, store, command } = input;
  if (
    command.kind !== "redirect" ||
    !Number.isInteger(command.sequence) ||
    command.sequence < 1 ||
    !Number.isFinite(Date.parse(command.issuedAt)) ||
    !command.reason.trim() ||
    command.reason.length > 2_000
  ) {
    return { ok: false, reason: "The task redirection command is malformed." };
  }
  if (previousSpec.id !== revisedSpec.id) {
    return { ok: false, reason: "A redirected task must retain the same durable mission id." };
  }

  const [previousGraph, revisedGraph] = await Promise.all([
    validateWorkGraph(previousSpec),
    validateWorkGraph(revisedSpec),
  ]);
  if (!previousGraph.ok) return previousGraph;
  if (!revisedGraph.ok) return revisedGraph;

  let checkpoint: WorkCheckpoint | null;
  try {
    checkpoint = await store.load(previousSpec.id);
  } catch (error) {
    return {
      ok: false,
      reason: `The work checkpoint could not be loaded for redirection: ${
        error instanceof Error ? error.message : "storage refused it"
      }.`,
    };
  }
  if (!checkpoint) return { ok: false, reason: "The task has no durable checkpoint to redirect." };
  if (checkpoint.specSha256 !== previousGraph.data.specSha256) {
    return {
      ok: false,
      reason: "The stored task graph does not match the branch being redirected.",
      checkpoint,
    };
  }
  const shapeError = checkpointShapeError(previousSpec, checkpoint);
  if (shapeError) {
    return { ok: false, reason: `The stored task cannot be redirected: ${shapeError}`, checkpoint };
  }
  if (command.sequence <= checkpoint.lastSupervisorSequence) {
    return { ok: true, data: checkpoint, evidence: "Replayed redirection ignored." };
  }
  if (Object.values(checkpoint.nodes).some((node) => node.status === "in_flight")) {
    return {
      ok: false,
      reason:
        "The task has an in-flight action. Pause and reconcile its host journal before redirecting.",
      checkpoint,
    };
  }
  if (checkpoint.status === "succeeded" || checkpoint.status === "cancelled") {
    return {
      ok: false,
      reason: `A ${checkpoint.status} task cannot be redirected; start a new mission instead.`,
      checkpoint,
    };
  }

  const previousSteps = new Map(previousSpec.steps.map((step) => [step.id, step]));
  const preserved: string[] = [];
  const nodes = Object.fromEntries(
    revisedSpec.steps.map((step) => {
      const oldStep = previousSteps.get(step.id);
      const oldNode = checkpoint!.nodes[step.id];
      if (oldStep && oldNode?.status === "done" && canonicalStep(oldStep) === canonicalStep(step)) {
        preserved.push(step.id);
        return [step.id, { ...oldNode }];
      }
      return [
        step.id,
        {
          status: "pending",
          attempts: 0,
          operationId: null,
          receipt: null,
          reason: null,
          recovered: false,
        } satisfies WorkNodeCheckpoint,
      ];
    }),
  );
  const superseded = previousSpec.steps.filter((step) => !nodes[step.id]).map((step) => step.id);
  const next = appendHistory(
    {
      ...checkpoint,
      specSha256: revisedGraph.data.specSha256,
      status: "ready",
      reason: `Redirected by ${command.source} supervisor: ${command.reason.trim()}`,
      nodes,
      lastSupervisorSequence: command.sequence,
      receiptArtifactId: null,
      receiptEvidence: null,
    },
    {
      at: command.issuedAt,
      kind: "redirected",
      detail: `Revision redirected; preserved ${preserved.length} verified step(s), superseded ${superseded.length} obsolete step(s). ${command.reason.trim()}`,
    },
  );
  return persist(store, next);
}

function operationIdFor(spec: WorkMissionSpec, step: WorkStep, attempt: number): string {
  return `${spec.id}:${step.id}:attempt-${attempt}`;
}

function receiptFor(step: WorkStep, observation: WorkHostObservation, at: string): EvidenceReceipt {
  return {
    appId: `ocade.work.${step.role}`,
    capabilityId: step.id,
    method: "adapter",
    at,
    verified: observation.observed && observation.verified && observation.outcome === "succeeded",
    evidence:
      observation.observed && observation.verified && observation.outcome === "succeeded"
        ? observation.evidence
        : `NOT CONFIRMED: ${observation.evidence}`,
  };
}

function readySteps(spec: WorkMissionSpec, checkpoint: WorkCheckpoint): WorkStep[] {
  return spec.steps.filter((step) => {
    const node = checkpoint.nodes[step.id];
    return (
      node.status === "pending" &&
      step.dependsOn.every((dependency) => checkpoint.nodes[dependency]?.status === "done")
    );
  });
}

function nextBatch(spec: WorkMissionSpec, checkpoint: WorkCheckpoint): WorkStep[] {
  const ready = readySteps(spec, checkpoint);
  if (ready.length === 0) return [];
  const first = ready[0];
  if (first.kind === "mutation") return [first];
  return ready.filter((step) => step.kind === "read").slice(0, spec.budget.maxParallelReads);
}

function estimatedBatchMs(batch: WorkStep[]): number {
  return batch.length === 0 ? 0 : Math.max(...batch.map((step) => step.estimatedMs));
}

function buildLedger(spec: WorkMissionSpec, checkpoint: WorkCheckpoint): WorkOutcome<TaskLedger> {
  const steps: LedgerStep[] = spec.steps.map((step) => {
    const node = checkpoint.nodes[step.id];
    return {
      intent: `[${step.role}] ${step.intent}`,
      receipt: node.receipt,
      status: node.status === "done" ? "done" : node.status === "skipped" ? "skipped" : "failed",
      attempts: node.attempts,
      ...(node.recovered
        ? {
            recovery: {
              action: "restore" as const,
              evidence: "Recovered from host operation journal.",
            },
          }
        : {}),
    };
  });
  const built = buildTaskLedger({
    taskId: spec.id,
    intent: spec.intent,
    initialState: spec.initialState,
    finalState:
      checkpoint.status === "succeeded"
        ? spec.finalState
        : (checkpoint.reason ?? "Mission did not reach its expected final state."),
    steps,
    startedAt: checkpoint.createdAt,
    finishedAt: checkpoint.updatedAt,
  });
  return built.ok ? built : { ok: false, reason: built.reason, checkpoint };
}

function currentData(
  spec: WorkMissionSpec,
  checkpoint: WorkCheckpoint,
  receiptRecording: WorkReceiptRecording = { status: "not_requested" },
): WorkOutcome<WorkRunData> {
  const ledger = checkpoint.status === "succeeded" ? buildLedger(spec, checkpoint) : null;
  if (ledger && !ledger.ok) return ledger;
  return {
    ok: true,
    data: {
      checkpoint,
      ledger: ledger?.data ?? null,
      receiptRecording,
    },
    evidence:
      checkpoint.status === "succeeded"
        ? "Mission completed with a derived verified ledger."
        : `Mission is ${checkpoint.status}.`,
  };
}

async function applySupervisorCommand(
  checkpoint: WorkCheckpoint,
  command: WorkSupervisorCommand | undefined,
  store: WorkCheckpointStore,
): Promise<WorkOutcome<WorkCheckpoint>> {
  if (!command || command.sequence <= checkpoint.lastSupervisorSequence) {
    return {
      ok: true,
      data: checkpoint,
      evidence: command ? "Replayed command ignored." : "No command.",
    };
  }
  if (
    !Number.isInteger(command.sequence) ||
    command.sequence < 1 ||
    !Number.isFinite(Date.parse(command.issuedAt))
  ) {
    return { ok: false, reason: "Supervisor command is malformed.", checkpoint };
  }

  let next = appendHistory(
    {
      ...checkpoint,
      lastSupervisorSequence: command.sequence,
    },
    {
      at: command.issuedAt,
      kind: "command",
      detail: `${command.source} requested ${command.kind}.`,
    },
  );

  if (command.kind === "cancel") {
    const nodes = { ...next.nodes };
    for (const [id, node] of Object.entries(nodes)) {
      if (node.status === "pending")
        nodes[id] = { ...node, status: "skipped", reason: "Cancelled." };
    }
    next = { ...next, nodes, status: "cancelled", reason: "Cancelled by supervisor." };
  } else if (command.kind === "pause") {
    next = { ...next, status: "paused", reason: `Paused by ${command.source} supervisor.` };
  } else if (!["succeeded", "cancelled"].includes(next.status)) {
    next = { ...next, status: "running", reason: null };
  }
  return persist(store, next);
}

function validateObservation(
  step: WorkStep,
  operationId: string,
  observation: WorkHostObservation,
): string | null {
  if (observation.operationId !== operationId) {
    return "The host returned evidence for a different operation id.";
  }
  if (!Number.isFinite(observation.durationMs) || observation.durationMs < 0) {
    return "The host returned an invalid duration.";
  }
  if (observation.outcome === "succeeded" && (!observation.observed || !observation.verified)) {
    return "The host claimed success without an observed, independently verified result.";
  }
  if (step.kind === "mutation" && observation.outcome === "succeeded" && !observation.committed) {
    return "The host claimed a successful mutation but did not observe a durable commit.";
  }
  return null;
}

async function recoverInflight(
  spec: WorkMissionSpec,
  checkpoint: WorkCheckpoint,
  host: WorkHost,
  store: WorkCheckpointStore,
  now: () => Date,
): Promise<WorkOutcome<WorkCheckpoint>> {
  let current = checkpoint;
  for (const step of spec.steps) {
    const node = current.nodes[step.id];
    if (node.status !== "in_flight" || !node.operationId) continue;

    let recovered: WorkHostRecovery;
    try {
      recovered = await host.recover(node.operationId, step);
    } catch (error) {
      recovered = {
        outcome: "unknown",
        evidence: error instanceof Error ? error.message : "Host recovery failed.",
      };
    }

    if (recovered.outcome === "unknown") {
      const reason = `The host cannot determine whether "${step.intent}" committed. OCADE will not repeat an ambiguous ${step.kind}. ${recovered.evidence}`;
      const blocked = appendHistory(
        { ...current, status: "recovery_required", reason },
        { at: nowIso(now), kind: "blocked", detail: reason },
      );
      const saved = await persist(store, blocked);
      return saved.ok ? saved : saved;
    }

    if (recovered.outcome === "not_found") {
      const nodes = {
        ...current.nodes,
        [step.id]: {
          ...node,
          status: "pending" as const,
          operationId: null,
          reason: recovered.evidence,
        },
      };
      current = appendHistory(
        { ...current, nodes, status: "running", reason: null },
        {
          at: nowIso(now),
          kind: "recovered",
          detail: `${step.id} was absent from the host journal and may be retried safely.`,
        },
      );
      const saved = await persist(store, current);
      if (!saved.ok) return saved;
      current = saved.data;
      continue;
    }

    if (!("operationId" in recovered)) {
      return {
        ok: false,
        reason: "Host recovery returned an unsupported outcome.",
        checkpoint: current,
      };
    }
    const invalid = validateObservation(step, node.operationId, recovered);
    if (invalid || recovered.outcome !== "succeeded") {
      const reason =
        invalid ?? `The host recovered ${step.id}, but it did not succeed: ${recovered.evidence}`;
      const blocked = appendHistory(
        { ...current, status: "recovery_required", reason },
        { at: nowIso(now), kind: "blocked", detail: reason },
      );
      return persist(store, blocked);
    }

    const at = nowIso(now);
    const nodes = {
      ...current.nodes,
      [step.id]: {
        ...node,
        status: "done" as const,
        receipt: receiptFor(step, recovered, at),
        reason: null,
        recovered: true,
      },
    };
    current = appendHistory(
      {
        ...current,
        nodes,
        status: "running",
        reason: null,
        elapsedMs: current.elapsedMs + recovered.durationMs,
      },
      {
        at,
        kind: "recovered",
        detail: `${step.id} recovered from operation ${node.operationId}; execution was not repeated.`,
      },
    );
    const saved = await persist(store, current);
    if (!saved.ok) return saved;
    current = saved.data;
  }
  return { ok: true, data: current, evidence: "In-flight operations reconciled." };
}

async function finalizeReceipt(
  spec: WorkMissionSpec,
  checkpoint: WorkCheckpoint,
  ledger: TaskLedger,
  store: WorkCheckpointStore,
  recordReceipt: boolean,
  now: () => Date,
): Promise<WorkOutcome<WorkRunData>> {
  if (!recordReceipt) return currentData(spec, checkpoint);
  if (checkpoint.receiptArtifactId && checkpoint.receiptEvidence) {
    return currentData(spec, checkpoint, {
      status: "saved",
      artifactId: checkpoint.receiptArtifactId,
      evidence: checkpoint.receiptEvidence,
    });
  }

  // Recover an artifact save whose checkpoint acknowledgement was lost.
  const canonical = serialiseLedger(ledger);
  const existing = listArtifacts().find(
    (artifact) =>
      artifact.kind === "receipt" &&
      artifact.provenance.producedBy === `ocade.task:${spec.id}` &&
      artifact.content === canonical,
  );
  const saved = existing
    ? { ok: true as const, data: existing, evidence: "Existing verified receipt recovered." }
    : await saveLedgerArtifact(ledger);
  if (!saved.ok) {
    return currentData(spec, checkpoint, { status: "failed", reason: saved.reason });
  }

  const next = appendHistory(
    {
      ...checkpoint,
      receiptArtifactId: saved.data.id,
      receiptEvidence: saved.evidence,
    },
    {
      at: nowIso(now),
      kind: "completed",
      detail: `Verified receipt ${saved.data.id} stored.`,
    },
  );
  const persisted = await persist(store, next);
  if (!persisted.ok) return persisted;
  return currentData(spec, persisted.data, {
    status: "saved",
    artifactId: saved.data.id,
    evidence: saved.evidence,
  });
}

/**
 * Run or resume one mission.
 *
 * `ok: true` means the orchestrator handled the state honestly; callers must
 * inspect `checkpoint.status`. Only `succeeded` plus a saved receipt is a
 * completed mission.
 */
export async function runWorkMission(
  input: RunWorkMissionInput,
): Promise<WorkOutcome<WorkRunData>> {
  const now = input.now ?? (() => new Date());
  const graph = await validateWorkGraph(input.spec);
  if (!graph.ok) return graph;
  if (
    input.checkpointLimit !== undefined &&
    (!Number.isInteger(input.checkpointLimit) || input.checkpointLimit < 1)
  ) {
    return { ok: false, reason: "Checkpoint limit must be a positive integer." };
  }

  let checkpoint: WorkCheckpoint;
  try {
    const loaded = await input.store.load(input.spec.id);
    if (loaded) checkpoint = loaded;
    else {
      const created = await createWorkCheckpoint(input.spec, now());
      if (!created.ok) return created;
      const saved = await persist(input.store, created.data, null);
      if (!saved.ok) return saved;
      checkpoint = saved.data;
    }
  } catch (error) {
    return {
      ok: false,
      reason: `The work checkpoint could not be loaded: ${
        error instanceof Error ? error.message : "storage refused it"
      }. OCADE will not restart the mission.`,
    };
  }

  if (checkpoint.specSha256 !== graph.data.specSha256) {
    return {
      ok: false,
      reason:
        "The mission graph changed after execution began. OCADE will not resume it against a different plan.",
      checkpoint,
    };
  }
  const checkpointError = checkpointShapeError(input.spec, checkpoint);
  if (checkpointError) {
    return {
      ok: false,
      reason: `The work checkpoint is invalid; OCADE will not resume it: ${checkpointError}`,
      checkpoint,
    };
  }

  const commanded = await applySupervisorCommand(checkpoint, input.supervisorCommand, input.store);
  if (!commanded.ok) return commanded;
  checkpoint = commanded.data;

  if (checkpoint.status === "paused" || checkpoint.status === "cancelled") {
    return currentData(input.spec, checkpoint);
  }
  if (checkpoint.status === "succeeded") {
    const ledger = buildLedger(input.spec, checkpoint);
    if (!ledger.ok) return ledger;
    return finalizeReceipt(
      input.spec,
      checkpoint,
      ledger.data,
      input.store,
      input.recordReceipt ?? true,
      now,
    );
  }
  if (checkpoint.status === "blocked" && input.supervisorCommand?.kind !== "resume") {
    return currentData(input.spec, checkpoint);
  }

  const reconciled = await recoverInflight(input.spec, checkpoint, input.host, input.store, now);
  if (!reconciled.ok) return reconciled;
  checkpoint = reconciled.data;
  if (checkpoint.status === "recovery_required") return currentData(input.spec, checkpoint);

  if (checkpoint.status !== "running") {
    const saved = await persist(input.store, { ...checkpoint, status: "running", reason: null });
    if (!saved.ok) return saved;
    checkpoint = saved.data;
  }

  let batchesThisCall = 0;

  /**
   * No-progress governor (§8.8, §19.8). Retries were already bounded per ACTION;
   * nothing bounded the task itself. Without this, a graph that keeps
   * dispatching batches while never marking a step done would loop until some
   * other limit happened to catch it.
   *
   * The wall clock stays with the existing mission budget, which is already
   * enforced per batch below — this governor watches for a task that is running
   * but getting nowhere, and for one that has returned to a state it has
   * already been in.
   */
  const progress = createProgressState({
    ...DEFAULT_PROGRESS_LIMITS,
    maxElapsedMs: input.spec.budget.maxDurationMs,
  });

  while (true) {
    if (input.signal?.aborted) {
      const paused = appendHistory(
        { ...checkpoint, status: "paused", reason: "Paused because this run was cancelled." },
        { at: nowIso(now), kind: "paused", detail: "Abort signal received at a checkpoint." },
      );
      const saved = await persist(input.store, paused);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }

    const failed = input.spec.steps.find((step) => checkpoint.nodes[step.id].status === "failed");
    if (failed) {
      const reason =
        checkpoint.nodes[failed.id].reason ?? `Step ${failed.id} exhausted its safe retries.`;
      const nodes = { ...checkpoint.nodes };
      for (const step of input.spec.steps) {
        if (
          nodes[step.id].status === "pending" &&
          dependsTransitivelyOn(input.spec, step.id, failed.id)
        ) {
          nodes[step.id] = { ...nodes[step.id], status: "skipped", reason: "Dependency failed." };
        }
      }
      const blocked = appendHistory(
        { ...checkpoint, nodes, status: "blocked", reason },
        { at: nowIso(now), kind: "blocked", detail: reason },
      );
      const saved = await persist(input.store, blocked);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }

    if (input.spec.steps.every((step) => checkpoint.nodes[step.id].status === "done")) {
      const completed = appendHistory(
        { ...checkpoint, status: "succeeded", reason: null },
        {
          at: nowIso(now),
          kind: "completed",
          detail: "All dependency-safe steps completed with verified receipts.",
        },
      );
      const saved = await persist(input.store, completed);
      if (!saved.ok) return saved;
      checkpoint = saved.data;
      const ledger = buildLedger(input.spec, checkpoint);
      if (!ledger.ok) return ledger;
      if (ledger.data.outcome !== "succeeded") {
        return {
          ok: false,
          reason: `The completed graph produced a ${ledger.data.outcome} ledger; OCADE will not call it complete.`,
          checkpoint,
        };
      }
      return finalizeReceipt(
        input.spec,
        checkpoint,
        ledger.data,
        input.store,
        input.recordReceipt ?? true,
        now,
      );
    }

    const batch = nextBatch(input.spec, checkpoint);
    if (batch.length === 0) {
      const reason = "No dependency-ready step remains, so the mission cannot make progress.";
      const blocked = appendHistory(
        { ...checkpoint, status: "blocked", reason },
        { at: nowIso(now), kind: "blocked", detail: reason },
      );
      const saved = await persist(input.store, blocked);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }

    const estimate = estimatedBatchMs(batch);
    if (checkpoint.elapsedMs + estimate > input.spec.budget.maxDurationMs) {
      const reason = `The next batch needs about ${estimate} ms but only ${Math.max(
        0,
        input.spec.budget.maxDurationMs - checkpoint.elapsedMs,
      )} ms remains in the mission budget.`;
      const blocked = appendHistory(
        { ...checkpoint, status: "blocked", reason },
        { at: nowIso(now), kind: "blocked", detail: reason },
      );
      const saved = await persist(input.store, blocked);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }

    const startedAt = nowIso(now);
    const startedNodes = { ...checkpoint.nodes };
    for (const step of batch) {
      const previous = startedNodes[step.id];
      const attempt = previous.attempts + 1;
      startedNodes[step.id] = {
        ...previous,
        status: "in_flight",
        attempts: attempt,
        operationId: operationIdFor(input.spec, step, attempt),
        reason: null,
      };
    }
    const started = appendHistory(
      { ...checkpoint, nodes: startedNodes },
      {
        at: startedAt,
        kind: "batch_started",
        detail: `${batch.map((step) => `${step.role}:${step.id}`).join(", ")} checkpointed before dispatch.`,
      },
    );
    const preflight = await persist(input.store, started);
    if (!preflight.ok) return preflight;
    checkpoint = preflight.data;

    const observations = await Promise.all(
      batch.map(async (step) => {
        const operationId = checkpoint.nodes[step.id].operationId as string;
        try {
          return {
            step,
            operationId,
            observation: await input.host.execute(step, operationId, input.signal),
            error: null,
          };
        } catch (error) {
          return { step, operationId, observation: null, error };
        }
      }),
    );

    const nodes = { ...checkpoint.nodes };
    let elapsed = checkpoint.elapsedMs;
    let ambiguousReason: string | null = null;
    for (const result of observations) {
      const node = nodes[result.step.id];
      if (result.error || !result.observation) {
        ambiguousReason = `Lost the acknowledgement for "${result.step.intent}". OCADE will recover operation ${result.operationId} before doing anything else.`;
        nodes[result.step.id] = {
          ...node,
          reason:
            result.error instanceof Error
              ? result.error.message
              : "Host acknowledgement was unavailable.",
        };
        continue;
      }

      const invalid = validateObservation(result.step, result.operationId, result.observation);
      if (invalid) {
        ambiguousReason = `${invalid} OCADE will not repeat operation ${result.operationId}.`;
        nodes[result.step.id] = { ...node, reason: invalid };
        continue;
      }

      elapsed += result.observation.durationMs;
      if (result.observation.outcome === "succeeded") {
        nodes[result.step.id] = {
          ...node,
          status: "done",
          receipt: receiptFor(result.step, result.observation, nowIso(now)),
          reason: null,
        };
      } else if (!result.observation.committed && node.attempts < result.step.maxAttempts) {
        nodes[result.step.id] = {
          ...node,
          status: "pending",
          operationId: null,
          receipt: null,
          reason: result.observation.evidence,
        };
      } else if (result.observation.committed) {
        ambiguousReason = `The host observed a committed but unverified mutation for "${result.step.intent}". OCADE will not repeat it.`;
        nodes[result.step.id] = {
          ...node,
          reason: result.observation.evidence,
          receipt: receiptFor(result.step, result.observation, nowIso(now)),
        };
      } else {
        nodes[result.step.id] = {
          ...node,
          status: "failed",
          operationId: null,
          receipt: receiptFor(result.step, result.observation, nowIso(now)),
          reason: result.observation.evidence,
        };
      }
    }

    let finished = appendHistory(
      {
        ...checkpoint,
        nodes,
        elapsedMs: elapsed,
        completedBatches: checkpoint.completedBatches + 1,
        status: ambiguousReason ? "recovery_required" : "running",
        reason: ambiguousReason,
      },
      {
        at: nowIso(now),
        kind: ambiguousReason ? "blocked" : "batch_finished",
        detail: ambiguousReason ?? `Batch ${checkpoint.completedBatches + 1} checkpointed.`,
      },
    );
    const terminal = await persist(input.store, finished);
    if (!terminal.ok) {
      // The durable state is still the pre-dispatch in-flight checkpoint.
      return {
        ok: true,
        data: {
          checkpoint: {
            ...checkpoint,
            status: "recovery_required",
            reason:
              "The host returned, but the terminal checkpoint was not durable. OCADE will query the operation journal before any retry.",
          },
          ledger: null,
          receiptRecording: { status: "not_requested" },
        },
        evidence: "Terminal checkpoint failed; operation recovery is required.",
      };
    }
    checkpoint = terminal.data;
    batchesThisCall += 1;
    if (checkpoint.status === "recovery_required") return currentData(input.spec, checkpoint);

    // Judge whether the task is actually getting anywhere. The digest is built
    // from step statuses only — never a timestamp, or every state would look
    // new and a cycle could never be detected.
    const doneCount = input.spec.steps.filter(
      (step) => checkpoint.nodes[step.id].status === "done",
    ).length;
    const verdict = checkProgress(progress, {
      iteration: batchesThisCall,
      completedSteps: doneCount,
      producedArtifacts: 0,
      verifiedReceipts: 0,
      stateDigest: input.spec.steps.map((step) => checkpoint.nodes[step.id].status).join("|"),
      elapsedMs: checkpoint.elapsedMs,
    });
    if (verdict.action === "halt") {
      // Same path as any other block: the checkpoint is preserved, so every
      // completed step and receipt survives. §8.8 requires partial outputs to
      // survive a halt.
      const stalled = appendHistory(
        { ...checkpoint, status: "blocked", reason: verdict.reason },
        { at: nowIso(now), kind: "blocked", detail: describeHalt(verdict.cause) },
      );
      const saved = await persist(input.store, stalled);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }

    const retried = batch.filter((step) => checkpoint.nodes[step.id].status === "pending");
    if (retried.length > 0) {
      finished = appendHistory(checkpoint, {
        at: nowIso(now),
        kind: "retry",
        detail: `${retried.map((step) => step.id).join(", ")} may retry because the host observed no commit.`,
      });
      const saved = await persist(input.store, finished);
      if (!saved.ok) return saved;
      checkpoint = saved.data;
    }

    if (
      input.checkpointLimit !== undefined &&
      batchesThisCall >= input.checkpointLimit &&
      !input.spec.steps.every((step) => checkpoint.nodes[step.id].status === "done")
    ) {
      const paused = appendHistory(
        {
          ...checkpoint,
          status: "paused",
          reason: "Paused at the requested durable checkpoint.",
        },
        {
          at: nowIso(now),
          kind: "paused",
          detail: `Paused after ${batchesThisCall} newly completed batch.`,
        },
      );
      const saved = await persist(input.store, paused);
      return saved.ok ? currentData(input.spec, saved.data) : saved;
    }
  }
}

function dependsTransitivelyOn(
  spec: WorkMissionSpec,
  candidateId: string,
  dependencyId: string,
  seen = new Set<string>(),
): boolean {
  if (candidateId === dependencyId) return true;
  if (seen.has(candidateId)) return false;
  seen.add(candidateId);
  const step = spec.steps.find((item) => item.id === candidateId);
  if (!step) return false;
  return step.dependsOn.some(
    (dependency) =>
      dependency === dependencyId || dependsTransitivelyOn(spec, dependency, dependencyId, seen),
  );
}
