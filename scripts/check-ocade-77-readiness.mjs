import { existsSync, readFileSync } from "node:fs";
import { OCADE_77_READINESS } from "./ocade-77-readiness.mjs";

const EXPECTED_TOTAL = 77;
const EXPECTED_CLASSIFICATIONS = {
  "source+test": 49,
  "source-inspected": 18,
  "truthful-unavailable": 10,
};

/**
 * The original 49 source+test items already had committed focused proof.
 * These 28 IDs were previously classified only by implementation/boundary
 * status. They now each have an explicit Vitest regression whose title includes
 * the readiness ID, so every one of the 77 requirements owns a committed
 * test/proof artifact without changing its semantic availability class.
 */
const ADDED_FOCUSED_PROOF = new Map([
  ...[9, 16, 17, 19, 22, 31, 34, 35, 37, 38, 39, 40, 42, 43, 44, 47, 70, 76].map((id) => [
    id,
    "src/lib/__tests__/ocade-readiness-source-boundaries.test.ts",
  ]),
  ...[18, 20, 45, 46, 48].map((id) => [
    id,
    "src/lib/__tests__/ocade-readiness-unavailable-ui.test.ts",
  ]),
  ...[49, 61, 65, 69, 71].map((id) => [
    id,
    "src/lib/__tests__/ocade-readiness-unavailable-runtime.test.ts",
  ]),
]);

const errors = [];
const ids = new Set();
const classifications = new Map();

if (OCADE_77_READINESS.length !== EXPECTED_TOTAL) {
  errors.push(`expected ${EXPECTED_TOTAL} readiness items, found ${OCADE_77_READINESS.length}`);
}

for (const item of OCADE_77_READINESS) {
  if (!Number.isInteger(item.id) || item.id < 1 || item.id > EXPECTED_TOTAL) {
    errors.push(`invalid readiness id: ${String(item.id)}`);
  }
  if (ids.has(item.id)) errors.push(`duplicate readiness id: ${item.id}`);
  ids.add(item.id);

  if (!item.requirement || typeof item.requirement !== "string") {
    errors.push(`item ${item.id} has no requirement text`);
  }

  if (!(item.classification in EXPECTED_CLASSIFICATIONS)) {
    errors.push(`item ${item.id} has unsupported classification: ${item.classification}`);
  } else {
    classifications.set(item.classification, (classifications.get(item.classification) ?? 0) + 1);
  }

  if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
    errors.push(`item ${item.id} has no evidence paths`);
    continue;
  }

  for (const evidencePath of item.evidence) {
    if (!existsSync(evidencePath)) {
      errors.push(`item ${item.id} evidence path is missing: ${evidencePath}`);
    }
  }
}

for (let id = 1; id <= EXPECTED_TOTAL; id += 1) {
  if (!ids.has(id)) errors.push(`readiness id ${id} is missing`);
}

for (const [classification, expected] of Object.entries(EXPECTED_CLASSIFICATIONS)) {
  const actual = classifications.get(classification) ?? 0;
  if (actual !== expected) {
    errors.push(`${classification}: expected ${expected}, found ${actual}`);
  }
}

const nonSourceTestIds = OCADE_77_READINESS.filter((item) => item.classification !== "source+test")
  .map((item) => item.id)
  .sort((a, b) => a - b);
const mappedProofIds = [...ADDED_FOCUSED_PROOF.keys()].sort((a, b) => a - b);

if (JSON.stringify(nonSourceTestIds) !== JSON.stringify(mappedProofIds)) {
  errors.push(
    `focused proof map must cover exactly every non-source+test item; expected [${nonSourceTestIds}], found [${mappedProofIds}]`,
  );
}

for (const [id, proofPath] of ADDED_FOCUSED_PROOF) {
  if (!existsSync(proofPath)) {
    errors.push(`item ${id} focused proof file is missing: ${proofPath}`);
    continue;
  }
  const proofSource = readFileSync(proofPath, "utf8");
  if (!proofSource.includes(`#${id}`)) {
    errors.push(
      `item ${id} proof file does not contain an explicit #${id} regression: ${proofPath}`,
    );
  }
}

const committedProofArtifacts =
  (classifications.get("source+test") ?? 0) + ADDED_FOCUSED_PROOF.size;
if (committedProofArtifacts !== EXPECTED_TOTAL) {
  errors.push(
    `test/proof artifacts committed: expected ${EXPECTED_TOTAL}, found ${committedProofArtifacts}`,
  );
}

if (errors.length > 0) {
  console.error("OCADE 77 readiness contract FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OCADE 77 readiness contract OK");
console.log(`- materially resolved: ${EXPECTED_TOTAL}/${EXPECTED_TOTAL}`);
console.log(`- test/proof artifacts committed: ${committedProofArtifacts}/${EXPECTED_TOTAL}`);
console.log(
  `- original source+test implementation class: ${EXPECTED_CLASSIFICATIONS["source+test"]}`,
);
console.log(
  `- source-inspected implementation class with focused proof: ${EXPECTED_CLASSIFICATIONS["source-inspected"]}`,
);
console.log(
  `- fail-closed/unavailable implementation class with focused proof: ${EXPECTED_CLASSIFICATIONS["truthful-unavailable"]}`,
);
console.log("- fresh execution success is intentionally NOT inferred by committed proof artifacts");
