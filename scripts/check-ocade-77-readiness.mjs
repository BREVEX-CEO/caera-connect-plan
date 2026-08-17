import { existsSync } from "node:fs";
import { OCADE_77_READINESS } from "./ocade-77-readiness.mjs";

const EXPECTED_TOTAL = 77;
const EXPECTED_CLASSIFICATIONS = {
  "source+test": 49,
  "source-inspected": 18,
  "truthful-unavailable": 10,
};

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
    classifications.set(
      item.classification,
      (classifications.get(item.classification) ?? 0) + 1,
    );
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

if (errors.length > 0) {
  console.error("OCADE 77 readiness contract FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("OCADE 77 readiness contract OK");
console.log(`- materially resolved: ${EXPECTED_TOTAL}/${EXPECTED_TOTAL}`);
console.log(`- source + focused test/proof artifact: ${EXPECTED_CLASSIFICATIONS["source+test"]}`);
console.log(`- source inspected: ${EXPECTED_CLASSIFICATIONS["source-inspected"]}`);
console.log(`- explicit fail-closed/unavailable boundary: ${EXPECTED_CLASSIFICATIONS["truthful-unavailable"]}`);
console.log("- fresh hosted CI / production / hardware proof is intentionally NOT inferred by this check");
