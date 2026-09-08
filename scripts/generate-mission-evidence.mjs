/**
 * Compose PLAN.md, current-reference parity, route placement, and remaining
 * gaps into one deterministic continuation graph.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import {
  extractPlanRequirements,
  MISSION_SECTION_STATES,
  validateMissionEvidence,
} from "../src/lib/release/mission-evidence.ts";
import { PRODUCT_REFERENCE_PARITY } from "../src/lib/release/product-reference-parity.ts";
import { ROUTE_DISPOSITIONS } from "../src/lib/release/route-dispositions.ts";
import { REMAINING_PRODUCT_GAPS } from "../src/lib/release/remaining-gaps.ts";

const CHECK = process.argv.includes("--check");
const DIRECTORY = join("release", "checklists");
const JSON_PATH = join(DIRECTORY, "OCADE_MISSION_EVIDENCE.json");
const MARKDOWN_PATH = join(DIRECTORY, "OCADE_MISSION_EVIDENCE.md");
const prettierConfig = (await resolveConfig(JSON_PATH)) ?? {};
const planText = readFileSync("PLAN.md", "utf8");
const planRequirements = extractPlanRequirements(planText);
const problems = validateMissionEvidence(planRequirements, existsSync);
if (problems.length) {
  console.error("The mission evidence graph is invalid:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const groupCount = (records, key, value) => records.filter((item) => item[key] === value).length;
const summary = {
  planRequirements: planRequirements.length,
  planSections: MISSION_SECTION_STATES.length,
  completeSections: groupCount(MISSION_SECTION_STATES, "sectionProgress", "COMPLETE"),
  partialSections: groupCount(MISSION_SECTION_STATES, "sectionProgress", "PARTIAL"),
  notStartedSections: groupCount(MISSION_SECTION_STATES, "sectionProgress", "NOT_STARTED"),
  parityCapabilities: PRODUCT_REFERENCE_PARITY.length,
  routeRecords: ROUTE_DISPOSITIONS.length,
  remainingGapRecords: REMAINING_PRODUCT_GAPS.length,
  applicableMissingGaps: groupCount(REMAINING_PRODUCT_GAPS, "status", "MISSING"),
};
const planSha256 = createHash("sha256").update(planText).digest("hex");

const document = {
  schemaVersion: 1,
  generatedBy: "scripts/generate-mission-evidence.mjs",
  authority: "PLAN.md",
  planSha256,
  statusSemantics: {
    requirementScope:
      "Each PLAN prose, list, and table block is represented. Progress and proof are inherited from its named section and never promote an individual item by file existence alone.",
    composition:
      "Feature-level claims remain in the parity, route, remaining-gap, donor, and final verification ledgers referenced by this graph.",
  },
  summary,
  sections: MISSION_SECTION_STATES,
  planRequirements,
  composedLedgers: {
    parity: {
      path: "docs/product-reference/OCADE_REFERENCE_PARITY.json",
      records: PRODUCT_REFERENCE_PARITY.map((item) => item.id),
    },
    routes: {
      path: "release/checklists/OCADE_ROUTE_DISPOSITIONS.json",
      records: ROUTE_DISPOSITIONS.map((item) => item.module),
    },
    remainingGaps: {
      path: "release/checklists/OCADE_REMAINING_PRODUCT_GAPS.json",
      records: REMAINING_PRODUCT_GAPS.map((item) => item.id),
    },
    donor: {
      path: "imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl",
      records: 2126,
      note: "Canonical archive-hash-bound disposition ledger; generated reports add current OCADE reachability evidence.",
    },
  },
};
const jsonText = await format(JSON.stringify(document), {
  ...prettierConfig,
  parser: "json",
});

const escape = (value) => String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const markdownText = await format(
  [
    "# OCADE mission evidence graph",
    "",
    "> Generated from `PLAN.md` and the typed evidence authorities. Do not edit by hand.",
    "> `npm run mission:check` rejects stale output, missing ownership, duplicate requirements, and missing authorities.",
    "",
    `PLAN SHA-256: \`${planSha256}\``,
    "",
    "Individual PLAN records inherit section progress and proof. This accounts for every requirement without claiming that a file's existence proves the individual behavior. Feature claims stay in the composed parity, route, gap, donor, and final verification ledgers.",
    "",
    "## Summary",
    "",
    `- PLAN semantic requirements: ${summary.planRequirements}`,
    `- PLAN sections: ${summary.planSections} (${summary.completeSections} complete, ${summary.partialSections} partial, ${summary.notStartedSections} not started)`,
    `- Current-reference parity capabilities: ${summary.parityCapabilities}`,
    `- Route dispositions: ${summary.routeRecords}`,
    `- Remaining applicable gaps: ${summary.remainingGapRecords} (${summary.applicableMissingGaps} MISSING)`,
    "- Donor dispositions: 2,126 (schema upgrade owned by Block 3)",
    "",
    "## Section continuation map",
    "",
    "| Section | Block | Progress | Proof | Authority | Remaining action | Completion evidence |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...MISSION_SECTION_STATES.map(
      (item) =>
        `| ${item.section} | ${item.continuationBlock} | ${item.sectionProgress} | ${item.proofLevel} | \`${item.currentAuthority}\` | ${escape(item.remainingAction)} | ${escape(item.evidenceTarget)} |`,
    ),
    "",
    "## Every PLAN semantic requirement",
    "",
    "| ID | PLAN line | Section | Kind | Requirement | Block | Section progress | Section proof | Authority |",
    "| --- | ---: | --- | --- | --- | ---: | --- | --- | --- |",
    ...planRequirements.map(
      (item) =>
        `| ${item.id} | ${item.planLine} | ${item.section} | ${item.kind} | ${escape(item.requirement)} | ${item.continuationBlock} | ${item.sectionProgress} | ${item.proofLevel} | \`${item.currentAuthority}\` |`,
    ),
    "",
  ].join("\n"),
  { ...prettierConfig, parser: "markdown" },
);

const outputs = [
  [JSON_PATH, jsonText],
  [MARKDOWN_PATH, markdownText],
];
if (CHECK) {
  const stale = outputs
    .filter(([path, expected]) => !existsSync(path) || readFileSync(path, "utf8") !== expected)
    .map(([path]) => path);
  if (stale.length) {
    console.error(`Mission evidence output is stale: ${stale.join(", ")}`);
    console.error("Run `npm run mission:generate`.");
    process.exit(1);
  }
  console.log(
    `Mission evidence current: ${summary.planRequirements} PLAN records, ${summary.parityCapabilities} parity records, ${summary.routeRecords} routes, ${summary.remainingGapRecords} gaps.`,
  );
} else {
  mkdirSync(DIRECTORY, { recursive: true });
  for (const [path, content] of outputs) writeFileSync(path, content, "utf8");
  console.log(`Wrote mission evidence graph: ${summary.planRequirements} PLAN records.`);
}
