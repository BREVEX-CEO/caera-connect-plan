/**
 * Universal application-action route selection.
 *
 * The selector is deterministic and side-effect free. It ranks only interfaces
 * that the host has actually observed, then refuses any candidate that lacks
 * identity, permission, verification, recovery, health or recording evidence.
 * A lower route is a fallback, never an excuse to bypass a failed safety gate.
 */
import type { ActionRoute, OcadeAppIdentity, RiskLevel } from "./control-plane";

export const UNIVERSAL_ROUTE_ORDER: readonly ActionRoute[] = [
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
];

export type RouteHealth = "healthy" | "degraded" | "failing" | "unknown";
export type RouteFallbackPolicy = "automatic" | "explicit" | "never";

export interface UniversalRouteCandidate {
  candidateId: string;
  route: ActionRoute;
  interfaceId: string;
  available: boolean;
  /** APIs must be official; plug-ins and MCP bridges must be explicitly approved. */
  officialOrApproved: boolean;
  supportedAppIds: string[];
  versionPrefixes?: string[];
  taskTypes: string[];
  requiredPermissions: string[];
  confidence: number;
  expectedLatencyMs: number;
  verification: {
    route: ActionRoute;
    confidence: number;
    independent: boolean;
  };
  recovery: {
    route: ActionRoute;
    ready: boolean;
  } | null;
  health: RouteHealth;
  supportsRecording: boolean;
  fallbackPolicy?: RouteFallbackPolicy;
  evidence: string;
}

export interface RouteSelectionInput {
  appIdentity: OcadeAppIdentity;
  taskType: string;
  risk: RiskLevel;
  grantedPermissions: string[];
  recordingPreference: "video_on" | "video_off";
  candidates: UniversalRouteCandidate[];
  explicitCoordinateFallbackApproval?: boolean;
  minimumConfidence?: number;
  maxExpectedLatencyMs?: number;
}

export interface RouteEvaluation {
  candidateId: string;
  route: ActionRoute;
  rank: number;
  adequate: boolean;
  effectiveConfidence: number;
  expectedLatencyMs: number;
  reasons: string[];
}

export interface UniversalRouteDecision {
  candidateId: string;
  route: ActionRoute;
  interfaceId: string;
  confidence: number;
  expectedLatencyMs: number;
  verificationRoute: ActionRoute;
  recoveryRoute: ActionRoute | null;
  fallbackFrom: ActionRoute[];
  evidence: string[];
}

export type RouteSelectionOutcome =
  | {
      ok: true;
      data: UniversalRouteDecision;
      evaluations: RouteEvaluation[];
    }
  | {
      ok: false;
      code:
        | "malformed"
        | "identity_unresolved"
        | "protected"
        | "high_risk_coordinate_fallback"
        | "no_adequate_route";
      reason: string;
      evaluations: RouteEvaluation[];
    };

const ROUTES = new Set<ActionRoute>(UNIVERSAL_ROUTE_ORDER);
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const MAX_CANDIDATES = 100;
const COORDINATE_ROUTES = new Set<ActionRoute>(["vision", "input"]);
const RISKS = new Set<RiskLevel>(["read", "low", "medium", "high", "protected"]);

/** Plug-in and MCP are the same specification tier. */
export function universalRouteRank(route: ActionRoute): number {
  switch (route) {
    case "api":
      return 1;
    case "plugin":
    case "mcp":
      return 2;
    case "cli":
      return 3;
    case "file":
      return 4;
    case "dom":
      return 5;
    case "accessibility":
      return 6;
    case "native":
      return 7;
    case "vision":
      return 8;
    case "input":
      return 9;
  }
}

function boundedText(value: unknown, max = 500): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
  );
}

function validIdentity(identity: OcadeAppIdentity): boolean {
  return (
    SAFE_ID.test(identity.appId) &&
    [identity.executable, identity.product, identity.version, identity.windowId]
      .filter((value) => value !== undefined)
      .every((value) => boundedText(value)) &&
    (identity.browserOrigin === undefined ||
      (() => {
        try {
          const url = new URL(identity.browserOrigin);
          return url.origin === identity.browserOrigin && /^https?:$/.test(url.protocol);
        } catch {
          return false;
        }
      })())
  );
}

function finiteUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function minimumFor(risk: RiskLevel): number {
  switch (risk) {
    case "read":
      return 0.55;
    case "low":
      return 0.65;
    case "medium":
      return 0.78;
    case "high":
      return 0.9;
    case "protected":
      return 1;
  }
}

function isMutation(risk: RiskLevel): boolean {
  return risk !== "read";
}

