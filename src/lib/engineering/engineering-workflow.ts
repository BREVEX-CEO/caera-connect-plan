/**
 * CAD/CAE application control (Stage 2, Phase 31).
 *
 * This boundary treats geometry and solver work as engineering evidence, not
 * ordinary UI automation. Work happens only in a verified duplicate; units and
 * every declared assumption are compared before and after; exports are checked
 * from exact bytes and independently reopened; solver conclusions require real
 * installed-application evidence and parsed result files.
 */
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_COMMAND_CHARS = 1_000_000;
const MAX_EXPORT_BYTES = 500 * 1024 * 1024;
const MAX_EXPORTS = 20;

export type EngineeringRoute =
  | "official_api"
  | "plugin"
  | "macro"
  | "script"
  | "cli"
  | "project_file"
  | "accessibility"
  | "vision_input";

export const CAD_ROUTE_ORDER: readonly EngineeringRoute[] = [
  "official_api",
  "plugin",
  "macro",
  "script",
  "cli",
  "project_file",
  "accessibility",
  "vision_input",
];

export type EngineeringEvidenceClass = "deterministic_fixture" | "installed_application";

export type EngineeringUnitSystem =
  "si_mm_kg_s" | "si_m_kg_s" | "imperial_in_lbf_s" | "imperial_ft_lbf_s";

export interface EngineeringRouteCapability {
  route: EngineeringRoute;
  available: boolean;
  approved: boolean;
  confidence: number;
  supportsMutation: boolean;
  supportsIndependentVerification: boolean;
  supportsRecovery: boolean;
  evidence: string;
}

export interface EngineeringAdapterStatus {
  appId: string;
  product: string;
  version: string;
  installed: boolean;
  executable: string;
  publisher: string;
  signatureVerified: boolean;
  licenceVerified: boolean;
  evidenceClass: EngineeringEvidenceClass;
  routes: EngineeringRouteCapability[];
  supportedFormats: EngineeringExportFormat[];
  evidence: string;
}

export interface EngineeringProjectRef {
  projectId: string;
  path: string;
  format: string;
}

export interface EngineeringWorkingCopy {
  copyId: string;
  sourceProjectId: string;
  sourceSha256: string;
  path: string;
  sha256: string;
  byteLength: number;
  createdAt: string;
  evidence: string;
}

export type EngineeringValues = Record<string, string | number | boolean>;

export interface EngineeringAssumptions {
  unitSystem: EngineeringUnitSystem;
  dimensions: Record<string, number>;
  materials: Record<string, string>;
  contacts: Record<string, string>;
  constraints: Record<string, string>;
  loads: Record<string, number>;
  boundaryConditions: Record<string, string>;
  tolerances: Record<string, number>;
}

export interface EngineeringModelObservation extends EngineeringAssumptions {
  projectSha256: string;
  features: number;
  rebuildSucceeded: boolean;
  failedConstraints: string[];
  underconstrainedSketches: string[];
  invalidReferences: string[];
  warnings: string[];
  errors: string[];
  evidence: string;
}

export type EngineeringExportFormat = "step" | "stl" | "dxf" | "dwg";

export interface EngineeringExport {
  name: string;
  format: EngineeringExportFormat;
  bytes: Uint8Array;
  sha256: string;
  byteLength: number;
}

export interface EngineeringExportObservation {
  name: string;
  format: EngineeringExportFormat;
  sha256: string;
  reopened: boolean;
  unitSystem: EngineeringUnitSystem;
  dimensions: Record<string, number>;
  entityCount: number;
  errors: string[];
  evidence: string;
}

export interface SolverExecutionObservation {
  launched: boolean;
  licenceVerified: boolean;
  normalTermination: boolean;
  logSha256: string;
  resultNames: string[];
  evidence: string;
}

export interface SolverResultObservation {
  normalTermination: boolean;
  metrics: Record<string, { value: number; unit: string; source: "solver_log" | "result_file" }>;
  resultSha256: Record<string, string>;
  warnings: string[];
  errors: string[];
  evidence: string;
}

export interface EngineeringExecutionObservation {
  route: EngineeringRoute;
  isolated: boolean;
  networkDenied: boolean;
  readScopeEnforced: boolean;
  writeScopeEnforced: boolean;
  processTreeTerminated: boolean;
  exitCode: number;
  cancelled: boolean;
  timedOut: boolean;
  outputNames: string[];
  originalProjectSha256: string;
  solver: SolverExecutionObservation | null;
  startedAt: string;
  finishedAt: string;
  evidence: string;
}

