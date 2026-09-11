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
const ENTERED_ELSEWHERE = {
  "src/cloudflare-entry.ts":
    "The Cloudflare Worker entry. The platform calls it; no page imports it.",
  "src/ffprobe-static.d.ts":
    "An ambient type declaration. TypeScript reads it; nothing imports it.",
  "src/nitro-virtual.d.ts": "An ambient type declaration for Nitro's virtual modules.",
  "src/prompts/raw.d.ts": "An ambient type declaration for raw prompt imports.",
  "src/lib/brain/adapters/webllm.server.ts":
    "The server-side shim Nitro substitutes for the browser engine. `check-release-source.mjs` asserts it stays a shim.",
  "src/lib/intelligence/edge-handler.ts":
    "The Supabase Edge Function body. Deno runs it from `supabase/functions`; the browser never imports it.",
  "src/lib/recovery/rehearsal.ts":
    "The restore logic `scripts/recovery-rehearsal.mts` drives against two real PostgreSQL instances.",
  "src/lib/release/mission-evidence.ts":
    "A release ledger. `scripts/generate-mission-evidence.mjs` reads it; no screen does.",
  "src/lib/release/product-reference-parity.ts":
    "A release ledger, read by `scripts/generate-product-reference-parity.mjs`.",
  "src/lib/release/remaining-gaps.ts":
    "A release ledger, read by `scripts/generate-remaining-gaps.mjs`.",
  "src/lib/release/route-dispositions.ts":
    "A release ledger, read by `scripts/generate-route-dispositions.mjs`.",
  "src/lib/security/caller-scoped-functions.ts":
    "Shared by two security gates that read `SECURITY DEFINER` bodies. It exists in `src/lib` precisely so there is not a second copy.",
  "src/lib/payments/provider.ts":
    "The payment protocol types and the `checkoutAllowed` decision, read by the deterministic twin and by the gate that proves nobody can be charged.",
  "src/lib/payments/twin.ts":
    "The deterministic payment provider twin. It signs and verifies real webhooks in evidence generation and in tests; no product surface may import it.",
  "src/lib/payments/entitlements.ts":
    "The twin's entitlement state machine, used by `scripts/p22-simulated-evidence.mts` to produce release evidence. NOT a shipped authority: the product resolves a tier from `subscriptions` and `ocade_entitlement_grants` through `entitlement-resolver.ts`, and this must never be imported by a route.",
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

const files = globSync("src/**/*.{ts,tsx}")
  .map((file) => file.replace(/\\/g, "/"))
  // Donor logic kept verbatim for provenance rather than shipped as a surface.
  .filter((file) => !file.includes("/primary-logic/"));
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

const entries = files.filter(
  (file) =>
    file.startsWith("src/routes/") ||
    file === "src/routeTree.gen.ts" ||
    /^src\/(router|start|client|ssr|server|entry)/.test(file) ||
    /\.worker\.ts$/.test(file),
);

const reached = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file);
  for (const next of imports.get(file) ?? []) if (!reached.has(next)) queue.push(next);
}

const unreached = product.filter((file) => !reached.has(file) && !(file in ENTERED_ELSEWHERE));

/*
 * An exemption for a module that IS reached is stale, and a stale exemption is
 * how the list grows into a place where real findings go to be forgotten.
 */
const staleExemptions = Object.keys(ENTERED_ELSEWHERE).filter(
  (file) => !known.has(file) || reached.has(file),
);

if (unreached.length > 0 || staleExemptions.length > 0) {
  if (unreached.length > 0) {
    console.error(`Unreached product modules: ${unreached.length}`);
    for (const file of unreached) console.error(`- ${file}`);
    console.error(
      "\nEach is either a capability nobody can reach — mount it — or genuinely entered" +
        "\nanother way, in which case name it in ENTERED_ELSEWHERE with the reason.",
    );
  }
  for (const file of staleExemptions) {
    console.error(
      `Stale exemption: ${file} is ${known.has(file) ? "reached by the graph" : "no longer in the tree"}.`,
    );
  }
  process.exit(1);
}

console.log(
  `Reachability: ${reached.size} of ${product.length} product modules reached from a route, an entry or a worker; ` +
    `${Object.keys(ENTERED_ELSEWHERE).length} entered elsewhere, each with a stated reason.`,
);
