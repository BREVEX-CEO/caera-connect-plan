/**
 * OCADE audit — PASS 2: codebase inventory and requirement→code traceability.
 *
 * Pass 1 proved complete line coverage of the specification and reduced 5,425
 * templated blocks to 510 canonical subjects. This pass inventories the live
 * repository and maps each canonical subject onto it.
 *
 * HONESTY ABOUT THE MATCHING METHOD. Traceability here is lexical: a canonical
 * subject is matched against file paths, export names and test names. That is
 * evidence of *presence*, not proof of semantic correctness — a match says the
 * repository contains something named for the subject, not that the subject's
 * obligations are met. Every row therefore carries `matchConfidence` and the
 * matched tokens, so a reader can audit the audit. Rows are never promoted to a
 * runtime status by this script; runtime status comes only from recorded
 * command evidence, which no static pass can manufacture.
 *
 * Read-only: reads the repo, writes only into out/.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const ROOT = join(HERE, "..", "..");
mkdirSync(OUT, { recursive: true });

const SKIP = new Set([
  "node_modules", ".git", "dist", "build", "coverage", "target", ".output",
  ".vite", ".wrangler", ".nitro", "out",
]);

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");

/* --------------------------------------------------------------- inventory */

const CODE_EXT = new Set([".ts", ".tsx", ".mjs", ".js", ".rs", ".java", ".swift", ".sql", ".yml", ".yaml"]);
const inventory = [];
const exportsByFile = new Map();
const importsByFile = new Map();

for (const f of files) {
  const r = rel(f);
  const ext = extname(f);
  let size = 0;
  try { size = statSync(f).size; } catch { /* unreadable */ }
  const record = { path: r, ext, size, kind: classify(r, ext) };
  if (CODE_EXT.has(ext) && size < 2_000_000) {
    let src = "";
    try { src = readFileSync(f, "utf8"); } catch { /* binary */ }
    const exps = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
    const imps = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    exportsByFile.set(r, exps);
    importsByFile.set(r, imps);
    record.exports = exps.length;
    record.imports = imps.length;
    record.lines = src.split("\n").length;
  }
  inventory.push(record);
}

function classify(r, ext) {
  if (r.startsWith("src/routes/")) return "route";
  if (r.startsWith("src/components/")) return "component";
  if (/\/__tests__\//.test(r) || /\.test\./.test(r)) return "test";
  if (r.startsWith("src/lib/native/")) return "native-bridge";
  if (r.startsWith("src/lib/mobile/")) return "mobile";
  if (r.startsWith("src/lib/control/")) return "control";
  if (r.startsWith("src/lib/skills/")) return "skill";
  if (r.startsWith("src/lib/")) return "lib";
  if (r.startsWith("supabase/migrations/")) return "migration";
  if (r.startsWith("supabase/rollback/")) return "rollback";
  if (r.startsWith("supabase/verification/")) return "verification-sql";
  if (r.startsWith("scripts/") && ext === ".mjs") return "gate-or-script";
  if (r.startsWith(".github/workflows/")) return "ci-workflow";
  if (r.startsWith("native/")) return "native";
  if (r.startsWith("android/")) return "android";
  if (r.startsWith("ios/")) return "ios";
  if (r.startsWith("relay/")) return "relay";
  if (r.startsWith("extension/")) return "extension";
  return "other";
}

const byKind = inventory.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});

/* ------------------------------------------------- import graph / orphans */

const prodFiles = inventory.filter((r) => r.kind !== "test" && /^src\//.test(r.path));
const incoming = new Map(prodFiles.map((r) => [r.path, 0]));
for (const [file, imps] of importsByFile) {
  if (/\/__tests__\//.test(file) || /\.test\./.test(file)) continue;
  for (const spec of imps) {
    for (const cand of incoming.keys()) {
      const base = cand.replace(/\.(tsx?|mjs)$/, "");
      if (spec.endsWith(base.replace(/^src\//, "")) || spec.includes(base.replace(/^src\//, ""))) {
        incoming.set(cand, incoming.get(cand) + 1);
      }
    }
  }
}
const orphans = [...incoming.entries()].filter(([, n]) => n === 0).map(([p]) => p);

/* ------------------------------------------------------------ traceability */

const canonical = readFileSync(join(OUT, "OCADE_CANONICAL_REQUIREMENTS.jsonl"), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));

const STOP = new Set(["the","and","for","with","that","this","from","into","are","not","all","must","one","its","per","n"]);
const tokensOf = (s) => s.split(/[^a-z0-9]+/i).map((t) => t.toLowerCase()).filter((t) => t.length > 3 && !STOP.has(t));

const haystack = inventory.map((r) => ({
  path: r.path, kind: r.kind,
  tokens: new Set(tokensOf(r.path).concat(tokensOf((exportsByFile.get(r.path) || []).join(" ")))),
}));

const trace = canonical.map((req) => {
  const want = tokensOf(req.normalisedSubject);
  let best = [];
  if (want.length > 0) {
    for (const h of haystack) {
      const hits = want.filter((t) => h.tokens.has(t));
      if (hits.length > 0) best.push({ path: h.path, kind: h.kind, hits: hits.length, tokens: hits });
    }
    best.sort((a, b) => b.hits - a.hits);
    best = best.slice(0, 6);
  }
  const impl = best.filter((b) => b.kind !== "test");
  const tests = best.filter((b) => b.kind === "test");
  const reachable = impl.some((b) => !orphans.includes(b.path));
  const confidence = best.length === 0 ? "none" : best[0].hits >= 2 ? "medium" : "low";
  return {
    canonicalId: req.canonicalId,
    subject: req.normalisedSubject,
    occurrences: req.occurrences,
    lifecycleStages: req.lifecycleStages,
    sourceLineRanges: req.sourceLineRanges.slice(0, 3),
    implementationFiles: impl.map((b) => b.path),
    tests: tests.map((b) => b.path),
    reachable,
    matchConfidence: confidence,
    matchedTokens: best[0]?.tokens ?? [],
    // Deliberately NOT set by this pass: runtime status. Static analysis cannot
    // produce runtime evidence, and inventing one here is the defect this whole
    // audit exists to detect.
    evidenceLevel: best.length === 0 ? "NOT STARTED"
      : tests.length > 0 && reachable ? "UNIT TESTED"
      : reachable ? "WIRED AND REACHABLE"
      : impl.length > 0 ? "SOURCE COMPLETE" : "PARTIAL SOURCE",
  };
});

const dist = trace.reduce((a, t) => ((a[t.evidenceLevel] = (a[t.evidenceLevel] || 0) + 1), a), {});
const conf = trace.reduce((a, t) => ((a[t.matchConfidence] = (a[t.matchConfidence] || 0) + 1), a), {});

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(join(OUT, "OCADE_CODEBASE_INVENTORY.jsonl"), jsonl(inventory));
writeFileSync(join(OUT, "OCADE_REQUIREMENT_TRACEABILITY_MATRIX.jsonl"), jsonl(trace));
writeFileSync(join(OUT, "OCADE_ORPHANS.json"), JSON.stringify({ count: orphans.length, orphans }, null, 2) + "\n");

console.log(JSON.stringify({
  filesInventoried: inventory.length,
  byKind,
  canonicalRequirements: trace.length,
  evidenceDistribution: dist,
  matchConfidence: conf,
  staticOrphanCandidates: orphans.length,
}, null, 2));
