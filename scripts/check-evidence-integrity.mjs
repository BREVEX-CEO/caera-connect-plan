/**
 * Evidence-integrity gate — makes false progress claims fail the pipeline.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every rule this gate enforces was already written down somewhere, and a
 * written rule stops nothing. This repository has already shipped a fabricated
 * green result once: `app-coverage-registry` hardcoded Blender as detected at
 * version 4.0.2 with evidence "Found executable", on a machine with no Blender.
 * Its own test asserted the lie, and its gate checked only that the file
 * existed. Nothing caught it but a human reading the file.
 *
 * So these six conditions are executable, not documented:
 *
 *   1. NO OWNER            — a requirement nobody is accountable for.
 *   2. MISSING EVIDENCE     — evidence citing a file that is not on disk.
 *   3. REVISION DRIFT       — evidence recorded against a different commit than
 *                             the one being verified.
 *   4. UNBACKED REAL-TARGET — a row claiming proof on real equipment without a
 *                             retained raw evidence artefact under release/.
 *   5. SOURCE-TEXT AS PROOF — a structural test (one that reads a file and
 *                             matches strings) cited as runtime proof.
 *   6. BLOCKED BUT VERIFIED — a row that is externally blocked while carrying
 *                             the weight of something proven.
 *
 * WHAT THIS GATE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It does not judge whether evidence is *convincing*. It judges whether the
 * claim is internally coherent and physically backed. A gate that tried to
 * assess persuasiveness would be a gate that could be argued with.
 *
 * Usage: node scripts/check-evidence-integrity.mjs [--json]
 * Exit:  0 when every row is coherent; 1 otherwise.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const jsonOnly = process.argv.includes("--json");

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const TEST_KINDS = "release/OCADE_TEST_KINDS.json";

/** Statuses that assert the thing was observed working on its real target. */
const REAL_TARGET_STATUSES = new Set(["REAL TARGET RUNTIME VERIFIED"]);

/**
 * The weight above which a row is claiming more than "written and unit tested".
 * An externally blocked row must not exceed it: if the work is genuinely
 * blocked, nobody has seen it run.
 */
const BLOCKED_WEIGHT_CEILING = 0.6;

const violations = [];

