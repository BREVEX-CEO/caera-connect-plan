/**
 * Canonical OCADE model-to-tool control plane.
 *
 * The Brain may propose goals and tool calls, but it never receives a Hands
 * registry or operating-system authority. The Director owns decoding, schema
 * validation, identity resolution, risk, permission, recovery, boundedness,
 * checkpoints, and idempotency. Hands may only execute a directed action.
 * Eyes then observe independently, and the Verifier derives the outcome from
 * expected versus observed postconditions.
 */
import {
  selectUniversalRoute,
  type UniversalRouteCandidate,
  type UniversalRouteDecision,
} from "./route-selector";
import type {
  ConnectorPrivacy,
  ConnectorRegistry,
  ConnectorRequirement,
} from "./connector-registry";

export type RiskLevel = "read" | "low" | "medium" | "high" | "protected";

export type ActionRoute =
  | "api"
  | "mcp"
  | "plugin"
  | "os_integration"
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

export interface BrainActionProposal {
  stepId: string;
  app: {
    appId?: string;
    executable?: string;
    product?: string;
    version?: string;
    windowId?: string;
    browserOrigin?: string;
  };
  capability: string;
  arguments: Record<string, unknown>;
}

export interface BrainProposal {
  taskId: string;
  goal: string;
  actions: BrainActionProposal[];
}

export interface OcadeBrain {
  propose(goal: string, signal?: AbortSignal): Promise<unknown>;
}

export type ValueSchema =
  | { type: "string"; minLength?: number; maxLength?: number; pattern?: string }
  | { type: "number"; minimum?: number; maximum?: number; integer?: boolean }
  | { type: "boolean" }
  | { type: "array"; items: ValueSchema; minItems?: number; maxItems?: number }
  | {
      type: "object";
      properties: Record<string, ValueSchema>;
      required?: string[];
      additionalProperties?: boolean;
    };

export interface ToolDefinition {
  capability: string;
  route: ActionRoute;
  argumentSchema: Extract<ValueSchema, { type: "object" }>;
  requiredPermission: string;
  risk: RiskLevel | ((arguments_: Record<string, unknown>, app: OcadeAppIdentity) => RiskLevel);
  mutating: boolean;
  timeoutMs: number;
  retryBudget: number;
  /**
   * Runtime-observed interfaces for this exact app action. When supplied, the
   * Director—not the model—selects the strongest adequate route.
   */
  routeCandidates?(
    arguments_: Record<string, unknown>,
    app: OcadeAppIdentity,
  ): UniversalRouteCandidate[];
  requiredResources?: string[];
  /** String arguments that must be canonicalized through the file broker. */
  fileArguments?: string[];
  expectedPostconditions(
    arguments_: Record<string, unknown>,
    app: OcadeAppIdentity,
  ): Postcondition[];
  verificationPlan(postconditions: Postcondition[]): VerificationStep[];
  rollbackPlan?(arguments_: Record<string, unknown>, app: OcadeAppIdentity): RecoveryStep[];
}

export interface PermissionGrant {
  grantId: string;
  taskId: string;
  permissions: string[];
  appIds: string[];
  fileRoots?: string[];
  browserOrigins?: string[];
  grantedAt: string;
  expiresAt: string;
}

export interface DirectorContext {
  tools: ToolDefinition[];
  permission: PermissionGrant | null;
  availableResources: string[];
  resolveApp(hint: BrainActionProposal["app"]): Promise<OcadeAppIdentity | null>;
  resolveFile?(path: string): Promise<string | null>;
  createCheckpoint?: (
    action: Omit<OcadeActionRequest, "idempotencyKey">,
  ) => Promise<{ checkpointId: string; evidence: string }>;
  routePolicy?: {
    taskType: string;
    recordingPreference: "video_on" | "video_off";
    explicitCoordinateFallbackApproval?: boolean;
    minimumConfidence?: number;
    maxExpectedLatencyMs?: number;
  };
  /** Optional typed connector broker; it contributes a route, never authority. */
  connectorRegistry?: Pick<ConnectorRegistry, "select">;
  connectorPolicy?: {
    online: boolean;
    allowedPrivacy: ConnectorPrivacy[];
    grantedScopes?: string[];
  };
  maxActions?: number;
  now?: Date;
}