export interface EngineeringAdapterHost {
  probe(signal?: AbortSignal): Promise<EngineeringAdapterStatus>;
  duplicateProject(
    project: EngineeringProjectRef,
    workingPath: string,
    signal?: AbortSignal,
  ): Promise<EngineeringWorkingCopy>;
  verifyWorkingCopy(
    copy: EngineeringWorkingCopy,
    signal?: AbortSignal,
  ): Promise<{ verified: boolean; evidence: string }>;
  inspectModel(
    copy: EngineeringWorkingCopy,
    signal?: AbortSignal,
  ): Promise<EngineeringModelObservation>;
  execute(
    input: {
      copy: EngineeringWorkingCopy;
      route: EngineeringRoute;
      command: string;
      expectedExports: string[];
      timeoutMs: number;
      mode: EngineeringPlan["mode"];
    },
    signal?: AbortSignal,
  ): Promise<EngineeringExecutionObservation>;
  inspectSolverResults(
    copy: EngineeringWorkingCopy,
    signal?: AbortSignal,
  ): Promise<SolverResultObservation>;
  readExport(name: string, signal?: AbortSignal): Promise<EngineeringExport | null>;
  inspectExport(
    output: EngineeringExport,
    signal?: AbortSignal,
  ): Promise<EngineeringExportObservation>;
  verifyOriginal(
    project: EngineeringProjectRef,
    expectedSha256: string,
    signal?: AbortSignal,
  ): Promise<{ verified: boolean; sha256: string; evidence: string }>;
  discardWorkingCopy(
    copy: EngineeringWorkingCopy,
    signal?: AbortSignal,
  ): Promise<{ discarded: boolean; originalSha256: string; evidence: string }>;
}

export interface EngineeringExportSpec {
  name: string;
  format: EngineeringExportFormat;
  maxBytes: number;
  expectedDimensions: Record<string, number>;
  dimensionTolerance: number;
}

export interface SolverMetricRule {
  name: string;
  unit: string;
  min?: number;
  max?: number;
}

export interface EngineeringPlan {
  runId: string;
  appId: string;
  mode: "cad_edit" | "cae_solver";
  project: EngineeringProjectRef;
  workingPath: string;
  command: string;
  baseline: EngineeringAssumptions;
  /** Flattened approved values, e.g. `dimensions.width` or `materials.body`. */
  approvedChanges: EngineeringValues;
  expected: {
    minFeatures: number;
    dimensions: Record<string, number>;
    dimensionTolerance: number;
    allowWarnings: boolean;
  };
  exports: EngineeringExportSpec[];
  solver?: {
    expectedResultNames: string[];
    metrics: SolverMetricRule[];
    allowWarnings: boolean;
  };
  timeoutMs: number;
  confirmed: boolean;
}

export interface EngineeringWorkflowReceipt {
  runId: string;
  appId: string;
  appVersion: string | null;
  evidenceClass: EngineeringEvidenceClass | null;
  route: EngineeringRoute | null;
  status: "failed" | "cancelled" | "completed_controlled" | "completed_verified";
  workingCopy: EngineeringWorkingCopy | null;
  model: EngineeringModelObservation | null;
  solver: SolverResultObservation | null;
  exports: EngineeringExportObservation[];
  engineeringConclusionAllowed: boolean;
  recovery: { attempted: boolean; verified: boolean; evidence: string };
  evidence: string[];
  recordedAt: string;
}

export interface EngineeringWorkflowResult {
  ok: boolean;
  receipt: EngineeringWorkflowReceipt;
}

export type EngineeringOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

function normaliseRelativePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, "/");
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path.startsWith("//") ||
    /^[A-Za-z]:\//.test(path)
  ) {
    return null;
  }
  const parts = path.split("/").filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === "..")) return null;
  return parts.join("/");
}

