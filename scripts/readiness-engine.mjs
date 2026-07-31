/**
 * Evidence-weighted production-readiness engine (P29 / HWE-43 / HWE-44).
 *
 * A declared status is not itself evidence. The engine therefore publishes two
 * numbers:
 *   1. declaredWeighted — the snapshot's internally consistent planning score;
 *   2. evidenceBound — only rows carrying requirement-specific evidence and
 *      the phase that observed it.
 *
 * A stale snapshot, expired row, source-revision mismatch or target-version
 * mismatch invalidates evidence automatically. Nothing is deleted or mutated.
 */

export const STATUS_WEIGHTS = Object.freeze({
  "NOT STARTED": 0,
  "PARTIAL SOURCE": 0.2,
  "SOURCE COMPLETE": 0.4,
  "EXTERNALLY BLOCKED": 0.4,
  "UNIT TESTED": 0.5,
  "INTEGRATION TESTED": 0.6,
  "SIMULATED RUNTIME VERIFIED": 0.7,
  "REAL TARGET RUNTIME VERIFIED": 1,
});

export class ReadinessCancelledError extends Error {
  constructor() {
    super("Readiness calculation cancelled.");
    this.name = "ReadinessCancelledError";
  }
}

const rounded = (value) => Math.round((value + Number.EPSILON) * 10) / 10;
const percent = (numerator, denominator) =>
  denominator === 0 ? 0 : rounded((numerator / denominator) * 100);

function issue(code, message, requirementId) {
  return {
    code,
    message,
    ...(requirementId ? { requirementId } : {}),
  };
}

function revisionMatches(recorded, expected) {
  if (!expected) return true;
  if (recorded === expected) return true;
  return typeof recorded === "string" && recorded.startsWith(`${expected.slice(0, 7)}+`);
}

function hasBoundEvidence(row) {
  return (
    typeof row.evidence === "string" &&
    row.evidence.trim().length >= 20 &&
    typeof row.resolvedInPhase === "string" &&
    row.resolvedInPhase.trim().length >= 2
  );
}

function evidenceFresh(row, snapshotFresh, nowMs) {
  if (!snapshotFresh) return false;
  if (row.evidenceExpiresAt === undefined) return true;
  const expiry = Date.parse(String(row.evidenceExpiresAt));
  return Number.isFinite(expiry) && expiry >= nowMs;
}

function dimensionFor(dimensions, area) {
  if (!dimensions.has(area)) {
    dimensions.set(area, {
      area,
      denominator: 0,
      declaredNumerator: 0,
      evidenceBoundNumerator: 0,
      notStarted: 0,
      unverifiedPositiveWeight: 0,
    });
  }
  return dimensions.get(area);
}