function candidateShapeIssue(candidate: UniversalRouteCandidate): string | null {
  if (
    !SAFE_ID.test(candidate.candidateId) ||
    !SAFE_ID.test(candidate.interfaceId) ||
    !ROUTES.has(candidate.route) ||
    !ROUTES.has(candidate.verification.route) ||
    (candidate.recovery !== null && !ROUTES.has(candidate.recovery.route)) ||
    !Array.isArray(candidate.supportedAppIds) ||
    !Array.isArray(candidate.taskTypes) ||
    !Array.isArray(candidate.requiredPermissions) ||
    typeof candidate.available !== "boolean" ||
    typeof candidate.officialOrApproved !== "boolean" ||
    typeof candidate.verification.independent !== "boolean" ||
    (candidate.recovery !== null && typeof candidate.recovery.ready !== "boolean") ||
    typeof candidate.supportsRecording !== "boolean" ||
    candidate.supportedAppIds.length === 0 ||
    candidate.taskTypes.length === 0 ||
    !candidate.supportedAppIds.every((id) => SAFE_ID.test(id)) ||
    !candidate.taskTypes.every((type) => SAFE_ID.test(type)) ||
    !candidate.requiredPermissions.every((permission) => SAFE_ID.test(permission)) ||
    !(candidate.versionPrefixes ?? []).every((prefix) => boundedText(prefix, 100)) ||
    !finiteUnit(candidate.confidence) ||
    !finiteUnit(candidate.verification.confidence) ||
    !Number.isFinite(candidate.expectedLatencyMs) ||
    candidate.expectedLatencyMs < 0 ||
    candidate.expectedLatencyMs > 300_000 ||
    !boundedText(candidate.evidence, 2_000) ||
    !["healthy", "degraded", "failing", "unknown"].includes(candidate.health) ||
    !["automatic", "explicit", "never"].includes(candidate.fallbackPolicy ?? "automatic")
  ) {
    return "A route candidate has malformed or unbounded metadata.";
  }
  return null;
}

function evaluateCandidate(
  candidate: UniversalRouteCandidate,
  input: RouteSelectionInput,
  minimumRank: number,
): RouteEvaluation {
  const reasons: string[] = [];
  const rank = universalRouteRank(candidate.route);
  if (!candidate.available) reasons.push("interface unavailable");
  if (
    (candidate.route === "api" || candidate.route === "plugin" || candidate.route === "mcp") &&
    !candidate.officialOrApproved
  ) {
    reasons.push("interface is not official or approved");
  }
  if (!candidate.supportedAppIds.includes(input.appIdentity.appId)) {
    reasons.push("application identity mismatch");
  }
  if (
    candidate.versionPrefixes &&
    candidate.versionPrefixes.length > 0 &&
    (!input.appIdentity.version ||
      !candidate.versionPrefixes.some((prefix) => input.appIdentity.version!.startsWith(prefix)))
  ) {
    reasons.push("application version mismatch");
  }
  if (!candidate.taskTypes.includes(input.taskType)) {
    reasons.push("task type unsupported");
  }
  for (const permission of candidate.requiredPermissions) {
    if (!input.grantedPermissions.includes(permission)) {
      reasons.push(`permission ${permission} missing`);
    }
  }
  if (candidate.health === "failing") reasons.push("interface health is failing");
  if (input.recordingPreference === "video_on" && !candidate.supportsRecording) {
    reasons.push("route cannot honor the recording preference");
  }
  if (!candidate.verification.independent) {
    reasons.push("verification is not independent");
  }
  if (candidate.verification.confidence < 0.6) {
    reasons.push("verification confidence is inadequate");
  }
  if (isMutation(input.risk) && !candidate.recovery?.ready) {
    reasons.push("mutation recovery is not ready");
  }
  if (candidate.expectedLatencyMs > (input.maxExpectedLatencyMs ?? 30_000)) {
    reasons.push("expected latency exceeds the task limit");
  }

  const coordinate = COORDINATE_ROUTES.has(candidate.route);
  if (input.risk === "high" && coordinate) {
    reasons.push("high-risk mutation cannot downgrade to coordinate control");
  }
  const isFallback = rank > minimumRank;
  const fallbackPolicy = candidate.fallbackPolicy ?? "automatic";
  if (isFallback && fallbackPolicy === "never") {
    reasons.push("route policy forbids fallback use");
  }
  if (
    isFallback &&
    (fallbackPolicy === "explicit" || (coordinate && input.risk === "medium")) &&
    !input.explicitCoordinateFallbackApproval
  ) {
    reasons.push("explicit fallback approval is missing");
  }

  let effectiveConfidence = candidate.confidence;
  if (candidate.health === "degraded") effectiveConfidence -= 0.1;
  if (candidate.health === "unknown") effectiveConfidence -= 0.05;
  if (!candidate.versionPrefixes || candidate.versionPrefixes.length === 0) {
    effectiveConfidence -= 0.05;
  }
  if (candidate.route === "vision") effectiveConfidence -= 0.1;
  if (candidate.route === "input") effectiveConfidence -= 0.15;
  effectiveConfidence = Math.max(0, Math.min(1, effectiveConfidence));
  const threshold = Math.max(
    minimumFor(input.risk),
    Math.min(Math.max(input.minimumConfidence ?? 0, 0), 1),
  );
  if (effectiveConfidence < threshold) {
    reasons.push(`confidence below ${threshold.toFixed(2)}`);
  }
  return {
    candidateId: candidate.candidateId,
    route: candidate.route,
    rank,
    adequate: reasons.length === 0,
    effectiveConfidence: Number(effectiveConfidence.toFixed(3)),
    expectedLatencyMs: candidate.expectedLatencyMs,
    reasons,
  };
}

