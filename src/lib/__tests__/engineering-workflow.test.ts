import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CAD_ROUTE_ORDER,
  ENGINEERING_RUNTIME_BOUNDARY,
  runEngineeringWorkflow,
  selectEngineeringRoute,
  validateEngineeringPlan,
  type EngineeringAdapterHost,
  type EngineeringAdapterStatus,
  type EngineeringExecutionObservation,
  type EngineeringExport,
  type EngineeringModelObservation,
  type EngineeringPlan,
  type EngineeringRoute,
  type SolverResultObservation,
} from "../engineering/engineering-workflow";

const SOURCE_SHA = "a".repeat(64);
const COPY_SHA = "b".repeat(64);
const MODEL_SHA = "c".repeat(64);
const LOG_SHA = "d".repeat(64);
const RESULT_SHA = "e".repeat(64);
const STEP_BYTES = new TextEncoder().encode(
  "ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('AP242'));\nENDSEC;\nDATA;\n#1=PRODUCT('fixture','','',());\nENDSEC;\nEND-ISO-10303-21;\n",
);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function route(
  name: EngineeringRoute,
  overrides: Partial<EngineeringAdapterStatus["routes"][number]> = {},
): EngineeringAdapterStatus["routes"][number] {
  return {
    route: name,
    available: true,
    approved: true,
    confidence: 0.99,
    supportsMutation: true,
    supportsIndependentVerification: true,
    supportsRecovery: true,
    evidence: `${name} controlled evidence`,
    ...overrides,
  };
}

function adapter(overrides: Partial<EngineeringAdapterStatus> = {}): EngineeringAdapterStatus {
  return {
    appId: "cad.fixture",
    product: "Controlled CAD",
    version: "1.0",
    installed: true,
    executable: "C:/Controlled/CAD.exe",
    publisher: "OCADE fixtures",
    signatureVerified: true,
    licenceVerified: true,
    evidenceClass: "deterministic_fixture",
    routes: CAD_ROUTE_ORDER.map((name) => route(name)),
    supportedFormats: ["step", "stl", "dxf", "dwg"],
    evidence: "Controlled application identity and capabilities were probed.",
    ...overrides,
  };
}

function assumptions(width = 100) {
  return {
    unitSystem: "si_mm_kg_s" as const,
    dimensions: { width, height: 50, thickness: 5 },
    materials: { body: "S355 steel" },
    contacts: { primary: "bonded" },
    constraints: { sketch: "fully_constrained" },
    loads: { force_y: -1000 },
    boundaryConditions: { base: "fixed" },
    tolerances: { geometry: 0.01, solver: 0.001 },
  };
}

function plan(overrides: Partial<EngineeringPlan> = {}): EngineeringPlan {
  return {
    runId: "engineering-run-31",
    appId: "cad.fixture",
    mode: "cad_edit",
    project: { projectId: "bracket", path: "projects/bracket.fcstd", format: "fcstd" },
    workingPath: "projects/working/bracket-phase31.fcstd",
    command: "set_dimension('width', 120); rebuild(); export_step();",
    baseline: assumptions(),
    approvedChanges: { "dimensions.width": 120 },
    expected: {
      minFeatures: 3,
      dimensions: { width: 120, height: 50, thickness: 5 },
      dimensionTolerance: 0.001,
      allowWarnings: false,
    },
    exports: [
      {
        name: "exports/bracket.step",
        format: "step",
        maxBytes: 1024 * 1024,
        expectedDimensions: { width: 120, height: 50, thickness: 5 },
        dimensionTolerance: 0.001,
      },
    ],
    timeoutMs: 60_000,
    confirmed: true,
    ...overrides,
  };
}