export interface DirectedAction {
  request: OcadeActionRequest;
  authorizationGrantId: string;
  authorizationExpiresAt: string;
  checkpoint: { checkpointId: string; evidence: string } | null;
  routeSelection?: UniversalRouteDecision;
}

export interface DirectedPlan {
  taskId: string;
  goal: string;
  actions: DirectedAction[];
}

export type DirectorFailureCode =
  | "malformed"
  | "too_many_steps"
  | "unknown_tool"
  | "identity_unresolved"
  | "unauthorized"
  | "resource_unavailable"
  | "route_unavailable"
  | "unverifiable"
  | "recovery_missing"
  | "checkpoint_failed";

export type DirectorOutcome =
  | { ok: true; data: DirectedPlan; evidence: string }
  | { ok: false; code: DirectorFailureCode; reason: string; stepId?: string };

export interface HandExecution {
  executorId: string;
  route: ActionRoute;
  startedAt: string;
  finishedAt: string;
  evidence: string[];
  output?: unknown;
}

export type HandExecutor = (
  request: OcadeActionRequest,
  signal: AbortSignal,
) => Promise<HandExecution>;

export interface EyeObservation {
  observerId: string;
  route: ActionRoute;
  postconditionId: string;
  value: unknown;
  observedAt: string;
  evidence: string;
  redacted: boolean;
}

export type EyeObserver = (
  request: OcadeActionRequest,
  step: VerificationStep,
  signal: AbortSignal,
) => Promise<EyeObservation[]>;

export interface VerificationReceipt {
  verified: boolean;
  evidence: string[];
  observations: EyeObservation[];
  missingPostconditions: string[];
  mismatchedPostconditions: string[];
}

export interface JournalEntry {
  idempotencyKey: string;
  actionId: string;
  status: "in_flight" | "verified" | "unverified" | "failed";
  evidence: string[];
}

export interface ControlJournal {
  lookup(idempotencyKey: string): Promise<JournalEntry | null>;
  begin(entry: JournalEntry): Promise<boolean>;
  complete(entry: JournalEntry): Promise<void>;
}

export type ControlOutcome =
  | {
      status: "verified" | "replayed";
      request: OcadeActionRequest;
      execution?: HandExecution;
      receipt: VerificationReceipt;
    }
  | {
      status: "refused" | "failed" | "unverified";
      request: OcadeActionRequest;
      reason: string;
      execution?: HandExecution;
      receipt?: VerificationReceipt;
    };

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i;
const ROUTES = new Set<ActionRoute>([
  "api",
  "mcp",
  "plugin",
  "os_integration",
  "cli",
  "file",
  "dom",
  "accessibility",
  "native",
  "vision",
  "input",
]);
const RISKS = new Set<RiskLevel>(["read", "low", "medium", "high", "protected"]);
const MAX_ACTIONS = 50;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RETRIES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
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

function decodeApp(value: unknown): BrainActionProposal["app"] | null {
  if (
    !isRecord(value) ||
    !hasOnly(value, ["appId", "executable", "product", "version", "windowId", "browserOrigin"])
  ) {
    return null;
  }
  for (const item of Object.values(value)) {
    if (item !== undefined && (typeof item !== "string" || item.length > 2_000)) return null;
  }
  if (!Object.values(value).some((item) => typeof item === "string" && item.trim())) return null;
  return value as BrainActionProposal["app"];
}

/** Strictly decode untrusted model output. Unknown fields fail closed. */
export function decodeBrainProposal(value: unknown): BrainProposal | null {
  if (
    !isRecord(value) ||
    !hasOnly(value, ["taskId", "goal", "actions"]) ||
    !isSafeId(value.taskId) ||
    !isBoundedText(value.goal, 10_000) ||
    !Array.isArray(value.actions)
  ) {
    return null;
  }
  const actions: BrainActionProposal[] = [];
  for (const raw of value.actions) {
    if (
      !isRecord(raw) ||
      !hasOnly(raw, ["stepId", "app", "capability", "arguments"]) ||
      !isSafeId(raw.stepId) ||
      !isSafeId(raw.capability) ||
      !isRecord(raw.arguments) ||
      !isJsonValue(raw.arguments)
    ) {
      return null;
    }
    const app = decodeApp(raw.app);
    if (!app) return null;
    actions.push({
      stepId: raw.stepId,
      app,
      capability: raw.capability,
      arguments: raw.arguments,
    });
  }
  return { taskId: value.taskId, goal: value.goal, actions };
}

