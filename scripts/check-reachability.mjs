/**
 * EVERY SHIPPED MODULE IS REACHED, AND EVERY EXCEPTION IS A SENTENCE.
 *
 * `PLAN.md` Phase 20: "Trace every visible route/control → feature use case →
 * core policy → data repository/platform adapter … Gate: every shipped
 * capability is reachable and every removed authority has no required
 * caller/provenance/legal role."
 *
 * WHAT THIS FOUND THE FIRST TIME IT RAN. Twenty-three product modules were in
 * the tree and in nobody's import graph, and two of them were not dead code at
 * all — they were the Remove and Install controls for Offline Intelligence,
 * built, tested, and rendered on no route. `PLAN.md` requires that "only
 * explicit Remove Offline Intelligence deletes it", and the only place removal
 * was offered was a remedy on the corner panel that appears when preparation
 * FAILS — a panel that renders nothing once the model is ready. An account with
 * Offline Intelligence successfully installed could not remove it.
 *
 * That is the failure mode this gate exists for, and it is not "dead code":
 * it is a CAPABILITY THAT LOOKS IMPLEMENTED. Every test passed, the components
 * were complete, and nobody could press either button.
 *
 * WHAT COUNTS AS AN ENTRY. Routes, the generated route tree, the framework's
 * own entry modules, workers and service workers. Everything else has to be
 * imported by something that is, directly or through a chain.
 *
 * THE EXEMPTIONS ARE NAMED AND REASONED, below. A module that is genuinely
 * entered another way — a build entry, an ambient type declaration, a ledger a
 * script reads, a deterministic twin used by evidence generation — says so and
 * says why. Adding a name here is asserting that the module is reached by
 * something outside the browser graph, which a reviewer can check.
 */

import { readFileSync, globSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";

const ROOT = process.cwd();

/**
 * Modules that are legitimately outside the route graph.
 *
 * Each entry says what enters it. "Nothing enters it" is not a reason; that is
 * the case this gate reports.
 */
/**
 * MODULES A NAMED, UNFINISHED `PLAN.md` PHASE WILL MOUNT.
 *
 * This is a DEBT LIST, not an exemption list: every entry is a capability no
 * person can reach today, held only because the phase that gives it a surface
 * has not run yet. The phase number is the promise. `PLAN.md` Phase 12 forbids
 * dead retired code in the final tree, so this map must be empty by then —
 * either the phase mounted the module, or the phase decided it was not needed
 * and deleted it.
 *
 * An entry whose file is gone, or that something now reaches on its own, is
 * reported as stale so the list cannot quietly outlive its subject.
 */
const AWAITING_MOUNT = {
  "src/lib/ocade-model-presentation.ts": 7,
  "src/lib/brain/use-brain.ts": 7,
  "src/lib/commercial/offline-lease.server.ts": 7,
  "src/lib/commercial/offline-usage.functions.ts": 7,
  "src/lib/account-data.functions.ts": 9,
  "src/lib/account.functions.ts": 9,
  "src/lib/account/data-classes.ts": 9,
  "src/lib/account/data-rights.ts": 9,
  "src/lib/notifications/history.ts": 9,
  "src/lib/notifications/preference-sync.ts": 9,
  "src/lib/notifications/supabase-backend.ts": 9,
  "src/lib/security/identity.ts": 9,
  "src/lib/security/reauthentication.ts": 9,
  "src/lib/security/sessions.functions.ts": 9,
  "src/lib/security/user-agent.ts": 9,
};

const ENTERED_ELSEWHERE = {
  "src/cloudflare-entry.ts":
    "The Cloudflare Worker entry. The platform calls it; no page imports it.",
  "src/ffprobe-static.d.ts":
    "An ambient type declaration. TypeScript reads it; nothing imports it.",
  "src/nitro-virtual.d.ts": "An ambient type declaration for Nitro's virtual modules.",
  "src/opfs.d.ts":
    "An ambient type declaration for the OPFS sync access handle the model store uses.",
  "src/lib/intelligence/edge-handler.ts":
    "The Supabase Edge Function body. Deno runs it from `supabase/functions`; the browser never imports it.",
  "src/lib/security/caller-scoped-functions.ts":
    "Shared by two security gates that read `SECURITY DEFINER` bodies. It exists in `src/lib` precisely so there is not a second copy.",
  "src/lib/payments/provider.ts":
    "The payment protocol types and the `checkoutAllowed` decision, read by the gate that proves nobody can be charged.",
};

/**
 * Test files are NOT entries, deliberately.
 *
 * A module reached only from its own test is the precise case this gate exists
 * to report: it is covered, it is green, and no person can get to it. Counting
 * the test as an entry would have hidden the two Offline Intelligence controls
 * that had tests and no mount point.
 */
const TEST_FILE = /(?:__tests__|\.test\.tsx?$)/;

const files = globSync("src/**/*.{ts,tsx}").map((file) => file.replace(/\\/g, "/"));
/** Product modules: what a person has to be able to reach. */
const product = files.filter((file) => !TEST_FILE.test(file));
const known = new Set(files);

function resolveSpecifier(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = relative(ROOT, resolve(dirname(fromFile), specifier));
  else return null;
  base = base.replace(/\\/g, "/");
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

const imports = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const out = new Set();
  // `from "…"` covers static imports and re-exports; `import("…")` covers the
  // lazy ones, which is how every heavy surface in this product is loaded.
  for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const target = resolveSpecifier(file, match[1]);
    if (target) out.add(target);
  }
  imports.set(file, out);
}

