#!/usr/bin/env node
/**
 * Third-party redistribution rights (requirements 180, 182).
 *
 * `--check` fails when anything OCADE ships is missing from release/third-party-licences.json,
 * has a different version, or carries a licence outside the allowed list: every Python package
 * in device-agent/windows/requirements.lock (the companion installer) and every production
 * package in package-lock.json (the website bundle). A package that is not allowed may stay
 * only if it is marked not bundled and the installer spec really excludes it.
 * `--write` regenerates THIRD_PARTY_NOTICES.txt from the same data.
 */
import { readFileSync, writeFileSync } from "node:fs";

const inventory = JSON.parse(readFileSync("release/third-party-licences.json", "utf8"));
const lock = readFileSync("device-agent/windows/requirements.lock", "utf8");
const spec = readFileSync("device-agent/windows/packaging/ocade-agent.spec", "utf8");
const npmLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const allowed = new Set(inventory.allowed);
const modelEntries = Object.entries(inventory.models ?? {});
const modelNoticeSection = modelEntries.length
  ? [
      "## On-device AI model licence",
      "",
      "OCADE's Offline Mode includes LFM2.5-VL-450M by Liquid AI, Inc. Its language weights and vision projector are governed by the **LFM Open License v1.0**, separate from OCADE's software licence. A complete copy is distributed with the website and available to recipients below. Commercial eligibility must be verified before public release.",
      "",
      "| Model | Licensor | Licence | Recipient copy |",
      "|---|---|---|---|",
      ...modelEntries.map(
        ([name, entry]) =>
          `| ${name} | ${entry.licensor} | ${entry.licence} | [Full licence copy](/${entry.licenceCopy.replace("public/", "")}) |`,
      ),
      "",
      "",
    ].join("\n")
  : "";

/** An SPDX expression is acceptable when every AND part, or any OR alternative, is allowed. */
export function permitted(expression) {
  const plain = String(expression ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[()]/g, " ")
    .trim();
  if (!plain) return false;
  return plain
    .split(/\s+OR\s+/)
    .some((alternative) =>
      alternative.split(/\s+AND\s+/).every((part) => allowed.has(part.trim())),
    );
}

const problems = [];
// Model files are separate redistribution artifacts, not npm/Python packages.
// Fail before release if the complete customer copy is absent or incomplete.
for (const [name, entry] of modelEntries) {
  if (entry.licence !== "LFM Open License v1.0" || entry.licensor !== "Liquid AI, Inc.")
    problems.push(`model ${name}: model licence or licensor requires review`);
  if (!entry.licenceCopy?.startsWith("public/legal/")) {
    problems.push(`model ${name}: missing local public licence copy path`);
    continue;
  }
  let copy = "";
  try {
    copy = readFileSync(entry.licenceCopy, "utf8");
  } catch {
    problems.push(`model ${name}: full licence not present at ${entry.licenceCopy}`);
    continue;
  }
  for (const clause of [
    "LFM Open License v1.0",
    "4. Redistribution.",
    "5. Commercial Use Limitation.",
    "11. Termination.",
    "END OF TERMS AND CONDITIONS",
  ])
    if (!copy.includes(clause))
      problems.push(`model ${name}: incomplete local licence copy (missing ${clause})`);
}
const python = Object.fromEntries(
  [...lock.matchAll(/^([A-Za-z0-9_.-]+)==([^\s;\\]+)/gm)].map(([, name, version]) => [
    name.toLowerCase(),
    version,
  ]),
);
for (const [name, version] of Object.entries(python)) {
  const entry = inventory.python[name];
  if (!entry) problems.push(`python ${name}==${version} is shipped but not in the inventory`);
  else if (entry.version !== version)
    problems.push(`python ${name}: inventory ${entry.version}, lock ${version}`);
  else if (!permitted(entry.licence)) {
    const excluded = new RegExp(`excludes=\\[[^\\]]*"${name}"`).test(spec);
    if (entry.bundled !== false || !excluded)
      problems.push(
        `python ${name} (${entry.licence}) is not an allowed licence and is not excluded from the installer`,
      );
  }
}
// The lock is the shipped truth only if it still matches every pin a person edits.
const pins = readFileSync("device-agent/windows/requirements.txt", "utf8");
for (const [, name, version] of pins.matchAll(/^([A-Za-z0-9_.-]+)==([^\s;#]+)/gm))
  if (python[name.toLowerCase()] !== version)
    problems.push(
      `requirements.lock has ${name}==${python[name.toLowerCase()]}, requirements.txt pins ${version}; regenerate the lock`,
    );
for (const name of Object.keys(inventory.python))
  if (!(name in python)) problems.push(`python ${name} is in the inventory but no longer shipped`);

const npm = [];
for (const [path, meta] of Object.entries(npmLock.packages)) {
  if (!path || meta.dev || meta.devOptional) continue;
  const name = path.split("node_modules/").pop();
  let licence = meta.license;
  if (!licence) {
    try {
      licence = JSON.parse(readFileSync(`${path}/package.json`, "utf8")).license;
    } catch {
      licence = undefined;
    }
  }
  npm.push({ name, version: meta.version, licence: licence ?? "UNKNOWN" });
  if (!permitted(licence))
    problems.push(
      `npm ${name}@${meta.version} (${licence ?? "no licence"}) is not an allowed licence`,
    );
}

if (process.argv.includes("--write")) {
  const rows = (list) =>
    list.map((item) => `| ${item.name} | ${item.version ?? ""} | ${item.licence} |`).join("\n");
  const bundledPython = Object.entries(inventory.python)
    .filter(([, entry]) => entry.bundled !== false)
    .map(([name, entry]) => ({ name, ...entry }));
  const text = `# Third-party notices

Generated by \`npm run licences:write\` from \`release/third-party-licences.json\`; do not edit by hand.
OCADE by CARCC includes the components below under their own licences. Licence texts are in each
component's distribution and at its project page.

## Conditions

${Object.entries(inventory.conditions)
  .map(([licence, condition]) => `- **${licence}:** ${condition}`)
  .join("\n")}

## Native and runtime components

| Component | Licence | Note |
|---|---|---|
${Object.entries(inventory.binaries)
  .map(([name, entry]) => `| ${name} | ${entry.licence} | ${entry.note} |`)
  .join("\n")}

## Companion (Python packages in the installer)

| Package | Version | Licence |
|---|---|---|
${rows(bundledPython)}

## Website (production JavaScript packages)

| Package | Version | Licence |
|---|---|---|
${rows(npm.sort((a, b) => a.name.localeCompare(b.name)))}
`;
  writeFileSync(
    "THIRD_PARTY_NOTICES.txt",
    text.replace(
      "## Native and runtime components",
      modelNoticeSection + "## Native and runtime components",
    ),
  );
}

if (process.argv.includes("--check")) {
  for (const [item, action] of Object.entries(inventory.ownerReview ?? {}))
    console.log(`OWNER REVIEW: ${item}: ${action}`);
  const notices = readFileSync("THIRD_PARTY_NOTICES.txt", "utf8");
  for (const [name, entry] of modelEntries)
    if (
      !notices.includes(`| ${name} |`) ||
      !notices.includes(entry.licenceCopy.replace("public/", "/"))
    )
      problems.push(`model ${name}: missing third-party notice or customer licence link`);
  for (const { name } of npm)
    if (!notices.includes(`| ${name} |`)) {
      console.error(`THIRD_PARTY_NOTICES.txt is out of date (${name}); run npm run licences:write`);
      process.exit(1);
    }
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(
    `Licences: ${Object.keys(python).length} Python and ${npm.length} npm packages allowed for redistribution.`,
  );
}