class FixtureHost implements EngineeringAdapterHost {
  calls: string[] = [];
  status = adapter();
  inspectCount = 0;
  verifyCopy = true;
  originalVerified = true;
  discardVerified = true;
  before: EngineeringModelObservation = {
    ...assumptions(),
    projectSha256: COPY_SHA,
    features: 3,
    rebuildSucceeded: true,
    failedConstraints: [],
    underconstrainedSketches: [],
    invalidReferences: [],
    warnings: [],
    errors: [],
    evidence: "Duplicate preflight matched the source model.",
  };
  after: EngineeringModelObservation = {
    ...assumptions(120),
    projectSha256: MODEL_SHA,
    features: 4,
    rebuildSucceeded: true,
    failedConstraints: [],
    underconstrainedSketches: [],
    invalidReferences: [],
    warnings: [],
    errors: [],
    evidence: "Reopened model rebuilt with four valid features.",
  };
  execution: EngineeringExecutionObservation = {
    route: "official_api",
    isolated: true,
    networkDenied: true,
    readScopeEnforced: true,
    writeScopeEnforced: true,
    processTreeTerminated: true,
    exitCode: 0,
    cancelled: false,
    timedOut: false,
    outputNames: ["exports/bracket.step"],
    originalProjectSha256: SOURCE_SHA,
    solver: null,
    startedAt: "2026-07-26T10:00:00.000Z",
    finishedAt: "2026-07-26T10:00:02.000Z",
    evidence: "Controlled engineering process exited zero inside declared scopes.",
  };
  exports = new Map<string, EngineeringExport>([
    [
      "exports/bracket.step",
      {
        name: "exports/bracket.step",
        format: "step",
        bytes: STEP_BYTES,
        sha256: sha256(STEP_BYTES),
        byteLength: STEP_BYTES.byteLength,
      },
    ],
  ]);
  solverResult: SolverResultObservation = {
    normalTermination: true,
    metrics: {
      max_displacement: { value: 0.42, unit: "mm", source: "result_file" },
      energy_ratio: { value: 0.02, unit: "ratio", source: "solver_log" },
    },
    resultSha256: { "results/bracket.d3plot": RESULT_SHA },
    warnings: [],
    errors: [],
    evidence: "Controlled result fixture exposed bounded metrics and hashes.",
  };

  async probe() {
    this.calls.push("probe");
    return this.status;
  }

  async duplicateProject(project: EngineeringPlan["project"], workingPath: string) {
    this.calls.push("duplicateProject");
    return {
      copyId: "copy-31",
      sourceProjectId: project.projectId,
      sourceSha256: SOURCE_SHA,
      path: workingPath,
      sha256: COPY_SHA,
      byteLength: 4096,
      createdAt: "2026-07-26T09:59:59.000Z",
      evidence: "Created a versioned duplicate without opening the source for writes.",
    };
  }

  async verifyWorkingCopy() {
    this.calls.push("verifyWorkingCopy");
    return {
      verified: this.verifyCopy,
      evidence: this.verifyCopy
        ? "Duplicate bytes were independently verified."
        : "Duplicate mismatch.",
    };
  }

  async inspectModel() {
    this.calls.push("inspectModel");
    this.inspectCount += 1;
    return this.inspectCount === 1 ? this.before : this.after;
  }

  async execute(input: Parameters<EngineeringAdapterHost["execute"]>[0]) {
    this.calls.push(`execute:${input.route}`);
    return { ...this.execution, route: input.route };
  }

  async inspectSolverResults() {
    this.calls.push("inspectSolverResults");
    return this.solverResult;
  }

  async readExport(name: string) {
    this.calls.push(`readExport:${name}`);
    return this.exports.get(name) ?? null;
  }

  async inspectExport(output: EngineeringExport) {
    this.calls.push(`inspectExport:${output.name}`);
    return {
      name: output.name,
      format: output.format,
      sha256: sha256(output.bytes),
      reopened: true,
      unitSystem: "si_mm_kg_s" as const,
      dimensions: { width: 120, height: 50, thickness: 5 },
      entityCount: 4,
      errors: [],
      evidence: "Independent exchange reader reopened four entities and measured dimensions.",
    };
  }

  async verifyOriginal() {
    this.calls.push("verifyOriginal");
    return {
      verified: this.originalVerified,
      sha256: this.originalVerified ? SOURCE_SHA : "f".repeat(64),
      evidence: this.originalVerified
        ? "Original project digest remained unchanged."
        : "Original project changed.",
    };
  }