function validateAgainstSchema(value: unknown, schema: ValueSchema, path: string): string | null {
  switch (schema.type) {
    case "string": {
      if (typeof value !== "string") return `${path} must be a string.`;
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return `${path} is shorter than allowed.`;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `${path} is longer than allowed.`;
      }
      if (schema.pattern) {
        try {
          if (!new RegExp(schema.pattern).test(value)) return `${path} does not match its schema.`;
        } catch {
          return `${path} has an invalid declared pattern.`;
        }
      }
      return null;
    }
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be finite.`;
      if (schema.integer && !Number.isInteger(value)) return `${path} must be an integer.`;
      if (schema.minimum !== undefined && value < schema.minimum) return `${path} is too small.`;
      if (schema.maximum !== undefined && value > schema.maximum) return `${path} is too large.`;
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} must be Boolean.`;
    case "array":
      if (!Array.isArray(value)) return `${path} must be an array.`;
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        return `${path} has too few items.`;
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return `${path} has too many items.`;
      }
      for (let index = 0; index < value.length; index += 1) {
        const issue = validateAgainstSchema(value[index], schema.items, `${path}[${index}]`);
        if (issue) return issue;
      }
      return null;
    case "object": {
      if (!isRecord(value)) return `${path} must be an object.`;
      const declared = new Set(Object.keys(schema.properties));
      if (
        schema.additionalProperties !== true &&
        Object.keys(value).some((key) => !declared.has(key))
      ) {
        return `${path} contains an undeclared argument.`;
      }
      for (const required of schema.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(value, required)) {
          return `${path}.${required} is required.`;
        }
      }
      for (const [key, item] of Object.entries(value)) {
        const child = schema.properties[key];
        if (!child) continue;
        const issue = validateAgainstSchema(item, child, `${path}.${key}`);
        if (issue) return issue;
      }
      return null;
    }
  }
}

