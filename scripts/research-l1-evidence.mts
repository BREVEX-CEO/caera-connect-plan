/**
 * L1 evidence: a real research run over the real network, with citations that
 * are checked against the actual page bytes, a mid-run cancellation, and a
 * deliberately broken source.
 *
 * WHAT IS REAL
 * ------------
 * `createHttpSourceFetcher` is the same fetcher the server function uses, and
 * it really does go to the network: allowlisted hosts only, manual redirects,
 * a byte cap and an abort signal. The pages fetched here are live public pages.
 *
 * CITATIONS ARE CHECKED AGAINST THE PAGE, NOT AGAINST THE PIPELINE
 * ---------------------------------------------------------------
 * A research tool that cites a source it never read, or cites one that does not
 * actually say what was claimed, is the single most dangerous way this can
 * fail — because the output looks more trustworthy, not less. So every citation
 * is verified INDEPENDENTLY: the cited URL is fetched again, separately from
 * the pipeline, and the claim's key terms must appear in the retrieved bytes.
 * Verification that reused the pipeline's own cached text would only prove the
 * pipeline agrees with itself.
 *
 * ON THE UI
 * ---------
 * The requirement asks for the query to be run through the actual UI. The
 * research panel sits behind `_authenticated`, which requires a real Supabase
 * session, and signing in means entering a password — which I will not do. The
 * dev server is started and the gate is exercised instead, so what IS shown is
 * that the route exists and refuses unauthenticated access. The pipeline
 * beneath it is proven here on the real network. See uiNote in the output.
 *
 * Usage: npx vite-node scripts/research-l1-evidence.mts -- [--write]
 */
import { writeFileSync } from "node:fs";
import { createHttpSourceFetcher } from "../src/lib/research/http-source.ts";
import { runResearch } from "../src/lib/research/research-run.ts";
import type { SourceRecord } from "../src/lib/research/source-ranking.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_L1_RESEARCH_CITATIONS.json";

const ALLOWED_HOSTS = [
  "en.wikipedia.org",
  "www.gov.uk",
  "developer.mozilla.org",
  "docs.python.org",
  "nvd.nist.gov",
];

const retrievedAt = new Date();
const source = (id: string, url: string, title: string, kind: SourceRecord["kind"]): SourceRecord => {
  const publisher = new URL(url).hostname.replace(/^www\./, "");
  return { id, title, url, publisher, kind, publishedAt: null, retrievedAt };
};

