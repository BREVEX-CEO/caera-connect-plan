import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { randomUuid } from "@/lib/ids";
import { LIST_CAP } from "@/lib/supabase/read-all";

export type UnifiedTaskStatus =
  | "CREATED"
  | "PLANNING"
  | "WAITING_PERMISSION"
  | "EXECUTING"
  | "WAITING_USER"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type UnifiedTaskSource = "automation" | "work" | "code" | "research" | "monitor" | "system";

export interface UnifiedTask {
  id: string;
  source: UnifiedTaskSource;
  sourceRef?: string;
  title: string;
  request?: string;
  currentStep?: string;
  status: UnifiedTaskStatus;
  progress?: number;
  deviceId?: string;
  agent?: string;
  permissionRequirements?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  receipts?: string[];
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  scheduledFor?: string;
  /**
   * The project this task belongs to, or absent when it is unfiled.
   *
   * A project is the shared context graph — chats, files, Code sessions,
   * artifacts and memory all carry the link. A task did not, so the one record
   * that represents work IN PROGRESS was the one that could not be filed with
   * the work it belonged to.
   */
  projectId?: string;
  dependencyTaskIds?: string[];
}

export interface AutomationRunLike {
  id: string;
  automation_id: string;
  status: string;
  attempt: number;
  blocked_reason?: string | null;
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
  plan?: { steps?: { summary: string }[] } | null;
}

const STORAGE_KEY = "ocade:unified-tasks:v1";
const DB_NAME = "ocade-runtime";
const STORE_NAME = "tasks";
const DB_VERSION = 1;
const TERMINAL = new Set<UnifiedTaskStatus>(["COMPLETED", "FAILED", "CANCELLED"]);