/*
 * A module named in ENTERED_ELSEWHERE is an ENTRY, not merely an exception.
 *
 * Treating it as an exception only silenced the file itself and left everything
 * it imports looking unreachable — the Edge Function's own health vocabulary was
 * reported as dead code while the Edge Function imported it on every request.
 * Seeding the walk from these files is what the reason strings already claim.
 */
const entries = files.filter(
  (file) =>
    file in ENTERED_ELSEWHERE ||
    file.startsWith("src/routes/") ||
    file === "src/routeTree.gen.ts" ||
    /^src\/(router|start|client|ssr|server|entry)/.test(file) ||
    /\.worker\.ts$/.test(file),
);

function walk(seeds) {
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of imports.get(file) ?? []) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

const reached = walk(entries);
/*
 * The same walk WITHOUT the exempted entries, which is the only way to tell an
 * exemption that is still doing work from one that has quietly become a lie:
 * a module a route can reach on its own does not need to be excused.
 */
const reachedFromProduct = walk(entries.filter((file) => !(file in ENTERED_ELSEWHERE)));

const unreached = product.filter(
  (file) => !reached.has(file) && !(file in ENTERED_ELSEWHERE) && !(file in AWAITING_MOUNT),
);

const awaiting = Object.entries(AWAITING_MOUNT).filter(([file]) => !reachedFromProduct.has(file));
const staleDebt = Object.keys(AWAITING_MOUNT).filter(
  (file) => !known.has(file) || reachedFromProduct.has(file),
);

/*
 * An exemption for a module that IS reached is stale, and a stale exemption is
 * how the list grows into a place where real findings go to be forgotten.
 */
const staleExemptions = Object.keys(ENTERED_ELSEWHERE).filter(
  (file) => !known.has(file) || reachedFromProduct.has(file),
);

if (unreached.length > 0 || staleExemptions.length > 0 || staleDebt.length > 0) {
  if (unreached.length > 0) {
    console.error(`Unreached product modules: ${unreached.length}`);
    for (const file of unreached) console.error(`- ${file}`);
    console.error(
      "\nEach is either a capability nobody can reach — mount it — or genuinely entered" +
        "\nanother way, in which case name it in ENTERED_ELSEWHERE with the reason.",
    );
  }
  for (const file of staleDebt) {
    console.error(
      `Stale phase debt: ${file} is ${known.has(file) ? "now mounted — remove it from AWAITING_MOUNT" : "no longer in the tree"}.`,
    );
  }
  for (const file of staleExemptions) {
    console.error(
      `Stale exemption: ${file} is ${known.has(file) ? "reached by a route on its own" : "no longer in the tree"}.`,
    );
  }
  process.exit(1);
}

console.log(
  `Reachability: ${reached.size} of ${product.length} product modules reached from a route, an entry or a worker; ` +
    `${Object.keys(ENTERED_ELSEWHERE).length} entered elsewhere, each with a stated reason.`,
);

if (awaiting.length > 0) {
  const phases = [...new Set(awaiting.map(([, phase]) => phase))].sort((a, b) => a - b);
  console.log(
    `\n${awaiting.length} module(s) reach nobody yet, each owed to an unfinished phase ` +
      `(${phases.map((phase) => `Phase ${phase}`).join(", ")}). PLAN.md Phase 12 requires this list to be empty:`,
  );
  for (const [file, phase] of awaiting) console.log(`- ${file} — Phase ${phase}`);
}
