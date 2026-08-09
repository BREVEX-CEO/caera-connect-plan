import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPORT = "release/OCADE_CAPABILITY_STATUS.json";
const ALLOWED = new Set(["REAL WORKING", "PARTIAL", "BLOCKED", "NOT IMPLEMENTED"]);
const REQUIRED = [
  "Chat/Brain",
  "Control+Work",
  "Universal Software Control",
  "Browser",
  "Desktop",
  "Files",
  "Voice",
  "Gestures",
  "Vision",
  "Research",
  "Mobile",
  "Connectors",
  "GUI",
  "Local Model",
  "Database",
  "Installer/Updates",
  "Security/Recovery",
  "Cross-platform",
];

const issues = [];
const check = (condition, message) => {
  if (!condition) issues.push(message);
};
const safeRelative = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !value.startsWith("/") &&
  !/^[a-z]:[\\/]/i.test(value) &&
  !value.split(/[\\/]/).includes("..");

check(existsSync(REPORT), `${REPORT} is missing.`);
const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : {};
check(report.schemaVersion === 1, "Capability report schemaVersion must be 1.");
check(Array.isArray(report.capabilities), "Capability report must contain capabilities[].");

const capabilities = Array.isArray(report.capabilities) ? report.capabilities : [];
const names = capabilities.map((entry) => entry.capability);
check(new Set(names).size === names.length, "Capability names must be unique.");
for (const required of REQUIRED) check(names.includes(required), `Missing capability: ${required}.`);

for (const entry of capabilities) {
  check(ALLOWED.has(entry.status), `${entry.capability} has invalid status ${entry.status}.`);
  check(Array.isArray(entry.proof), `${entry.capability} must declare proof[].`);
  for (const proof of entry.proof ?? []) {
    check(safeRelative(proof.path), `${entry.capability} has an unsafe proof path.`);
    check(existsSync(proof.path), `${entry.capability} proof does not exist: ${proof.path}.`);
    check(
      ["real-target", "integration", "unit", "source"].includes(proof.kind),
      `${entry.capability} has invalid proof kind ${proof.kind}.`,
    );
    check(
      typeof proof.summary === "string" && proof.summary.length >= 20,
      `${entry.capability} proof requires a useful summary.`,
    );
  }
  if (entry.status === "REAL WORKING") {
    check(
      (entry.proof ?? []).some((proof) => proof.kind === "real-target"),
      `${entry.capability} cannot be REAL WORKING without real-target proof.`,
    );
    check(!entry.remainingBlocker, `${entry.capability} is REAL WORKING but still names a blocker.`);
  }
  if (entry.status === "PARTIAL") {
    check((entry.proof ?? []).length > 0, `${entry.capability} is PARTIAL without proof.`);
    check(
      typeof entry.remainingBlocker === "string" && entry.remainingBlocker.length >= 20,
      `${entry.capability} is PARTIAL without a concrete remaining blocker.`,
    );
  }
  if (entry.status === "BLOCKED") {
    check(
      typeof entry.remainingBlocker === "string" && entry.remainingBlocker.length >= 20,
      `${entry.capability} is BLOCKED without a concrete blocker.`,
    );
    check(
      typeof entry.ownerAction === "string" && entry.ownerAction.length >= 20,
      `${entry.capability} is BLOCKED without one owner action.`,
    );
  }
}

const forbiddenFields = /"(?:weight|score|percent|numerator|denominator|requirements)"\s*:/i;
check(!forbiddenFields.test(JSON.stringify(report)), "Capability report contains legacy scoring fields.");

const ACTIVE_ROOTS = ["src", "scripts", ".github"];
const ACTIVE_FILES = ["package.json", "docs/ARCHITECTURE.md", "docs/CHARTER.md", "docs/GOVERNANCE.md", "docs/boundaries.json", REPORT, "release/OCADE_PORTABLE_RELEASE_MANIFEST.json"];
const LEGACY = [
  { code: "legacy_count", pattern: /\b510(?:-row| rows| requirements|\/510|\s+requirement)/i },
  { code: "legacy_id", pattern: /\b(?:AZ|HWE|CXR)-\d{2,3}\b/i },
  {
    code: "legacy_snapshot",
    pattern: new RegExp(
      `${["OCADE", "REQUIREMENT", "STATUS", "SNAPSHOT"].join("_")}|${[
        "OCADE",
        "P29",
        "FINAL",
        "READINESS",
      ].join("_")}`,
      "i",
    ),
  },
  {
    code: "legacy_gate",
    pattern: new RegExp(
      [
        ["readiness", "check"].join(":"),
        ["readiness", "publish"].join(":"),
        ["evidence", "integrity"].join(":"),
        ["readiness", "engine"].join("-"),
      ].join("|"),
      "i",
    ),
  },
];
const SOURCE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|mts|json|md|ya?ml)$/i;
const ignoredDirectories = new Set(["node_modules", "target", ".git", ".output", "dist"]);

function walk(root, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (SOURCE_EXTENSIONS.test(entry.name)) out.push(path.replace(/\\/g, "/"));
  }
  return out;
}

const scanned = [...new Set([...ACTIVE_ROOTS.flatMap((root) => walk(root)), ...ACTIVE_FILES])]
  .filter(
    (path) =>
      path !== "scripts/check-capability-status.mjs" &&
      existsSync(path) &&
      statSync(path).isFile(),
  );
for (const path of scanned) {
  const content = readFileSync(path, "utf8");
  for (const rule of LEGACY) {
    if (rule.pattern.test(content)) issues.push(`${rule.code}: ${relative(".", path)}`);
  }
}

if (issues.length > 0) {
  console.error(`OCADE capability-status gate FAILED — ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const counts = Object.fromEntries([...ALLOWED].map((status) => [status, capabilities.filter((entry) => entry.status === status).length]));
console.log(`OCADE capability-status gate: ${capabilities.length} capabilities, no weighted score.`);
console.log(JSON.stringify(counts));
console.log("Legacy 510/AZ/HWE/CXR operational dependency scan: clean.");