function validAppIdentity(app: OcadeAppIdentity): boolean {
  return (
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

function permissionReason(
  grant: PermissionGrant | null,
  taskId: string,
  permission: string,
  app: OcadeAppIdentity,
  now: Date,
): string | null {
  if (!grant) return "No user permission grant covers this action.";
  const granted = Date.parse(grant.grantedAt);
  const expires = Date.parse(grant.expiresAt);
  if (
    !isSafeId(grant.grantId) ||
    grant.taskId !== taskId ||
    !Number.isFinite(granted) ||
    !Number.isFinite(expires) ||
    expires <= granted ||
    now.getTime() < granted ||
    now.getTime() >= expires
  ) {
    return "The user permission grant is invalid, expired, or belongs to another task.";
  }
  if (!grant.permissions.includes(permission)) return `Permission "${permission}" was not granted.`;
  if (!grant.appIds.includes(app.appId)) return `Application "${app.appId}" was not granted.`;
  if (
    app.browserOrigin &&
    !(grant.browserOrigins ?? []).some((origin) => origin === app.browserOrigin)
  ) {
    return `Browser origin "${app.browserOrigin}" was not granted.`;
  }
  return null;
}

function normaliseFilePath(path: string): string | null {
  const value = path.replace(/\\/g, "/").replace(/\/+/g, "/").trim().toLowerCase();
  if (!value || value.split("/").includes("..")) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function fileIsGranted(path: string, roots: string[]): boolean {
  const candidate = normaliseFilePath(path);
  if (!candidate) return false;
  return roots.some((root) => {
    const base = normaliseFilePath(root);
    return base !== null && (candidate === base || candidate.startsWith(`${base}/`));
  });
}

function directorFailure(
  code: DirectorFailureCode,
  reason: string,
  stepId?: string,
): DirectorOutcome {
  return { ok: false, code, reason, ...(stepId ? { stepId } : {}) };
}

/**
 * Convert untrusted Brain output into a permission-checked executable plan.
 * Tool metadata—not model text—supplies risk, route, verification and recovery.
 */
export async function directBrainProposal(
  raw: unknown,
  context: DirectorContext,
): Promise<DirectorOutcome> {
  const proposal = decodeBrainProposal(raw);
  if (!proposal) return directorFailure("malformed", "The model proposal is malformed.");
  const maxActions = Math.min(context.maxActions ?? MAX_ACTIONS, MAX_ACTIONS);
  if (proposal.actions.length === 0 || proposal.actions.length > maxActions) {
    return directorFailure(
      "too_many_steps",
      `A plan must contain between 1 and ${maxActions} bounded actions.`,
    );
  }
  if (new Set(proposal.actions.map((action) => action.stepId)).size !== proposal.actions.length) {
    return directorFailure("malformed", "Step ids must be unique.");
  }

  const now = context.now ?? new Date();
  if (!Number.isFinite(now.getTime()))
    return directorFailure("malformed", "Director time is invalid.");
  const actions: DirectedAction[] = [];
  const keys = new Set<string>();

  for (const proposalAction of proposal.actions) {
    const tool = context.tools.find(
      (candidate) => candidate.capability === proposalAction.capability,
    );
    if (!tool) {
      return directorFailure(
        "unknown_tool",
        `Unknown capability "${proposalAction.capability}" was refused.`,
        proposalAction.stepId,
      );
    }
    const schemaIssue = validateAgainstSchema(
      proposalAction.arguments,
      tool.argumentSchema,
      "arguments",
    );
    if (schemaIssue) return directorFailure("malformed", schemaIssue, proposalAction.stepId);

    const app = await context.resolveApp(proposalAction.app);
    if (!app || !validAppIdentity(app)) {
      return directorFailure(
        "identity_unresolved",
        "The target application identity could not be resolved exactly.",
        proposalAction.stepId,
      );
    }
    const resolvedArguments = { ...proposalAction.arguments };
    for (const key of tool.fileArguments ?? []) {
      const candidate = resolvedArguments[key];
      if (typeof candidate !== "string" || !context.resolveFile) {
        return directorFailure(
          "identity_unresolved",
          `File argument "${key}" cannot be resolved through the file broker.`,
          proposalAction.stepId,
        );
      }
      const resolved = await context.resolveFile(candidate);
      if (!resolved || !isBoundedText(resolved)) {
        return directorFailure(
          "identity_unresolved",
          `File argument "${key}" did not resolve to an approved canonical path.`,
          proposalAction.stepId,
        );
      }
      resolvedArguments[key] = resolved;
    }
    const resolvedSchemaIssue = validateAgainstSchema(
      resolvedArguments,
      tool.argumentSchema,
      "resolved arguments",
    );
    if (resolvedSchemaIssue) {
      return directorFailure("identity_unresolved", resolvedSchemaIssue, proposalAction.stepId);
    }

    const permissionIssue = permissionReason(
      context.permission,
      proposal.taskId,
      tool.requiredPermission,
      app,
      now,
    );
    if (permissionIssue) {
      return directorFailure("unauthorized", permissionIssue, proposalAction.stepId);
    }
    for (const key of tool.fileArguments ?? []) {
      const resolved = resolvedArguments[key];
      if (
        typeof resolved !== "string" ||
        !fileIsGranted(resolved, context.permission?.fileRoots ?? [])
      ) {
        return directorFailure(
          "unauthorized",
          `Resolved file argument "${key}" is outside the granted roots.`,
          proposalAction.stepId,
        );
      }
    }
    const missingResource = (tool.requiredResources ?? []).find(
      (resource) => !context.availableResources.includes(resource),
    );
    if (missingResource) {
      return directorFailure(
        "resource_unavailable",
        `Required resource "${missingResource}" is unavailable.`,
        proposalAction.stepId,
      );
    }

    let expected: Postcondition[];
    let verification: VerificationStep[];
    let recovery: RecoveryStep[] | undefined;
    let risk: RiskLevel;
    let selectedRoute = tool.route;
    let routeSelection: UniversalRouteDecision | undefined;
    try {
      risk = typeof tool.risk === "function" ? tool.risk(resolvedArguments, app) : tool.risk;
      if (!RISKS.has(risk)) {
        return directorFailure(
          "malformed",
          "The tool calculated an unknown risk.",
          proposalAction.stepId,
        );
      }
      if (risk === "protected") {
        return directorFailure(
          "unauthorized",
          "Protected actions cannot be authorized for model execution.",
          proposalAction.stepId,
        );
      }
      expected = tool.expectedPostconditions(resolvedArguments, app);
      verification = tool.verificationPlan(expected);
      recovery = tool.rollbackPlan?.(resolvedArguments, app);
      if (tool.routeCandidates) {
        if (!context.routePolicy) {
          return directorFailure(
            "route_unavailable",
            "This action exposes multiple interfaces but has no explicit route policy.",
            proposalAction.stepId,
          );
        }
        const candidates = tool.routeCandidates(resolvedArguments, app);
        if (context.connectorRegistry && context.connectorPolicy) {
          const requirement: ConnectorRequirement = {
            capabilityId: tool.capability,
            access: tool.mutating ? "write" : "read",
            maximumRisk: risk,
            grantedScopes: context.connectorPolicy.grantedScopes ?? context.permission!.permissions,
            appId: app.appId,
            online: context.connectorPolicy.online,
            allowedPrivacy: context.connectorPolicy.allowedPrivacy,
          };
          const connector = context.connectorRegistry.select(requirement);
          if (connector.ok) {
            candidates.push({
              candidateId: `connector:${connector.connector.connectorId}`,
              route: connector.connector.route,
              interfaceId: connector.connector.connectorId,
              available: true,
              officialOrApproved: true,
              supportedAppIds: [app.appId],
              taskTypes: [context.routePolicy.taskType],
              requiredPermissions: [tool.requiredPermission],
              confidence: connector.connector.health === "healthy" ? 1 : 0.85,
              expectedLatencyMs: connector.connector.latencyMs ?? 30_000,
              verification: {
                route: connector.capability.verificationRoute,
                confidence: 0.9,
                independent: true,
              },
              recovery:
                risk === "read"
                  ? null
                  : {
                      route: connector.capability.verificationRoute,
                      ready: connector.capability.reversible,
                    },
              health: connector.connector.health === "healthy" ? "healthy" : "degraded",
              supportsRecording: false,
              fallbackPolicy: "explicit",
              evidence: connector.evidence.join(" ").slice(0, 2_000),
            });
          }
        }
        const selected = selectUniversalRoute({
          appIdentity: app,
          taskType: context.routePolicy.taskType,
          risk,
          grantedPermissions: context.permission!.permissions,
          recordingPreference: context.routePolicy.recordingPreference,
          candidates,
          explicitCoordinateFallbackApproval:
            context.routePolicy.explicitCoordinateFallbackApproval,
          minimumConfidence: context.routePolicy.minimumConfidence,
          maxExpectedLatencyMs: context.routePolicy.maxExpectedLatencyMs,
        });
        if (!selected.ok) {
          return directorFailure("route_unavailable", selected.reason, proposalAction.stepId);
        }
        routeSelection = selected.data;
        selectedRoute = selected.data.route;
        if (!verification.some((step) => step.route === selected.data.verificationRoute)) {
          return directorFailure(
            "unverifiable",
            "The selected route has no matching independent verification step.",
            proposalAction.stepId,
          );
        }
      }
    } catch (cause) {
      return directorFailure(
        "malformed",
        cause instanceof Error ? cause.message : "Tool planning failed.",
        proposalAction.stepId,
      );
    }

    const actionBase: Omit<OcadeActionRequest, "idempotencyKey"> = {
      actionId: `${proposal.taskId}:${proposalAction.stepId}`,
      taskId: proposal.taskId,
      stepId: proposalAction.stepId,
      appIdentity: app,
      capability: tool.capability,
      route: selectedRoute,
      arguments: resolvedArguments,
      risk,
      requiredPermission: tool.requiredPermission,
      expectedPostconditions: expected,
      verificationPlan: verification,
      ...(recovery ? { rollbackPlan: recovery } : {}),
      timeoutMs: tool.timeoutMs,
      retryBudget: tool.retryBudget,
    };
    const idempotencyKey = deriveIdempotencyKey({
      taskId: proposal.taskId,
      stepId: proposalAction.stepId,
      capability: tool.capability,
      arguments: resolvedArguments,
    });
    if (keys.has(idempotencyKey)) {
      return directorFailure("malformed", "The plan contains a duplicate logical action.");
    }
    keys.add(idempotencyKey);
    const request: OcadeActionRequest = { ...actionBase, idempotencyKey };
    const requestIssue = validateOcadeActionRequest(request);
    if (requestIssue) {
      const code =
        requestIssue.includes("verification") || requestIssue.includes("postcondition")
          ? "unverifiable"
          : requestIssue.includes("rollback")
            ? "recovery_missing"
            : "malformed";
      return directorFailure(code, requestIssue, proposalAction.stepId);
    }

    let checkpoint: DirectedAction["checkpoint"] = null;
    if (tool.mutating && (risk === "medium" || risk === "high")) {
      if (!context.createCheckpoint) {
        return directorFailure(
          "checkpoint_failed",
          "A risky mutation requires a durable checkpoint before execution.",
          proposalAction.stepId,
        );
      }
      try {
        checkpoint = await context.createCheckpoint(actionBase);
        if (!isSafeId(checkpoint.checkpointId) || !isBoundedText(checkpoint.evidence)) {
          return directorFailure(
            "checkpoint_failed",
            "The recovery checkpoint did not return valid evidence.",
            proposalAction.stepId,
          );
        }
      } catch (cause) {
        return directorFailure(
          "checkpoint_failed",
          cause instanceof Error ? cause.message : "The recovery checkpoint failed.",
          proposalAction.stepId,
        );
      }
    }

    actions.push({
      request,
      authorizationGrantId: context.permission!.grantId,
      authorizationExpiresAt: context.permission!.expiresAt,
      checkpoint,
      ...(routeSelection ? { routeSelection } : {}),
    });
  }

  return {
    ok: true,
    data: { taskId: proposal.taskId, goal: proposal.goal, actions },
    evidence: `Director admitted ${actions.length} bounded, permission-checked action(s).`,
  };
}

/** The Brain can only return an untrusted proposal; the Director always mediates. */
export async function planBrainGoal(
  brain: OcadeBrain,
  goal: string,
  context: DirectorContext,
  signal?: AbortSignal,
): Promise<DirectorOutcome> {
  if (!isBoundedText(goal, 10_000)) return directorFailure("malformed", "The goal is invalid.");
  if (signal?.aborted) return directorFailure("malformed", "Planning was cancelled.");
  try {
    return await directBrainProposal(await brain.propose(goal, signal), context);
  } catch (cause) {
    return directorFailure(
      "malformed",
      cause instanceof Error ? cause.message : "The Brain did not return a proposal.",
    );
  }
}

export class HandsRegistry {
  private readonly executors = new Map<string, HandExecutor>();

  register(
    capability: string,
    route: ActionRoute,
    executorId: string,
    executor: HandExecutor,
  ): void {
    if (!isSafeId(capability) || !ROUTES.has(route) || !isSafeId(executorId)) {
      throw new Error("Hands registration requires safe capability, route and executor ids.");
    }
    this.executors.set(`${route}:${capability}`, executor);
  }

  get(request: OcadeActionRequest): HandExecutor | null {
    return this.executors.get(`${request.route}:${request.capability}`) ?? null;
  }
}

export class EyesRegistry {
  private readonly observers = new Map<string, EyeObserver>();

  register(observerId: string, observer: EyeObserver): void {
    if (!isSafeId(observerId)) throw new Error("Eyes registration requires a safe observer id.");
    this.observers.set(observerId, observer);
  }

  get(observerId: string): EyeObserver | null {
    return this.observers.get(observerId) ?? null;
  }
}

export class InMemoryControlJournal implements ControlJournal {
  private readonly entries = new Map<string, JournalEntry>();

  async lookup(idempotencyKey: string): Promise<JournalEntry | null> {
    return this.entries.get(idempotencyKey) ?? null;
  }

  async begin(entry: JournalEntry): Promise<boolean> {
    if (this.entries.has(entry.idempotencyKey)) return false;
    this.entries.set(entry.idempotencyKey, { ...entry, evidence: [...entry.evidence] });
    return true;
  }

  async complete(entry: JournalEntry): Promise<void> {
    const current = this.entries.get(entry.idempotencyKey);
    if (!current || current.actionId !== entry.actionId) {
      throw new Error("The idempotency journal lost ownership of this action.");
    }
    this.entries.set(entry.idempotencyKey, { ...entry, evidence: [...entry.evidence] });
  }
}

function observedMatches(postcondition: Postcondition, observation: EyeObservation): boolean {
  switch (postcondition.operator) {
    case "equals":
    case "sha256":
      return stableJson(observation.value) === stableJson(postcondition.expected);
    case "exists":
      return Boolean(observation.value) === Boolean(postcondition.expected);
    case "contains":
      return (
        typeof observation.value === "string" &&
        typeof postcondition.expected === "string" &&
        observation.value.includes(postcondition.expected)
      );
  }
}

/** Independent verifier: only Eyes observations can satisfy postconditions. */
export function verifyObservations(
  request: OcadeActionRequest,
  execution: HandExecution,
  observations: EyeObservation[],
): VerificationReceipt {
  const evidence: string[] = [];
  const missingPostconditions: string[] = [];
  const mismatchedPostconditions: string[] = [];

  for (const postcondition of request.expectedPostconditions) {
    const candidates = observations.filter(
      (observation) =>
        observation.postconditionId === postcondition.id &&
        observation.observerId !== execution.executorId,
    );
    if (candidates.length === 0) {
      missingPostconditions.push(postcondition.id);
      continue;
    }
    if (!candidates.some((observation) => observedMatches(postcondition, observation))) {
      mismatchedPostconditions.push(postcondition.id);
    }
    evidence.push(...candidates.map((observation) => observation.evidence));
  }
  const verified = missingPostconditions.length === 0 && mismatchedPostconditions.length === 0;
  return {
    verified,
    evidence:
      evidence.length > 0
        ? evidence
        : ["No independent observation established the expected postconditions."],
    observations,
    missingPostconditions,
    mismatchedPostconditions,
  };
}

function mergedAbortSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("Action timed out.")), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled."));
      return;
    }
    signal.addEventListener(
      "abort",
      () => reject(signal.reason instanceof Error ? signal.reason : new Error("Action cancelled.")),
      { once: true },
    );
  });
}