async function digest(bytes: Uint8Array): Promise<string> {
  const copied = Uint8Array.from(bytes);
  const value = await globalThis.crypto.subtle.digest("SHA-256", copied.buffer);
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validRecord(record: Record<string, unknown>, kind: "number" | "string"): boolean {
  const entries = Object.entries(record);
  return (
    entries.length <= 1_000 &&
    entries.every(
      ([key, value]) =>
        SAFE_ID.test(key) &&
        (kind === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : typeof value === "string" && value.trim().length > 0 && value.length <= 1_000),
    )
  );
}

function validAssumptions(value: EngineeringAssumptions): boolean {
  return (
    ["si_mm_kg_s", "si_m_kg_s", "imperial_in_lbf_s", "imperial_ft_lbf_s"].includes(
      value.unitSystem,
    ) &&
    validRecord(value.dimensions, "number") &&
    validRecord(value.materials, "string") &&
    validRecord(value.contacts, "string") &&
    validRecord(value.constraints, "string") &&
    validRecord(value.loads, "number") &&
    validRecord(value.boundaryConditions, "string") &&
    validRecord(value.tolerances, "number")
  );
}

export function validateEngineeringPlan(
  requested: EngineeringPlan,
): EngineeringOutcome<EngineeringPlan> {
  if (!SAFE_ID.test(requested.runId) || !SAFE_ID.test(requested.appId)) {
    return { ok: false, reason: "The engineering run or application id is invalid." };
  }
  const projectPath = normaliseRelativePath(requested.project.path);
  const workingPath = normaliseRelativePath(requested.workingPath);
  if (
    !SAFE_ID.test(requested.project.projectId) ||
    !projectPath ||
    !workingPath ||
    projectPath === workingPath ||
    !requested.project.format.trim()
  ) {
    return {
      ok: false,
      reason: "The source and duplicate engineering project paths are unsafe or identical.",
    };
  }
  if (
    !["cad_edit", "cae_solver"].includes(requested.mode) ||
    !requested.command.trim() ||
    requested.command.length > MAX_COMMAND_CHARS ||
    !validAssumptions(requested.baseline)
  ) {
    return { ok: false, reason: "The engineering command or baseline assumptions are invalid." };
  }
  if (
    !Number.isInteger(requested.expected.minFeatures) ||
    requested.expected.minFeatures < 1 ||
    !validRecord(requested.expected.dimensions, "number") ||
    !Number.isFinite(requested.expected.dimensionTolerance) ||
    requested.expected.dimensionTolerance < 0
  ) {
    return { ok: false, reason: "The expected engineering model is invalid." };
  }
  const approvedEntries = Object.entries(requested.approvedChanges);
  if (
    approvedEntries.length > 1_000 ||
    approvedEntries.some(
      ([key, value]) =>
        !/^(dimensions|materials|contacts|constraints|loads|boundaryConditions|tolerances)\.[a-z0-9._:-]+$/i.test(
          key,
        ) ||
        !["string", "number", "boolean"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value)) ||
        (typeof value === "string" && (!value.trim() || value.length > 1_000)),
    )
  ) {
    return { ok: false, reason: "An approved engineering change is malformed." };
  }
  if (
    requested.exports.length === 0 ||
    requested.exports.length > MAX_EXPORTS ||
    new Set(requested.exports.map((output) => output.name)).size !== requested.exports.length
  ) {
    return { ok: false, reason: "The engineering export list is empty, duplicate or unbounded." };
  }
  for (const output of requested.exports) {
    if (
      !normaliseRelativePath(output.name) ||
      !["step", "stl", "dxf", "dwg"].includes(output.format) ||
      !Number.isSafeInteger(output.maxBytes) ||
      output.maxBytes <= 0 ||
      output.maxBytes > MAX_EXPORT_BYTES ||
      !validRecord(output.expectedDimensions, "number") ||
      !Number.isFinite(output.dimensionTolerance) ||
      output.dimensionTolerance < 0
    ) {
      return { ok: false, reason: "An engineering export rule is unsafe or invalid." };
    }
  }
  if (requested.mode === "cae_solver") {
    if (
      !requested.solver ||
      requested.solver.expectedResultNames.length === 0 ||
      requested.solver.metrics.length === 0 ||
      new Set(requested.solver.expectedResultNames).size !==
        requested.solver.expectedResultNames.length
    ) {
      return { ok: false, reason: "A CAE run needs bounded result files and metric rules." };
    }
    for (const name of requested.solver.expectedResultNames) {
      if (!normaliseRelativePath(name)) {
        return { ok: false, reason: "A solver result path is unsafe." };
      }
    }
    for (const metric of requested.solver.metrics) {
      if (
        !SAFE_ID.test(metric.name) ||
        !metric.unit.trim() ||
        (metric.min === undefined && metric.max === undefined) ||
        (metric.min !== undefined && !Number.isFinite(metric.min)) ||
        (metric.max !== undefined && !Number.isFinite(metric.max)) ||
        (metric.min !== undefined && metric.max !== undefined && metric.min > metric.max)
      ) {
        return { ok: false, reason: "A solver acceptance metric is invalid." };
      }
    }
  } else if (requested.solver) {
    return { ok: false, reason: "A CAD-only plan cannot carry solver success criteria." };
  }
  if (
    !Number.isInteger(requested.timeoutMs) ||
    requested.timeoutMs < 1_000 ||
    requested.timeoutMs > 7 * 24 * 60 * 60 * 1_000 ||
    !requested.confirmed
  ) {
    return { ok: false, reason: "The engineering timeout or confirmation is invalid." };
  }
  return {
    ok: true,
    data: {
      ...requested,
      project: { ...requested.project, path: projectPath },
      workingPath,
      exports: requested.exports.map((output) => ({
        ...output,
        name: normaliseRelativePath(output.name)!,
      })),
      solver: requested.solver
        ? {
            ...requested.solver,
            expectedResultNames: requested.solver.expectedResultNames.map((name) =>
              normaliseRelativePath(name)!,
            ),
          }
        : undefined,
    },
    evidence: "Engineering plan, duplicate path, assumptions and deliverables were admitted.",
  };
}