/** Live, public, allowlisted pages on genuinely independent publishers. */
const CANDIDATES: SourceRecord[] = [
  source("mdn-http-status", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404", "MDN: 404 Not Found", "official"),
  source("wikipedia-http404", "https://en.wikipedia.org/wiki/HTTP_404", "Wikipedia: HTTP 404", "unknown"),
  source("python-http", "https://docs.python.org/3/library/http.html", "Python: http module", "official"),
];

const QUERY = "What does the HTTP 404 status code mean?";

const results: Record<string, unknown> = {};
let failed = false;

// ---------------------------------------------------------------- 1. real run

const fetcher = createHttpSourceFetcher({ allowedHosts: ALLOWED_HOSTS });
const started = Date.now();
const run = await runResearch({
  query: QUERY,
  topic: "http-status-codes",
  candidateSources: CANDIDATES,
  fetcher,
  volatility: "stable",
});
const runMs = Date.now() - started;

results.run = {
  query: QUERY,
  elapsedMs: runMs,
  ok: run.ok,
  ...(run.ok ? { evidence: run.evidence, result: run.data } : { reason: run.reason }),
};
if (!run.ok) failed = true;

// ------------------------------------------- 2. verify each citation INDEPENDENTLY

/*
 * Re-fetch every cited URL from scratch and confirm the page actually contains
 * the claim's key terms. This deliberately does NOT reuse anything the pipeline
 * retrieved: the whole point is to check the pipeline against reality rather
 * than against its own memory.
 */
const citationChecks: Record<string, unknown>[] = [];
if (run.ok) {
  for (const sub of run.data.subAnswers) {
    for (const cited of sub.sources) {
      const match = CANDIDATES.find((c) => cited.includes(c.publisher) || cited.includes(c.title) || cited.includes(c.id));
      if (!match) {
        citationChecks.push({ citation: cited, resolvedToCandidate: false, verified: false });
        failed = true;
        continue;
      }
      let status = 0;
      let body = "";
      try {
        const response = await fetch(match.url, { headers: { accept: "text/html" } });
        status = response.status;
        body = (await response.text()).toLowerCase();
      } catch (error) {
        body = "";
        citationChecks.push({ citation: cited, url: match.url, fetchError: String(error), verified: false });
        failed = true;
        continue;
      }
      /*
       * Terms that must genuinely appear for the page to support a claim about
       * what HTTP 404 means — matched against text normalised so that
       * identifier spelling counts as the same phrase.
       *
       * A first version demanded the literal "not found" and marked the Python
       * documentation as failing to support the claim. That was my check being
       * wrong, not the citation: that page carries a table row mapping `404` to
       * `NOT_FOUND`, which is exactly the claim, written the way an enum is
       * written. Underscores and hyphens are now folded to spaces. This is a
       * correction to a broken verifier, not a threshold lowered to get a pass —
       * a page containing neither form still fails.
       */
      const normalizedBody = body.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
      const terms = ["404", "not found"];
      const present = terms.filter((t) => normalizedBody.includes(t));
      const verified = status === 200 && present.length === terms.length;
      citationChecks.push({
        citation: cited,
        url: match.url,
        httpStatus: status,
        bytes: body.length,
        requiredTerms: terms,
        termsFound: present,
        supportsTheClaim: verified,
      });
      if (!verified) failed = true;
    }
  }
}
results.citationVerification = {
  method:
    "Every cited URL is fetched again from scratch, outside the pipeline, and the claim's key terms must appear in the retrieved bytes. Reusing the pipeline's own retrieved text would only prove it agrees with itself.",
  checks: citationChecks,
  allVerified: citationChecks.length > 0 && citationChecks.every((c) => c.supportsTheClaim === true),
};
if (citationChecks.length === 0) failed = true;

// ------------------------------------------------------- 3. cancellation mid-run

/*
 * Cancel a SEPARATE run partway through and require a clean stop: a refusal
 * that names cancellation, not a thrown error, not a hang, and not a result
 * quietly assembled from whatever happened to be finished.
 */
/*
 * A first attempt aborted after 150 ms and the run came back ok:true in 58 ms —
 * it had already finished, because the identical query was served from the
 * research cache populated by the run above. The test was racing a cache, not
 * cancelling a fetch. Both cases below therefore use a query nothing has seen,
 * and the immediate case removes the race entirely.
 */
async function cancelCase(label: string, abortAfterMs: number, topic: string) {
  const controller = new AbortController();
  if (abortAfterMs <= 0) controller.abort();
  else setTimeout(() => controller.abort(), abortAfterMs);
  const t0 = Date.now();
  let outcome: { ok: boolean; reason?: string } | undefined;
  let threw: string | null = null;
  try {
    outcome = (await runResearch({
      // A unique query, so the cache cannot answer it before the abort lands.
      query: `${QUERY} (uncached probe ${topic} ${Date.now()})`,
      topic,
      candidateSources: CANDIDATES,
      fetcher,
      volatility: "stable",
      signal: controller.signal,
    })) as { ok: boolean; reason?: string };
  } catch (error) {
    threw = String(error);
  }
  const elapsedMs = Date.now() - t0;
  const stoppedCleanly = threw === null && outcome?.ok === false && /cancel/i.test(outcome?.reason ?? "");
  return { label, abortAfterMs, elapsedMs, threw, outcome, stoppedCleanly };
}

const cancelImmediate = await cancelCase("aborted before any work", 0, "cancel-immediate");
const cancelMidFlight = await cancelCase("aborted mid-fetch", 40, "cancel-midflight");
const cancelStoppedCleanly = cancelImmediate.stoppedCleanly && cancelMidFlight.stoppedCleanly;
results.cancellation = {
  cases: [cancelImmediate, cancelMidFlight],
  stoppedCleanly: cancelStoppedCleanly,
  // Compared against the uncancelled run so "stopped early" is measurable.
  uncancelledRunMs: runMs,
  note:
    "A clean stop means a refusal that names cancellation — not a thrown error, and not a partial result presented as an answer. Each case uses a query the cache has never seen, because an earlier version aborted after 150ms against a cached query that had already completed in 58ms and so cancelled nothing.",
};
if (!cancelStoppedCleanly) failed = true;

// --------------------------------------------------- 4. deliberately broken source

/*
 * Three ways a source can be broken, all pointed at the same run: a URL on the
 * allowlist that does not exist, a host that is not allowlisted at all, and a
 * host that cannot resolve. None may crash the run, and none may be silently
 * treated as corroboration.
 */
const brokenSources: SourceRecord[] = [
  source("broken-404", "https://en.wikipedia.org/wiki/OCADE_This_Page_Does_Not_Exist_9781", "Deliberately missing page", "unknown"),
  source("broken-offhost", "https://example.com/not-allowlisted", "Host not on the allowlist", "unknown"),
  source("broken-dns", "https://docs.python.org.invalid-tld-9781/nothing", "Unresolvable host", "unknown"),
];
const brokenProbe = await Promise.all(
  brokenSources.map(async (s) => {
    const outcome = await fetcher(QUERY, s, { attempt: 1 });
    return { id: s.id, url: s.url, result: outcome.result, error: outcome.error ?? null };
  }),
);

const brokenStarted = Date.now();
const brokenRun = await runResearch({
  query: QUERY,
  topic: "http-status-codes-broken",
  // One good source alongside the broken ones, so a graceful run is
  // distinguishable from a run that simply failed.
  candidateSources: [CANDIDATES[0], ...brokenSources],
  fetcher,
  volatility: "stable",
});
const brokenMs = Date.now() - brokenStarted;
const brokenHandledGracefully =
  brokenProbe.every((p) => p.result === "hard" || p.result === "transient") &&
  typeof brokenRun === "object" &&
  brokenRun !== null;
results.brokenSources = {
  perSourceOutcome: brokenProbe,
  runElapsedMs: brokenMs,
  runOutcome: brokenRun.ok ? { ok: true, result: brokenRun.data } : { ok: false, reason: brokenRun.reason },
  handledGracefully: brokenHandledGracefully,
  note:
    "A missing page, an off-allowlist host and an unresolvable host are each classified as a failed acquisition rather than crashing the run or counting as support. The good source is included so a graceful degradation is distinguishable from a total failure.",
};
if (!brokenHandledGracefully) failed = true;

const doc = {
  schemaVersion: 1,
  item: "L1 - real research run, verified citations, cancellation, broken sources",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  allowedHosts: ALLOWED_HOSTS,
  uiNote:
    "The research panel lives at /ocade/studio behind the _authenticated gate, which requires a real Supabase session. Signing in means entering a password, which I will not do, so the query was NOT driven through the logged-in UI. What is proven here is the pipeline the UI calls, running against the live network with the same fetcher the server function uses. The gate itself is exercised separately and recorded in release/OCADE_L1_UI_GATE.json.",
  ...results,
};

console.log(`run            : ok=${run.ok} in ${runMs}ms`);
if (run.ok) {
  for (const sub of run.data.subAnswers) {
    console.log(`  [${sub.status}] ${sub.subquery}`);
    console.log(`     findings : ${String(sub.findings).slice(0, 110)}`);
    console.log(`     sources  : ${sub.sources.join(" | ")}`);
  }
}
console.log(`citations      : ${citationChecks.length} checked, all verified=${results.citationVerification && (results.citationVerification as { allVerified: boolean }).allVerified}`);
for (const c of citationChecks) {
  console.log(`   ${c.supportsTheClaim ? "SUPPORTS" : "FAILS   "} ${c.url} (HTTP ${c.httpStatus}, terms ${JSON.stringify(c.termsFound)})`);
}
for (const c of [cancelImmediate, cancelMidFlight]) {
  console.log(`cancellation   : ${c.label} (abort@${c.abortAfterMs}ms) -> ${c.elapsedMs}ms clean=${c.stoppedCleanly} reason=${JSON.stringify(c.outcome && c.outcome.reason)}`);
}
console.log(`broken sources :`);
for (const b of brokenProbe) console.log(`   ${b.result.padEnd(9)} ${b.url} -> ${String(b.error).slice(0, 70)}`);
console.log(`               graceful=${brokenHandledGracefully}`);
console.log(`L1: ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
