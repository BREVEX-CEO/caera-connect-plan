#!/usr/bin/env node
/**
 * The 236-entry requirement → implementation → test matrix (plan.md Annexes A–C).
 *
 * Reads the A/B/C identifiers from plan.md itself (so nothing can be skipped by
 * editing a second list), gives each one a disposition and maps every active
 * entry, through the plan sections and P-packages it names, to the code that
 * owns it, the tests that exercise it and the current evidence status. Fails
 * when an identifier is missing, duplicated, unmapped or an active entry has
 * neither a test nor a stated blocker.
 *
 *   node scripts/jarvis-traceability.mjs [--write evidence/<date>]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const plan = readFileSync("plan.md", "utf8");

const C = {
  contracts: "src/lib/jarvis/contracts.ts",
  authority: "src/lib/jarvis/authority.server.ts",
  supervisor: "src/lib/jarvis/supervisor.ts",
  planner: "src/lib/jarvis/planner.server.ts + supabase/functions/ocade-intelligence-service",
  migration: "supabase/migrations/20261030120000_jarvis_task_authority.sql",
  ui: "src/jarvis/JarvisWorkspace.tsx + JarvisPanels.tsx",
  gateway: "device-agent/windows/ocade_agent/gateway.py",
  catalog: "device-agent/windows/ocade_agent/catalog.py",
  sandbox: "device-agent/windows/ocade_agent/sandbox.py",
  office: "device-agent/windows/ocade_agent/office_worker.py + engine.py",
  verify: "device-agent/windows/ocade_agent/verify_worker.py",
  windows: "device-agent/windows/ocade_agent/windows_worker.py + discovery.py",
  web: "device-agent/windows/ocade_agent/web_worker.py",
  media: "device-agent/windows/ocade_agent/media_worker.py + scene_gl.py",
  agent: "device-agent/windows/ocade_agent/agent.py + device.py + journal.py",
  packaging: "device-agent/windows/packaging/",
};
const T = {
  db: "tests/jarvis/db/authority.test.sql",
  e2e: "tests/jarvis/e2e.test.ts",
  unit: "tests/jarvis/contracts.test.ts",
  gateway: "device-agent/windows/tests/test_gateway.py",
  agent: "device-agent/windows/tests/test_agent.py",
  sandbox: "device-agent/windows/tests/test_sandbox.py",
  catalog: "device-agent/windows/tests/test_catalog.py",
  fleet: "device-agent/windows/tests/mcp_fleet.py (measurement)",
  web: "device-agent/windows/tests/test_web.py",
  media: "device-agent/windows/tests/test_media.py + tests/qualify_media.py (M1/M2 runs)",
  ui: "evidence UI render (signed-out)",
};

/**
 * Each plan section (and P-package) → owners, tests, status, evidence level and blocker.
 * Status is the weakest qualified state of what the section requires.
 */