async function boundedCall<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return await Promise.race([work, waitForAbort(signal)]);
}

async function completeJournal(
  journal: ControlJournal,
  entry: JournalEntry,
): Promise<string | null> {
  try {
    await journal.complete(entry);
    return null;
  } catch (cause) {
    return cause instanceof Error
      ? cause.message
      : "The idempotency journal could not be completed.";
  }
}

function priorReceipt(request: OcadeActionRequest, entry: JournalEntry): VerificationReceipt {
  return {
    verified: true,
    evidence: entry.evidence,
    observations: [],
    missingPostconditions: [],
    mismatchedPostconditions: [],
  };
}

/**
 * Execute one already-directed action. Revalidation and authorization expiry
 * checks happen again at dispatch so a delayed plan cannot outlive its grant.
 */
export async function runDirectedAction(input: {
  action: DirectedAction;
  hands: HandsRegistry;
  eyes: EyesRegistry;
  journal: ControlJournal;
  signal?: AbortSignal;
  now?: Date;
}): Promise<ControlOutcome> {
  const request = input.action.request;
  const issue = validateOcadeActionRequest(request);
  if (issue) return { status: "refused", request, reason: issue };
  const now = input.now ?? new Date();
  if (
    !Number.isFinite(now.getTime()) ||
    now.getTime() >= Date.parse(input.action.authorizationExpiresAt)
  ) {
    return {
      status: "refused",
      request,
      reason: "The action authorization expired before dispatch.",
    };
  }
  if ((request.risk === "medium" || request.risk === "high") && !input.action.checkpoint) {
    return {
      status: "refused",
      request,
      reason: "The risky action has no durable pre-mutation checkpoint.",
    };
  }
  if (input.signal?.aborted)
    return { status: "refused", request, reason: "The action was cancelled." };

  const prior = await input.journal.lookup(request.idempotencyKey);
  if (prior?.status === "verified") {
    return { status: "replayed", request, receipt: priorReceipt(request, prior) };
  }
  if (prior) {
    return {
      status: "refused",
      request,
      reason:
        "This idempotency key already has an ambiguous or failed journal entry. Recover it before retrying.",
    };
  }

  const executor = input.hands.get(request);
  if (!executor) {
    return { status: "refused", request, reason: "No deterministic Hands executor is registered." };
  }
  const began = await input.journal.begin({
    idempotencyKey: request.idempotencyKey,
    actionId: request.actionId,
    status: "in_flight",
    evidence: ["Action admitted to the idempotency journal before dispatch."],
  });
  if (!began) {
    return { status: "refused", request, reason: "Concurrent duplicate action was refused." };
  }

  let execution: HandExecution | undefined;
  let lastFailure = "The Hands executor failed.";
  for (let attempt = 0; attempt <= request.retryBudget; attempt += 1) {
    const bounded = mergedAbortSignal(input.signal, request.timeoutMs);
    try {
      execution = await boundedCall(executor(request, bounded.signal), bounded.signal);
      if (
        !isSafeId(execution.executorId) ||
        execution.route !== request.route ||
        !Array.isArray(execution.evidence) ||
        execution.evidence.length === 0
      ) {
        throw new Error("The Hands executor returned malformed evidence.");
      }
      break;
    } catch (cause) {
      lastFailure = cause instanceof Error ? cause.message : "The Hands executor failed.";
      if (bounded.signal.aborted || attempt === request.retryBudget) break;
    } finally {
      bounded.dispose();
    }
  }
  if (!execution) {
    const entry: JournalEntry = {
      idempotencyKey: request.idempotencyKey,
      actionId: request.actionId,
      status: "failed",
      evidence: [lastFailure],
    };
    const journalFailure = await completeJournal(input.journal, entry);
    if (journalFailure)
      lastFailure = `${lastFailure} Journal completion also failed: ${journalFailure}`;
    return { status: "failed", request, reason: lastFailure };
  }

  const observations: EyeObservation[] = [];
  try {
    for (const step of request.verificationPlan) {
      const observer = input.eyes.get(step.observerId);
      if (!observer) throw new Error(`Independent observer "${step.observerId}" is unavailable.`);
      const bounded = mergedAbortSignal(input.signal, request.timeoutMs);
      try {
        const observed = await boundedCall(observer(request, step, bounded.signal), bounded.signal);
        if (
          !Array.isArray(observed) ||
          observed.some(
            (item) =>
              item.observerId !== step.observerId ||
              item.route !== step.route ||
              !step.postconditionIds.includes(item.postconditionId) ||
              !isBoundedText(item.evidence),
          )
        ) {
          throw new Error(`Observer "${step.observerId}" returned malformed evidence.`);
        }
        observations.push(...observed);
      } finally {
        bounded.dispose();
      }
    }
  } catch (cause) {
    const reason =
      cause instanceof Error ? cause.message : "Independent postcondition observation failed.";
    const journalFailure = await completeJournal(input.journal, {
      idempotencyKey: request.idempotencyKey,
      actionId: request.actionId,
      status: "unverified",
      evidence: [...execution.evidence, reason],
    });
    return {
      status: "unverified",
      request,
      execution,
      reason: journalFailure
        ? `${reason} Journal completion also failed: ${journalFailure}`
        : reason,
    };
  }

  const receipt = verifyObservations(request, execution, observations);
  const journalFailure = await completeJournal(input.journal, {
    idempotencyKey: request.idempotencyKey,
    actionId: request.actionId,
    status: receipt.verified ? "verified" : "unverified",
    evidence: [...execution.evidence, ...receipt.evidence],
  });
  if (journalFailure) {
    return {
      status: "failed",
      request,
      execution,
      receipt,
      reason: `The action completed, but its idempotency receipt was not durable: ${journalFailure}`,
    };
  }
  if (!receipt.verified) {
    return {
      status: "unverified",
      request,
      execution,
      receipt,
      reason: "Independent observations did not establish every expected postcondition.",
    };
  }
  return { status: "verified", request, execution, receipt };
}
