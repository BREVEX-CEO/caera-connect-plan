#!/usr/bin/env node
/**
 * Static gate for the OCADE Cowork extension.
 *
 * The end-to-end suite proves the extension BEHAVES; this proves it cannot ship
 * having quietly given itself more reach than it needs. Both matter: a
 * behavioural test passes just as happily against a manifest that asks for
 * every site on the internet.
 *
 * Exit 1 on any finding. Run: `npm run extension:check`.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "extension";
const failures = [];
const fail = (message) => failures.push(message);

if (!existsSync(join(ROOT, "manifest.json"))) {
  console.error("extension/manifest.json is missing.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));

if (manifest.manifest_version !== 3) fail("The manifest must be version 3.");

/*
 * The whole security posture. Host access is granted per site by the person;
 * a standing `host_permissions` entry would mean OCADE can reach every site
 * from the moment it is installed, whatever the popup shows.
 */
if (Array.isArray(manifest.host_permissions) && manifest.host_permissions.length > 0) {
  fail(
    `The extension must declare NO standing host permissions; found: ${manifest.host_permissions.join(", ")}`,
  );
}

const ALLOWED = new Set(["tabs", "scripting", "storage", "activeTab"]);
for (const permission of manifest.permissions ?? []) {
  if (!ALLOWED.has(permission)) fail(`Unexpected permission: ${permission}`);
}
for (const forbidden of [
  "<all_urls>",
  "webRequest",
  "cookies",
  "history",
  "debugger",
  "management",
]) {
  if ((manifest.permissions ?? []).includes(forbidden)) fail(`Refused permission: ${forbidden}`);
}

const files = [
  "src/background.js",
  "src/content.js",
  "src/protocol.js",
  "src/popup.html",
  "src/popup.js",
];
for (const file of files) {
  if (!existsSync(join(ROOT, file))) fail(`Missing file: ${file}`);
}

const background = readFileSync(join(ROOT, "src/background.js"), "utf8");

/*
 * The stop latch must not live only in memory. MV3 recycles an idle service
 * worker, and an in-memory latch comes back RUNNING with it — the stop button
 * would work for about thirty seconds and then quietly stop working.
 */
if (!background.includes("chrome.storage.session")) {
  fail("The control latch must be persisted to chrome.storage.session, not held in memory.");
}
if (
  !/case "control\.resume":[\s\S]{0,400}PAUSED \|\| state\.control === HANDED_OVER/.test(background)
) {
  fail("Resume must clear only PAUSED and HANDED_OVER — never a STOP.");
}

/* Scope may only be changed by the extension's own pages, never by a site. */
if (!background.includes("fromExtensionPage")) {
  fail("Scope changes must be restricted to the extension's own pages.");
}

/*
 * The website channel. Chrome delivers an external message only when the
 * sender's origin is in this list, so an empty or wildcard list is the whole
 * question. And the site must not be able to grant OCADE new reach.
 */
const external = manifest.externally_connectable?.matches;
if (!Array.isArray(external) || external.length === 0) {
  fail("The extension must name the origins allowed to talk to it.");
} else if (external.some((pattern) => /^\*:\/\/\*\/|<all_urls>|^\*:\/\/\*\/\*$/.test(pattern))) {
  fail(`externally_connectable must not match every origin: ${external.join(", ")}`);
}
if (!background.includes("onMessageExternal")) {
  fail("The extension must expose a channel for the OCADE website.");
}
if (!/onMessageExternal[\s\S]{0,900}scope\.approve/.test(background)) {
  fail("The website channel must explicitly refuse scope changes.");
}

/**
 * Blank out comments before scanning, keeping newlines so any future line
 * numbers stay right. Without this the check flagged the example URLs used to
 * EXPLAIN the lookalike-origin rule as though they were live references.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

/* No remote code: an extension that fetches its own logic cannot be reviewed. */
for (const [file, source] of files
  .filter((f) => f.endsWith(".js"))
  .map((f) => [f, withoutComments(readFileSync(join(ROOT, f), "utf8"))])) {
  if (/\bimportScripts\s*\(/.test(source)) fail(`${file} uses importScripts.`);
  if (/\beval\s*\(/.test(source)) fail(`${file} uses eval.`);
  if (/new Function\s*\(/.test(source)) fail(`${file} builds code with new Function.`);
  if (/https?:\/\/[^"'\s)]+/.test(source.replace(/https?:\/\/\*/g, ""))) {
    const hits = source.match(/https?:\/\/[^"'\s)]+/g) ?? [];
    const remote = hits.filter((h) => !h.startsWith("http://*") && !h.startsWith("https://*"));
    if (remote.length > 0) fail(`${file} references a remote origin: ${remote.join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("OCADE Cowork extension check failed:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  [
    "OCADE Cowork extension:",
    `  manifest v${manifest.manifest_version}`,
    `  standing host permissions: ${(manifest.host_permissions ?? []).length} (must be 0)`,
    `  permissions: ${(manifest.permissions ?? []).join(", ")}`,
    `  optional host access: ${(manifest.optional_host_permissions ?? []).join(", ")}`,
    "  control latch persisted: yes",
    "  scope changeable only from the extension's own pages: yes",
    `  website channel origins: ${(manifest.externally_connectable?.matches ?? []).join(", ")}`,
    "  website cannot change scope: yes",
    "  no remote code, no eval: yes",
  ].join("\n"),
);
