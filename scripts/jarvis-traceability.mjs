#!/usr/bin/env node
/**
 * The 84 architecture concepts of plan.md §3, each with its code owner, the
 * tests that exercise it, its evidence state and, when not PASS, the reason.
 *
 * Reads the concept rows from plan.md itself, so a concept cannot be skipped by
 * editing a second list. Fails when a concept is missing or duplicated, a status
 * is not one of the plan's states, a PASS has no test, or a non-PASS has no
 * reason. Evidence level: L1 unit/contract, L2 local integration with real
 * workers/DB, L3 live hosted staging, L4 real Gemini task. Status is the weakest
 * honest claim; a mock or Linux run never stands in for live Gemini or Windows.
 *
 *   node scripts/jarvis-traceability.mjs [--write evidence/<folder>]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const O = {
  authority: "src/lib/jarvis/authority.server.ts",
  planner: "src/lib/jarvis/planner.server.ts",
  contracts: "src/lib/jarvis/contracts.ts",
  supervisor: "src/lib/jarvis/supervisor.ts",
  migration: "supabase/migrations/20261030120000_jarvis_task_authority.sql",
  service: "src/lib/intelligence/edge-handler.ts (deployed ocade-intelligence-service)",
  ui: "src/jarvis/JarvisPanels.tsx",
  gateway: "device-agent/windows/ocade_agent/gateway.py",
  catalog: "device-agent/windows/ocade_agent/catalog.py",
  discovery: "device-agent/windows/ocade_agent/discovery.py",
  sandbox: "device-agent/windows/ocade_agent/sandbox.py",
  agent: "device-agent/windows/ocade_agent/agent.py + device.py + journal.py",
  office: "device-agent/windows/ocade_agent/office_worker.py",
  media: "device-agent/windows/ocade_agent/media_worker.py + scene_gl.py",
  web: "device-agent/windows/ocade_agent/web_worker.py",
  windows: "device-agent/windows/ocade_agent/windows_worker.py",
  verify: "device-agent/windows/ocade_agent/verify_worker.py",
  packaging: "device-agent/windows/packaging/",
  guard: "scripts/jarvis-no-hardcoded-journeys.mjs",
};
const T = {
  unit: "tests/jarvis/contracts.test.ts",
  e2e: "tests/jarvis/e2e.test.ts",
  db: "tests/jarvis/db/authority.test.sql",
  gateway: "device-agent/windows/tests/test_gateway.py",
  agent: "device-agent/windows/tests/test_agent.py",
  sandbox: "device-agent/windows/tests/test_sandbox.py",
  catalog: "device-agent/windows/tests/test_catalog.py",
  web: "device-agent/windows/tests/test_web.py",
  media: "device-agent/windows/tests/test_media.py",
  frozen: "device-agent/windows/packaging/check_frozen.py",
  guard: "npm run jarvis:no-hardcoded",
  staging: "staging checks and real UI run (evidence/2026-10-31-architecture)",
};
const LIVE_RUNS = "live Gemini runs (evidence/2026-10-31-browser)";
const WIN = "needs an interactive Windows machine";

// number: [status, level, owners, tests, reason]
const C = {
  1: [
    "PARTIAL",
    "L4",
    ["authority", "planner", "gateway", "verify"],
    ["e2e", "staging"],
    `full loop proven in ${LIVE_RUNS} on Linux (text, vision, browser video PASS); browser photo editing not completed; Windows native control untested`,
  ],
  2: [
    "PARTIAL",
    "L2",
    ["authority", "agent"],
    ["e2e"],
    "task and activity ids link every hop; no separate traceId",
  ],
  3: [
    "PASS",
    "L2",
    ["supervisor", "catalog", "gateway", "agent", "verify"],
    ["e2e", "gateway"],
    "",
  ],
  4: ["PASS", "L2", ["migration", "authority"], ["db", "e2e"], ""],
  5: ["PASS", "L2", ["planner", "contracts", "migration", "verify"], ["unit", "db", "e2e"], ""],
  6: [
    "PARTIAL",
    "L1",
    ["planner"],
    ["unit"],
    "goal checks and per-turn tool shortlist; no explicit milestone layer",
  ],
  7: ["PASS", "L2", ["migration", "supervisor"], ["db", "e2e"], ""],
  8: [
    "PARTIAL",
    "L4",
    ["planner", "contracts"],
    ["e2e", "staging"],
    `Gemini compiles typed checks before any step in ${LIVE_RUNS}; for photo edits it chose existence-only checks`,
  ],
  9: ["PASS", "L1", ["guard", "planner"], ["guard", "unit", "e2e"], ""],
  10: ["PASS", "L1", ["planner", "discovery"], ["unit"], ""],
  11: [
    "PARTIAL",
    "L2",
    ["discovery", "catalog"],
    ["agent"],
    `engines, MCP manifests reported; installed-app and window discovery ${WIN}`,
  ],
  12: ["BLOCKED", "L0", ["discovery"], [], WIN],
  13: ["PASS", "L2", ["catalog", "contracts"], ["catalog", "gateway"], ""],
  14: ["PASS", "L1", ["planner"], ["unit"], ""],
  15: ["PASS", "L1", ["planner"], ["unit"], ""],
  16: [
    "PARTIAL",
    "L1",
    ["planner"],
    ["unit"],
    "TF-IDF vectors over descriptors; learned embeddings blocked (no approved embedding model)",
  ],
  17: ["PASS", "L1", ["planner"], ["unit"], ""],
  18: [
    "PARTIAL",
    "L2",
    ["planner", "migration"],
    ["e2e"],
    "step and time budgets, durable state; no milestone construct",
  ],
  19: ["PASS", "L1", ["planner"], ["unit", "e2e"], ""],
  20: [
    "PARTIAL",
    "L4",
    ["planner", "gateway"],
    ["e2e", "staging"],
    `adapts live in ${LIVE_RUNS} (refused selector corrected, verifier-driven repair); stalled on a canvas editor's menus`,
  ],
  21: [
    "PARTIAL",
    "L2",
    ["migration", "authority"],
    ["db", "e2e"],
    "resume issues a new controller; no target refresh after takeover",
  ],
  22: ["PASS", "L2", ["catalog", "gateway"], ["catalog", "unit"], ""],
  23: ["PASS", "L1", ["planner"], ["unit"], ""],
  24: ["PASS", "L1", ["discovery", "planner", "media"], ["unit", "media"], ""],
  25: [
    "PARTIAL",
    "L1",
    ["planner"],
    ["unit"],
    "preference order in the model instructions; no automatic mechanism fallback",
  ],
  26: ["PASS", "L2", ["office", "sandbox", "media"], ["sandbox", "gateway", "media"], ""],
  27: ["PASS", "L2", ["media", "office", "sandbox"], ["media", "sandbox"], ""],
  28: ["BLOCKED", "L0", ["windows"], [], WIN],
  29: ["BLOCKED", "L0", [], [], "macOS is not an offered platform; no AX bridge exists"],
  30: ["PASS", "L2", ["web"], ["web"], ""],
  31: [
    "PARTIAL",
    "L2",
    ["web"],
    ["web"],
    "dedicated OCADE profile only; existing signed-in sessions not used",
  ],
  32: ["BLOCKED", "L0", ["windows"], [], WIN],
  33: [
    "PARTIAL",
    "L2",
    ["web", "windows", "contracts"],
    ["web", "unit"],
    `page/site binding tested; window leases ${WIN}`,
  ],
  34: ["BLOCKED", "L0", ["windows"], [], WIN],
  35: ["BLOCKED", "L0", ["windows"], [], WIN],
  36: ["FAIL", "L0", ["windows"], [], "no confidence-scored visual anchor fallback implemented"],
  37: [
    "PARTIAL",
    "L1",
    ["planner", "discovery"],
    ["unit"],
    "engine-gated choice; no runtime fallback between mechanisms",
  ],
  38: ["PASS", "L2", ["sandbox"], ["sandbox"], ""],
  39: ["PASS", "L2", ["gateway", "catalog"], ["gateway", "catalog"], ""],
  40: ["PASS", "L2", ["gateway"], ["gateway", "agent"], ""],
  41: ["PASS", "L2", ["gateway", "packaging"], ["gateway", "frozen"], ""],
  42: ["PASS", "L2", ["gateway"], ["gateway"], ""],
  43: ["PASS", "L2", ["gateway"], ["gateway"], ""],
  44: ["PASS", "L2", ["contracts", "gateway"], ["unit", "gateway"], ""],
  45: [
    "PARTIAL",
    "L2",
    ["catalog", "discovery"],
    ["catalog"],
    "pinned manifests and start-up health; no health TTL cache",
  ],
  46: [
    "PARTIAL",
    "L2",
    ["catalog", "gateway"],
    ["catalog", "gateway"],
    "pinned and untrusted; a real third-party server run was blocked by sandbox policy",
  ],
  47: ["PASS", "L2", ["gateway"], ["gateway", "agent"], ""],
  48: [
    "PARTIAL",
    "L2",
    ["gateway", "authority"],
    ["gateway", "e2e"],
    "per-action and model durations recorded; no p50/p95 from real runs",
  ],
  49: ["PASS", "L1", ["planner", "authority", "migration"], ["unit", "db"], ""],
  50: [
    "PARTIAL",
    "L2",
    ["migration"],
    ["db"],
    "one open task per device; no per-file lock across devices",
  ],
  51: [
    "PARTIAL",
    "L2",
    ["migration", "gateway"],
    ["db"],
    "serialized per device; no CPU/GPU-aware scheduling",
  ],
  52: ["PASS", "L2", ["migration", "agent"], ["db", "agent"], ""],
  53: ["PASS", "L2", ["agent"], ["agent"], ""],
  54: ["PASS", "L2", ["migration"], ["db", "e2e"], ""],
  55: ["PASS", "L2", ["agent", "migration"], ["agent", "db"], ""],
  56: ["PASS", "L2", ["agent", "migration"], ["agent", "e2e"], ""],
  57: ["PASS", "L2", ["migration", "agent", "gateway"], ["e2e", "agent", "gateway"], ""],
  58: ["FAIL", "L0", [], [], "live user-interference detection not implemented"],
  59: [
    "PARTIAL",
    "L2",
    ["web", "windows"],
    ["web"],
    `web page binding rechecked per action; windows ${WIN}`,
  ],
  60: ["PASS", "L1", ["planner"], ["unit"], ""],
  61: ["PASS", "L2", ["authority", "planner"], ["e2e", "unit"], ""],
  62: [
    "PARTIAL",
    "L2",
    ["gateway", "sandbox"],
    ["gateway", "sandbox"],
    "sanitized env and path sandbox; no OS-level ACL or network isolation",
  ],
  63: ["PASS", "L2", ["migration", "authority", "service"], ["db", "e2e"], ""],
  64: ["PASS", "L2", ["gateway", "service"], ["gateway", "e2e"], ""],
  65: [
    "PARTIAL",
    "L2",
    ["agent", "authority"],
    ["e2e"],
    "request signatures tested; signed binary updates blocked (no certificate)",
  ],
  66: ["PASS", "L2", ["migration", "authority"], ["e2e", "db"], ""],
  67: ["PARTIAL", "L2", ["migration"], ["db"], "grants persist per device; no purpose or expiry"],
  68: [
    "BLOCKED",
    "L0",
    ["packaging"],
    ["frozen"],
    "Windows build, installer and signing need Windows and a certificate",
  ],
  69: ["PASS", "L2", ["sandbox", "media", "office"], ["sandbox", "media"], ""],
  70: ["PASS", "L2", ["migration", "authority", "ui"], ["e2e"], ""],
  71: [
    "PARTIAL",
    "L2",
    ["authority", "ui"],
    ["e2e"],
    "files land in the device folder; no download/read-back from the UI tested",
  ],
  72: [
    "PARTIAL",
    "L3",
    ["ui"],
    ["staging"],
    "UI sign-in, pairing and request on staging; live tasks ran through the production authority from the harness, not yet from the UI",
  ],
  73: ["PASS", "L2", ["packaging", "gateway"], ["frozen"], ""],
  74: ["PASS", "L2", ["gateway", "agent"], ["gateway", "agent"], ""],
  75: ["PASS", "L2", ["verify"], ["gateway", "media"], ""],
  76: ["PASS", "L2", ["verify"], ["gateway", "media"], ""],
  77: ["PASS", "L1", ["planner"], ["unit"], ""],
  78: [
    "PARTIAL",
    "L4",
    ["authority"],
    ["staging"],
    `elapsed, model, execution and wait times recorded per run in ${LIVE_RUNS}; no CPU/memory benchmark; Linux only`,
  ],
  79: [
    "PARTIAL",
    "L4",
    [],
    ["staging"],
    `browser video trim PASS and verified; browser photo edit not completed (model stalls, Free allowance of 28 requests per window) in ${LIVE_RUNS}`,
  ],
  80: [
    "PARTIAL",
    "L2",
    ["gateway", "web", "sandbox", "migration"],
    ["gateway", "web", "sandbox", "db"],
    `Windows wrong-target cases ${WIN}`,
  ],
  81: ["PASS", "L1", ["guard"], ["guard", "e2e"], ""],
  82: ["PASS", "L1", [], ["unit"], ""],
  83: [
    "PARTIAL",
    "L4",
    ["authority"],
    ["staging"],
    `per-run outcome and confirmations recorded in ${LIVE_RUNS}; no aggregated product metric`,
  ],
  84: ["FAIL", "L0", [], [], "release gate not met: concepts above are FAIL/BLOCKED/PARTIAL"],
};
const STATES = ["PASS", "PARTIAL", "FAIL", "BLOCKED", "UNTESTED"];

const rows = [
  ...readFileSync("plan.md", "utf8").matchAll(/^\| (\d{1,2}) \| \*\*(.+?)\*\* \|/gm),
].map((m) => ({
  n: Number(m[1]),
  title: m[2],
}));
const problems = [];
if (rows.length !== 84) problems.push(`${rows.length} concepts in plan.md, expected 84`);
for (let n = 1; n <= 84; n += 1) {
  if (rows.filter((r) => r.n === n).length !== 1)
    problems.push(`concept ${n} missing or duplicated`);
  const entry = C[n];
  if (!entry) problems.push(`concept ${n} has no ledger entry`);
  else {
    const [status, , owners, tests, reason] = entry;
    if (!STATES.includes(status)) problems.push(`${n}: unknown status ${status}`);
    if (status === "PASS" && !tests.length) problems.push(`${n}: PASS without a test`);
    if (status !== "PASS" && !reason) problems.push(`${n}: ${status} without a reason`);
    for (const key of owners) if (!O[key]) problems.push(`${n}: unknown owner ${key}`);
    for (const key of tests) if (!T[key]) problems.push(`${n}: unknown test ${key}`);
  }
}

const entries = rows.map(({ n, title }) => {
  const [status, level, owners, tests, reason] = C[n] ?? ["UNTESTED", "L0", [], [], "no entry"];
  return {
    n,
    title,
    status,
    level,
    owners: owners.map((k) => O[k]),
    tests: tests.map((k) => T[k]),
    reason,
  };
});
const totals = Object.fromEntries(
  STATES.map((s) => [s, entries.filter((e) => e.status === s).length]),
);
console.log(
  JSON.stringify(
    { concepts: entries.length, totals, architectureReady: totals.PASS === 84 },
    null,
    2,
  ),
);
const at = process.argv.indexOf("--write");
if (at > 0) {
  const folder = process.argv[at + 1];
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "architecture-ledger.json"), `${JSON.stringify(entries, null, 2)}\n`);
  const cell = (v) => String(v).replace(/\|/g, "\\|");
  const md = [
    "| # | Concept | Status | Level | Owners | Tests | Reason |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
    ...entries.map(
      (e) =>
        `| ${e.n} | ${cell(e.title)} | ${e.status} | ${e.level} | ${cell(e.owners.join("<br>"))} | ${cell(e.tests.join("<br>"))} | ${cell(e.reason)} |`,
    ),
  ].join("\n");
  writeFileSync(join(folder, "architecture-ledger.md"), `${md}\n`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