export function evaluateRequirementReadiness(snapshot, options = {}) {
  const {
    expectedRequirementCount = 510,
    expectedHead,
    expectedTargetVersion,
    expectedEvidenceBindings = {},
    targetVersion,
    maxSnapshotAgeMs = 7 * 24 * 60 * 60 * 1000,
    now = new Date(),
    signal,
  } = options;
  const issues = [];
  const rows = Array.isArray(snapshot?.requirements) ? snapshot.requirements : [];
  const nowMs = now.getTime();
  const generatedAtMs = Date.parse(String(snapshot?.generatedAt ?? ""));
  const ageMs = nowMs - generatedAtMs;
  const recordedBindings =
    snapshot?.evidenceBindings && typeof snapshot.evidenceBindings === "object"
      ? snapshot.evidenceBindings
      : {};
  let evidenceBindingsValid = true;
  for (const [key, expected] of Object.entries(expectedEvidenceBindings)) {
    const recorded = recordedBindings[key];
    const matches =
      key === "sourceRevision"
        ? revisionMatches(recorded, String(expected))
        : recorded === expected;
    if (!matches) {
      evidenceBindingsValid = false;
      issues.push(
        issue(
          recorded === undefined ? "evidence_binding_missing" : "evidence_binding_drift",
          `Snapshot evidence binding "${key}" does not match the current verification environment.`,
        ),
      );
    }
  }
  const snapshotFresh =
    Number.isFinite(generatedAtMs) &&
    ageMs >= 0 &&
    ageMs <= maxSnapshotAgeMs &&
    revisionMatches(snapshot?.head, expectedHead) &&
    evidenceBindingsValid &&
    (!expectedTargetVersion || targetVersion === expectedTargetVersion);

  if (rows.length !== expectedRequirementCount) {
    issues.push(
      issue(
        "requirement_count",
        `Expected ${expectedRequirementCount} requirements, found ${rows.length}.`,
      ),
    );
  }
  if (!Number.isFinite(generatedAtMs)) {
    issues.push(issue("snapshot_time_invalid", "Snapshot generatedAt is invalid."));
  } else if (ageMs < 0) {
    issues.push(issue("snapshot_from_future", "Snapshot generatedAt is in the future."));
  } else if (ageMs > maxSnapshotAgeMs) {
    issues.push(issue("snapshot_stale", "Snapshot evidence exceeded its freshness window."));
  }
  if (!revisionMatches(snapshot?.head, expectedHead)) {
    issues.push(
      issue("source_revision_drift", "Snapshot is not bound to the current source revision."),
    );
  }
  if (expectedTargetVersion && targetVersion !== expectedTargetVersion) {
    issues.push(
      issue("target_version_drift", "Snapshot target version differs from the release target."),
    );
  }

  const seen = new Set();
  const counts = {};
  const dimensions = new Map();
  const requirements = [];
  let declaredNumerator = 0;
  let evidenceBoundNumerator = 0;

  for (const row of rows) {
    if (signal?.aborted) throw new ReadinessCancelledError();
    const id = String(row?.id ?? "");
    const area = String(row?.area ?? "Unassigned");
    const status = String(row?.status ?? "");
    const expectedWeight = STATUS_WEIGHTS[status];
    const declaredWeight = Number(row?.weight);
    const dimension = dimensionFor(dimensions, area);
    dimension.denominator += 1;

    if (!id) issues.push(issue("requirement_id_missing", "Requirement ID is missing."));
    else if (seen.has(id))
      issues.push(issue("requirement_id_duplicate", `Duplicate ID ${id}.`, id));
    seen.add(id);

    if (expectedWeight === undefined) {
      issues.push(issue("status_unknown", `Unknown status "${status}".`, id));
    } else if (declaredWeight !== expectedWeight) {
      issues.push(
        issue(
          "weight_mismatch",
          `${id} declares ${declaredWeight}; ${status} requires ${expectedWeight}.`,
          id,
        ),
      );
    }

    const safeWeight = expectedWeight === declaredWeight ? declaredWeight : 0;
    declaredNumerator += safeWeight;
    dimension.declaredNumerator += safeWeight;
    counts[status] = (counts[status] ?? 0) + 1;

    const bound = safeWeight > 0 && hasBoundEvidence(row);
    const fresh = bound && evidenceFresh(row, snapshotFresh, nowMs);
    const effectiveWeight = fresh ? safeWeight : 0;
    evidenceBoundNumerator += effectiveWeight;
    dimension.evidenceBoundNumerator += effectiveWeight;
    if (safeWeight === 0) dimension.notStarted += 1;
    if (safeWeight > 0 && !fresh) dimension.unverifiedPositiveWeight += 1;

    if (safeWeight > 0 && !bound) {
      issues.push(
        issue(
          "evidence_unbound",
          `${id} has positive declared weight but no requirement-bound evidence and phase provenance.`,
          id,
        ),
      );
    } else if (bound && !fresh) {
      issues.push(issue("evidence_stale", `${id} evidence is stale for this source/target.`, id));
    }

    requirements.push({
      id,
      area,
      declaredStatus: status,
      declaredWeight: safeWeight,
      evidenceBound: bound,
      evidenceFresh: fresh,
      effectiveWeight,
      closureClassification: safeWeight === 0 ? "NOT STARTED" : fresh ? status : "UNVERIFIED",
    });
  }

  const declared = rounded(declaredNumerator);
  const evidenceBound = rounded(evidenceBoundNumerator);
  const denominator = rows.length;
  const declaredSnapshot = Number(snapshot?.readiness?.expanded?.numerator);
  if (declaredSnapshot !== declared) {
    issues.push(
      issue(
        "declared_total_mismatch",
        `Snapshot declares ${declaredSnapshot}; rows sum to ${declared}.`,
      ),
    );
  }
  if (JSON.stringify(counts) !== JSON.stringify(snapshot?.counts ?? {})) {
    issues.push(issue("status_counts_mismatch", "Snapshot status counts do not match its rows."));
  }

  const dimensionRows = [...dimensions.values()]
    .map((dimension) => ({
      ...dimension,
      declaredNumerator: rounded(dimension.declaredNumerator),
      evidenceBoundNumerator: rounded(dimension.evidenceBoundNumerator),
      declaredPercent: percent(dimension.declaredNumerator, dimension.denominator),
      evidenceBoundPercent: percent(dimension.evidenceBoundNumerator, dimension.denominator),
    }))
    .sort((a, b) => a.area.localeCompare(b.area));
  const productionReady =
    rows.length === expectedRequirementCount &&
    evidenceBound === expectedRequirementCount &&
    issues.length === 0;

  return {
    schemaVersion: 1,
    calculatedAt: now.toISOString(),
    sourceRevision: snapshot?.head ?? null,
    targetVersion: targetVersion ?? null,
    evidenceBindings: recordedBindings,
    snapshotFresh,
    denominator,
    declared: {
      numerator: declared,
      denominator,
      percent: percent(declared, denominator),
    },
    evidenceBound: {
      numerator: evidenceBound,
      denominator,
      percent: percent(evidenceBound, denominator),
    },
    productionReady,
    counts,
    dimensions: dimensionRows,
    requirements,
    issues,
  };
}

