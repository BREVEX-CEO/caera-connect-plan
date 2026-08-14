/**
 * Unknown-App Learning and Application Digital Twins.
 *
 * This module is deliberately host-agnostic. The signed desktop companion (or
 * another approved host) supplies observations and performs a single bounded
 * action; this layer validates those facts, selects a safe route, rehearses,
 * requests task-scoped permission, verifies independently, compiles a private
 * fingerprint-bound recipe, and invalidates both twin and recipe on change.
 */
import type { ActionRoute, OcadeAppIdentity, RiskLevel } from "./action-contract";
import {
  selectUniversalRoute,
  type UniversalRouteCandidate,
  type UniversalRouteDecision,
} from "./route-selector";

export const UNKNOWN_APP_SUPPORT_LABELS = [
  "LIVE_TESTED",
  "VERIFIED_CONNECTOR",
  "PROBED_AND_REHEARSED",
  "GENERIC_DOM",
  "GENERIC_ACCESSIBILITY",
  "GENERIC_NATIVE",
  "VISION_FALLBACK",
  "FORMAT_ONLY",
  "CONNECTOR_REQUIRED",
  "PERMISSION_REQUIRED",
  "APPLICATION_REQUIRED",
  "UNAVAILABLE",
  "FAILED_VERIFICATION",
] as const;

export type UnknownAppSupportLabel = (typeof UNKNOWN_APP_SUPPORT_LABELS)[number];

export interface ProbedIdentity extends OcadeAppIdentity {
  executable: string;
  publisher: string;
  signature: "valid" | "invalid" | "unsigned" | "unknown";
  product: string;
  version: string;
}

export interface NamedAppNode {
  id: string;
  label: string;
}

export interface VerificationMethod {
  id: string;
  route: ActionRoute;
  independent: boolean;
  description: string;
}

export interface RecoveryMethod {
  id: string;
  route: ActionRoute;
  ready: boolean;
  description: string;
}

export interface TwinCapability {
  id: string;
  label: string;
  taskType: string;
  candidateIds: string[];
  requiredPermission: string;
  risk: RiskLevel;
  verificationMethodId: string;
  recoveryMethodId: string;
}

export interface UnknownAppProbe {
  identity: ProbedIdentity;
  environment: {
    locale: string;
    theme: string;
    displayScale: number;
    plugins: string[];
    layoutRevision: string;
  };
  windows: NamedAppNode[];
  views: NamedAppNode[];
  menus: NamedAppNode[];
  controls: NamedAppNode[];
  commands: NamedAppNode[];
  shortcuts: NamedAppNode[];
  projectFileTypes: string[];
  approvedLocalEvidence: {
    help: string[];
    logs: string[];
    projectFiles: string[];
  };
  interfaces: UniversalRouteCandidate[];
  capabilities: TwinCapability[];
  protectedAreas: string[];
  destructiveAreas: string[];
  errorStates: NamedAppNode[];
  verificationMethods: VerificationMethod[];
  recoveryMethods: RecoveryMethod[];
  resourceProfile: {
    cpu: "low" | "medium" | "high";
    memoryMb: number;
    gpuRequired: boolean;
  };
  compatibilityConstraints: string[];
  evidence: string[];
}

export interface ApplicationDigitalTwin {
  schemaVersion: 1;
  identity: ProbedIdentity;
  compatibleVersions: string[];
  fingerprint: string;
  environment: UnknownAppProbe["environment"];
  windows: NamedAppNode[];
  views: NamedAppNode[];
  menus: NamedAppNode[];
  controls: NamedAppNode[];
  commands: NamedAppNode[];
  shortcuts: NamedAppNode[];
  projectFileTypes: string[];
  approvedLocalEvidence: UnknownAppProbe["approvedLocalEvidence"];
  capabilityGraph: TwinCapability[];
  protectedAreas: string[];
  destructiveAreas: string[];
  commonWorkflows: string[];
  errorStates: NamedAppNode[];
  verificationMethods: VerificationMethod[];
  recoveryMethods: RecoveryMethod[];
  resourceProfile: UnknownAppProbe["resourceProfile"];
  knownAdapterRoutes: {
    candidateId: string;
    route: ActionRoute;
    interfaceId: string;
  }[];
  confidence: number;
  learnedAt: string;
  lastVerification: string | null;
  compatibilityConstraints: string[];
  supportLabel: UnknownAppSupportLabel;
  evidence: string[];
}