function validRoute(route: EngineeringRouteCapability): boolean {
  return (
    CAD_ROUTE_ORDER.includes(route.route) &&
    typeof route.available === "boolean" &&
    typeof route.approved === "boolean" &&
    Number.isFinite(route.confidence) &&
    route.confidence >= 0 &&
    route.confidence <= 1 &&
    typeof route.supportsMutation === "boolean" &&
    typeof route.supportsIndependentVerification === "boolean" &&
    typeof route.supportsRecovery === "boolean" &&
    route.evidence.trim().length > 0
  );
}

export function selectEngineeringRoute(
  status: EngineeringAdapterStatus,
): EngineeringOutcome<EngineeringRouteCapability> {
  if (
    !SAFE_ID.test(status.appId) ||
    !status.product.trim() ||
    !status.version.trim() ||
    !status.executable.trim() ||
    !status.publisher.trim() ||
    !["deterministic_fixture", "installed_application"].includes(status.evidenceClass) ||
    status.routes.length === 0 ||
    status.routes.some((route) => !validRoute(route)) ||
    new Set(status.routes.map((route) => route.route)).size !== status.routes.length
  ) {
    return { ok: false, reason: "The engineering adapter identity or routes are malformed." };
  }
  if (!status.installed || !status.signatureVerified || !status.licenceVerified) {
    return {
      ok: false,
      reason: "The engineering application installation, signature or licence is not verified.",
    };
  }
  for (const routeName of CAD_ROUTE_ORDER) {
    const route = status.routes.find((candidate) => candidate.route === routeName);
    if (
      route &&
      route.route !== "vision_input" &&
      route.available &&
      route.approved &&
      route.confidence >= 0.9 &&
      route.supportsMutation &&
      route.supportsIndependentVerification &&
      route.supportsRecovery
    ) {
      return {
        ok: true,
        data: route,
        evidence: `Selected ${route.route} for ${status.product} ${status.version}. ${route.evidence}`,
      };
    }
  }
  return {
    ok: false,
    reason:
      "No approved CAD/CAE route provides adequate mutation, independent verification and recovery.",
  };
}

function flattenAssumptions(input: EngineeringAssumptions): EngineeringValues {
  const flattened: EngineeringValues = {};
  for (const group of [
    "dimensions",
    "materials",
    "contacts",
    "constraints",
    "loads",
    "boundaryConditions",
    "tolerances",
  ] as const) {
    for (const [key, value] of Object.entries(input[group])) {
      flattened[`${group}.${key}`] = value;
    }
  }
  return flattened;
}

