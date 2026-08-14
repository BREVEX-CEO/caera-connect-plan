/**
 * The action contract: what a directed action must contain to be executable.
 *
 * WHERE THIS CAME FROM, AND WHY ONLY THIS PART SURVIVED
 * ------------------------------------------------------
 * This was extracted from `src/lib/control/control-plane.ts` when that
 * directory was deleted. The deleted module was a 1,200-line simulated control
 * plane — a Director/Hands/Eyes/Verifier pipeline that never touched a
 * computer. The real control path is the fast router, the tool registry and
 * the two native hosts; nothing in `src/lib/control/` was ever on it.
 *
 * Two things in it were genuinely load-bearing and are kept here: the SHAPE of
 * a bounded action request, and the two functions that check and key one.
 * `governed-run.ts` validates against them before it records a run, and
 * `unknown-app-learning.ts` types its route decisions with them. Neither
 * simulates anything.
 *
 * The name changed deliberately. "Control plane" described a system that does
 * not exist; "action contract" describes what this file actually is — a set of
 * types and two pure validators, with no execution in it at all.
 */

export type RiskLevel = "read" | "low" | "medium" | "high" | "protected";

export type ActionRoute =
  | "api"
  | "plugin"
  | "mcp"
  | "cli"
  | "file"
  | "dom"
  | "accessibility"
  | "native"
  | "vision"
  | "input";

export interface OcadeAppIdentity {
  appId: string;
  executable?: string;
  product?: string;
  version?: string;
  windowId?: string;
  browserOrigin?: string;
}

export interface Postcondition {
  id: string;
  kind: string;
  selector: string;
  operator: "equals" | "exists" | "contains" | "sha256";
  expected: unknown;
}

export interface VerificationStep {
  id: string;
  observerId: string;
  route: ActionRoute;
  postconditionIds: string[];
}

export interface RecoveryStep {
  id: string;
  kind: "cancel" | "isolate" | "restore" | "undo";
  description: string;
  ready: boolean;
}

export interface OcadeActionRequest {
  actionId: string;
  taskId: string;
  stepId: string;
  appIdentity: OcadeAppIdentity;
  capability: string;
  route: ActionRoute;
  arguments: Record<string, unknown>;
  risk: RiskLevel;
  requiredPermission: string;
  expectedPostconditions: Postcondition[];
  verificationPlan: VerificationStep[];
  rollbackPlan?: RecoveryStep[];
  timeoutMs: number;
  retryBudget: number;
  idempotencyKey: string;
}

/**
 * A source of proposals.
 *
 * Kept as a one-method interface because that is all any consumer uses:
 * `model-fabric.ts` names the type so a provider can be described as a brain
 * without importing an implementation.
 */
export interface OcadeBrain {
  propose(goal: string, signal?: AbortSignal): Promise<unknown>;
}

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i;

const ROUTES = new Set<ActionRoute>([
  "api",
  "plugin",
  "mcp",
  "cli",
  "file",
  "dom",
  "accessibility",
  "native",
  "vision",
  "input",
]);
const RISKS = new Set<RiskLevel>(["read", "low", "medium", "high", "protected"]);
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isBoundedText(value: unknown, max = 2_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return value.length <= 1_000 && value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value) || Object.keys(value).length > 1_000) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

/**
 * Key-order-independent serialisation.
 *
 * The idempotency key must not change because two callers built the same
 * arguments object in a different order — that would turn one logical action
 * into two, which is the exact failure an idempotency key exists to prevent.
 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Stable correlation key, not a cryptographic authorization primitive. */
export function deriveIdempotencyKey(input: {
  taskId: string;
  stepId: string;
  capability: string;
  arguments: Record<string, unknown>;
}): string {
  const text = stableJson(input);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ocade:${input.taskId}:${input.stepId}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function validAppIdentity(app: OcadeAppIdentity): boolean {
  return (
    isRecord(app) &&
    isSafeId(app.appId) &&
    [app.executable, app.product, app.version, app.windowId, app.browserOrigin].every(
      (value) => value === undefined || (typeof value === "string" && value.length <= 2_000),
    )
  );
}

/** Public structural validation used by every production execution path. */
export function validateOcadeActionRequest(request: OcadeActionRequest): string | null {
  if (!isSafeId(request.actionId) || !isSafeId(request.taskId) || !isSafeId(request.stepId)) {
    return "Action, task and step ids must be bounded safe identifiers.";
  }
  if (!validAppIdentity(request.appIdentity)) return "The application identity is invalid.";
  if (!isSafeId(request.capability) || !isSafeId(request.requiredPermission)) {
    return "Capability and permission ids must be bounded safe identifiers.";
  }
  if (!ROUTES.has(request.route) || !RISKS.has(request.risk)) {
    return "The route or risk is unknown.";
  }
  if (!isRecord(request.arguments) || !isJsonValue(request.arguments)) {
    return "Action arguments must be bounded JSON.";
  }
  if (
    !Number.isInteger(request.timeoutMs) ||
    request.timeoutMs < 1 ||
    request.timeoutMs > MAX_TIMEOUT_MS
  ) {
    return "The action timeout is outside the bounded range.";
  }
  if (
    !Number.isInteger(request.retryBudget) ||
    request.retryBudget < 0 ||
    request.retryBudget > MAX_RETRIES
  ) {
    return "The retry budget is outside the bounded range.";
  }
  if (!isBoundedText(request.idempotencyKey, 500)) return "The idempotency key is invalid.";
  if (
    !Array.isArray(request.expectedPostconditions) ||
    request.expectedPostconditions.length === 0
  ) {
    return "At least one expected postcondition is required.";
  }
  const postconditionIds = new Set<string>();
  for (const postcondition of request.expectedPostconditions) {
    if (
      !isSafeId(postcondition.id) ||
      !isBoundedText(postcondition.kind) ||
      !isBoundedText(postcondition.selector) ||
      !["equals", "exists", "contains", "sha256"].includes(postcondition.operator) ||
      !isJsonValue(postcondition.expected) ||
      postconditionIds.has(postcondition.id)
    ) {
      return "A postcondition is malformed or duplicated.";
    }
    postconditionIds.add(postcondition.id);
  }
  if (!Array.isArray(request.verificationPlan) || request.verificationPlan.length === 0) {
    return "At least one independent verification step is required.";
  }
  const covered = new Set<string>();
  for (const step of request.verificationPlan) {
    if (
      !isSafeId(step.id) ||
      !isSafeId(step.observerId) ||
      !ROUTES.has(step.route) ||
      !Array.isArray(step.postconditionIds) ||
      step.postconditionIds.length === 0 ||
      step.postconditionIds.some((id) => !postconditionIds.has(id))
    ) {
      return "A verification step is malformed or references an unknown postcondition.";
    }
    step.postconditionIds.forEach((id) => covered.add(id));
  }
  if ([...postconditionIds].some((id) => !covered.has(id))) {
    return "Every expected postcondition must have an observation route.";
  }
  if (request.risk === "protected") return "Protected actions are never executable.";
  if (request.risk === "medium" || request.risk === "high") {
    const adequateKinds =
      request.risk === "high"
        ? new Set<RecoveryStep["kind"]>(["restore", "undo"])
        : new Set<RecoveryStep["kind"]>(["isolate", "restore", "undo"]);
    if (!request.rollbackPlan?.some((step) => step.ready && adequateKinds.has(step.kind))) {
      return "Risky mutations require a ready rollback or recovery step.";
    }
  }
  return null;
}