  async discardWorkingCopy() {
    this.calls.push("discardWorkingCopy");
    return {
      discarded: this.discardVerified,
      originalSha256: this.discardVerified ? SOURCE_SHA : "f".repeat(64),
      evidence: this.discardVerified ? "Working duplicate was discarded." : "Discard failed.",
    };
  }
}

function solverPlan(): EngineeringPlan {
  return plan({
    mode: "cae_solver",
    command: "preflight(); launch_solver(); parse_results(); export_step();",
    solver: {
      expectedResultNames: ["results/bracket.d3plot"],
      metrics: [
        { name: "max_displacement", unit: "mm", max: 0.5 },
        { name: "energy_ratio", unit: "ratio", min: 0, max: 0.05 },
      ],
      allowWarnings: false,
    },
  });
}

function enableSolver(host: FixtureHost) {
  host.execution = {
    ...host.execution,
    solver: {
      launched: true,
      licenceVerified: true,
      normalTermination: true,
      logSha256: LOG_SHA,
      resultNames: ["results/bracket.d3plot"],
      evidence: "Controlled solver fixture reached its normal termination marker.",
    },
  };
}

describe("engineering admission and routing", () => {
  it("requires a distinct safe working copy and complete solver criteria", () => {
    expect(validateEngineeringPlan(plan()).ok).toBe(true);
    expect(validateEngineeringPlan(plan({ workingPath: "projects/bracket.fcstd" })).ok).toBe(false);
    expect(validateEngineeringPlan(plan({ workingPath: "../outside/bracket.fcstd" })).ok).toBe(
      false,
    );
    expect(validateEngineeringPlan(plan({ mode: "cae_solver", solver: undefined })).ok).toBe(false);
  });

  it("prefers API, plug-in, macro, script and CLI in the specified order", () => {
    const api = selectEngineeringRoute(adapter());
    expect(api.ok && api.data.route).toBe("official_api");
    const plugin = selectEngineeringRoute(
      adapter({
        routes: CAD_ROUTE_ORDER.map((name) => route(name, { available: name !== "official_api" })),
      }),
    );
    expect(plugin.ok && plugin.data.route).toBe("plugin");
    expect(selectEngineeringRoute(adapter({ routes: [route("vision_input")] })).ok).toBe(false);
  });

  it("refuses an unsigned, unlicensed or unavailable engineering application", () => {
    expect(selectEngineeringRoute(adapter({ signatureVerified: false })).ok).toBe(false);
    expect(selectEngineeringRoute(adapter({ licenceVerified: false })).ok).toBe(false);
    expect(selectEngineeringRoute(adapter({ installed: false })).ok).toBe(false);
  });
});