function compareEngineeringState(
  plan: EngineeringPlan,
  observed: EngineeringModelObservation,
): EngineeringOutcome<true> {
  if (observed.unitSystem !== plan.baseline.unitSystem) {
    return {
      ok: false,
      reason: "The model unit system changed; unit conversion was not authorised.",
    };
  }
  const before = flattenAssumptions(plan.baseline);
  const after = flattenAssumptions(observed);
  const approved = plan.approvedChanges;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const original = before[key];
    const current = after[key];
    if (Object.is(original, current)) continue;
    if (!(key in approved) || !Object.is(approved[key], current)) {
      return {
        ok: false,
        reason: `Engineering assumption ${key} changed without an exact approved value.`,
      };
    }
  }
  for (const [key, expected] of Object.entries(approved)) {
    if (!Object.is(after[key], expected)) {
      return { ok: false, reason: `Approved engineering change ${key} was not observed exactly.` };
    }
  }
  for (const [name, expected] of Object.entries(plan.expected.dimensions)) {
    const actual = observed.dimensions[name];
    if (actual === undefined || Math.abs(actual - expected) > plan.expected.dimensionTolerance) {
      return { ok: false, reason: `Dimension ${name} is outside its approved tolerance.` };
    }
  }
  if (
    observed.features < plan.expected.minFeatures ||
    !observed.rebuildSucceeded ||
    observed.failedConstraints.length > 0 ||
    observed.underconstrainedSketches.length > 0 ||
    observed.invalidReferences.length > 0 ||
    observed.errors.length > 0 ||
    (!plan.expected.allowWarnings && observed.warnings.length > 0)
  ) {
    return {
      ok: false,
      reason:
        "The rebuilt engineering model failed feature, constraint, reference, warning or error checks.",
    };
  }
  return {
    ok: true,
    data: true,
    evidence:
      "Units, dimensions, assumptions, constraints and rebuild state matched the approved model.",
  };
}

function contentMatchesFormat(output: EngineeringExport): EngineeringOutcome<string> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(output.bytes);
  if (
    output.format === "step" &&
    /^ISO-10303-21;/i.test(text.trimStart()) &&
    /FILE_SCHEMA\s*\(/i.test(text) &&
    /END-ISO-10303-21;/i.test(text)
  ) {
    return { ok: true, data: "STEP", evidence: "STEP exchange structure is present." };
  }
  if (
    output.format === "dxf" &&
    /\bSECTION\b/.test(text) &&
    /\$INSUNITS/.test(text) &&
    /\bEOF\b/.test(text)
  ) {
    return { ok: true, data: "DXF", evidence: "DXF sections, units and terminator are present." };
  }
  if (
    output.format === "dwg" &&
    output.bytes.byteLength >= 64 &&
    /^AC10\d{2}/.test(text.slice(0, 6))
  ) {
    return {
      ok: true,
      data: "DWG",
      evidence: "DWG version signature and bounded bytes are present.",
    };
  }
  if (output.format === "stl") {
    const view = new DataView(
      output.bytes.buffer,
      output.bytes.byteOffset,
      output.bytes.byteLength,
    );
    const binaryTriangles = output.bytes.byteLength >= 84 ? view.getUint32(80, true) : 0;
    const validBinary =
      binaryTriangles > 0 && 84 + binaryTriangles * 50 === output.bytes.byteLength;
    const validAscii =
      /^\s*solid\b/i.test(text) &&
      /\bfacet\s+normal\b/i.test(text) &&
      (text.match(/\bvertex\b/gi)?.length ?? 0) >= 3 &&
      /\bendsolid\b/i.test(text);
    if (validBinary || validAscii) {
      return {
        ok: true,
        data: "STL",
        evidence: validBinary
          ? `Binary STL contains ${binaryTriangles} complete triangle records.`
          : "ASCII STL contains facets, vertices and a closing solid.",
      };
    }
  }
  return {
    ok: false,
    reason: `${output.name} does not contain a conforming ${output.format.toUpperCase()} structure.`,
  };
}