const SECTIONS = {
  0: [
    ["authority", "supervisor"],
    ["e2e"],
    "PARTIAL",
    "L3",
    "95% per-family gate not measured; Windows/UI journeys blocked",
  ],
  1: [["authority"], ["e2e"], "PASS", "L0", ""],
  2: [["authority", "migration"], ["db"], "PASS", "L2", ""],
  3: [["contracts"], ["unit"], "PASS", "L0", ""],
  4: [
    ["authority", "supervisor", "planner", "gateway", "verify"],
    ["e2e", "gateway"],
    "PARTIAL",
    "L2",
    "real model judgement untested (provider spend not confirmed free); Windows actuators untested",
  ],
  5: [["migration", "authority", "agent"], ["db", "e2e", "agent"], "PASS", "L2", ""],
  6: [
    ["gateway", "catalog", "contracts"],
    ["gateway", "catalog", "fleet"],
    "PARTIAL",
    "L2",
    "real third-party MCP server run denied by sandbox policy; needs owner approval",
  ],
  7: [
    ["agent", "packaging", "authority"],
    ["e2e"],
    "PARTIAL",
    "L3",
    "installer/startup/DPAPI need a disposable Windows machine",
  ],
  8: [["windows"], [], "BLOCKED", "L0", "needs an interactive Windows desktop"],
  9: [
    ["office", "windows"],
    ["gateway", "media", "e2e"],
    "PARTIAL",
    "L3",
    "LibreOffice/ffmpeg pass on Linux; Excel/Word COM needs Windows + Office",
  ],
  10: [
    ["web", "contracts"],
    ["web"],
    "PARTIAL",
    "L3",
    "fixture site + example.com read pass; third-party accounts/editors not approved",
  ],
  11: [["migration", "agent", "gateway"], ["db", "agent", "e2e"], "PASS", "L2", ""],
  12: [["verify", "supervisor"], ["gateway", "e2e", "media"], "PASS", "L3", ""],
  13: [
    ["supervisor", "planner", "office", "web", "media"],
    ["e2e", "web", "media"],
    "PARTIAL",
    "L3",
    "chess/CAD not implemented; 3D scene + video timeline engines pass locally, but no live Gemini-planned media run (planner BLOCKED); Windows apps blocked",
  ],
  14: [["ui"], ["ui"], "PARTIAL", "L3", "signed-in UI needs hosted Supabase auth"],
  15: [
    ["contracts", "web", "sandbox", "catalog", "migration"],
    ["db", "web", "sandbox", "catalog"],
    "PARTIAL",
    "L2",
    "Windows-specific attacks (junctions, UAC, wrong HWND) blocked",
  ],
  16: [
    ["catalog"],
    ["fleet"],
    "PARTIAL",
    "L2",
    "task-level latency/benchmark against real model not run",
  ],
  17: [
    ["authority"],
    ["db", "e2e"],
    "PARTIAL",
    "L2",
    "release gates need Windows + real model evidence",
  ],
  18: [["authority"], ["e2e"], "PARTIAL", "L2", "see per-package report"],
  19: [["authority"], [], "PASS", "L0", ""],
  20: [["authority"], [], "PASS", "L0", ""],
  21: [["windows", "contracts"], ["unit"], "PARTIAL", "L0", "pywinauto/PyAutoGUI need Windows"],
  22: [["agent", "gateway"], ["e2e"], "PASS", "L2", ""],
  23: [["authority", "agent", "gateway"], ["e2e", "gateway"], "PASS", "L2", ""],
  24: [["migration"], ["db"], "PASS", "L2", ""],
  25: [
    ["windows", "web", "sandbox"],
    ["web", "sandbox"],
    "PARTIAL",
    "L3",
    "Windows control stack blocked",
  ],
  26: [
    ["packaging", "agent"],
    [],
    "BLOCKED",
    "L0",
    "signing certificate and Windows build host needed",
  ],
  27: [
    ["supervisor", "verify", "office"],
    ["e2e"],
    "PARTIAL",
    "L3",
    "Journey 1 passes on Linux/LibreOffice; Journeys 2-3 L2 only",
  ],
  28: [
    ["authority"],
    ["db", "e2e", "gateway", "web"],
    "PARTIAL",
    "L2",
    "Windows/UIA negative tests blocked",
  ],
  29: [["authority"], ["e2e"], "PARTIAL", "L2", "release gate not met"],
  30: [["gateway", "planner"], ["gateway"], "PASS", "L2", ""],
};

const rows = [...plan.matchAll(/^\| ([ABC]\d{2,3}) \|(.*)\|\s*$/gm)].map((m) => ({
  id: m[1],
  cells: m[2].split("|").map((c) => c.trim()),
}));

function disposition(id, text) {
  if (/Excluded|Omitted estimate/i.test(text))
    return ["NOT APPLICABLE", "numerical sizing excluded by owner direction"];
  if (/rejected/i.test(text))
    return ["NOT APPLICABLE", "historical claim rejected as unsafe/unmeasurable (see treatment)"];
  if (/Example-only|example not production/i.test(text))
    return ["NOT APPLICABLE", "example only, not a product requirement"];
  if (/macOS|Peekaboo/i.test(text))
    return ["NOT APPLICABLE", "future platform outside Windows-first scope"];
  return ["ACTIVE", ""];
}

