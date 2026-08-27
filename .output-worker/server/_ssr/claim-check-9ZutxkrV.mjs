//#region node_modules/.nitro/vite/services/ssr/assets/claim-check-9ZutxkrV.js
/** Beyond this, a source is not evidence about "right now". */
var STALE_AFTER_MS = 1440 * 60 * 1e3;
/**
* How old a source is.
*
* Refuses rather than assuming when the source carries no date: an undated page
* is not recent, it is undated, and the difference decides whether an answer
* about current conditions is worth anything.
*/
function freshnessOf(source, now = /* @__PURE__ */ new Date()) {
	if (!source.publishedAt) return {
		ok: false,
		reason: `“${source.title}” doesn't say when it was published, so OCADE can't tell you whether it's current. It won't assume it is.`
	};
	if (!Number.isFinite(source.publishedAt.getTime())) return {
		ok: false,
		reason: `"${source.title}" has an unreadable publication date, so its timestamp can't be trusted.`
	};
	const ageMs = now.getTime() - source.publishedAt.getTime();
	if (ageMs < 0) return {
		ok: false,
		reason: `“${source.title}” is dated in the future, so its timestamp can't be trusted.`
	};
	const minutes = Math.floor(ageMs / 6e4);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const label = minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : hours < 24 ? `${hours} h ago` : `${days} d ago`;
	return {
		ok: true,
		data: {
			ageMs,
			label,
			stale: ageMs > STALE_AFTER_MS
		},
		evidence: `Published ${label}, read ${source.retrievedAt.toISOString()}.`
	};
}
/**
* Base weight per kind. Ordering, not precision — the gaps matter, the exact
* numbers do not, and nothing downstream reports these as a score to the user.
*/
var KIND_WEIGHT = {
	official: 1,
	primary_party: .85,
	news: .7,
	wire: .7,
	aggregator: .4,
	social: .25,
	sensor: .5,
	unknown: .2
};
/**
* How much weight this source carries **on this topic**.
*
* A source outside its remit is downgraded, not promoted by its general
* standing: a health ministry is authoritative on an outbreak and is not
* authoritative on a football result.
*/
function authorityFor(source, topic) {
	const base = KIND_WEIGHT[source.kind];
	const remit = source.authoritativeFor;
	if (!remit || remit.length === 0) return base;
	return remit.some((t) => t.toLowerCase() === topic.toLowerCase()) ? base : Math.min(base, .5) * .6;
}
/**
* Collapse sources that are really the same reporting.
*
* Two records are independent only if they come from different publishers AND
* different originators. Wire copy republished by twenty outlets counts once —
* which is the whole point.
*/
function independentSources(sources) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const s of sources) {
		const identity = (s.originator ?? s.publisher).trim().toLowerCase();
		if (seen.has(identity)) continue;
		seen.add(identity);
		out.push(s);
	}
	return out;
}
/**
* Order sources for a topic: authority first, then recency.
*
* Undated sources are kept, ranked last, and labelled — dropping them silently
* would hide from the user that OCADE saw something it couldn't date.
*/
function rankSources(sources, topic, now = /* @__PURE__ */ new Date()) {
	if (sources.length === 0) return {
		ok: false,
		reason: "There are no sources to rank."
	};
	const ranked = sources.map((source) => {
		const f = freshnessOf(source, now);
		const authority = authorityFor(source, topic);
		return {
			source,
			freshness: f.ok ? f.data : null,
			authority,
			note: f.ok ? f.data.stale ? `${source.publisher} — ${f.data.label}, too old to describe current conditions.` : `${source.publisher} — ${f.data.label}.` : `${source.publisher} — undated, so it can't be ranked for recency.`
		};
	});
	ranked.sort((a, b) => {
		if (b.authority !== a.authority) return b.authority - a.authority;
		if (!a.freshness && !b.freshness) return 0;
		if (!a.freshness) return 1;
		if (!b.freshness) return -1;
		return a.freshness.ageMs - b.freshness.ageMs;
	});
	const undated = ranked.filter((r) => !r.freshness).length;
	const independent = independentSources(sources).length;
	return {
		ok: true,
		data: ranked,
		evidence: `${sources.length} source${sources.length === 1 ? "" : "s"}, ${independent} independent${undated > 0 ? `, ${undated} undated` : ""}.`
	};
}
/**
* OCADE Research — deciding what may be asserted.
*
* Ranking sources tells you which are worth reading. This module decides what
* OCADE is allowed to *say* on the strength of them, and refuses when the
* honest answer is "the evidence doesn't support that".
*
* THE INCIDENT RULE.
*
* The strictest rule here concerns claims about accidents, emergencies,
* casualties and causes. Sensor data — a traffic layer gone red, a satellite
* image, a slowdown on a motorway — is precise about *what it measured* and
* silent about *why*. Red on a map means vehicles are moving slowly. It does
* not mean there has been a crash; it equally means roadworks, a match letting
* out, a burst water main, or a sensor fault.
*
* An agent that reports "there's been an accident" from a red road has invented
* the most alarming explanation for an ambiguous signal, and phrased it as
* observation. Someone may act on that — call a relative, change route, panic.
* So `assessIncidentClaim` refuses categorically: an incident, its cause, or
* any casualty claim requires an official source that states it. No quantity of
* sensor data substitutes, and no confidence score is offered in its place,
* because a number would invite the reader to round it up.
*/
/**
* Assess an ordinary factual claim.
*
* Contradiction is never resolved by weight of numbers alone: when sources
* disagree, the disagreement IS the finding, and burying it under a majority
* count would hide the thing the user most needs to know.
*/
function assessClaim(claim, now = /* @__PURE__ */ new Date()) {
	const support = independentSources(claim.supporting);
	const against = independentSources(claim.contradicting ?? []);
	const uncertainties = [];
	const dated = support.map((s) => ({
		s,
		f: freshnessOf(s, now)
	})).filter((x) => x.f.ok);
	const undatedCount = support.length - dated.length;
	if (undatedCount > 0) uncertainties.push(`${undatedCount} supporting source${undatedCount === 1 ? " carries" : "s carry"} no publication date, so ${undatedCount === 1 ? "it" : "they"} can't be confirmed as current.`);
	const syndicated = claim.supporting.length - support.length;
	if (syndicated > 0) uncertainties.push(`${syndicated} of the ${claim.supporting.length} results were the same reporting republished, so they count once rather than as separate confirmation.`);
	const freshest = dated.length > 0 ? dated.reduce((a, b) => b.f.data.ageMs < a.f.data.ageMs ? b : a) : null;
	const asOf = freshest ? freshest.s.publishedAt.toISOString() : null;
	if (freshest && freshest.f.data.stale) uncertainties.push(`The most recent supporting source is ${freshest.f.data.label}, so this may no longer hold.`);
	const hasAuthoritative = (support.length > 0 ? Math.max(...support.map((s) => authorityFor(s, claim.topic))) : 0) >= .7;
	if (support.length > 0 && !hasAuthoritative) uncertainties.push("No source with accountability for this subject was found — this rests on secondary reporting.");
	if (support.length === 0) return {
		confidence: "unsupported",
		statement: `OCADE found nothing that supports this, so it won't state it: ${claim.text}`,
		independentSupport: 0,
		uncertainties: ["No supporting source at all."],
		asOf: null
	};
	if (against.length > 0) return {
		confidence: "contested",
		statement: `Sources disagree about this. ${support.length} say it, ${against.length} contradict it — including ${against[0].publisher}. OCADE won't pick a side for you.`,
		independentSupport: support.length,
		uncertainties: [...uncertainties, `Contradicted by ${against.map((s) => s.publisher).join(", ")}.`],
		asOf
	};
	if (support.length === 1) return {
		confidence: "single_source",
		statement: `Only ${support[0].publisher} reports this, so treat it as unconfirmed: ${claim.text}`,
		independentSupport: 1,
		uncertainties: [...uncertainties, "Nothing independent corroborates it."],
		asOf
	};
	return {
		confidence: support.length >= 2 && hasAuthoritative && uncertainties.length === 0 ? "well_supported" : "supported",
		statement: claim.text,
		independentSupport: support.length,
		uncertainties,
		asOf
	};
}
/** Sources that can establish that an incident happened. */
var CAN_ESTABLISH_INCIDENT = /* @__PURE__ */ new Set(["official", "primary_party"]);
/**
* Decide whether OCADE may state that an incident has occurred.
*
* Refuses unless an official or directly-involved source says so. See the
* module header for why sensor data — however much of it — never suffices.
*
* `mayInsteadSay` is not a consolation prize: it is the honest observation the
* sensor data actually supports, so the caller has something true to say rather
* than being left with nothing and reaching for the inference anyway.
*/
function assessIncidentClaim(claim, now = /* @__PURE__ */ new Date()) {
	const independent = independentSources(claim.sources);
	const official = independent.find((s) => CAN_ESTABLISH_INCIDENT.has(s.kind));
	const sensors = independent.filter((s) => s.kind === "sensor");
	const observation = sensors.length > 0 ? `Traffic near ${claim.location} is moving slowly according to ${sensors.map((s) => s.publisher).join(", ")}. That is what the data shows; it does not say why. Roadworks, an event, weather or a sensor fault would look the same.` : `OCADE has no official information about ${claim.location}.`;
	if (!official) return {
		ok: false,
		reason: sensors.length > 0 ? `OCADE won't report ${describeKind(claim.kind)} from traffic or imagery data. A slow road means vehicles are slow — it doesn't say an incident happened, and guessing the most alarming explanation is how people are frightened by something that isn't there. Check the local emergency service or traffic authority.` : `No official source reports ${describeKind(claim.kind)} near ${claim.location}, so OCADE won't state it.`,
		mayInsteadSay: observation
	};
	const f = freshnessOf(official, now);
	if (!f.ok) return {
		ok: false,
		reason: `${official.publisher} reports this but doesn't say when, and an undated emergency report can't be presented as current.`,
		mayInsteadSay: `${official.publisher} has reported ${claim.text}, but the report carries no timestamp — check it directly before acting on it.`
	};
	if (f.data.stale) return {
		ok: false,
		reason: `The only official report is ${f.data.label}, which is too old to describe the situation now.`,
		mayInsteadSay: `${official.publisher} reported ${claim.text} ${f.data.label}. That may well be resolved — check for a current update.`
	};
	return {
		ok: true,
		statement: `${official.publisher} reports ${claim.text} near ${claim.location}, as of ${f.data.label}.`,
		asOf: official.publishedAt.toISOString(),
		official: official.publisher
	};
}
function describeKind(kind) {
	switch (kind) {
		case "accident": return "an accident";
		case "emergency": return "an emergency";
		case "casualty": return "injuries or casualties";
		case "cause": return "a cause";
		case "closure": return "a road closure";
	}
}
/**
* The line OCADE shows beneath an answer.
*
* Timestamp, source count and uncertainty always travel with the claim — an
* answer whose caveats live elsewhere is an answer without caveats.
*/
function describeAssessment(a) {
	const parts = [];
	switch (a.confidence) {
		case "well_supported":
			parts.push(`Confirmed by ${a.independentSupport} independent sources.`);
			break;
		case "supported":
			parts.push(`Supported by ${a.independentSupport} independent sources, with caveats.`);
			break;
		case "single_source":
			parts.push("Reported by one source only — unconfirmed.");
			break;
		case "contested":
			parts.push("Sources disagree.");
			break;
		case "unsupported":
			parts.push("Not supported by anything OCADE could find.");
			break;
	}
	if (a.asOf) parts.push(`Most recent source dated ${a.asOf}.`);
	for (const u of a.uncertainties) parts.push(u);
	return parts.join(" ");
}
//#endregion
export { independentSources as a, describeAssessment as i, assessIncidentClaim as n, rankSources as o, authorityFor as r, assessClaim as t };
