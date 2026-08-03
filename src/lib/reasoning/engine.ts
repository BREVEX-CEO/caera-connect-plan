/**
 * OCADE reasoning service (W1) — the one way any surface asks a model to think.
 *
 * WHAT WAS MISSING
 * ----------------
 * OCADE had a mouth and hands but no nerve between them. The chat route talked
 * to a model; the governed work loop, the control ladder and the skills layer
 * executed typed actions. Nothing turned intent into those actions. An audit of
 * every OCADE route found exactly one that reasons with a model at all:
 *
 *   ocade.artifacts / automations / code / models / monitors / projects /
 *   studio / work   →  zero model references
 *   ocade.tsx (chat) →  the only one
 *
 * and `grep` for llm|model|infer|prompt across work/orchestrator.ts,
 * skills/*.ts and control/route-selector.ts returned nothing at all.
 *
 * WHAT THIS IS
 * ------------
 * A single entry point: given a prompt and a task kind, return a reply or an
 * honest refusal. Every model-backed surface calls this and nothing else, so
 * local-first, fallback behaviour, cancellation and receipts are decided once
 * rather than reinvented per screen.
 *
 * FOUR RULES IT WILL NOT BEND
 *
 * 1. **Local first, always.** Cloud is used only when the caller explicitly
 *    permits it AND local genuinely cannot serve. There is no path where a
 *    prompt silently leaves the machine.
 * 2. **Deterministic work never goes to a model.** `router-policy` already
 *    refuses task kinds whose correctness is not a matter of opinion
 *    (P06.S02); this preserves that refusal rather than routing around it.
 * 3. **Unavailable is an answer.** When nothing can serve, this returns a
 *    refusal naming why. It never invents text, and it never quietly downgrades
 *    to a weaker engine without saying so.
 * 4. **Every outcome carries a receipt** — which model answered, which were
 *    rejected and why, and whether the reply came from this device or a server.
 *
 * Effects are injected, so the policy is unit-testable and this module stays
 * SSR-safe and browser-safe: it imports nothing from node.
 */
import {
  routeTask,
  isDeterministic,
  PerfLedger,
  type TaskKind,
  type DeterministicTask,
  type RoutePolicy,
  type RouteReceipt,
} from "../local/router-policy";
import type { LocalModelInfo } from "../ocade-local";

export type ReasonFailure =
  | "deterministic_task"
  | "no_local_model"
  | "local_unreachable"
  | "cloud_not_permitted"
  | "cloud_unavailable"
  | "cancelled"
  | "empty_reply"
  | "model_error";

export interface ReasonRefusal {
  ok: false;
  failure: ReasonFailure;
  /** A sentence a user can act on, not an error code. */
  reason: string;
  receipt: ReasonReceipt;
}

export interface ReasonReceipt {
  /** Where the reply came from. "none" when nothing served the request. */
  servedBy: "local" | "cloud" | "none";
  modelId: string | null;
  taskKind: ReasonTask;
  /** Why this model and not another — from the router's own receipt. */
  routing: RouteReceipt | null;
  /** Set when local was skipped or failed and cloud was considered. */
  localFallbackReason?: string;
  startedAt: string;
  elapsedMs: number;
}

export interface ReasonSuccess {
  ok: true;
  text: string;
  receipt: ReasonReceipt;
}

export type ReasonResult = ReasonSuccess | ReasonRefusal;

export interface ReasonMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * What a caller may ask for.
 *
 * Deliberately WIDER than `TaskKind`. `router-policy` keeps two separate
 * vocabularies: model-suitable kinds (`code`, `general`, `vision`, …) and
 * deterministic work that must never be generated (`file_write`, `shell`,
 * `sql`, `arithmetic`, `checksum`, `http_request`). They do not overlap.
 *
 * An earlier version of this file typed `task` as `TaskKind` alone — which made
 * the deterministic guard DEAD CODE, because no value of that type could ever
 * be deterministic. The guard existed and could never fire. Accepting the union
 * is what makes rule 2 real: the work loop genuinely will ask for "shell", and
 * this is where that gets refused.
 */
export type ReasonTask = TaskKind | DeterministicTask;

export interface ReasonRequest {
  messages: ReasonMessage[];
  /** Drives model selection, and triggers the deterministic-work refusal. */
  task: ReasonTask;
  /**
   * Whether the caller permits a cloud provider if local cannot serve.
   * Defaults to FALSE: a surface must opt in to sending anything off-device.
   */
  allowCloud?: boolean;
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  policy?: RoutePolicy;
  /**
   * Use this model and skip routing.
   *
   * Some surfaces have already chosen — chat runs its own fallback chain and
   * arrives here with a decision made. Re-routing would silently override it.
   * The deterministic-task refusal still applies: choosing a model does not buy
   * permission to generate work that must be computed.
   */
  modelId?: string;
}

export interface ReasonDeps {
  /** Models currently installed on this device. */
  listLocalModels: () => Promise<LocalModelInfo[]>;
  /** Stream from the local engine. Resolves when the stream ends. */
  streamLocal: (
    modelId: string,
    messages: ReasonMessage[],
    handlers: { onToken: (c: string) => void; signal?: AbortSignal },
  ) => Promise<{ ok: boolean; reason?: string }>;
  /** Optional cloud path. Absent means cloud is not configured at all. */
  streamCloud?: (
    messages: ReasonMessage[],
    handlers: { onToken: (c: string) => void; signal?: AbortSignal },
  ) => Promise<{ ok: boolean; reason?: string; modelId?: string }>;
  ledger: PerfLedger;
  now: () => number;
}