export interface CompiledPrivateSkill {
  schemaVersion: 1;
  skillId: string;
  private: true;
  appId: string;
  compatibleVersions: string[];
  trigger: string;
  taskPattern: string;
  requiredFingerprint: string;
  preconditions: string[];
  permissions: string[];
  actions: {
    capabilityId: string;
    route: ActionRoute;
    interfaceId: string;
  }[];
  verification: {
    methodId: string;
    independent: true;
  };
  failureHandling: string[];
  recovery: {
    methodId: string;
    ready: true;
  };
  testFixtures: string[];
  evidence: string[];
  invalidatingChanges: readonly [
    "version",
    "plugins",
    "locale",
    "theme",
    "display_scale",
    "layout",
  ];
  compiledAt: string;
}

export interface RehearsalEvidence {
  safe: boolean;
  mode: "temporary_file" | "duplicate_project" | "undoable_action" | "no_op";
  fixtureId: string;
  evidence: string;
}

export interface ScopedPermissionEvidence {
  granted: boolean;
  grantId: string;
  appId: string;
  permissions: string[];
  expiresAt: string;
  evidence: string;
}

export interface BoundedExecutionEvidence {
  executed: boolean;
  executionId: string;
  startedAt: string;
  finishedAt: string;
  evidence: string;
  outputDigest: string;
}

export interface IndependentVerificationEvidence {
  verified: boolean;
  methodId: string;
  observedAt: string;
  evidence: string;
}

export interface RecoveryEvidence {
  recovered: boolean;
  methodId: string;
  evidence: string;
}

export interface UnknownAppHost {
  probe(app: OcadeAppIdentity, signal?: AbortSignal): Promise<UnknownAppProbe>;
  rehearse(
    twin: ApplicationDigitalTwin,
    capability: TwinCapability,
    route: UniversalRouteDecision,
    signal?: AbortSignal,
  ): Promise<RehearsalEvidence>;
  requestPermission(input: {
    appId: string;
    taskId: string;
    capabilityId: string;
    permissions: string[];
    risk: RiskLevel;
  }): Promise<ScopedPermissionEvidence>;
  execute(
    input: {
      twin: ApplicationDigitalTwin;
      capability: TwinCapability;
      route: UniversalRouteDecision;
      permission: ScopedPermissionEvidence;
    },
    signal?: AbortSignal,
  ): Promise<BoundedExecutionEvidence>;
  verify(
    input: {
      twin: ApplicationDigitalTwin;
      capability: TwinCapability;
      execution: BoundedExecutionEvidence;
      method: VerificationMethod;
    },
    signal?: AbortSignal,
  ): Promise<IndependentVerificationEvidence>;
  recover(
    input: {
      twin: ApplicationDigitalTwin;
      capability: TwinCapability;
      execution: BoundedExecutionEvidence | null;
      method: RecoveryMethod;
    },
    signal?: AbortSignal,
  ): Promise<RecoveryEvidence>;
}

export interface TwinInvalidation {
  appId: string;
  priorFingerprint: string;
  observedFingerprint: string;
  reason: string;
  invalidatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A bounded private cache. A persistent host can implement the same contract. */
export class ApplicationTwinCache {
  private readonly twins = new Map<string, ApplicationDigitalTwin>();
  private readonly skills = new Map<string, CompiledPrivateSkill>();
  private readonly invalidations: TwinInvalidation[] = [];

  saveTwin(twin: ApplicationDigitalTwin): void {
    this.twins.set(twin.identity.appId, clone(twin));
  }

  getTwin(appId: string): ApplicationDigitalTwin | null {
    const twin = this.twins.get(appId);
    return twin ? clone(twin) : null;
  }

  saveSkill(skill: CompiledPrivateSkill): void {
    if (!skill.private) throw new Error("Learned application skills must remain private.");
    this.skills.set(skill.skillId, clone(skill));
  }