/**
 * Select the strongest adequate route. Failure evidence is retained so callers
 * can explain every skipped interface without pretending that it ran.
 */
export function selectUniversalRoute(input: RouteSelectionInput): RouteSelectionOutcome {
  if (
    !validIdentity(input.appIdentity) ||
    !SAFE_ID.test(input.taskType) ||
    !RISKS.has(input.risk) ||
    !["video_on", "video_off"].includes(input.recordingPreference) ||
    !Array.isArray(input.grantedPermissions) ||
    !input.grantedPermissions.every((permission) => SAFE_ID.test(permission)) ||
    (input.minimumConfidence !== undefined && !finiteUnit(input.minimumConfidence)) ||
    (input.maxExpectedLatencyMs !== undefined &&
      (!Number.isFinite(input.maxExpectedLatencyMs) ||
        input.maxExpectedLatencyMs <= 0 ||
        input.maxExpectedLatencyMs > 300_000)) ||
    (input.explicitCoordinateFallbackApproval !== undefined &&
      typeof input.explicitCoordinateFallbackApproval !== "boolean")
  ) {
    return {
      ok: false,
      code: "identity_unresolved",
      reason: "The application identity, task type or permission set is invalid.",
      evaluations: [],
    };
  }
  if (input.risk === "protected") {
    return {
      ok: false,
      code: "protected",
      reason: "Protected actions have no executable route.",
      evaluations: [],
    };
  }
  if (
    !Array.isArray(input.candidates) ||
    input.candidates.length === 0 ||
    input.candidates.length > MAX_CANDIDATES ||
    new Set(input.candidates.map((candidate) => candidate.candidateId)).size !==
      input.candidates.length
  ) {
    return {
      ok: false,
      code: "malformed",
      reason: "Route candidates must be non-empty, unique and bounded.",
      evaluations: [],
    };
  }
  for (const candidate of input.candidates) {
    const issue = candidateShapeIssue(candidate);
    if (issue) {
      return { ok: false, code: "malformed", reason: issue, evaluations: [] };
    }
  }

  const minimumRank = Math.min(
    ...input.candidates.map((candidate) => universalRouteRank(candidate.route)),
    10,
  );
  const evaluations = input.candidates
    .map((candidate) => evaluateCandidate(candidate, input, minimumRank))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.effectiveConfidence - a.effectiveConfidence ||
        a.expectedLatencyMs - b.expectedLatencyMs ||
        a.candidateId.localeCompare(b.candidateId),
    );
  const selectedEvaluation = evaluations.find((evaluation) => evaluation.adequate);
  if (!selectedEvaluation) {
    const highRiskCoordinate = evaluations.some(
      (evaluation) =>
        COORDINATE_ROUTES.has(evaluation.route) &&
        evaluation.reasons.includes("high-risk mutation cannot downgrade to coordinate control"),
    );
    return {
      ok: false,
      code: highRiskCoordinate ? "high_risk_coordinate_fallback" : "no_adequate_route",
      reason: highRiskCoordinate
        ? "No semantic route is adequate, and a high-risk mutation cannot silently downgrade to vision or keyboard/mouse input."
        : "No route has adequate identity, permission, confidence, verification, recovery, health and recording evidence.",
      evaluations,
    };
  }
  const selected = input.candidates.find(
    (candidate) => candidate.candidateId === selectedEvaluation.candidateId,
  )!;
  const fallbackFrom = evaluations
    .filter(
      (evaluation) =>
        evaluation.rank <= selectedEvaluation.rank &&
        evaluation.candidateId !== selectedEvaluation.candidateId &&
        !evaluation.adequate,
    )
    .map((evaluation) => evaluation.route);
  return {
    ok: true,
    data: {
      candidateId: selected.candidateId,
      route: selected.route,
      interfaceId: selected.interfaceId,
      confidence: selectedEvaluation.effectiveConfidence,
      expectedLatencyMs: selected.expectedLatencyMs,
      verificationRoute: selected.verification.route,
      recoveryRoute: selected.recovery?.route ?? null,
      fallbackFrom: [...new Set(fallbackFrom)],
      evidence: [
        `Selected ${selected.route} through ${selected.interfaceId} at confidence ${selectedEvaluation.effectiveConfidence.toFixed(3)}.`,
        selected.evidence,
        ...(fallbackFrom.length > 0
          ? [
              `Routed around inadequate higher interfaces: ${[...new Set(fallbackFrom)].join(", ")}.`,
            ]
          : []),
      ],
    },
    evaluations,
  };
}