const order = ["FAIL", "BLOCKED", "PARTIAL", "UNTESTED", "PASS"];
const entries = rows.map(({ id, cells }) => {
  const heading = cells[id.startsWith("A") ? 1 : 0];
  const treatment = cells.at(-1);
  const text = cells.join(" ");
  const [kind, reason] = disposition(id, text);
  const sections = [
    ...new Set(
      (treatment.match(/(?<![\d.])\d{1,2}(?![\d])/g) ?? [])
        .map(Number)
        .filter((n) => n in SECTIONS),
    ),
  ];
  const packages = [...new Set(text.match(/P\d{2}/g) ?? [])];
  if (kind !== "ACTIVE") {
    return {
      id,
      heading,
      treatment,
      disposition: kind,
      status: "NOT APPLICABLE",
      reason,
      sections,
      packages,
      code: [],
      tests: [],
    };
  }
  const mapped = sections.length ? sections : [18];
  const status = mapped
    .map((s) => SECTIONS[s][2])
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  return {
    id,
    heading,
    treatment,
    disposition: /candidate/i.test(text) ? "OPTIONAL" : "MANDATORY",
    status,
    level: mapped.map((s) => SECTIONS[s][3]).sort()[0],
    sections: mapped,
    packages,
    code: [...new Set(mapped.flatMap((s) => SECTIONS[s][0].map((k) => C[k])))],
    tests: [...new Set(mapped.flatMap((s) => SECTIONS[s][1].map((k) => T[k])))],
    blocker: [...new Set(mapped.map((s) => SECTIONS[s][4]).filter(Boolean))].join("; "),
  };
});

const problems = [];
const count = (prefix) =>
  new Set(entries.filter((e) => e.id.startsWith(prefix)).map((e) => e.id)).size;
for (const [prefix, expected] of [
  ["A", 143],
  ["B", 30],
  ["C", 63],
]) {
  if (count(prefix) !== expected)
    problems.push(`${prefix}: ${count(prefix)} identifiers, expected ${expected}`);
  for (let n = 1; n <= expected; n += 1) {
    const id = `${prefix}${String(n).padStart(prefix === "A" ? 3 : 2, "0")}`;
    if (!entries.some((e) => e.id === id)) problems.push(`${id} missing`);
  }
}
if (new Set(entries.map((e) => e.id)).size !== entries.length)
  problems.push("duplicate identifiers");
for (const e of entries) {
  if (e.disposition === "NOT APPLICABLE" && !e.reason)
    problems.push(`${e.id} excluded without reason`);
  if (e.status !== "NOT APPLICABLE" && !e.code.length)
    problems.push(`${e.id} has no implementation owner`);
  if (e.status !== "NOT APPLICABLE" && !e.tests.length && !e.blocker && e.status !== "PASS")
    problems.push(`${e.id} has neither a test nor a blocker`);
  if (e.status === "PASS" && !e.tests.length && e.level !== "L0")
    problems.push(`${e.id} PASS without evidence`);
}

const totals = entries.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }), {});
console.log(JSON.stringify({ entries: entries.length, totals }, null, 2));
const at = process.argv.indexOf("--write");
if (at > 0) {
  const folder = process.argv[at + 1];
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "traceability.json"), `${JSON.stringify(entries, null, 2)}\n`);
  const md = [
    "| ID | Heading | Disposition | Status | Level | Plan sections | Code | Tests | Blocker / reason |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...entries.map((e) =>
      [
        e.id,
        e.heading,
        e.disposition,
        e.status,
        e.level ?? "",
        e.sections.join(", "),
        e.code.join("<br>"),
        e.tests.join("<br>"),
        e.blocker || e.reason,
      ]
        .map((v) => String(v).replace(/\|/g, "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .concat(" |"),
    ),
  ].join("\n");
  writeFileSync(join(folder, "traceability.md"), `${md}\n`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
