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
  EXECUTING: new Set(["WAITING_PERMISSION", "WAITING_USER", "VERIFYING", "COMPLETED", "FAILED", "CANCELLED"]),
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
  const finishedAt = TERMINAL.has(status) ? patch.finishedAt ?? at : patch.finishedAt ?? task.finishedAt;
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
  input: Pick<UnifiedTask, "source" | "title"> & Partial<Omit<UnifiedTask, "source" | "title" | "id" | "status" | "createdAt" | "updatedAt" | "retryCount">>,
  at = nowIso(),
): UnifiedTask {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const blockedError = run.status === "blocked" ? run.blocked_reason ?? "The automation plan was blocked." : undefined;
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

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open OCADE task database."));
  });
}

function readFallback(): UnifiedTask[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as UnifiedTask[]) : [];
  } catch {
    return [];
  }
}

function writeFallback(tasks: UnifiedTask[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, 500)));
}

export async function listLocalTasks(): Promise<UnifiedTask[]> {
  try {
    const db = await openDb();
    if (!db) return readFallback();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as UnifiedTask[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return readFallback();
  }
}

export async function persistTask(task: UnifiedTask): Promise<UnifiedTask> {
  try {
    const db = await openDb();
    if (!db) {
      const tasks = readFallback().filter((item) => item.id !== task.id);
      writeFallback([task, ...tasks]);
      return task;
    }
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return task;
  } catch {
    const tasks = readFallback().filter((item) => item.id !== task.id);
    writeFallback([task, ...tasks]);
    return task;
  }
}

export async function removeLocalTask(id: string): Promise<void> {
  const fallback = readFallback().filter((task) => task.id !== id);
  writeFallback(fallback);
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback storage was already updated. A local persistence failure must not
    // turn into a fabricated task success or affect the actual external run.
  }
}
