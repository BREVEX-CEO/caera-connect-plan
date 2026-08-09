/**
 * Connector Registry for the universal control fabric.
 *
 * A connector is a typed control surface, not a card the user has to choose.
 * The broker selects only observed healthy connectors whose capability, scope,
 * authentication, privacy and risk declarations match the current task. A
 * connector never bypasses the Director's permission or verification gates.
 */
import type { ActionRoute, RiskLevel } from "./control-plane";
import { universalRouteRank } from "./route-selector";

export type ConnectorKind =
  | "application_api"
  | "native_adapter"
  | "mcp"
  | "plugin"
  | "browser"
  | "filesystem"
  | "research"
  | "device";

export type ConnectorPrivacy = "on_device" | "private_network" | "cloud";
export type ConnectorAuthState = "not_required" | "ready" | "required" | "expired" | "failed";
export type ConnectorHealth = "unknown" | "healthy" | "degraded" | "failing" | "offline";

export interface ConnectorCapability {
  id: string;
  access: "read" | "write";
  risk: Exclude<RiskLevel, "protected">;
  requiredScopes: string[];
  verificationRoute: ActionRoute;
  reversible: boolean;
}

export interface ConnectorScope {
  appIds: string[];
  domains: string[];
  deviceIds: string[];
}

export interface ConnectorManifest {
  schemaVersion: 1;
  connectorId: string;
  displayName: string;
  kind: ConnectorKind;
  route: ActionRoute;
  capabilities: ConnectorCapability[];
  scope: ConnectorScope;
  auth: {
    state: ConnectorAuthState;
    requiredScopes: string[];
    humanControlledFields: Array<"password" | "otp" | "captcha" | "biometric" | "payment">;
  };
  availability: "online" | "offline" | "local_only";
  health: ConnectorHealth;
  latencyMs: number | null;
  privacy: ConnectorPrivacy;
  enabled: boolean;
  observedAt: string | null;
  evidence: string[];
}

export interface ConnectorRequirement {
  capabilityId: string;
  access: "read" | "write";
  maximumRisk: Exclude<RiskLevel, "protected">;
  grantedScopes: string[];
  appId?: string;
  domain?: string;
  deviceId?: string;
  online: boolean;
  allowedPrivacy: ConnectorPrivacy[];
}

export type ConnectorSelection =
  | {
      ok: true;
      connector: ConnectorManifest;
      capability: ConnectorCapability;
      evidence: string[];
    }
  | { ok: false; reason: string; evaluations: Array<{ connectorId: string; reasons: string[] }> };

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const KINDS = new Set<ConnectorKind>([
  "application_api",
  "native_adapter",
  "mcp",
  "plugin",
  "browser",
  "filesystem",
  "research",
  "device",
]);
const PRIVACY = new Set<ConnectorPrivacy>(["on_device", "private_network", "cloud"]);
const RISK_RANK: Record<Exclude<RiskLevel, "protected">, number> = {
  read: 0,
  low: 1,
  medium: 2,
  high: 3,
};
const PRIVACY_RANK: Record<ConnectorPrivacy, number> = {
  on_device: 0,
  private_network: 1,
  cloud: 2,
};

function boundedText(value: unknown, max = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function safeStringArray(value: unknown, maxItems = 100): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => boundedText(item, 500))
  );
}

function validManifest(manifest: ConnectorManifest): boolean {
  return (
    manifest.schemaVersion === 1 &&
    SAFE_ID.test(manifest.connectorId) &&
    boundedText(manifest.displayName) &&
    KINDS.has(manifest.kind) &&
    Array.isArray(manifest.capabilities) &&
    manifest.capabilities.length > 0 &&
    manifest.capabilities.length <= 100 &&
    manifest.capabilities.every(
      (capability) =>
        SAFE_ID.test(capability.id) &&
        ["read", "write"].includes(capability.access) &&
        RISK_RANK[capability.risk] !== undefined &&
        safeStringArray(capability.requiredScopes) &&
        typeof capability.reversible === "boolean",
    ) &&
    safeStringArray(manifest.scope.appIds) &&
    safeStringArray(manifest.scope.domains) &&
    safeStringArray(manifest.scope.deviceIds) &&
    safeStringArray(manifest.auth.requiredScopes) &&
    safeStringArray(manifest.auth.humanControlledFields) &&
    PRIVACY.has(manifest.privacy) &&
    (manifest.latencyMs === null ||
      (Number.isFinite(manifest.latencyMs) &&
        manifest.latencyMs >= 0 &&
        manifest.latencyMs <= 300_000)) &&
    Array.isArray(manifest.evidence) &&
    manifest.evidence.length <= 100 &&
    manifest.evidence.every((line) => boundedText(line, 2_000))
  );
}

function scopeMatches(values: string[], requested: string | undefined): boolean {
  if (!requested) return true;
  return values.includes("*") || values.includes(requested);
}

function requirementIssue(requirement: ConnectorRequirement): string | null {
  if (
    !SAFE_ID.test(requirement.capabilityId) ||
    !["read", "write"].includes(requirement.access) ||
    RISK_RANK[requirement.maximumRisk] === undefined ||
    !safeStringArray(requirement.grantedScopes) ||
    !Array.isArray(requirement.allowedPrivacy) ||
    requirement.allowedPrivacy.length === 0 ||
    !requirement.allowedPrivacy.every((privacy) => PRIVACY.has(privacy)) ||
    [requirement.appId, requirement.domain, requirement.deviceId]
      .filter((value) => value !== undefined)
      .some((value) => !boundedText(value))
  ) {
    return "The connector requirement is malformed or unbounded.";
  }
  return null;
}