async function verifyExport(
  host: EngineeringAdapterHost,
  output: EngineeringExport,
  rule: EngineeringExportSpec,
  unitSystem: EngineeringUnitSystem,
  signal?: AbortSignal,
): Promise<EngineeringOutcome<EngineeringExportObservation>> {
  if (
    output.name !== rule.name ||
    output.format !== rule.format ||
    output.byteLength !== output.bytes.byteLength ||
    output.byteLength <= 0 ||
    output.byteLength > rule.maxBytes ||
    !SHA256.test(output.sha256.toLowerCase())
  ) {
    return { ok: false, reason: `${rule.name} has invalid engineering export metadata.` };
  }
  const actualHash = await digest(output.bytes);
  if (actualHash !== output.sha256.toLowerCase()) {
    return { ok: false, reason: `${rule.name} changed before engineering verification.` };
  }
  const structure = contentMatchesFormat(output);
  if (!structure.ok) return structure;
  const inspected = await host.inspectExport(output, signal);
  if (
    !inspected.reopened ||
    inspected.name !== output.name ||
    inspected.format !== output.format ||
    inspected.sha256.toLowerCase() !== actualHash ||
    inspected.unitSystem !== unitSystem ||
    inspected.entityCount < 1 ||
    inspected.errors.length > 0
  ) {
    return { ok: false, reason: `${rule.name} failed independent reopen inspection.` };
  }
  for (const [name, expected] of Object.entries(rule.expectedDimensions)) {
    const actual = inspected.dimensions[name];
    if (actual === undefined || Math.abs(actual - expected) > rule.dimensionTolerance) {
      return { ok: false, reason: `${rule.name} dimension ${name} changed during export.` };
    }
  }
  return {
    ok: true,
    data: inspected,
    evidence: `${structure.evidence} Exact bytes and independent reopen inspection matched.`,
  };
}

function verifySolver(
  plan: EngineeringPlan,
  execution: SolverExecutionObservation | null,
  result: SolverResultObservation,
): EngineeringOutcome<true> {
  const rules = plan.solver;
  if (
    !rules ||
    !execution ||
    !execution.launched ||
    !execution.licenceVerified ||
    !execution.normalTermination ||
    !result.normalTermination ||
    !SHA256.test(execution.logSha256.toLowerCase()) ||
    rules.expectedResultNames.some(
      (name) =>
        !execution.resultNames.includes(name) ||
        !SHA256.test(result.resultSha256[name]?.toLowerCase() ?? ""),
    ) ||
    result.errors.length > 0 ||
    (!rules.allowWarnings && result.warnings.length > 0)
  ) {
    return {
      ok: false,
      reason:
        "The solver launch, termination, logs, result files, warnings or errors are unverified.",
    };
  }
  for (const rule of rules.metrics) {
    const metric = result.metrics[rule.name];
    if (
      !metric ||
      metric.unit !== rule.unit ||
      !Number.isFinite(metric.value) ||
      !["solver_log", "result_file"].includes(metric.source) ||
      (rule.min !== undefined && metric.value < rule.min) ||
      (rule.max !== undefined && metric.value > rule.max)
    ) {
      return {
        ok: false,
        reason: `Solver metric ${rule.name} is missing, out of range or not parsed from real output.`,
      };
    }
  }
  return {
    ok: true,
    data: true,
    evidence:
      "Solver termination, result files and every acceptance metric were independently parsed.",
  };
}

function receipt(plan: EngineeringPlan, now: Date): EngineeringWorkflowReceipt {
  return {
    runId: plan.runId,
    appId: plan.appId,
    appVersion: null,
    evidenceClass: null,
    route: null,
    status: "failed",
    workingCopy: null,
    model: null,
    solver: null,
    exports: [],
    engineeringConclusionAllowed: false,
    recovery: { attempted: false, verified: false, evidence: "No recovery was needed." },
    evidence: [],
    recordedAt: now.toISOString(),
  };
}

async function recover(
  host: EngineeringAdapterHost,
  plan: EngineeringPlan,
  copy: EngineeringWorkingCopy,
  signal?: AbortSignal,
): Promise<EngineeringWorkflowReceipt["recovery"]> {
  try {
    const discarded = await host.discardWorkingCopy(copy, signal);
    const verified =
      discarded.discarded &&
      discarded.originalSha256.toLowerCase() === copy.sourceSha256.toLowerCase();
    return {
      attempted: true,
      verified,
      evidence: verified
        ? `${discarded.evidence} The original project digest remained unchanged.`
        : `${discarded.evidence} Original-project preservation was not verified.`,
    };
  } catch (error) {
    return {
      attempted: true,
      verified: false,
      evidence:
        error instanceof Error
          ? `Engineering recovery failed: ${error.message}`
          : "Engineering recovery failed unexpectedly.",
    };
  }
}