function receipt(
  base: Partial<ReasonReceipt> & { taskKind: ReasonTask; startedAt: string; elapsedMs: number },
): ReasonReceipt {
  return {
    servedBy: base.servedBy ?? "none",
    modelId: base.modelId ?? null,
    routing: base.routing ?? null,
    ...(base.localFallbackReason ? { localFallbackReason: base.localFallbackReason } : {}),
    taskKind: base.taskKind,
    startedAt: base.startedAt,
    elapsedMs: base.elapsedMs,
  };
}

/**
 * Ask a model to think, local first.
 *
 * Returns a refusal rather than throwing: a surface that cannot get a reply
 * needs to show the user why, and an exception carries that badly.
 */
export async function reason(deps: ReasonDeps, request: ReasonRequest): Promise<ReasonResult> {
  const startedAtMs = deps.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const done = () => deps.now() - startedAtMs;
  const fail = (failure: ReasonFailure, reason: string, extra: Partial<ReasonReceipt> = {}) => ({
    ok: false as const,
    failure,
    reason,
    receipt: receipt({ ...extra, taskKind: request.task, startedAt, elapsedMs: done() }),
  });

  // Rule 2, before anything else. Handing deterministic work to a model is a
  // correctness bug, not a routing preference, so it is refused up front.
  if (isDeterministic(request.task)) {
    return fail(
      "deterministic_task",
      `"${request.task}" has a single correct answer and must be executed by a tool, not decided by a model.`,
    );
  }

  if (request.signal?.aborted) {
    return fail("cancelled", "Cancelled before the model was asked.");
  }

  const models = request.modelId ? [] : await deps.listLocalModels();
  // Safe by construction: every deterministic value was refused above, so what
  // remains is a TaskKind.
  const route = request.modelId
    ? null
    : routeTask(request.task as TaskKind, models, deps.ledger, request.policy ?? {});

  let localFallbackReason: string | undefined;

  if (request.modelId || route?.ok) {
    // A caller-supplied model wins over routing; otherwise `receipt.chosen` is
    // string | null by design and the winning model itself is the authority.
    const modelId = request.modelId ?? (route?.ok ? route.model.id : "");
    let text = "";
    const result = await deps.streamLocal(modelId, request.messages, {
      onToken: (c) => {
        text += c;
        request.onToken?.(c);
      },
      signal: request.signal,
    });

    if (result.ok && text.trim().length > 0) {
      return {
        ok: true,
        text,
        receipt: receipt({
          servedBy: "local",
          modelId,
          routing: route?.receipt ?? null,
          taskKind: request.task,
          startedAt,
          elapsedMs: done(),
        }),
      };
    }

    // A user cancelling is their choice, not the model failing, and must never
    // be reinterpreted as a reason to reach for the cloud.
    if (result.reason === "cancelled" || request.signal?.aborted) {
      return fail("cancelled", "Cancelled while the model was answering.", {
        modelId,
        routing: route?.receipt ?? null,
      });
    }

    localFallbackReason =
      result.ok && text.trim().length === 0
        ? `The local model "${modelId}" returned an empty reply.`
        : (result.reason ?? `The local model "${modelId}" could not answer.`);
  } else {
    // A refused route carries its explanation on the receipt, not as a
    // top-level field — so the rejected candidates travel with the reason.
    localFallbackReason =
      models.length === 0
        ? "No local model is installed on this device."
        : (route?.receipt.refusal ?? "No installed model was suitable for this task.");
  }

  // Rule 1. Cloud only on explicit permission, and only after local failed.
  if (!request.allowCloud) {
    const failure: ReasonFailure = models.length === 0 ? "no_local_model" : "local_unreachable";
    return fail(
      failure,
      `${localFallbackReason} This request was not sent to any server, because sending it was not permitted.`,
      { localFallbackReason, routing: route?.ok ? route.receipt : null },
    );
  }

  if (!deps.streamCloud) {
    return fail(
      "cloud_unavailable",
      `${localFallbackReason} No cloud provider is configured, so there is nothing to fall back to.`,
      { localFallbackReason, routing: route?.ok ? route.receipt : null },
    );
  }

  let cloudText = "";
  const cloud = await deps.streamCloud(request.messages, {
    onToken: (c) => {
      cloudText += c;
      request.onToken?.(c);
    },
    signal: request.signal,
  });

  if (cloud.reason === "cancelled" || request.signal?.aborted) {
    return fail("cancelled", "Cancelled while the server was answering.", { localFallbackReason });
  }
  if (!cloud.ok) {
    return fail("model_error", cloud.reason ?? "The server could not answer.", {
      localFallbackReason,
    });
  }
  if (cloudText.trim().length === 0) {
    return fail("empty_reply", "The server returned an empty reply.", { localFallbackReason });
  }

  return {
    ok: true,
    text: cloudText,
    receipt: receipt({
      servedBy: "cloud",
      modelId: cloud.modelId ?? null,
      routing: route?.ok ? route.receipt : null,
      localFallbackReason,
      taskKind: request.task,
      startedAt,
      elapsedMs: done(),
    }),
  };
}

/** Plain-language summary of a receipt, for showing a user why they got what they got. */
export function explainReceipt(r: ReasonReceipt): string {
  if (r.servedBy === "none") return "Nothing answered this request.";
  const where =
    r.servedBy === "local"
      ? "on this device, so nothing left your machine"
      : "on a server, because the local engine could not answer";
  const which = r.modelId ? `"${r.modelId}"` : "an unnamed model";
  const why = r.localFallbackReason ? ` ${r.localFallbackReason}` : "";
  return `Answered by ${which} ${where}.${why}`;
}