  getSkills(appId: string): CompiledPrivateSkill[] {
    return [...this.skills.values()].filter((skill) => skill.appId === appId).map(clone);
  }

  invalidate(
    appId: string,
    observedFingerprint: string,
    reason: string,
    now: Date,
  ): TwinInvalidation | null {
    const prior = this.twins.get(appId);
    if (!prior) return null;
    const event: TwinInvalidation = {
      appId,
      priorFingerprint: prior.fingerprint,
      observedFingerprint,
      reason,
      invalidatedAt: now.toISOString(),
    };
    this.twins.delete(appId);
    for (const [skillId, skill] of this.skills) {
      if (skill.appId === appId) this.skills.delete(skillId);
    }
    this.invalidations.push(event);
    return clone(event);
  }

  listInvalidations(): TwinInvalidation[] {
    return this.invalidations.map(clone);
  }
}

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const MAX_ITEMS = 500;
const INVALIDATING_CHANGES = [
  "version",
  "plugins",
  "locale",
  "theme",
  "display_scale",
  "layout",
] as const;

function isBoundedText(value: unknown, max = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function validNodes(nodes: NamedAppNode[]): boolean {
  const ids = new Set<string>();
  return (
    Array.isArray(nodes) &&
    nodes.length <= MAX_ITEMS &&
    nodes.every((node) => {
      if (!node || !SAFE_ID.test(node.id) || ids.has(node.id) || !isBoundedText(node.label, 200)) {
        return false;
      }
      ids.add(node.id);
      return true;
    })
  );
}

function validTexts(values: string[], max = 500): boolean {
  return (
    Array.isArray(values) &&
    values.length <= MAX_ITEMS &&
    values.every((value) => isBoundedText(value, max))
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Structural cache key; not an authorization or content-integrity signature. */
export function fingerprintUnknownApp(probe: UnknownAppProbe): string {
  return `uat1:${fnv1a(
    stableJson({
      executable: probe.identity.executable,
      publisher: probe.identity.publisher,
      signature: probe.identity.signature,
      product: probe.identity.product,
      version: probe.identity.version,
      locale: probe.environment.locale,
      theme: probe.environment.theme,
      displayScale: probe.environment.displayScale,
      plugins: [...probe.environment.plugins].sort(),
      layoutRevision: probe.environment.layoutRevision,
      windows: probe.windows.map((item) => item.id).sort(),
      views: probe.views.map((item) => item.id).sort(),
      menus: probe.menus.map((item) => item.id).sort(),
      controls: probe.controls.map((item) => item.id).sort(),
      commands: probe.commands.map((item) => item.id).sort(),
      shortcuts: probe.shortcuts.map((item) => item.id).sort(),
      interfaces: probe.interfaces
        .map((candidate) => `${candidate.candidateId}:${candidate.route}`)
        .sort(),
    }),
  )}`;
}

function validateProbe(app: OcadeAppIdentity, probe: UnknownAppProbe): string | null {
  if (
    !probe ||
    !probe.identity ||
    probe.identity.appId !== app.appId ||
    (app.version !== undefined && probe.identity.version !== app.version) ||
    !SAFE_ID.test(probe.identity.appId) ||
    !isBoundedText(probe.identity.executable) ||
    !isBoundedText(probe.identity.publisher) ||
    !["valid", "invalid", "unsigned", "unknown"].includes(probe.identity.signature) ||
    !isBoundedText(probe.identity.product) ||
    !isBoundedText(probe.identity.version, 100)
  ) {
    return "The probe returned a malformed or mismatched application identity.";
  }
  if (
    !isBoundedText(probe.environment.locale, 100) ||
    !isBoundedText(probe.environment.theme, 100) ||
    !Number.isFinite(probe.environment.displayScale) ||
    probe.environment.displayScale < 0.5 ||
    probe.environment.displayScale > 8 ||
    !validTexts(probe.environment.plugins, 200) ||
    !isBoundedText(probe.environment.layoutRevision, 200)
  ) {
    return "The probe returned malformed locale, theme, scale, plug-in or layout evidence.";
  }
  if (
    !validNodes(probe.windows) ||
    !validNodes(probe.views) ||
    !validNodes(probe.menus) ||
    !validNodes(probe.controls) ||
    !validNodes(probe.commands) ||
    !validNodes(probe.shortcuts) ||
    !validNodes(probe.errorStates) ||
    probe.windows.length === 0 ||
    probe.controls.length === 0
  ) {
    return "The probe did not return a bounded structural application map.";
  }
  if (
    !validTexts(probe.projectFileTypes, 50) ||
    !validTexts(probe.approvedLocalEvidence.help) ||
    !validTexts(probe.approvedLocalEvidence.logs) ||
    !validTexts(probe.approvedLocalEvidence.projectFiles) ||
    !validTexts(probe.protectedAreas) ||
    !validTexts(probe.destructiveAreas) ||
    !validTexts(probe.compatibilityConstraints) ||
    !validTexts(probe.evidence, 2_000)
  ) {
    return "The probe returned malformed or unbounded local evidence.";
  }
  if (
    !Number.isInteger(probe.resourceProfile.memoryMb) ||
    probe.resourceProfile.memoryMb < 1 ||
    probe.resourceProfile.memoryMb > 1_048_576 ||
    !["low", "medium", "high"].includes(probe.resourceProfile.cpu) ||
    typeof probe.resourceProfile.gpuRequired !== "boolean"
  ) {
    return "The probe returned an invalid resource profile.";
  }

  const candidateIds = new Set(probe.interfaces.map((item) => item.candidateId));
  const verificationIds = new Set(probe.verificationMethods.map((item) => item.id));
  const recoveryIds = new Set(probe.recoveryMethods.map((item) => item.id));
  if (
    probe.interfaces.length === 0 ||
    candidateIds.size !== probe.interfaces.length ||
    probe.verificationMethods.length === 0 ||
    verificationIds.size !== probe.verificationMethods.length ||
    probe.recoveryMethods.length === 0 ||
    recoveryIds.size !== probe.recoveryMethods.length ||
    !probe.verificationMethods.every(
      (method) =>
        SAFE_ID.test(method.id) && method.independent && isBoundedText(method.description),
    ) ||
    !probe.recoveryMethods.every(
      (method) => SAFE_ID.test(method.id) && method.ready && isBoundedText(method.description),
    ) ||
    probe.capabilities.length === 0 ||
    probe.capabilities.length > MAX_ITEMS ||
    !probe.capabilities.every(
      (capability) =>
        SAFE_ID.test(capability.id) &&
        isBoundedText(capability.label, 200) &&
        SAFE_ID.test(capability.taskType) &&
        SAFE_ID.test(capability.requiredPermission) &&
        capability.candidateIds.length > 0 &&
        capability.candidateIds.every((id) => candidateIds.has(id)) &&
        verificationIds.has(capability.verificationMethodId) &&
        recoveryIds.has(capability.recoveryMethodId),
    )
  ) {
    return "The probe did not produce a closed capability, verification and recovery graph.";
  }
  return null;
}

export type TwinBuildOutcome =
  { ok: true; data: ApplicationDigitalTwin } | { ok: false; reason: string };

export function buildApplicationDigitalTwin(input: {
  app: OcadeAppIdentity;
  probe: UnknownAppProbe;
  now?: Date;
}): TwinBuildOutcome {
  const issue = validateProbe(input.app, input.probe);
  if (issue) return { ok: false, reason: issue };
  const now = input.now ?? new Date();
  const probe = clone(input.probe);
  const twin: ApplicationDigitalTwin = {
    schemaVersion: 1,
    identity: probe.identity,
    compatibleVersions: [probe.identity.version],
    fingerprint: fingerprintUnknownApp(probe),
    environment: probe.environment,
    windows: probe.windows,
    views: probe.views,
    menus: probe.menus,
    controls: probe.controls,
    commands: probe.commands,
    shortcuts: probe.shortcuts,
    projectFileTypes: probe.projectFileTypes,
    approvedLocalEvidence: probe.approvedLocalEvidence,
    capabilityGraph: probe.capabilities,
    protectedAreas: probe.protectedAreas,
    destructiveAreas: probe.destructiveAreas,
    commonWorkflows: [...new Set(probe.capabilities.map((capability) => capability.taskType))],
    errorStates: probe.errorStates,
    verificationMethods: probe.verificationMethods,
    recoveryMethods: probe.recoveryMethods,
    resourceProfile: probe.resourceProfile,
    knownAdapterRoutes: probe.interfaces.map((candidate) => ({
      candidateId: candidate.candidateId,
      route: candidate.route,
      interfaceId: candidate.interfaceId,
    })),
    confidence: 0.62,
    learnedAt: now.toISOString(),
    lastVerification: null,
    compatibilityConstraints: probe.compatibilityConstraints,
    supportLabel: "PERMISSION_REQUIRED",
    evidence: probe.evidence,
  };
  return { ok: true, data: twin };
}

export type LearnUnknownAppOutcome =
  | { status: "learned"; twin: ApplicationDigitalTwin; evidence: string[] }
  | { status: "refused" | "failed"; reason: string };

export async function learnUnknownApplication(input: {
  app: OcadeAppIdentity;
  approved: boolean;
  host: Pick<UnknownAppHost, "probe">;
  cache: ApplicationTwinCache;
  now?: Date;
  signal?: AbortSignal;
}): Promise<LearnUnknownAppOutcome> {
  if (!input.approved) {
    return {
      status: "refused",
      reason: "Unknown-application inspection requires explicit approval.",
    };
  }
  if (input.signal?.aborted) {
    return { status: "refused", reason: "Unknown-application learning was cancelled." };
  }
  try {
    const probe = await input.host.probe(input.app, input.signal);
    if (input.signal?.aborted) {
      return { status: "refused", reason: "Unknown-application learning was cancelled." };
    }
    const built = buildApplicationDigitalTwin({
      app: input.app,
      probe,
      now: input.now,
    });
    if (!built.ok) return { status: "failed", reason: built.reason };
    input.cache.saveTwin(built.data);
    return {
      status: "learned",
      twin: built.data,
      evidence: [
        ...built.data.evidence,
        `Application twin ${built.data.fingerprint} cached without document contents.`,
      ],
    };
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? `Application probing failed: ${error.message}`
          : "Application probing failed.",
    };
  }
}

function compilePrivateSkill(input: {
  twin: ApplicationDigitalTwin;
  taskPattern: string;
  capability: TwinCapability;
  route: UniversalRouteDecision;
  permission: ScopedPermissionEvidence;
  rehearsal: RehearsalEvidence;
  verification: IndependentVerificationEvidence;
  recovery: RecoveryMethod;
  now: Date;
}): CompiledPrivateSkill {
  return {
    schemaVersion: 1,
    skillId: `private:${input.twin.identity.appId}:${input.capability.id}`,
    private: true,
    appId: input.twin.identity.appId,
    compatibleVersions: [input.twin.identity.version],
    trigger: input.capability.label,
    taskPattern: input.taskPattern,
    requiredFingerprint: input.twin.fingerprint,
    preconditions: [
      `application:${input.twin.identity.appId}`,
      `version:${input.twin.identity.version}`,
      `fingerprint:${input.twin.fingerprint}`,
    ],
    permissions: input.permission.permissions,
    actions: [
      {
        capabilityId: input.capability.id,
        route: input.route.route,
        interfaceId: input.route.interfaceId,
      },
    ],
    verification: {
      methodId: input.verification.methodId,
      independent: true,
    },
    failureHandling: [
      "Stop on cancellation, stale fingerprint or failed independent verification.",
      "Never replay an ambiguous mutation.",
    ],
    recovery: { methodId: input.recovery.id, ready: true },
    testFixtures: [input.rehearsal.fixtureId],
    evidence: [input.rehearsal.evidence, ...input.route.evidence, input.verification.evidence],
    invalidatingChanges: INVALIDATING_CHANGES,
    compiledAt: input.now.toISOString(),
  };
}

export type OperateLearnedAppOutcome =
  | {
      status: "verified";
      twin: ApplicationDigitalTwin;
      skill: CompiledPrivateSkill;
      route: UniversalRouteDecision;
      rehearsal: RehearsalEvidence;
      execution: BoundedExecutionEvidence;
      verification: IndependentVerificationEvidence;
    }
  | {
      status: "missing" | "stale" | "refused" | "failed" | "failed_verification";
      reason: string;
      invalidation?: TwinInvalidation;
      recovery?: RecoveryEvidence;
    };

export async function operateLearnedApplication(input: {
  app: OcadeAppIdentity;
  taskId: string;
  taskPattern: string;
  capabilityId: string;
  host: UnknownAppHost;
  cache: ApplicationTwinCache;
  recordingPreference: "video_on" | "video_off";
  explicitCoordinateFallbackApproval?: boolean;
  now?: Date;
  signal?: AbortSignal;
}): Promise<OperateLearnedAppOutcome> {
  const now = input.now ?? new Date();
  const twin = input.cache.getTwin(input.app.appId);
  if (!twin) {
    return { status: "missing", reason: "No learned application twin is available." };
  }
  if (input.signal?.aborted) {
    return { status: "refused", reason: "The learned action was cancelled." };
  }

  let currentProbe: UnknownAppProbe;
  try {
    currentProbe = await input.host.probe(input.app, input.signal);
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? `Freshness probing failed: ${error.message}`
          : "Freshness probing failed.",
    };
  }
  const probeIssue = validateProbe(input.app, currentProbe);
  if (probeIssue) return { status: "failed", reason: probeIssue };
  const observedFingerprint = fingerprintUnknownApp(currentProbe);
  if (observedFingerprint !== twin.fingerprint) {
    const invalidation = input.cache.invalidate(
      input.app.appId,
      observedFingerprint,
      "Version, plug-in, locale, theme, display scale or structural layout changed.",
      now,
    );
    return {
      status: "stale",
      reason:
        "The learned application fingerprint is stale. Its twin and compiled skills were invalidated; relearn before acting.",
      invalidation: invalidation ?? undefined,
    };
  }

  const capability = twin.capabilityGraph.find((item) => item.id === input.capabilityId);
  if (!capability) {
    return { status: "refused", reason: "The learned twin has no exact capability match." };
  }
  const candidates = currentProbe.interfaces.filter((candidate) =>
    capability.candidateIds.includes(candidate.candidateId),
  );
  const preflight = selectUniversalRoute({
    appIdentity: twin.identity,
    taskType: capability.taskType,
    risk: capability.risk,
    grantedPermissions: [capability.requiredPermission],
    recordingPreference: input.recordingPreference,
    candidates,
    explicitCoordinateFallbackApproval: input.explicitCoordinateFallbackApproval,
  });
  if (!preflight.ok) {
    return {
      status: "refused",
      reason: `No safe learned route is available: ${preflight.reason}`,
    };
  }

  let rehearsal: RehearsalEvidence;
  try {
    rehearsal = await input.host.rehearse(twin, capability, preflight.data, input.signal);
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? `Rehearsal failed: ${error.message}` : "Rehearsal failed.",
    };
  }
  if (
    !rehearsal.safe ||
    !isBoundedText(rehearsal.fixtureId) ||
    !isBoundedText(rehearsal.evidence, 2_000)
  ) {
    return {
      status: "refused",
      reason: "The bounded rehearsal did not prove the step safe to attempt.",
    };
  }

  const permission = await input.host.requestPermission({
    appId: twin.identity.appId,
    taskId: input.taskId,
    capabilityId: capability.id,
    permissions: [capability.requiredPermission],
    risk: capability.risk,
  });
  const expiresAt = Date.parse(permission.expiresAt);
  if (
    !permission.granted ||
    permission.appId !== twin.identity.appId ||
    !permission.permissions.includes(capability.requiredPermission) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime()
  ) {
    return {
      status: "refused",
      reason: "The task-scoped application permission was denied, mismatched or expired.",
    };
  }
  if (input.signal?.aborted) {
    return { status: "refused", reason: "The learned action was cancelled." };
  }

  const verificationMethod = twin.verificationMethods.find(
    (method) => method.id === capability.verificationMethodId,
  )!;
  const recoveryMethod = twin.recoveryMethods.find(
    (method) => method.id === capability.recoveryMethodId,
  )!;
  let execution: BoundedExecutionEvidence | null = null;
  try {
    execution = await input.host.execute(
      { twin, capability, route: preflight.data, permission },
      input.signal,
    );
    if (
      !execution.executed ||
      !isBoundedText(execution.executionId) ||
      !isBoundedText(execution.outputDigest) ||
      Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)
    ) {
      throw new Error("The executor did not return bounded completion evidence.");
    }
    const verification = await input.host.verify(
      { twin, capability, execution, method: verificationMethod },
      input.signal,
    );
    if (
      !verification.verified ||
      verification.methodId !== verificationMethod.id ||
      !verificationMethod.independent ||
      Date.parse(verification.observedAt) < Date.parse(execution.finishedAt)
    ) {
      const recovery = await input.host.recover(
        { twin, capability, execution, method: recoveryMethod },
        input.signal,
      );
      return {
        status: "failed_verification",
        reason:
          "The action was not independently verified. Recovery was attempted and no skill was compiled.",
        recovery,
      };
    }

    const verifiedTwin: ApplicationDigitalTwin = {
      ...twin,
      confidence: Math.min(0.84, Number((twin.confidence + 0.12).toFixed(2))),
      lastVerification: verification.observedAt,
      supportLabel: "PROBED_AND_REHEARSED",
      evidence: [...twin.evidence, rehearsal.evidence, verification.evidence],
    };
    const skill = compilePrivateSkill({
      twin: verifiedTwin,
      taskPattern: input.taskPattern,
      capability,
      route: preflight.data,
      permission,
      rehearsal,
      verification,
      recovery: recoveryMethod,
      now,
    });
    input.cache.saveTwin(verifiedTwin);
    input.cache.saveSkill(skill);
    return {
      status: "verified",
      twin: verifiedTwin,
      skill,
      route: preflight.data,
      rehearsal,
      execution,
      verification,
    };
  } catch (error) {
    let recovery: RecoveryEvidence | undefined;
    try {
      recovery = await input.host.recover(
        { twin, capability, execution, method: recoveryMethod },
        input.signal,
      );
    } catch {
      recovery = {
        recovered: false,
        methodId: recoveryMethod.id,
        evidence: "Recovery host failed.",
      };
    }
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? `The bounded learned action failed: ${error.message}`
          : "The bounded learned action failed.",
      recovery,
    };
  }
}