export async function runEngineeringWorkflow(
  host: EngineeringAdapterHost,
  requested: EngineeringPlan,
  options: { signal?: AbortSignal; now?: Date } = {},
): Promise<EngineeringWorkflowResult> {
  const now = options.now ?? new Date();
  const output = receipt(requested, now);
  const admitted = validateEngineeringPlan(requested);
  if (!admitted.ok) {
    output.evidence.push(admitted.reason);
    return { ok: false, receipt: output };
  }
  const plan = admitted.data;
  if (options.signal?.aborted) {
    output.status = "cancelled";
    output.evidence.push("The engineering run was cancelled before probing.");
    return { ok: false, receipt: output };
  }

  let status: EngineeringAdapterStatus;
  try {
    status = await host.probe(options.signal);
  } catch (error) {
    output.evidence.push(
      error instanceof Error
        ? `Engineering adapter probe failed: ${error.message}`
        : "Engineering adapter probe failed.",
    );
    return { ok: false, receipt: output };
  }
  output.appVersion = status.version;
  output.evidenceClass = status.evidenceClass;
  if (status.appId !== plan.appId) {
    output.evidence.push("The probed engineering application does not match the request.");
    return { ok: false, receipt: output };
  }
  const route = selectEngineeringRoute(status);
  if (!route.ok) {
    output.evidence.push(route.reason);
    return { ok: false, receipt: output };
  }
  output.route = route.data.route;
  output.evidence.push(
    route.evidence,
    `Approved engineering command SHA-256: ${await digest(new TextEncoder().encode(plan.command))}.`,
  );
  if (plan.exports.some((item) => !status.supportedFormats.includes(item.format))) {
    output.evidence.push("The installed adapter does not declare every requested export format.");
    return { ok: false, receipt: output };
  }

  let copy: EngineeringWorkingCopy;
  try {
    copy = await host.duplicateProject(plan.project, plan.workingPath, options.signal);
    output.workingCopy = copy;
    const validCopy =
      SAFE_ID.test(copy.copyId) &&
      copy.sourceProjectId === plan.project.projectId &&
      normaliseRelativePath(copy.path) === plan.workingPath &&
      SHA256.test(copy.sourceSha256.toLowerCase()) &&
      SHA256.test(copy.sha256.toLowerCase()) &&
      copy.sourceSha256.toLowerCase() !== copy.sha256.toLowerCase() &&
      Number.isSafeInteger(copy.byteLength) &&
      copy.byteLength > 0 &&
      Number.isFinite(Date.parse(copy.createdAt));
    const verified = validCopy
      ? await host.verifyWorkingCopy(copy, options.signal)
      : { verified: false, evidence: "Working-copy metadata was malformed." };
    output.evidence.push(copy.evidence, verified.evidence);
    if (!verified.verified) return { ok: false, receipt: output };

    const before = await host.inspectModel(copy, options.signal);
    const baseline = compareEngineeringState(
      {
        ...plan,
        approvedChanges: {},
        expected: { ...plan.expected, dimensions: plan.baseline.dimensions },
      },
      before,
    );
    if (!baseline.ok) {
      output.evidence.push(`Duplicate-project preflight failed: ${baseline.reason}`);
      output.recovery = await recover(host, plan, copy, options.signal);
      return { ok: false, receipt: output };
    }
    output.evidence.push(`Duplicate-project preflight: ${baseline.evidence}`);
  } catch (error) {
    output.evidence.push(
      error instanceof Error
        ? `Engineering duplication/preflight failed: ${error.message}`
        : "Engineering duplication/preflight failed.",
    );
    if (output.workingCopy) {
      output.recovery = await recover(host, plan, output.workingCopy, options.signal);
    }
    return { ok: false, receipt: output };
  }

  let execution: EngineeringExecutionObservation;
  try {
    execution = await host.execute(
      {
        copy,
        route: route.data.route,
        command: plan.command,
        expectedExports: plan.exports.map((item) => item.name),
        timeoutMs: plan.timeoutMs,
        mode: plan.mode,
      },
      options.signal,
    );
  } catch (error) {
    output.evidence.push(
      error instanceof Error
        ? `Engineering execution failed: ${error.message}`
        : "Engineering execution failed.",
    );
    output.recovery = await recover(host, plan, copy, options.signal);
    return { ok: false, receipt: output };
  }
  output.evidence.push(execution.evidence);
  const executionVerified =
    execution.route === route.data.route &&
    execution.isolated &&
    execution.networkDenied &&
    execution.readScopeEnforced &&
    execution.writeScopeEnforced &&
    execution.processTreeTerminated &&
    execution.exitCode === 0 &&
    !execution.cancelled &&
    !execution.timedOut &&
    execution.originalProjectSha256.toLowerCase() === copy.sourceSha256.toLowerCase() &&
    Number.isFinite(Date.parse(execution.startedAt)) &&
    Number.isFinite(Date.parse(execution.finishedAt)) &&
    Date.parse(execution.finishedAt) >= Date.parse(execution.startedAt) &&
    plan.exports.every((item) => execution.outputNames.includes(item.name)) &&
    ((plan.mode === "cae_solver" && execution.solver !== null) ||
      (plan.mode === "cad_edit" && execution.solver === null));
  if (!executionVerified) {
    output.status = execution.cancelled ? "cancelled" : "failed";
    output.evidence.push(
      "The engineering host did not prove bounded execution or original preservation.",
    );
    output.recovery = await recover(host, plan, copy, options.signal);
    return { ok: false, receipt: output };
  }

  try {
    const model = await host.inspectModel(copy, options.signal);
    output.model = model;
    output.evidence.push(model.evidence);
    const checkedModel = compareEngineeringState(plan, model);
    if (!checkedModel.ok) {
      output.evidence.push(checkedModel.reason);
      output.recovery = await recover(host, plan, copy, options.signal);
      return { ok: false, receipt: output };
    }
    output.evidence.push(checkedModel.evidence);

    if (plan.mode === "cae_solver") {
      const solver = await host.inspectSolverResults(copy, options.signal);
      output.solver = solver;
      output.evidence.push(solver.evidence);
      const checkedSolver = verifySolver(plan, execution.solver, solver);
      if (!checkedSolver.ok) {
        output.evidence.push(checkedSolver.reason);
        output.recovery = await recover(host, plan, copy, options.signal);
        return { ok: false, receipt: output };
      }
      output.evidence.push(checkedSolver.evidence);
    }

    for (const rule of plan.exports) {
      const exported = await host.readExport(rule.name, options.signal);
      if (!exported) {
        output.evidence.push(`${rule.name} was not produced.`);
        output.recovery = await recover(host, plan, copy, options.signal);
        return { ok: false, receipt: output };
      }
      const verified = await verifyExport(
        host,
        exported,
        rule,
        plan.baseline.unitSystem,
        options.signal,
      );
      if (!verified.ok) {
        output.evidence.push(verified.reason);
        output.recovery = await recover(host, plan, copy, options.signal);
        return { ok: false, receipt: output };
      }
      output.exports.push(verified.data);
      output.evidence.push(verified.evidence);
    }

    const original = await host.verifyOriginal(plan.project, copy.sourceSha256, options.signal);
    if (!original.verified || original.sha256.toLowerCase() !== copy.sourceSha256.toLowerCase()) {
      output.evidence.push("The original engineering project changed during duplicate work.");
      output.recovery = await recover(host, plan, copy, options.signal);
      return { ok: false, receipt: output };
    }
    output.evidence.push(original.evidence);
  } catch (error) {
    output.evidence.push(
      error instanceof Error
        ? `Engineering verification failed: ${error.message}`
        : "Engineering verification failed.",
    );
    output.recovery = await recover(host, plan, copy, options.signal);
    return { ok: false, receipt: output };
  }

  const live = status.evidenceClass === "installed_application";
  output.status = live ? "completed_verified" : "completed_controlled";
  output.engineeringConclusionAllowed =
    live && (plan.mode === "cad_edit" || output.solver !== null);
  output.recovery = {
    attempted: false,
    verified: true,
    evidence: "The verified duplicate remains available and the original digest is unchanged.",
  };
  output.evidence.push(
    live
      ? "Installed-application model and deliverables completed with independent evidence."
      : "Deterministic fixture contract completed. It is not an engineering or installed-application conclusion.",
  );
  return { ok: true, receipt: output };
}

export const ENGINEERING_RUNTIME_BOUNDARY =
  "CAD/CAE source and deterministic fixtures are available, but no installed licensed CAD application or solver, real engineering model, solver result file, or independently reopened live export has been validated here. Fixture metrics can test the contract but can never support an engineering conclusion.";
