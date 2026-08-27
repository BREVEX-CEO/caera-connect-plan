import { c as stringType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-BQwRVjSw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research.functions-BBoCrRe5.js
/**
* Research server functions (P21 production wiring).
*
* `runResearch`, `createHttpSourceFetcher`, `ResearchCache` and the fallback
* planner were complete, tested — and imported only by tests. Four modules of
* a working research pipeline with no way to reach it.
*
* They belong on the SERVER, not in the browser, for two reasons that are not
* about convenience:
*
*  1. The browser cannot fetch arbitrary origins. A research run driven from
*     the client would be silently shaped by CORS rather than by the source
*     ranking, and would report "no sources" for reasons unrelated to the
*     sources.
*  2. `validateResearchUrl` is an SSRF guard, and an SSRF guard that runs in
*     the client protects nothing — the attacker controls the client. It has
*     to run where the request is actually made.
*
* The allowlist is therefore built here and never accepted from the caller.
*/
/**
* Hosts a research run may reach.
*
* Server-side and hard-coded on purpose. Letting the caller supply this would
* turn the SSRF guard into decoration: a client that can name its own allowed
* host can name the metadata endpoint.
*/
/**
* What kind of source each allowed host is.
*
* Ranking weights `official` above `aggregator`, so this is a claim with
* consequences and it is only made for hosts on our own allowlist — where we
* genuinely do know the answer. Anything else is `unknown`, which ranks
* conservatively. Guessing "official" for an unrecognised host would let a
* caller promote its own source by naming it.
*/
/**
* One cache for the server process, keyed by query. Bounded by the cache's own
* policy; research answers go stale, and a cache that never expires would
* serve yesterday's answer to a question about today.
*/
var researchInput = objectType({
	query: stringType().min(3).max(500),
	topic: stringType().min(1).max(120),
	volatility: enumType([
		"realtime",
		"hourly",
		"daily",
		"stable"
	]).default("daily"),
	/**
	* Candidate sources are supplied by the caller but constrained here: the
	* fetcher will refuse any URL outside ALLOWED_HOSTS regardless of what
	* arrives, so this list can only ever narrow the run, never widen it.
	*/
	candidates: arrayType(objectType({
		url: stringType().url().max(2e3),
		title: stringType().max(300).default(""),
		publishedAt: stringType().datetime().nullable().default(null)
	})).max(20).default([])
});
/** A source as the answer will cite it. Returned so the caller need not guess. */
var runResearchQuery = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((raw) => researchInput.parse(raw)).handler(createSsrRpc("2dd5708b81c37d6ff6eba345c3c717a2bdf4cf0e46fd29b82ef0b20bb0755c93"));
var currentInformationInput = objectType({
	query: stringType().trim().min(3).max(500),
	volatility: enumType([
		"realtime",
		"hourly",
		"daily",
		"stable"
	])
});
/**
* Production Chat current-information boundary.
*
* Discovery is a normal non-AI search request. The caller cannot choose a
* provider, an allowlist, a redirect policy, a byte budget, or an address. All
* of those stay on the server, while final reasoning remains in the browser's
* local model.
*/
var retrieveCurrentInformation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((raw) => currentInformationInput.parse(raw)).handler(createSsrRpc("12fa6cbf6d79f4e26afefc32a7c38c832cb79f92a56cee0273faa1f4229262e8"));
//#endregion
export { runResearchQuery as n, retrieveCurrentInformation as t };