export class ConnectorRegistry {
  private readonly manifests = new Map<string, ConnectorManifest>();

  register(manifest: ConnectorManifest): void {
    if (!validManifest(manifest)) throw new Error("Connector manifest is malformed or unbounded.");
    if (this.manifests.has(manifest.connectorId)) {
      throw new Error(`Connector ${manifest.connectorId} is already registered.`);
    }
    this.manifests.set(manifest.connectorId, structuredClone(manifest));
  }

  remove(connectorId: string): boolean {
    return this.manifests.delete(connectorId);
  }

  setEnabled(connectorId: string, enabled: boolean): void {
    const manifest = this.manifests.get(connectorId);
    if (!manifest) throw new Error("Connector is not registered.");
    manifest.enabled = enabled;
  }

  recordHealth(input: {
    connectorId: string;
    health: ConnectorHealth;
    latencyMs: number | null;
    observedAt: string;
    evidence: string;
  }): void {
    const manifest = this.manifests.get(input.connectorId);
    if (!manifest) throw new Error("Connector is not registered.");
    if (
      !["unknown", "healthy", "degraded", "failing", "offline"].includes(input.health) ||
      (input.latencyMs !== null &&
        (!Number.isFinite(input.latencyMs) || input.latencyMs < 0 || input.latencyMs > 300_000)) ||
      !Number.isFinite(Date.parse(input.observedAt)) ||
      !boundedText(input.evidence, 2_000)
    ) {
      throw new Error("Connector health evidence is malformed.");
    }
    manifest.health = input.health;
    manifest.latencyMs = input.latencyMs;
    manifest.observedAt = input.observedAt;
    manifest.evidence = [...manifest.evidence.slice(-98), input.evidence];
  }

  list(): ConnectorManifest[] {
    return [...this.manifests.values()]
      .map((manifest) => structuredClone(manifest))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  select(requirement: ConnectorRequirement): ConnectorSelection {
    const malformed = requirementIssue(requirement);
    if (malformed) return { ok: false, reason: malformed, evaluations: [] };
    const evaluated = [...this.manifests.values()].map((manifest) => {
      const reasons: string[] = [];
      const capability = manifest.capabilities.find(
        (item) => item.id === requirement.capabilityId && item.access === requirement.access,
      );
      if (!manifest.enabled) reasons.push("disabled");
      if (!capability) reasons.push("capability unavailable");
      if (!["healthy", "degraded"].includes(manifest.health)) reasons.push("health unavailable");
      if (manifest.auth.state !== "ready" && manifest.auth.state !== "not_required") {
        reasons.push("authentication not ready");
      }
      if (manifest.availability === "online" && !requirement.online)
        reasons.push("network offline");
      if (!requirement.allowedPrivacy.includes(manifest.privacy))
        reasons.push("privacy class refused");
      if (!scopeMatches(manifest.scope.appIds, requirement.appId))
        reasons.push("application scope mismatch");
      if (!scopeMatches(manifest.scope.domains, requirement.domain))
        reasons.push("domain scope mismatch");
      if (!scopeMatches(manifest.scope.deviceIds, requirement.deviceId))
        reasons.push("device scope mismatch");
      if (capability && RISK_RANK[capability.risk] > RISK_RANK[requirement.maximumRisk]) {
        reasons.push("risk exceeds task limit");
      }
      for (const scope of [
        ...manifest.auth.requiredScopes,
        ...(capability?.requiredScopes ?? []),
      ]) {
        if (!requirement.grantedScopes.includes(scope)) reasons.push(`scope ${scope} missing`);
      }
      return { manifest, capability, reasons: [...new Set(reasons)] };
    });
    const eligible = evaluated
      .filter(
        (entry): entry is typeof entry & { capability: ConnectorCapability } =>
          entry.reasons.length === 0 && entry.capability !== undefined,
      )
      .sort(
        (left, right) =>
          universalRouteRank(left.manifest.route) - universalRouteRank(right.manifest.route) ||
          PRIVACY_RANK[left.manifest.privacy] - PRIVACY_RANK[right.manifest.privacy] ||
          Number(left.manifest.health === "degraded") -
            Number(right.manifest.health === "degraded") ||
          (left.manifest.latencyMs ?? Number.MAX_SAFE_INTEGER) -
            (right.manifest.latencyMs ?? Number.MAX_SAFE_INTEGER) ||
          left.manifest.connectorId.localeCompare(right.manifest.connectorId),
      );
    const selected = eligible[0];
    if (!selected) {
      return {
        ok: false,
        reason: "No healthy connector satisfies capability, scope, auth, privacy and risk.",
        evaluations: evaluated.map((entry) => ({
          connectorId: entry.manifest.connectorId,
          reasons: entry.reasons,
        })),
      };
    }
    return {
      ok: true,
      connector: structuredClone(selected.manifest),
      capability: structuredClone(selected.capability),
      evidence: [
        `Selected ${selected.manifest.displayName} through ${selected.manifest.route}.`,
        ...selected.manifest.evidence,
      ],
    };
  }
}
