/** Generate PLAN.md §4's route-disposition ledger from its typed authority. */
import { globSync } from "node:fs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format, resolveConfig } from "prettier";
import {
  CANONICAL_ROUTES,
  ROUTE_DISPOSITIONS,
  unservedCanonicalRoutes,
  validateRouteLedger,
} from "../src/lib/release/route-dispositions.ts";

const CHECK = process.argv.includes("--check");
const DIRECTORY = join("release", "checklists");
const JSON_PATH = join(DIRECTORY, "OCADE_ROUTE_DISPOSITIONS.json");
const MARKDOWN_PATH = join(DIRECTORY, "OCADE_ROUTE_DISPOSITIONS.md");
const prettierConfig = (await resolveConfig(JSON_PATH)) ?? {};

const modulesOnDisk = globSync("src/routes/**/*.{ts,tsx}")
  .filter((path) => !path.includes("__tests__"))
  .map((path) =>
    path
      .replace(/\\/g, "/")
      .replace(/^src\/routes\//, "")
      .replace(/\.(ts|tsx)$/, ""),
  )
  .sort();

const problems = [...validateRouteLedger(modulesOnDisk), ...unservedCanonicalRoutes()];
if (problems.length) {
  console.error("The route-disposition ledger is invalid:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const dispositions = ["CANONICAL", "SUPPORTING", "MIGRATE", "ABSORB", "RETIRE"];
const summary = Object.fromEntries(
  dispositions.map((value) => [
    value.toLowerCase(),
    ROUTE_DISPOSITIONS.filter((entry) => entry.disposition === value).length,
  ]),
);
summary.total = ROUTE_DISPOSITIONS.length;
summary.modulesOnDisk = modulesOnDisk.length;
summary.canonicalAreas = Object.keys(CANONICAL_ROUTES).length;

const document = {
  schemaVersion: 1,
  generatedBy: "scripts/generate-route-dispositions.mjs",
  source: "src/lib/release/route-dispositions.ts",
  authority: "PLAN.md §4",
  summary,
  canonicalRoutes: CANONICAL_ROUTES,
  routes: ROUTE_DISPOSITIONS,
};
const jsonText = await format(JSON.stringify(document), {
  ...prettierConfig,
  parser: "json",
});
const escape = (value) => String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const markdownText = await format(
  [
    "# OCADE route dispositions",
    "",
    "> Generated from `src/lib/release/route-dispositions.ts`. Do not edit by hand.",
    "> `npm run routes:ledger-check` rejects stale output and route/source drift.",
    "",
    "## Summary",
    "",
    `- Route modules: ${summary.modulesOnDisk}`,
    `- Ledger records: ${summary.total}`,
    `- Canonical areas: ${summary.canonicalAreas}`,
    `- Canonical: ${summary.canonical}`,
    `- Supporting: ${summary.supporting}`,
    `- Migrate: ${summary.migrate}`,
    `- Absorb: ${summary.absorb}`,
    `- Retire: ${summary.retire}`,
    "",
    "## Canonical areas",
    "",
    "| Area | Route |",
    "| --- | --- |",
    ...Object.entries(CANONICAL_ROUTES).map(([area, path]) => `| ${area} | \`${path}\` |`),
    "",
    "## Every route module",
    "",
    "| Module | Path | Disposition | Destination | Reason |",
    "| --- | --- | --- | --- | --- |",
    ...ROUTE_DISPOSITIONS.map(
      (entry) =>
        `| \`${entry.module}\` | \`${entry.path}\` | ${entry.disposition} | ${entry.movesTo ? `\`${entry.movesTo}\`` : "—"} | ${escape(entry.reason)} |`,
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
    console.error(`Route-disposition output is stale: ${stale.join(", ")}`);
    console.error("Run `npm run routes:ledger-generate`.");
    process.exit(1);
  }
  console.log(
    `Route-disposition ledger current: ${summary.total}/${summary.modulesOnDisk} routes.`,
  );
} else {
  mkdirSync(DIRECTORY, { recursive: true });
  for (const [path, content] of outputs) writeFileSync(path, content, "utf8");
  console.log(`Wrote route-disposition ledger: ${summary.total} routes.`);
}