export type UnknownAppCycleOutcome =
  | {
      status: "verified";
      twin: ApplicationDigitalTwin;
      skill: CompiledPrivateSkill;
    }
  | { status: "refused" | "failed"; reason: string };

/** Complete approved learn -> rehearse -> operate -> verify -> compile cycle. */
export async function runUnknownAppLearningCycle(input: {
  app: OcadeAppIdentity;
  approved: boolean;
  taskId: string;
  taskPattern: string;
  capabilityId: string;
  host: UnknownAppHost;
  cache: ApplicationTwinCache;
  recordingPreference: "video_on" | "video_off";
  explicitCoordinateFallbackApproval?: boolean;
  now?: Date;
  signal?: AbortSignal;
}): Promise<UnknownAppCycleOutcome> {
  const learned = await learnUnknownApplication(input);
  if (learned.status !== "learned") return learned;
  const operated = await operateLearnedApplication(input);
  if (operated.status !== "verified") {
    return {
      status: operated.status === "refused" ? "refused" : "failed",
      reason: operated.reason,
    };
  }
  return { status: "verified", twin: operated.twin, skill: operated.skill };
}

export const UNKNOWN_APP_LEARNING_REALITY =
  "Unknown-App Learning can probe, rehearse, verify and compile a private version-bound recipe only through an approved runtime host. PROBED_AND_REHEARSED is not LIVE_TESTED; any version, plug-in, locale, theme, scale or layout change invalidates the twin and its recipes before execution.";