describe("duplicate-project CAD workflow", () => {
  it("completes only as controlled evidence for a fixture and preserves the original", async () => {
    const host = new FixtureHost();
    const result = await runEngineeringWorkflow(host, plan());
    expect(result.ok).toBe(true);
    expect(result.receipt).toMatchObject({
      status: "completed_controlled",
      route: "official_api",
      engineeringConclusionAllowed: false,
      recovery: { attempted: false, verified: true },
    });
    expect(result.receipt.exports).toHaveLength(1);
    expect(result.receipt.evidence.join(" ")).toMatch(/not an engineering/i);
    expect(host.calls).toContain("verifyOriginal");
    expect(host.calls).not.toContain("discardWorkingCopy");
    expect(ENGINEERING_RUNTIME_BOUNDARY).toMatch(/never support an engineering conclusion/i);
  });

  it("recovers when an unapproved material, load or tolerance changes", async () => {
    const host = new FixtureHost();
    host.after = {
      ...host.after,
      materials: { body: "Aluminium 6061" },
      loads: { force_y: -800 },
    };
    const result = await runEngineeringWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/changed without an exact approved value/i);
    expect(result.receipt.recovery).toMatchObject({ attempted: true, verified: true });
  });

  it("recovers on failed constraints, underconstraint, references or rebuild", async () => {
    const host = new FixtureHost();
    host.after = {
      ...host.after,
      rebuildSucceeded: false,
      failedConstraints: ["Sketch001.Distance"],
      underconstrainedSketches: ["Sketch002"],
    };
    const result = await runEngineeringWorkflow(host, plan());
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/constraint, reference/i);
    expect(host.calls.at(-1)).toBe("discardWorkingCopy");
  });

  it("recovers when exact export bytes, structure, reopen or dimensions fail", async () => {
    const host = new FixtureHost();
    const item = host.exports.get("exports/bracket.step")!;
    host.exports.set("exports/bracket.step", { ...item, sha256: "f".repeat(64) });
    const changed = await runEngineeringWorkflow(host, plan());
    expect(changed.ok).toBe(false);
    expect(changed.receipt.evidence.join(" ")).toMatch(/changed before engineering verification/i);

    const malformedHost = new FixtureHost();
    const invalid = new TextEncoder().encode("not a STEP file");
    malformedHost.exports.set("exports/bracket.step", {
      ...item,
      bytes: invalid,
      byteLength: invalid.byteLength,
      sha256: sha256(invalid),
    });
    const malformed = await runEngineeringWorkflow(malformedHost, plan());
    expect(malformed.ok).toBe(false);
    expect(malformed.receipt.evidence.join(" ")).toMatch(/conforming STEP/i);
  });

  it("recovers when bounded execution or original preservation is not proven", async () => {
    const host = new FixtureHost();
    host.execution = { ...host.execution, writeScopeEnforced: false };
    const unsafe = await runEngineeringWorkflow(host, plan());
    expect(unsafe.ok).toBe(false);
    expect(unsafe.receipt.evidence.join(" ")).toMatch(/bounded execution/i);
    expect(unsafe.receipt.recovery.verified).toBe(true);

    const changedHost = new FixtureHost();
    changedHost.originalVerified = false;
    const changed = await runEngineeringWorkflow(changedHost, plan());
    expect(changed.ok).toBe(false);
    expect(changed.receipt.evidence.join(" ")).toMatch(/original engineering project changed/i);
  });
});

describe("solver result boundary", () => {
  it("parses controlled result evidence but never turns fixture metrics into engineering truth", async () => {
    const host = new FixtureHost();
    enableSolver(host);
    const result = await runEngineeringWorkflow(host, solverPlan());
    expect(result.ok).toBe(true);
    expect(result.receipt.status).toBe("completed_controlled");
    expect(result.receipt.solver?.metrics.max_displacement.value).toBe(0.42);
    expect(result.receipt.engineeringConclusionAllowed).toBe(false);
  });

  it("recovers when termination, result hashes or acceptance metrics are missing", async () => {
    const host = new FixtureHost();
    enableSolver(host);
    host.solverResult = {
      ...host.solverResult,
      metrics: {
        ...host.solverResult.metrics,
        max_displacement: {
          value: 0.75,
          unit: "mm",
          source: "result_file",
        },
      },
    };
    const result = await runEngineeringWorkflow(host, solverPlan());
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/max_displacement/i);
    expect(result.receipt.recovery.verified).toBe(true);
  });

  it("allows a conclusion only when the host proves installed-application evidence", async () => {
    const host = new FixtureHost();
    host.status = adapter({ evidenceClass: "installed_application" });
    enableSolver(host);
    const result = await runEngineeringWorkflow(host, solverPlan());
    expect(result.ok).toBe(true);
    expect(result.receipt.status).toBe("completed_verified");
    expect(result.receipt.engineeringConclusionAllowed).toBe(true);
  });

  it("cancels before probing without duplicating or mutating a project", async () => {
    const host = new FixtureHost();
    const controller = new AbortController();
    controller.abort();
    const result = await runEngineeringWorkflow(host, plan(), {
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    expect(result.receipt.status).toBe("cancelled");
    expect(host.calls).toEqual([]);
  });
});