const TRANSITIONS: Record<UnifiedTaskStatus, ReadonlySet<UnifiedTaskStatus>> = {
  CREATED: new Set(["PLANNING", "WAITING_PERMISSION", "EXECUTING", "CANCELLED", "FAILED"]),
  PLANNING: new Set(["WAITING_PERMISSION", "EXECUTING", "WAITING_USER", "FAILED", "CANCELLED"]),
  WAITING_PERMISSION: new Set(["EXECUTING", "WAITING_USER", "FAILED", "CANCELLED"]),
  EXECUTING: new Set([
    "WAITING_PERMISSION",
    "WAITING_USER",
    "VERIFYING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ]),
  WAITING_USER: new Set(["EXECUTING", "VERIFYING", "FAILED", "CANCELLED"]),
  VERIFYING: new Set(["COMPLETED", "FAILED", "EXECUTING", "CANCELLED"]),
  COMPLETED: new Set(),
  FAILED: new Set(["PLANNING", "EXECUTING", "CANCELLED"]),
  CANCELLED: new Set(["PLANNING"]),
};

function nowIso() {
  return new Date().toISOString();
}

function safeProgress(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return Math.min(100, Math.max(0, value));
}

export function canTransition(from: UnifiedTaskStatus, to: UnifiedTaskStatus): boolean {
  return from === to || TRANSITIONS[from].has(to);
}

export function transitionTask(
  task: UnifiedTask,
  status: UnifiedTaskStatus,
  patch: Partial<Omit<UnifiedTask, "id" | "status" | "createdAt">> = {},
  at = nowIso(),
): UnifiedTask {
  if (!canTransition(task.status, status)) {
    throw new Error(`Invalid task transition: ${task.status} -> ${status}`);
  }
  const startedAt = task.startedAt ?? (status === "EXECUTING" ? at : undefined);
  const finishedAt = TERMINAL.has(status)
    ? (patch.finishedAt ?? at)
    : (patch.finishedAt ?? task.finishedAt);
  return {
    ...task,
    ...patch,
    status,
    progress: safeProgress(patch.progress ?? task.progress),
    startedAt,
    finishedAt,
    updatedAt: at,
  };
}

export function createUnifiedTask(
  input: Pick<UnifiedTask, "source" | "title"> &
    Partial<
      Omit<
        UnifiedTask,
        "source" | "title" | "id" | "status" | "createdAt" | "updatedAt" | "retryCount"
      >
    >,
  at = nowIso(),
): UnifiedTask {
  /*
   * A UUID, because that is what the column holds. Generated here rather than
   * by the database so the caller can reference the task immediately — and the
   * fallback is a UUID too, not a readable string: an id the column rejects
   * would turn a storage detail into a task that cannot be saved at all.
   */
  const id = randomUuid();
  return {
    ...input,
    id,
    source: input.source,
    title: input.title.trim() || "Untitled task",
    status: "CREATED",
    retryCount: 0,
    createdAt: at,
    updatedAt: at,
    progress: safeProgress(input.progress),
  };
}

export function retryTask(task: UnifiedTask, at = nowIso()): UnifiedTask {
  if (task.status !== "FAILED" && task.status !== "CANCELLED") {
    throw new Error(`Only failed or cancelled tasks can retry; received ${task.status}`);
  }
  return {
    ...transitionTask(task, "PLANNING", { lastError: undefined, finishedAt: undefined }, at),
    retryCount: task.retryCount + 1,
  };
}

/** Adapter for the existing durable automation runtime. */
export function taskFromAutomationRun(run: AutomationRunLike, title: string): UnifiedTask {
  const statusMap: Record<string, UnifiedTaskStatus> = {
    pending: "PLANNING",
    awaiting_approval: "WAITING_PERMISSION",
    running: "EXECUTING",
    paused: "WAITING_USER",
    succeeded: "COMPLETED",
    failed: "FAILED",
    blocked: "FAILED",
    cancelled: "CANCELLED",
  };
  const status = statusMap[run.status] ?? "FAILED";
  const firstStep = run.plan?.steps?.[0]?.summary;
  const blockedError =
    run.status === "blocked"
      ? (run.blocked_reason ?? "The automation plan was blocked.")
      : undefined;
  return {
    id: `automation:${run.id}`,
    source: "automation",
    sourceRef: run.automation_id,
    title,
    currentStep: firstStep ?? run.blocked_reason ?? undefined,
    status,
    retryCount: Math.max(0, run.attempt - 1),
    createdAt: run.created_at,
    updatedAt: run.finished_at ?? run.created_at,
    startedAt: status === "EXECUTING" || TERMINAL.has(status) ? run.created_at : undefined,
    finishedAt: run.finished_at ?? (TERMINAL.has(status) ? run.created_at : undefined),
    lastError: run.error ?? blockedError,
  };
}

/* ------------------------------------------------------------ storage -- */

/**
 * WHERE TASKS LIVE, AND WHY THAT CHANGED.
 *
 * They were kept in IndexedDB with a `localStorage` fallback. That meant work
 * started on a laptop was invisible on a phone, gone when somebody cleared
 * their browser, and outside every export and deletion path the account offers
 * — while the same person's automation runs were already in the account.
 * `PLAN.md` Phase 2 leaves one persistent authority, and these three functions
 * are requests to it.
 *
 * The transition rules above are untouched. They are the domain logic, they are
 * pure, and they are tested without a database; only the storage moved.
 */

export interface TaskRow {
  id: string;
  source: UnifiedTaskSource;
  source_ref: string | null;
  title: string;
  request: string | null;
  current_step: string | null;
  status: UnifiedTaskStatus;
  progress: number | null;
  device_id: string | null;
  agent: string | null;
  permission_requirements: string[];
  input_refs: string[];
  output_refs: string[];
  receipts: string[];
  dependency_task_ids: string[];
  retry_count: number;
  last_error: string | null;
  scheduled_for: string | null;
  project_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const TASK_COLUMNS =
  "id, source, source_ref, title, request, current_step, status, progress, device_id, agent, permission_requirements, input_refs, output_refs, receipts, dependency_task_ids, retry_count, last_error, scheduled_for, project_id, started_at, finished_at, created_at, updated_at";

/** Undefined rather than null on the way out: the task type uses optionals. */
function optional<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

/**
 * Exported for the tests that hold the column mapping.
 *
 * The pair is the only place a task's shape and the table's shape meet, so a
 * field that is written and never read back — a schedule, say — is invisible
 * everywhere else until somebody notices their scheduled task behaving like an
 * immediate one. A round trip through both is the cheapest proof that cannot
 * be satisfied by a mock.
 */
export function toTask(row: TaskRow): UnifiedTask {
  return {
    id: row.id,
    source: row.source,
    sourceRef: optional(row.source_ref),
    title: row.title,
    request: optional(row.request),
    currentStep: optional(row.current_step),
    status: row.status,
    progress: optional(row.progress),
    deviceId: optional(row.device_id),
    agent: optional(row.agent),
    permissionRequirements: row.permission_requirements,
    inputRefs: row.input_refs,
    outputRefs: row.output_refs,
    receipts: row.receipts,
    dependencyTaskIds: row.dependency_task_ids,
    retryCount: row.retry_count,
    lastError: optional(row.last_error),
    scheduledFor: optional(row.scheduled_for),
    projectId: optional(row.project_id),
    startedAt: optional(row.started_at),
    finishedAt: optional(row.finished_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRow(task: UnifiedTask, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    source: task.source,
    source_ref: task.sourceRef ?? null,
    title: task.title,
    request: task.request ?? null,
    current_step: task.currentStep ?? null,
    status: task.status,
    progress: task.progress ?? null,
    device_id: task.deviceId ?? null,
    agent: task.agent ?? null,
    permission_requirements: task.permissionRequirements ?? [],
    input_refs: task.inputRefs ?? [],
    output_refs: task.outputRefs ?? [],
    receipts: task.receipts ?? [],
    dependency_task_ids: task.dependencyTaskIds ?? [],
    retry_count: task.retryCount,
    last_error: task.lastError ?? null,
    scheduled_for: task.scheduledFor ?? null,
    project_id: task.projectId ?? null,
    started_at: task.startedAt ?? null,
    finished_at: task.finishedAt ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

/** Every task the account has, most recently changed first. */
export async function listTasks(): Promise<UnifiedTask[]> {
  const supabase = await loadSupabaseClient();
  /*
   * Bounded, and the bound is the honest answer for a board. Tasks accumulate
   * for as long as somebody uses OCADE; nobody scrolls ten thousand of them,
   * and an unbounded read makes the board slower every week. The most recently
   * changed few hundred is what a board is for.
   */
  const { data, error } = await supabase
    .from("ocade_tasks")
    .select(TASK_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(LIST_CAP);
  if (error) throw new Error(error.message);
  return ((data as unknown as TaskRow[] | null) ?? []).map(toTask);
}

/**
 * Write a task, creating or replacing it.
 *
 * THROWS RATHER THAN SWALLOWING. This used to fall back to another store on
 * failure, so a caller could never tell whether the work it just recorded
 * actually existed anywhere. A task board that shows a task nobody kept is
 * worse than one that says it could not save.
 */
export async function persistTask(task: UnifiedTask): Promise<UnifiedTask> {
  const supabase = await loadSupabaseClient();
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Sign in before saving a task.");

  const { data, error } = await supabase
    .from("ocade_tasks")
    .upsert(toRow(task, userId), { onConflict: "id" })
    .select(TASK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toTask(data as unknown as TaskRow);
}

/** Remove a task. Its comments go with it, through the foreign key. */
export async function removeTask(id: string): Promise<void> {
  const supabase = await loadSupabaseClient();
  const { error } = await supabase.from("ocade_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