function violation(code, requirementId, detail) {
  violations.push({ code, requirementId, detail });
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const snapshot = JSON.parse(readFileSync(resolve(root, SNAPSHOT), "utf8"));
const rows = Array.isArray(snapshot.requirements) ? snapshot.requirements : [];

if (rows.length === 0) {
  console.error("Evidence-integrity gate failed: the snapshot contains no requirements.");
  process.exit(1);
}

/*
 * Structural-only test files, as classified by the test-kind gate. Reused
 * rather than reclassified, so the two gates can never disagree about what
 * counts as a structural test.
 */
const structuralOnly = new Set();
if (!existsSync(resolve(root, TEST_KINDS))) {
  // The ledger is the only source for this classification. Without it,
  // condition 5 cannot be evaluated, and silently evaluating nothing would be
  // the exact failure this gate exists to prevent.
  violations.push({
    code: "test_kinds_ledger_missing",
    requirementId: null,
    detail: `${TEST_KINDS} is absent, so structural-vs-execution cannot be checked. Absence of a check is not a passing check.`,
  });
} else {
  const kinds = JSON.parse(readFileSync(resolve(root, TEST_KINDS), "utf8"));
  /*
   * Entries under `structuralOnly` are structural BY VIRTUE OF BEING THERE —
   * the list carries `path`, `why` and `couldBeStronger`, and no `kind` field.
   * An earlier version of this loader required `entry.kind === "structural"`,
   * which no entry has, so the set silently stayed empty and condition 5 was
   * inert while appearing to pass. Read the schema, not the schema you expect.
   */
  const entries = kinds.structuralOnly ?? kinds.files ?? [];
  for (const entry of entries) {
    const path = typeof entry === "string" ? entry : entry.path;
    if (path) structuralOnly.add(path.replace(/\\/g, "/"));
  }
  if (structuralOnly.size === 0 && entries.length > 0) {
    violations.push({
      code: "test_kinds_ledger_unreadable",
      requirementId: null,
      detail: `${TEST_KINDS} lists ${entries.length} entries but none yielded a path. The loader and the ledger schema disagree.`,
    });
  }
}

/**
 * Pull file paths out of a free-text evidence string.
 *
 * Evidence is prose with paths embedded in it, so this matches path-shaped
 * tokens rather than assuming a structure the field never had. Anything that
 * does not look like a repository path is left alone — this gate reports
 * missing files, not prose it failed to parse.
 */
function citedPaths(evidence) {
  if (typeof evidence !== "string") return [];
  const matches = evidence.matchAll(
    /\b((?:release|src|scripts|native|extension|mobile|supabase|android|ios|audit)\/[A-Za-z0-9._$/\\-]+)/g,
  );
  return [...new Set([...matches].map((m) => m[1].replace(/\\/g, "/").replace(/[.,;:]+$/, "")))];
}

// --- Condition 3: revision drift, evaluated once for the whole snapshot ------
let headRevision = null;
try {
  headRevision = git("rev-parse", "HEAD");
} catch {
  headRevision = null;
}

const recorded = snapshot.evidenceBindings?.sourceRevision ?? snapshot.head ?? null;

if (!recorded) {
  violation("revision_drift", null, "The snapshot records no source revision at all.");
} else if (headRevision && recorded !== headRevision) {
  /*
   * A binding commit cannot contain its own hash, so HEAD legitimately sits one
   * commit ahead while that commit touches only the binding files. Anything
   * else means the evidence describes a tree that has moved.
   */
  let changed = [];
  try {
    changed = git("diff", "--name-only", `${recorded}..${headRevision}`)
      .split("\n")
      .filter(Boolean);
  } catch {
    changed = null;
  }
  const BINDING_ONLY = new Set([
    "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json",
    "release/OCADE_P29_FINAL_READINESS.json",
    "CHECKPOINT.md",
  ]);
  const bindingOnly =
    Array.isArray(changed) && changed.length > 0 && changed.every((p) => BINDING_ONLY.has(p));
  if (!bindingOnly) {
    violation(
      "revision_drift",
      null,
      `Evidence is bound to ${recorded.slice(0, 7)} but HEAD is ${headRevision.slice(0, 7)}, and the difference is not limited to the binding files. Re-run the evidence, then rebind.`,
    );
  }
}

// --- Per-row conditions -----------------------------------------------------
for (const row of rows) {
  const id = row.id ?? "(no id)";

  // Condition 1 — no owner.
  if (!row.owner || String(row.owner).trim() === "") {
    violation("no_owner", id, "No accountable owner. Every requirement must name one.");
  }
  if (row.status === "EXTERNALLY BLOCKED") {
    const b = row.blockerOwner;
    if (!b || !b.requires || !b.proofWhenUnblocked) {
      violation(
        "blocker_unspecified",
        id,
        "Externally blocked without naming what is required and what proof closes it. A blocker with no exit condition can never be cleared.",
      );
    }
  }

  // Condition 2 — evidence pointing at a file that does not exist.
  for (const path of citedPaths(row.evidence)) {
    if (!existsSync(resolve(root, path))) {
      violation("evidence_file_missing", id, `Evidence cites ${path}, which is not on disk.`);
    }
  }

  // Condition 4 — real-target claim with no retained raw artefact.
  if (REAL_TARGET_STATUSES.has(row.status)) {
    const retained = citedPaths(row.evidence).filter(
      (p) => p.startsWith("release/") && existsSync(resolve(root, p)),
    );
    if (retained.length === 0) {
      violation(
        "real_target_without_evidence",
        id,
        "Claims proof on real equipment but cites no retained artefact under release/. Real-target proof requires a retained record, not a description of one.",
      );
    }
  }

  // Condition 5 — a structural test used as runtime proof.
  if (REAL_TARGET_STATUSES.has(row.status) || row.status === "SIMULATED RUNTIME VERIFIED") {
    for (const path of citedPaths(row.evidence)) {
      if (structuralOnly.has(path)) {
        violation(
          "source_text_as_runtime_proof",
          id,
          `Cites ${path} as runtime proof, but the test-kind gate classifies it as structural-only. Reading a file and matching strings proves the string is present, not that anything ran.`,
        );
      }
    }
  }

  // Condition 6 — blocked, yet carrying the weight of something proven.
  if (row.status === "EXTERNALLY BLOCKED" && Number(row.weight) > BLOCKED_WEIGHT_CEILING) {
    violation(
      "blocked_but_verified",
      id,
      `Externally blocked but weighted ${row.weight}, above the ${BLOCKED_WEIGHT_CEILING} ceiling. If nobody can run it, nobody has seen it work.`,
    );
  }
  if (row.status === "EXTERNALLY BLOCKED" && REAL_TARGET_STATUSES.has(row.verifiedStatus)) {
    violation("blocked_but_verified", id, "Externally blocked and simultaneously marked verified.");
  }
}

// --- Report -----------------------------------------------------------------
const byCode = violations.reduce((acc, v) => {
  acc[v.code] = (acc[v.code] ?? 0) + 1;
  return acc;
}, {});

if (jsonOnly) {
  console.log(JSON.stringify({ checked: rows.length, violations, byCode }, null, 2));
  process.exit(violations.length > 0 ? 1 : 0);
}

if (violations.length > 0) {
  console.error(`OCADE evidence-integrity gate FAILED — ${violations.length} violation(s):`);
  for (const [code, count] of Object.entries(byCode)) console.error(`  ${code}: ${count}`);
  console.error("");
  for (const v of violations.slice(0, 40)) {
    console.error(`- [${v.code}] ${v.requirementId ?? "snapshot"}: ${v.detail}`);
  }
  if (violations.length > 40) console.error(`  ... and ${violations.length - 40} more`);
  process.exit(1);
}

console.log(`OCADE evidence-integrity gate: ${rows.length} requirements, 0 violations.`);
console.log(
  "Checked: owner present, blocker exit condition named, evidence files exist, revision bound, real-target claims retained, no structural test used as runtime proof, no blocked row weighted as proven.",
);