export function validateProductionClaim(claim, calculation) {
  const issues = [];
  if (claim?.productionReady === true && calculation.productionReady !== true) {
    issues.push(
      issue(
        "production_claim_overstated",
        "Production readiness was claimed before all 510 evidence-bound acceptance conditions passed.",
      ),
    );
  }
  if (
    Number(claim?.evidenceBoundNumerator) !== calculation.evidenceBound.numerator ||
    Number(claim?.denominator) !== calculation.denominator
  ) {
    issues.push(
      issue(
        "published_score_stale",
        "Published evidence-bound numerator or denominator differs from the executed calculation.",
      ),
    );
  }
  if (
    Number(claim?.declaredNumerator) !== calculation.declared.numerator ||
    Number(claim?.declaredPercent) !== calculation.declared.percent ||
    Number(claim?.evidenceBoundPercent) !== calculation.evidenceBound.percent
  ) {
    issues.push(
      issue(
        "published_declared_score_stale",
        "Published declared or evidence-bound percentages differ from the executed calculation.",
      ),
    );
  }
  if (
    claim?.sourceRevision !== calculation.sourceRevision ||
    claim?.targetVersion !== calculation.targetVersion ||
    JSON.stringify(claim?.evidenceBindings ?? {}) !== JSON.stringify(calculation.evidenceBindings)
  ) {
    issues.push(
      issue(
        "published_binding_stale",
        "Published readiness is not bound to the calculated source revision and target version.",
      ),
    );
  }
  if (
    JSON.stringify(claim?.statusCounts ?? {}) !== JSON.stringify(calculation.counts) ||
    JSON.stringify(claim?.dimensions ?? []) !== JSON.stringify(calculation.dimensions)
  ) {
    issues.push(
      issue(
        "published_dimensions_stale",
        "Published status counts or readiness dimensions differ from the executed calculation.",
      ),
    );
  }
  return issues;
}

export function buildReadinessRecoveryPlan(calculation) {
  const actions = [];
  const seen = new Set();
  const add = (code, action) => {
    if (seen.has(code)) return;
    seen.add(code);
    actions.push({ code, action });
  };

  for (const entry of calculation.issues) {
    switch (entry.code) {
      case "evidence_unbound":
        add(
          entry.code,
          "Attach requirement-specific executed evidence and the observing phase; do not raise the status from source text alone.",
        );
        break;
      case "evidence_stale":
      case "snapshot_stale":
      case "snapshot_from_future":
        add(
          entry.code,
          "Rerun the applicable acceptance checks and publish a new timestamped snapshot without mutating historical evidence.",
        );
        break;
      case "source_revision_drift":
        add(
          entry.code,
          "Rerun acceptance checks against the current source revision and bind the replacement snapshot to that revision.",
        );
        break;
      case "target_version_drift":
        add(
          entry.code,
          "Rebuild and retest the intended release target, then bind evidence to its exact version.",
        );
        break;
      default:
        add(
          entry.code,
          "Correct the reported structural defect, regenerate the readiness publication, and rerun the final-readiness gate.",
        );
    }
  }

  if (calculation.requirements.some((row) => row.declaredWeight === 0)) {
    add(
      "not_started",
      "Implement and execute the missing requirement, or record a genuine external boundary with an accountable owner and evidence.",
    );
  }
  return actions;
}

export function createReadinessPublication(calculation, context = {}) {
  const issueSummary = Object.fromEntries(
    [...new Set(calculation.issues.map((entry) => entry.code))]
      .sort()
      .map((code) => [code, calculation.issues.filter((entry) => entry.code === code).length]),
  );
  return {
    schemaVersion: 1,
    phase: "P29 - Final production-readiness closure",
    calculatedAt: calculation.calculatedAt,
    branch: context.branch ?? null,
    currentHead: context.currentHead ?? null,
    sourceRevision: calculation.sourceRevision,
    targetVersion: calculation.targetVersion,
    evidenceBindings: calculation.evidenceBindings,
    productionReady: calculation.productionReady,
    declaredNumerator: calculation.declared.numerator,
    evidenceBoundNumerator: calculation.evidenceBound.numerator,
    denominator: calculation.denominator,
    declaredPercent: calculation.declared.percent,
    evidenceBoundPercent: calculation.evidenceBound.percent,
    statusCounts: calculation.counts,
    dimensions: calculation.dimensions,
    issueSummary,
    recoveryPlan: buildReadinessRecoveryPlan(calculation),
    conclusion: calculation.productionReady
      ? "PRODUCTION READY - every acceptance condition has current requirement-bound evidence."
      : "NOT PRODUCTION READY - source, live-runtime, signing, deployment, device, and requirement-bound evidence gaps remain.",
  };
}
