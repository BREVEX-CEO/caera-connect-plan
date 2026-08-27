import { t as LOCAL_FILES_PACK } from "./local-files-pack-DE27j354.mjs";
import { C as methodRank, E as recordStep, S as matchPack, a as actionStyleFor, d as chooseHealthyMethod, i as SKILL_CATEGORIES, n as DEFAULT_BUDGET, o as assessAction, s as buildReceipt, t as CONTROL_PREFERENCE, u as checkScope, w as predictBudget } from "./skill-pack-DE_iAXbW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pack-registry-CPvQqgjI.js
/**
* Learned application maps (Skill Packs, second half).
*
* When OCADE meets an app it has no tested pack for, it inspects it ONCE —
* version, window titles, menus, accessibility tree, known file locations — and
* saves a reusable map. Later tasks reuse that map instead of re-inspecting,
* which is where most of the speed comes from.
*
* The correctness rule is the interesting part: a saved map is only valid while
* the app is unchanged. Menus and control ids move between releases, and acting
* on a stale map is precisely how an agent clicks the wrong thing. So every map
* carries a fingerprint, and a mismatch forces a re-probe rather than a guess.
*
* Maps describe STRUCTURE only — control names, menu paths, file locations.
* They never contain document contents, field values or anything the user
* typed, so a saved map is not a copy of the user's data.
*/
var KEY = "caera:appmaps:v1";
/**
* Build a fingerprint from what the probe observed.
*
* Deliberately includes UI shape (window title, control count), not just the
* version string: an app can change its layout in a patch release without
* changing the version the user sees, and a plugin can add menu items to an
* otherwise-identical build.
*/
function fingerprintApp(input) {
	return [
		input.version ?? "no-version",
		input.windowTitle ?? "no-title",
		String(input.controlCount ?? 0),
		input.locale ?? "no-locale"
	].join("|");
}
function cloneMap(map) {
	return {
		...map,
		controls: map.controls.map((control) => ({ ...control }))
	};
}
function isCanonicalIso(value) {
	if (typeof value !== "string") return false;
	const time = Date.parse(value);
	if (!Number.isFinite(time)) return false;
	try {
		return new Date(time).toISOString() === value;
	} catch {
		return false;
	}
}
function isStoredAppMap(value) {
	if (!value || typeof value !== "object") return false;
	const map = value;
	if (typeof map.appId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(map.appId) || typeof map.displayName !== "string" || !map.displayName.trim() || map.displayName.length > 200 || map.version !== null && (typeof map.version !== "string" || map.version.length > 100) || typeof map.fingerprint !== "string" || !map.fingerprint.trim() || map.fingerprint.length > 1e3 || !isCanonicalIso(map.learnedAt) || !Number.isInteger(map.uses) || map.uses < 0 || map.uses > 1e6 || !Array.isArray(map.controls) || map.controls.length > 1e3) return false;
	const ids = /* @__PURE__ */ new Set();
	return map.controls.every((control) => {
		if (!control || typeof control !== "object" || typeof control.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(control.id) || ids.has(control.id) || typeof control.label !== "string" || !control.label.trim() || control.label.length > 200 || !CONTROL_PREFERENCE.includes(control.method) || typeof control.anchor !== "string" || control.anchor.length > 500 || !isStableAnchor(control.anchor)) return false;
		ids.add(control.id);
		return true;
	});
}
function readAll() {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isStoredAppMap).map(cloneMap);
	} catch {
		return [];
	}
}
function writeAll(maps) {
	if (typeof localStorage === "undefined") return false;
	try {
		localStorage.setItem(KEY, JSON.stringify(maps));
		return true;
	} catch {
		return false;
	}
}
function listAppMaps() {
	return readAll();
}
/**
* Find a usable map for an app.
*
* `stale` is returned rather than `missing` when a map exists but the app
* changed: the caller can show what OCADE previously knew while making clear it
* must re-check. Returning `missing` would throw away useful context; returning
* `fresh` would be a lie.
*/
function lookupAppMap(appId, fingerprint) {
	const map = readAll().find((m) => m.appId === appId);
	if (!map) return {
		status: "missing",
		reason: "OCADE hasn't inspected this app yet."
	};
	if (map.fingerprint !== fingerprint) return {
		status: "stale",
		map,
		reason: "This app has changed since OCADE last looked at it — a different version, layout or language. OCADE will inspect it again before acting."
	};
	return {
		status: "fresh",
		map
	};
}
/** Record a successful use, so a well-proven map can be trusted more. */
function recordMapUse(appId) {
	const maps = readAll();
	const idx = maps.findIndex((m) => m.appId === appId);
	if (idx === -1) return true;
	if (maps[idx].uses >= 1e6) return false;
	maps[idx] = {
		...maps[idx],
		uses: maps[idx].uses + 1
	};
	return writeAll(maps);
}
/** Look up a control within a map. Returns null rather than a near-match. */
function findControl(map, controlId) {
	return map.controls.find((c) => c.id === controlId) ?? null;
}
function forgetAppMap(appId) {
	return writeAll(readAll().filter((m) => m.appId !== appId));
}
/**
* A control anchor must be stable across resize, DPI and theme changes.
* Raw coordinates are rejected: they are the single most common cause of an
* automation clicking the wrong thing after a display change.
*/
function isStableAnchor(anchor) {
	const a = anchor.trim();
	if (!a) return false;
	return !/^[({[]?\s*(?:x\s*[=:]\s*)?-?\d+(?:\.\d+)?\s*(?:[,;]|\s)\s*(?:y\s*[=:]\s*)?-?\d+(?:\.\d+)?\s*[)}\]]?$/i.test(a);
}
/**
* Decide whether and how to perform one step. Pure — it plans, it never acts,
* so the caller can show the plan before anything happens.
*/
function planStep(input) {
	const now = input.now ?? /* @__PURE__ */ new Date();
	const scopeDecision = checkScope(input.action, input.scope, now);
	if (!scopeDecision.allow) return {
		status: "refused",
		reason: scopeDecision.reason,
		escalate: scopeDecision.escalate
	};
	const match = matchPack(input.app, input.packs);
	let capability = input.capability;
	if (match.pack) {
		const declared = match.pack.capabilities.find((candidate) => candidate.id === capability.id);
		if (!declared) return {
			status: "refused",
			reason: `${match.pack.displayName} does not declare the "${capability.id}" capability. OCADE will not infer it from another pack.`,
			escalate: true
		};
		const sameMethods = declared.methods.length === capability.methods.length && declared.methods.every((method) => capability.methods.includes(method));
		if (declared.label !== capability.label || declared.mutating !== capability.mutating || declared.verifyBy !== capability.verifyBy || declared.tested !== capability.tested || !sameMethods) return {
			status: "refused",
			reason: `The requested "${capability.id}" metadata does not match the registered skill pack. OCADE will not run altered safety or verification rules.`,
			escalate: true
		};
		capability = declared;
	}
	const fingerprint = fingerprintApp(input.fingerprintInput ?? { version: input.app.version ?? null });
	const mapState = lookupAppMap(input.app.appId, fingerprint);
	if (match.confidence !== "verified" && mapState.status !== "fresh") return {
		status: "needs_inspection",
		reason: mapState.status === "stale" ? mapState.reason : `${match.reason} OCADE will look at the app once before acting.`,
		previousMap: mapState.status === "stale" ? mapState.map : null
	};
	const needsMappedCapability = match.confidence !== "verified" && mapState.status === "fresh";
	const learnedControl = needsMappedCapability ? findControl(mapState.map, capability.id) : null;
	if (needsMappedCapability && !learnedControl) return {
		status: "refused",
		reason: `OCADE inspected ${input.app.displayName}, but its learned map does not contain the exact "${capability.id}" capability. It will not substitute a similar control.`,
		escalate: true
	};
	const candidateMethods = learnedControl ? capability.methods.filter((method) => method === learnedControl.method) : capability.methods;
	if (learnedControl && candidateMethods.length === 0) return {
		status: "refused",
		reason: `The learned route for "${input.capability.id}" is not one of the capability's permitted methods.`,
		escalate: true
	};
	const routed = chooseHealthyMethod(candidateMethods.filter((m) => input.availableMethods.includes(m)), input.health, methodRank);
	if (!routed.method) return {
		status: "refused",
		reason: "Every way OCADE knows to do this is currently failing. It has stopped rather than retry blindly.",
		escalate: true
	};
	const effectiveConfidence = match.confidence === "unknown" && mapState.status === "fresh" ? "probed" : match.confidence;
	const assessment = assessAction(capability, effectiveConfidence, [routed.method], mapState.status === "fresh" ? { uses: mapState.map.uses } : null);
	if (!assessment.proceed || !assessment.method) return {
		status: "refused",
		reason: assessment.reason,
		escalate: true
	};
	const budget = predictBudget(input.remainingSteps ?? 1, input.averageStepMs ?? 500, input.budget ?? DEFAULT_BUDGET);
	if (!budget.withinBudget) return {
		status: "over_budget",
		reason: budget.reason,
		estimateMs: budget.estimateMs
	};
	return {
		status: "ready",
		plan: {
			app: input.app,
			capability,
			method: routed.method,
			confidence: assessment.confidence,
			routedAround: routed.routedAround,
			style: actionStyleFor(input.recording),
			scope: recordStep(scopeDecision.scope),
			intent: describeIntent(input.app, capability, routed.method, assessment.confidence)
		}
	};
}
/**
* State the app, version, target, result and confidence before acting — so the
* user can stop a step that is about to do the wrong thing.
*/
function describeIntent(app, capability, method, confidence) {
	const version = app.version ? ` ${app.version}` : "";
	const risk = capability.mutating ? "changes something" : "reads only";
	return `${capability.label} in ${app.displayName}${version} — ${risk}, ${Math.round(confidence * 100)}% confident.`;
}
/**
* Turn a completed step into a receipt.
*
* `verified` must come from a real check by the caller. Passing `true` without
* one produces exactly the fabricated success this product refuses to emit, so
* a capability declaring `verifyBy: "none"` can never yield a verified receipt.
*/
function completeStep(input) {
	const canVerify = input.plan.capability.verifyBy !== "none";
	const receipt = buildReceipt({
		app: input.plan.app,
		capability: input.plan.capability,
		method: input.plan.method,
		verified: canVerify && input.verified,
		evidence: canVerify ? input.evidence : `${input.evidence || "action performed"} (this step has no way to be checked)`,
		now: input.now
	});
	if (receipt.verified) recordMapUse(input.plan.app.appId);
	return receipt;
}
/**
* Executor registry — the missing link between a plan and an actual result.
*
* `work-session.planStep` decides WHETHER and HOW to act. Until now nothing
* connected that decision to the code that does the work, so a fully-planned
* step had no way to run. This maps `appId:capabilityId` to a real function and
* enforces, at the boundary, the two rules that the whole confidence model
* rests on:
*
*  1. A capability with no registered executor is REFUSED, not simulated. An
*     agent that quietly does nothing and reports success is worse than one
*     that fails.
*  2. Execution and verification are separate functions. An executor cannot
*     mark its own work as confirmed, and a missing verifier is a failed,
*     unconfirmed step rather than a plausible-looking success.
*/
function keyOf(appId, capabilityId) {
	return `${appId}:${capabilityId}`;
}
var SAFE_EXECUTOR_ID = /^[a-z0-9][a-z0-9._-]*$/i;
var ExecutorRegistry = class {
	executors = /* @__PURE__ */ new Map();
	verifiers = /* @__PURE__ */ new Map();
	register(appId, capabilityId, executor, verifier) {
		if (!SAFE_EXECUTOR_ID.test(appId) || !SAFE_EXECUTOR_ID.test(capabilityId)) throw new Error("Executor app and capability ids must be non-empty safe identifiers.");
		const key = keyOf(appId, capabilityId);
		this.executors.set(key, executor);
		if (verifier) this.verifiers.set(key, verifier);
		else this.verifiers.delete(key);
	}
	has(appId, capabilityId) {
		return this.executors.has(keyOf(appId, capabilityId));
	}
	get(appId, capabilityId) {
		return this.executors.get(keyOf(appId, capabilityId)) ?? null;
	}
	getVerifier(appId, capabilityId) {
		return this.verifiers.get(keyOf(appId, capabilityId)) ?? null;
	}
	/** Every capability that can genuinely be performed right now. */
	runnable() {
		return [...this.executors.keys()].sort();
	}
};
/**
* Run a planned step.
*
* The unavailable case is deliberately NOT an error dressed as a result: it
* returns before anything is attempted and produces no receipt at all, because
* a receipt implies something happened.
*/
async function runPlannedStep(registry, plan, now) {
	if (!(plan.app.appId.trim().length > 0 && plan.capability.id.trim().length > 0 && plan.capability.methods.includes(plan.method) && Number.isFinite(plan.confidence) && plan.confidence >= .7 && plan.confidence <= 1 && plan.intent.trim().length > 0)) return {
		status: "unavailable",
		reason: "Invalid plan metadata was refused before an executor could run."
	};
	const executor = registry.get(plan.app.appId, plan.capability.id);
	if (!executor) return {
		status: "unavailable",
		reason: `OCADE can plan “${plan.capability.label}” for ${plan.app.displayName} but has nothing wired up to actually do it. It hasn't pretended to.`
	};
	let result;
	try {
		result = await executor(plan);
	} catch (e) {
		const reason = e instanceof Error ? e.message : "The step failed unexpectedly.";
		return {
			status: "failed",
			reason,
			receipt: completeStep({
				plan,
				verified: false,
				evidence: reason,
				now
			})
		};
	}
	if (!result.ok) return {
		status: "failed",
		reason: result.evidence,
		receipt: completeStep({
			plan,
			verified: false,
			evidence: result.evidence,
			now
		})
	};
	if (plan.capability.verifyBy === "none") {
		const reason = `${result.evidence} The capability has no independent verification method.`;
		return {
			status: "failed",
			reason,
			receipt: completeStep({
				plan,
				verified: false,
				evidence: reason,
				now
			})
		};
	}
	const verifier = registry.getVerifier(plan.app.appId, plan.capability.id);
	if (!verifier) {
		const reason = `${result.evidence} No independent verifier is registered.`;
		return {
			status: "failed",
			reason,
			receipt: completeStep({
				plan,
				verified: false,
				evidence: reason,
				now
			})
		};
	}
	let verification;
	try {
		verification = await verifier(plan, result);
	} catch (e) {
		const reason = e instanceof Error ? e.message : "Independent verification failed unexpectedly.";
		return {
			status: "failed",
			reason,
			receipt: completeStep({
				plan,
				verified: false,
				evidence: reason,
				now
			})
		};
	}
	const receipt = completeStep({
		plan,
		verified: verification.verified,
		evidence: verification.evidence,
		now
	});
	if (!receipt.verified) return {
		status: "failed",
		reason: verification.evidence,
		receipt
	};
	return {
		status: "done",
		receipt,
		data: result.data
	};
}
/**
* Describe what OCADE can actually DO right now, as opposed to what it can
* describe. The difference between those two is the entire point.
*/
function describeRunnable(registry, capabilities) {
	const runnable = capabilities.filter((c) => registry.has(c.appId, c.capability.id));
	if (runnable.length === 0) return "OCADE can't perform any of these on this machine yet — it will say so rather than appear to try.";
	return `${runnable.length} of ${capabilities.length} actions can run here. The rest need software or a component that isn't installed.`;
}
var DATA_PACK = {
	appId: "ocade.data",
	displayName: "Data and analysis",
	category: "data_bi_ai",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "data.parse_csv",
			label: "Read a CSV file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "data.parse_json",
			label: "Read a JSON file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "data.summarise",
			label: "Summarise a column",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "data.filter",
			label: "Filter rows",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false
};
/**
* Parse CSV, including quoted fields containing commas and newlines.
*
* A naive `split(",")` corrupts any real-world export silently — the row count
* still looks plausible, so the damage is invisible until someone acts on it.
*/
function parseCsv(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That file is empty."
	};
	const rows = [];
	let field = "";
	let row = [];
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === "\"") if (text[i + 1] === "\"") {
				field += "\"";
				i++;
			} else inQuotes = false;
			else field += c;
			continue;
		}
		if (c === "\"") inQuotes = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (c !== "\r") field += c;
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	if (inQuotes) return {
		ok: false,
		reason: "This CSV has an unclosed quote — it may be truncated."
	};
	if (rows.length < 2) return {
		ok: false,
		reason: "This CSV has a header but no data rows."
	};
	const columns = rows[0].map((c) => c.trim());
	const dataRows = rows.slice(1).filter((r) => r.some((v) => v.trim().length > 0));
	const ragged = dataRows.findIndex((r) => r.length !== columns.length);
	if (ragged !== -1) return {
		ok: false,
		reason: `Row ${ragged + 2} has ${dataRows[ragged].length} values but there are ${columns.length} columns. OCADE won't guess which column they belong to.`
	};
	return {
		ok: true,
		data: {
			columns,
			rows: dataRows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])))
		},
		evidence: `${dataRows.length} rows × ${columns.length} columns.`
	};
}
function parseJsonRecords(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		return {
			ok: false,
			reason: `That isn't valid JSON: ${e instanceof Error ? e.message : "unreadable"}.`
		};
	}
	if (!Array.isArray(parsed)) return {
		ok: false,
		reason: "That JSON isn't a list of records."
	};
	if (parsed.length === 0) return {
		ok: false,
		reason: "That list is empty."
	};
	const objects = parsed.filter((r) => typeof r === "object" && r !== null);
	if (objects.length !== parsed.length) return {
		ok: false,
		reason: "Some entries aren't records, so the columns can't be determined."
	};
	const columns = [...new Set(objects.flatMap((o) => Object.keys(o)))];
	return {
		ok: true,
		data: {
			columns,
			rows: objects.map((o) => Object.fromEntries(columns.map((c) => [c, o[c] === void 0 || o[c] === null ? "" : String(o[c])])))
		},
		evidence: `${objects.length} records × ${columns.length} fields.`
	};
}
/**
* Summarise one column.
*
* Refuses rather than approximating when any value in a numeric column cannot
* be parsed: a mean over "the rows that happened to parse" is a different
* number from the one the user asked for, and it looks identical.
*/
function summariseColumn(table, column) {
	if (!table.columns.includes(column)) return {
		ok: false,
		reason: `There's no column called “${column}”. Available: ${table.columns.join(", ")}.`
	};
	const nonEmpty = table.rows.map((r) => (r[column] ?? "").trim()).filter((v) => v.length > 0);
	if (nonEmpty.length === 0) return {
		ok: true,
		data: {
			column,
			count: 0,
			numeric: false,
			unparsed: 0
		},
		evidence: `“${column}” has no values, so there's nothing to average.`
	};
	const parsed = nonEmpty.map((v) => ({
		raw: v,
		num: Number(v.replace(/,/g, ""))
	}));
	const unparsed = parsed.filter((p) => !Number.isFinite(p.num));
	if (unparsed.length > 0 && unparsed.length < parsed.length) return {
		ok: false,
		reason: `“${column}” mixes numbers with ${unparsed.length} non-numeric value${unparsed.length === 1 ? "" : "s"} (e.g. “${unparsed[0].raw}”). OCADE won't average part of a column and present it as the whole.`
	};
	if (unparsed.length === parsed.length) return {
		ok: true,
		data: {
			column,
			count: nonEmpty.length,
			numeric: false,
			unparsed: unparsed.length
		},
		evidence: `“${column}” holds text, so only the count (${nonEmpty.length}) is meaningful.`
	};
	const nums = parsed.map((p) => p.num);
	const sum = nums.reduce((a, b) => a + b, 0);
	return {
		ok: true,
		data: {
			column,
			count: nums.length,
			numeric: true,
			min: Math.min(...nums),
			max: Math.max(...nums),
			sum,
			mean: sum / nums.length,
			unparsed: 0
		},
		evidence: `${nums.length} values, mean ${(sum / nums.length).toFixed(2)}, range ${Math.min(...nums)}–${Math.max(...nums)}.`
	};
}
/** Filter rows by an exact column value. Reports how many matched. */
function filterRows(table, column, value) {
	if (!table.columns.includes(column)) return {
		ok: false,
		reason: `There's no column called “${column}”.`
	};
	const rows = table.rows.filter((r) => (r[column] ?? "") === value);
	return {
		ok: true,
		data: {
			columns: table.columns,
			rows
		},
		evidence: `${rows.length} of ${table.rows.length} rows match ${column} = “${value}”.`
	};
}
/**
* Default executors - what OCADE can genuinely do right now, in the browser,
* with no companion and no network.
*
* This is deliberately a short list. Most packs describe work that needs the
* signed companion (files, windows, git, archives) or its managed browser host
* (pages), and neither can run inside the web app itself. Registering those
* here would produce controls that look available and fail on use.
*
* The data pack is different: it is pure computation over text the user has
* already given us, so it runs anywhere - including offline.
*/
/**
* Build a registry of the capabilities that genuinely work here.
*
* Execution and verification are registered separately. Each verifier
* recomputes the expected result from the input instead of accepting the
* executor's account of its own work.
*/
function createDefaultExecutors(getInput) {
	const registry = new ExecutorRegistry();
	const need = () => getInput() ?? { missing: "no input" };
	const compare = (execution, expectedData, evidence) => execution.data === expectedData ? {
		verified: true,
		evidence: `Independent recomputation matched. ${evidence}`
	} : {
		verified: false,
		evidence: "Independent recomputation did not match the executor output."
	};
	registry.register("ocade.data", "data.parse_csv", async () => {
		const input = need();
		if ("missing" in input || !input.text) return {
			ok: false,
			evidence: "No CSV text was provided."
		};
		const result = parseCsv(input.text);
		return result.ok ? {
			ok: true,
			evidence: result.evidence,
			data: JSON.stringify({
				columns: result.data.columns,
				rowCount: result.data.rows.length
			})
		} : {
			ok: false,
			evidence: result.reason
		};
	}, (_plan, execution) => {
		const input = need();
		if ("missing" in input || !input.text) return {
			verified: false,
			evidence: "Independent verification had no CSV input."
		};
		const checked = parseCsv(input.text);
		if (!checked.ok) return {
			verified: false,
			evidence: checked.reason
		};
		return compare(execution, JSON.stringify({
			columns: checked.data.columns,
			rowCount: checked.data.rows.length
		}), checked.evidence);
	});
	registry.register("ocade.data", "data.parse_json", async () => {
		const input = need();
		if ("missing" in input || !input.text) return {
			ok: false,
			evidence: "No JSON text was provided."
		};
		const result = parseJsonRecords(input.text);
		return result.ok ? {
			ok: true,
			evidence: result.evidence,
			data: JSON.stringify({
				columns: result.data.columns,
				rowCount: result.data.rows.length
			})
		} : {
			ok: false,
			evidence: result.reason
		};
	}, (_plan, execution) => {
		const input = need();
		if ("missing" in input || !input.text) return {
			verified: false,
			evidence: "Independent verification had no JSON input."
		};
		const checked = parseJsonRecords(input.text);
		if (!checked.ok) return {
			verified: false,
			evidence: checked.reason
		};
		return compare(execution, JSON.stringify({
			columns: checked.data.columns,
			rowCount: checked.data.rows.length
		}), checked.evidence);
	});
	registry.register("ocade.data", "data.summarise", async () => {
		const input = need();
		if ("missing" in input || !input.table || !input.column) return {
			ok: false,
			evidence: "No table or column was provided."
		};
		const result = summariseColumn(input.table, input.column);
		return result.ok ? {
			ok: true,
			evidence: result.evidence,
			data: JSON.stringify(result.data)
		} : {
			ok: false,
			evidence: result.reason
		};
	}, (_plan, execution) => {
		const input = need();
		if ("missing" in input || !input.table || !input.column) return {
			verified: false,
			evidence: "Independent verification had no table or column."
		};
		const checked = summariseColumn(input.table, input.column);
		if (!checked.ok) return {
			verified: false,
			evidence: checked.reason
		};
		return compare(execution, JSON.stringify(checked.data), checked.evidence);
	});
	registry.register("ocade.data", "data.filter", async () => {
		const input = need();
		if ("missing" in input || !input.table || !input.column || input.value === void 0) return {
			ok: false,
			evidence: "No table, column or value was provided."
		};
		const result = filterRows(input.table, input.column, input.value);
		return result.ok ? {
			ok: true,
			evidence: result.evidence,
			data: String(result.data.rows.length)
		} : {
			ok: false,
			evidence: result.reason
		};
	}, (_plan, execution) => {
		const input = need();
		if ("missing" in input || !input.table || !input.column || input.value === void 0) return {
			verified: false,
			evidence: "Independent verification had no table, column or filter value."
		};
		const checked = filterRows(input.table, input.column, input.value);
		if (!checked.ok) return {
			verified: false,
			evidence: checked.reason
		};
		return compare(execution, String(checked.data.rows.length), checked.evidence);
	});
	return registry;
}
var RUNTIME_REALITY = "Reading and analysing data works entirely on this device, including offline. Controlling files, windows and other applications needs the OCADE companion app, and acting on web pages needs its managed Playwright/CDP browser host. OCADE says so rather than showing a control that would fail.";
var GIT_PACK = {
	appId: "git",
	displayName: "Git",
	category: "dev_tools",
	testedVersions: ["2."],
	capabilities: [
		{
			id: "git.version",
			label: "Check the installed Git version",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.status",
			label: "See what has changed",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.log",
			label: "Read recent history",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.diff",
			label: "Show the exact changes",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.branch.list",
			label: "List branches",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.stage",
			label: "Stage specific files",
			methods: ["cli"],
			mutating: true,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.commit",
			label: "Commit staged changes",
			methods: ["cli"],
			mutating: true,
			verifyBy: "log",
			tested: true
		},
		{
			id: "git.branch.create",
			label: "Create a branch",
			methods: ["cli"],
			mutating: true,
			verifyBy: "log",
			tested: true
		}
	],
	requiresLicensedInstall: false
};
var INTEGRITY_PACK = {
	appId: "ocade.integrity",
	displayName: "File integrity",
	category: "security_networking",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "integrity.hash",
			label: "Calculate a file's checksum",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "integrity.verify",
			label: "Check a file against an expected checksum",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "integrity.compare",
			label: "Check whether two files are identical",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		}
	],
	requiresLicensedInstall: false
};
var ARCHIVE_PACK = {
	appId: "tar",
	displayName: "Archives",
	category: "browsers_transfer",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "archive.list",
			label: "List what's inside an archive",
			methods: ["cli"],
			mutating: false,
			verifyBy: "log",
			tested: true
		},
		{
			id: "archive.create",
			label: "Create an archive",
			methods: ["cli"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "archive.extract",
			label: "Extract an archive you've approved",
			methods: ["cli"],
			mutating: true,
			verifyBy: "file",
			tested: true
		}
	],
	requiresLicensedInstall: false
};
var GEO_PACK = {
	appId: "ocade.geo",
	displayName: "Maps and geospatial data",
	category: "engineering_cad",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "geo.parse",
			label: "Read a GeoJSON file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "geo.bbox",
			label: "Find the extent of features",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "geo.area",
			label: "Measure a polygon's area on the ground",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Covers GeoJSON files only. OCADE cannot operate SolidWorks, AutoCAD, ArcGIS or other CAD and GIS applications."
};
function isPosition(v) {
	return Array.isArray(v) && v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number" && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}
/**
* Longitude/latitude order is the single most common GeoJSON mistake, and a
* swapped pair usually still parses. Range-checking catches most of them: a
* latitude beyond ±90 is impossible, so the file is wrong somewhere.
*/
function positionError(p, where) {
	const [lon, lat] = p;
	if (lat < -90 || lat > 90) return `${where} has a latitude of ${lat}, which is outside ±90. GeoJSON positions are [longitude, latitude] — these may be the wrong way round.`;
	if (lon < -180 || lon > 180) return `${where} has a longitude of ${lon}, which is outside ±180.`;
	return null;
}
function readRing(coords, where) {
	if (!Array.isArray(coords)) return {
		ok: false,
		reason: `${where} has no coordinate list.`
	};
	const ring = [];
	for (let i = 0; i < coords.length; i++) {
		const p = coords[i];
		if (!isPosition(p)) return {
			ok: false,
			reason: `${where}, position ${i + 1} isn't a valid [longitude, latitude] pair.`
		};
		const err = positionError(p, `${where}, position ${i + 1}`);
		if (err) return {
			ok: false,
			reason: err
		};
		ring.push([p[0], p[1]]);
	}
	return {
		ok: true,
		data: ring,
		evidence: `${ring.length} positions.`
	};
}
/**
* A closed ring repeats its first position last, and needs four positions to
* enclose any area. Both are refusals rather than repairs — see the header.
*/
function ringClosureError(ring, where) {
	if (ring.length < 4) return `${where} has ${ring.length} position${ring.length === 1 ? "" : "s"}. A polygon ring needs at least 4, with the last repeating the first.`;
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first[0] !== last[0] || first[1] !== last[1]) return `${where} isn't closed — it ends at [${last[0]}, ${last[1]}] but starts at [${first[0]}, ${first[1]}]. OCADE won't close it for you, because that changes the shape.`;
	return null;
}
function readGeometry(geometry, where) {
	if (typeof geometry !== "object" || geometry === null) return {
		ok: false,
		reason: `${where} has no geometry.`
	};
	const g = geometry;
	const type = g.type;
	if (type === "Point") {
		const p = g.coordinates;
		if (!isPosition(p)) return {
			ok: false,
			reason: `${where} isn't a valid position.`
		};
		const err = positionError(p, where);
		if (err) return {
			ok: false,
			reason: err
		};
		return {
			ok: true,
			data: {
				type: "Point",
				rings: [[[p[0], p[1]]]]
			},
			evidence: "1 point."
		};
	}
	if (type === "LineString") {
		const ring = readRing(g.coordinates, where);
		if (!ring.ok) return ring;
		if (ring.data.length < 2) return {
			ok: false,
			reason: `${where} has fewer than 2 positions, so it isn't a line.`
		};
		return {
			ok: true,
			data: {
				type: "LineString",
				rings: [ring.data]
			},
			evidence: ring.evidence
		};
	}
	if (type === "Polygon") {
		if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return {
			ok: false,
			reason: `${where} has no rings.`
		};
		const rings = [];
		for (let i = 0; i < g.coordinates.length; i++) {
			const label = i === 0 ? `${where}, outer ring` : `${where}, hole ${i}`;
			const ring = readRing(g.coordinates[i], label);
			if (!ring.ok) return ring;
			const closure = ringClosureError(ring.data, label);
			if (closure) return {
				ok: false,
				reason: closure
			};
			rings.push(ring.data);
		}
		return {
			ok: true,
			data: {
				type: "Polygon",
				rings
			},
			evidence: `${rings.length} ring(s).`
		};
	}
	if (type === "MultiPolygon") {
		if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return {
			ok: false,
			reason: `${where} has no polygons.`
		};
		const rings = [];
		for (let pi = 0; pi < g.coordinates.length; pi++) {
			const poly = g.coordinates[pi];
			if (!Array.isArray(poly)) return {
				ok: false,
				reason: `${where}, polygon ${pi + 1} has no rings.`
			};
			for (let i = 0; i < poly.length; i++) {
				const label = i === 0 ? `${where}, polygon ${pi + 1} outer ring` : `${where}, polygon ${pi + 1} hole ${i}`;
				const ring = readRing(poly[i], label);
				if (!ring.ok) return ring;
				const closure = ringClosureError(ring.data, label);
				if (closure) return {
					ok: false,
					reason: closure
				};
				rings.push(ring.data);
			}
		}
		return {
			ok: true,
			data: {
				type: "MultiPolygon",
				rings
			},
			evidence: `${rings.length} ring(s).`
		};
	}
	return {
		ok: false,
		reason: `${where} is a “${String(type)}” geometry, which OCADE hasn't been tested against. It handles Point, LineString, Polygon and MultiPolygon.`
	};
}
/**
* Parse a GeoJSON document. Accepts a FeatureCollection, a single Feature, or a
* bare geometry — all three are valid RFC 7946 and all three appear in exports.
*/
function parseGeoJson(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That file is empty."
	};
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		return {
			ok: false,
			reason: `That isn't valid JSON: ${e instanceof Error ? e.message : "unreadable"}.`
		};
	}
	if (typeof parsed !== "object" || parsed === null) return {
		ok: false,
		reason: "That JSON isn't a GeoJSON object."
	};
	const root = parsed;
	const readFeature = (f, where) => {
		if (typeof f !== "object" || f === null) return {
			ok: false,
			reason: `${where} isn't an object.`
		};
		const feat = f;
		const geom = readGeometry(feat.geometry, where);
		if (!geom.ok) return geom;
		const props = typeof feat.properties === "object" && feat.properties !== null ? feat.properties : {};
		return {
			ok: true,
			data: {
				...geom.data,
				properties: props
			},
			evidence: geom.evidence
		};
	};
	if (root.type === "FeatureCollection") {
		if (!Array.isArray(root.features)) return {
			ok: false,
			reason: "This FeatureCollection has no features list."
		};
		if (root.features.length === 0) return {
			ok: false,
			reason: "This FeatureCollection is empty — there's nothing to work with."
		};
		const features = [];
		for (let i = 0; i < root.features.length; i++) {
			const f = readFeature(root.features[i], `Feature ${i + 1}`);
			if (!f.ok) return f;
			features.push(f.data);
		}
		return {
			ok: true,
			data: { features },
			evidence: `${features.length} feature${features.length === 1 ? "" : "s"}.`
		};
	}
	if (root.type === "Feature") {
		const f = readFeature(root, "This feature");
		if (!f.ok) return f;
		return {
			ok: true,
			data: { features: [f.data] },
			evidence: "1 feature."
		};
	}
	const geom = readGeometry(root, "This geometry");
	if (!geom.ok) return geom;
	return {
		ok: true,
		data: { features: [{
			...geom.data,
			properties: {}
		}] },
		evidence: "1 geometry."
	};
}
/**
* The extent of every feature in the document.
*
* Refuses when the features span more than half the globe in longitude: such a
* set is either antimeridian-crossing (where a west<east box is simply wrong)
* or contains a coordinate error, and OCADE cannot tell which. A box that is
* silently inside-out is worse than no box.
*/
function boundingBox(doc) {
	const positions = doc.features.flatMap((f) => f.rings.flat());
	if (positions.length === 0) return {
		ok: false,
		reason: "There are no positions to measure."
	};
	const lons = positions.map((p) => p[0]);
	const lats = positions.map((p) => p[1]);
	const box = {
		west: Math.min(...lons),
		south: Math.min(...lats),
		east: Math.max(...lons),
		north: Math.max(...lats)
	};
	if (box.east - box.west > 180) return {
		ok: false,
		reason: `These features span ${(box.east - box.west).toFixed(1)}° of longitude. That usually means they cross the antimeridian or one coordinate is wrong — either way a simple box would be misleading, so OCADE won't give you one.`
	};
	return {
		ok: true,
		data: box,
		evidence: `${positions.length} positions, from ${box.south.toFixed(4)}, ${box.west.toFixed(4)} to ${box.north.toFixed(4)}, ${box.east.toFixed(4)}.`
	};
}
/** Mean Earth radius, metres (IUGG). */
var EARTH_RADIUS_M = 6371008.8;
var toRad = (deg) => deg * Math.PI / 180;
/**
* Signed geodesic area of one ring, in square metres, by spherical excess.
*
* This is the standard formula used by geodesy libraries. A planar
* shoelace over raw degrees would be wrong by roughly a factor of cos(latitude)
* in one axis — about 2× at 60° — while still printing a confident number.
*/
function ringAreaM2(ring) {
	if (ring.length < 4) return 0;
	let total = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [lon1, lat1] = ring[i];
		const [lon2, lat2] = ring[i + 1];
		total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
	}
	return total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
}
/**
* Ground area of a polygon feature, with holes subtracted.
*
* Refuses anything that isn't a polygon: a line and a point have no area, and
* returning zero would read as "measured, and it's zero".
*/
function polygonArea(feature) {
	if (feature.type !== "Polygon" && feature.type !== "MultiPolygon") return {
		ok: false,
		reason: `A ${feature.type} encloses no area. OCADE won't report 0 m², because that reads as a measurement.`
	};
	const areas = feature.rings.map((r) => Math.abs(ringAreaM2(r)));
	const outer = areas[0] ?? 0;
	const holes = areas.slice(1).reduce((a, b) => a + b, 0);
	if (holes > outer) return {
		ok: false,
		reason: "The holes in this polygon are larger than its outer boundary, so the ring order must be wrong. OCADE won't report a negative area as if it were a measurement."
	};
	const squareMetres = outer - holes;
	return {
		ok: true,
		data: {
			squareMetres,
			hectares: squareMetres / 1e4,
			rings: feature.rings.length
		},
		evidence: squareMetres >= 1e6 ? `${(squareMetres / 1e6).toFixed(3)} km² (${Math.round(squareMetres).toLocaleString("en-GB")} m²), measured on the Earth's surface.` : `${Math.round(squareMetres).toLocaleString("en-GB")} m², measured on the Earth's surface.`
	};
}
var MONEY_PACK = {
	appId: "ocade.money",
	displayName: "Invoices and money arithmetic",
	category: "finance_commerce",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "money.parse",
			label: "Read an amount exactly",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "money.invoice_total",
			label: "Total an invoice, with tax",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "money.allocate",
			label: "Split an amount without losing a penny",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Calculates on amounts you provide. OCADE cannot sign into a bank, move money, file a tax return, or operate accounting software such as SAP, Xero or QuickBooks."
};
/**
* Currencies with an exponent other than 2. Getting JPY wrong by a factor of
* 100 is the classic version of this bug.
*/
var EXPONENTS = {
	JPY: 0,
	KRW: 0,
	VND: 0,
	CLP: 0,
	ISK: 0,
	BHD: 3,
	KWD: 3,
	OMR: 3,
	TND: 3,
	JOD: 3
};
function exponentFor(currency) {
	return EXPONENTS[currency.toUpperCase()] ?? 2;
}
/**
* Read an amount written the way people write them.
*
* Refuses more decimal places than the currency actually has, rather than
* rounding: "10.005" in GBP is either a typo or a value from a system with
* different precision, and quietly turning it into £10.01 hides which.
*/
function parseMoney(input, currency) {
	const code = currency.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code)) return {
		ok: false,
		reason: `“${currency}” isn't a three-letter currency code.`
	};
	const exponent = exponentFor(code);
	const cleaned = input.trim().replace(/[\s,](?=\d{3}\b)/g, "").replace(/[£$€]/g, "");
	const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(cleaned);
	if (!m) return {
		ok: false,
		reason: `OCADE can't read “${input}” as an amount. It won't guess — a misread figure is worse than no figure.`
	};
	const [, sign, whole, frac = ""] = m;
	if (frac.length > exponent) return {
		ok: false,
		reason: exponent === 0 ? `${code} has no minor unit, so “${input}” can't be exact. OCADE won't round it for you.` : `${code} has ${exponent} decimal places, but “${input}” has ${frac.length}. OCADE won't round it silently.`
	};
	const padded = frac.padEnd(exponent, "0");
	const minorUnits = Number(`${sign}${whole}${padded}`);
	if (!Number.isSafeInteger(minorUnits)) return {
		ok: false,
		reason: `${input} is too large to hold exactly.`
	};
	return {
		ok: true,
		data: {
			minorUnits,
			currency: code,
			exponent
		},
		evidence: `${formatMoney({
			minorUnits,
			currency: code,
			exponent
		})} held as ${minorUnits} minor unit${Math.abs(minorUnits) === 1 ? "" : "s"}.`
	};
}
function formatMoney(m) {
	const negative = m.minorUnits < 0;
	const abs = Math.abs(m.minorUnits).toString().padStart(m.exponent + 1, "0");
	const whole = m.exponent === 0 ? abs : abs.slice(0, -m.exponent);
	const frac = m.exponent === 0 ? "" : `.${abs.slice(-m.exponent)}`;
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return `${negative ? "-" : ""}${grouped}${frac} ${m.currency}`;
}
/**
* Total an invoice.
*
* Tax is computed **per rate band on the summed net**, not per line. Rounding
* each line's tax separately and adding them up gives a different figure from
* the one the tax authority expects, and the difference grows with line count.
*/
function invoiceTotal(items, currency) {
	const code = currency.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code)) return {
		ok: false,
		reason: `“${currency}” isn't a three-letter currency code.`
	};
	if (items.length === 0) return {
		ok: false,
		reason: "There are no line items, so there is no total."
	};
	for (const [i, item] of items.entries()) {
		if (!Number.isSafeInteger(item.unitPrice)) return {
			ok: false,
			reason: `Line ${i + 1} (“${item.description}”) has a fractional unit price. Prices must be exact minor units — read them with parseMoney first.`
		};
		if (!Number.isInteger(item.quantity) || item.quantity < 0) return {
			ok: false,
			reason: `Line ${i + 1} (“${item.description}”) has an invalid quantity.`
		};
		if (!Number.isInteger(item.taxRateBasisPoints) || item.taxRateBasisPoints < 0) return {
			ok: false,
			reason: `Line ${i + 1} (“${item.description}”) has an invalid tax rate.`
		};
	}
	const bands = /* @__PURE__ */ new Map();
	for (const item of items) {
		const lineNet = item.unitPrice * item.quantity;
		bands.set(item.taxRateBasisPoints, (bands.get(item.taxRateBasisPoints) ?? 0) + lineNet);
	}
	const byRate = [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([rateBasisPoints, net]) => ({
		rateBasisPoints,
		net,
		tax: Math.round(net * rateBasisPoints / 1e4)
	}));
	const net = byRate.reduce((a, b) => a + b.net, 0);
	const tax = byRate.reduce((a, b) => a + b.tax, 0);
	const exponent = exponentFor(code);
	return {
		ok: true,
		data: {
			net,
			tax,
			gross: net + tax,
			currency: code,
			exponent,
			byRate
		},
		evidence: `${items.length} line${items.length === 1 ? "" : "s"}: net ${formatMoney({
			minorUnits: net,
			currency: code,
			exponent
		})}, tax ${formatMoney({
			minorUnits: tax,
			currency: code,
			exponent
		})}, total ${formatMoney({
			minorUnits: net + tax,
			currency: code,
			exponent
		})}.`
	};
}
/**
* Split an amount into shares that sum EXACTLY back to it.
*
* Largest-remainder: give everyone their floor, then hand the leftover minor
* units to the shares with the largest fractional parts. Rounding each share
* independently is the version of this that loses a penny — and a penny that
* vanishes from a payout run is a reconciliation failure, not a rounding
* detail.
*/
function allocate(total, weights) {
	if (!Number.isSafeInteger(total)) return {
		ok: false,
		reason: "The amount to split must be exact minor units."
	};
	if (weights.length === 0) return {
		ok: false,
		reason: "There's nobody to split this between."
	};
	if (weights.some((w) => !Number.isFinite(w) || w < 0)) return {
		ok: false,
		reason: "Every share must be zero or more."
	};
	const totalWeight = weights.reduce((a, b) => a + b, 0);
	if (totalWeight <= 0) return {
		ok: false,
		reason: "The shares add up to zero, so there's no way to divide this."
	};
	const exact = weights.map((w) => total * w / totalWeight);
	const shares = exact.map((e) => Math.floor(e));
	let remainder = total - shares.reduce((a, b) => a + b, 0);
	const order = exact.map((e, i) => ({
		i,
		frac: e - Math.floor(e)
	})).sort((a, b) => b.frac - a.frac || a.i - b.i);
	for (let k = 0; remainder > 0; k++, remainder--) shares[order[k % order.length].i] += 1;
	const sum = shares.reduce((a, b) => a + b, 0);
	if (sum !== total) return {
		ok: false,
		reason: `Split failed an internal check: parts total ${sum}, not ${total}.`
	};
	return {
		ok: true,
		data: shares,
		evidence: `Split ${total} into ${shares.length} share${shares.length === 1 ? "" : "s"} totalling exactly ${sum}.`
	};
}
var CALENDAR_PACK = {
	appId: "ocade.calendar",
	displayName: "Calendars and schedules",
	category: "chat_projects",
	testedVersions: ["2.0"],
	capabilities: [
		{
			id: "calendar.parse",
			label: "Read a calendar file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "calendar.conflicts",
			label: "Find overlapping events",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "calendar.free_time",
			label: "Find free time in a day",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Reads exported .ics calendar files. OCADE cannot sign into Outlook, Google Calendar, Slack or Teams, and never sends invitations or replies."
};
/**
* Undo RFC 5545 line folding: a line beginning with a space or tab continues
* the previous one.
*/
function unfold(text) {
	const raw = text.replace(/\r\n/g, "\n").split("\n");
	const lines = [];
	for (const line of raw) if ((line.startsWith(" ") || line.startsWith("	")) && lines.length > 0) lines[lines.length - 1] += line.slice(1);
	else lines.push(line);
	return lines;
}
/** iCalendar escapes \, \; \n and \\ inside text values. */
function unescapeText(v) {
	return v.replace(/\\([\\;,nN])/g, (_, c) => c === "n" || c === "N" ? "\n" : c);
}
function parseProp(line) {
	const colon = line.indexOf(":");
	if (colon === -1) return null;
	const head = line.slice(0, colon);
	const value = line.slice(colon + 1);
	const [name, ...paramParts] = head.split(";");
	const params = {};
	for (const p of paramParts) {
		const eq = p.indexOf("=");
		if (eq !== -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
	}
	return {
		name: name.toUpperCase(),
		params,
		value
	};
}
/**
* Read a DTSTART/DTEND value.
*
* A trailing `Z` means UTC. A `TZID` parameter names a zone. Anything else is
* floating local time, and is flagged rather than assumed to be UTC — assuming
* is how an agent reports a clash that isn't there, or misses one that is.
*/
function parseTime(prop) {
	const v = prop.value.trim();
	const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
	if (dateOnly) {
		const [, y, m, d] = dateOnly;
		return {
			ok: true,
			data: {
				date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))),
				floating: false,
				allDay: true
			},
			evidence: "all-day"
		};
	}
	const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
	if (!stamp) return {
		ok: false,
		reason: `OCADE can't read “${prop.value}” as a date and time.`
	};
	const [, y, mo, d, h, mi, s, z] = stamp;
	const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
	if (Number.isNaN(date.getTime())) return {
		ok: false,
		reason: `“${prop.value}” isn't a real date.`
	};
	const floating = z !== "Z";
	return {
		ok: true,
		data: {
			date,
			floating,
			allDay: false
		},
		evidence: floating ? "local time" : "UTC"
	};
}
/** Parse an iCalendar document into events. */
function parseIcs(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That file is empty."
	};
	const lines = unfold(text);
	if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) return {
		ok: false,
		reason: "That isn't an iCalendar file — it has no BEGIN:VCALENDAR."
	};
	const events = [];
	let current = null;
	let index = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
			index++;
			current = {};
			continue;
		}
		if (trimmed.toUpperCase() === "END:VEVENT") {
			if (!current) continue;
			if (!current.start) return {
				ok: false,
				reason: `Event ${index} has no start time, so it can't be placed.`
			};
			events.push({
				uid: current.uid ?? `event-${index}`,
				summary: current.summary ?? "(no title)",
				start: current.start,
				end: current.end ?? current.start,
				floating: current.floating ?? false,
				allDay: current.allDay ?? false
			});
			current = null;
			continue;
		}
		if (!current) continue;
		const prop = parseProp(line);
		if (!prop) continue;
		if (prop.name === "UID") current.uid = prop.value.trim();
		else if (prop.name === "SUMMARY") current.summary = unescapeText(prop.value);
		else if (prop.name === "DTSTART") {
			const t = parseTime(prop);
			if (!t.ok) return t;
			current.start = t.data.date;
			current.floating = t.data.floating;
			current.allDay = t.data.allDay;
		} else if (prop.name === "DTEND") {
			const t = parseTime(prop);
			if (!t.ok) return t;
			current.end = t.data.date;
			if (t.data.floating) current.floating = true;
		}
	}
	if (current !== null) return {
		ok: false,
		reason: "This file ends inside an event — it's truncated."
	};
	if (events.length === 0) return {
		ok: false,
		reason: "This calendar has no events."
	};
	for (const e of events) if (e.end.getTime() < e.start.getTime()) return {
		ok: false,
		reason: `“${e.summary}” ends before it starts, so this file is wrong.`
	};
	const floating = events.filter((e) => e.floating).length;
	return {
		ok: true,
		data: events,
		evidence: floating > 0 ? `${events.length} event${events.length === 1 ? "" : "s"}, ${floating} without a time zone.` : `${events.length} event${events.length === 1 ? "" : "s"}.`
	};
}
/**
* Find events that overlap.
*
* Refuses outright when any event is floating: one unzoned time can shift a
* comparison by hours, and a clash report that is confidently wrong is worse
* than being told the file needs fixing first.
*/
function findConflicts(events) {
	const floating = events.filter((e) => e.floating);
	if (floating.length > 0) return {
		ok: false,
		reason: `${floating.length} event${floating.length === 1 ? " has" : "s have"} no time zone (e.g. “${floating[0].summary}”). OCADE won't compare those against zoned times — the answer would look right and be hours out.`
	};
	const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
	const conflicts = [];
	for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
		const a = sorted[i];
		const b = sorted[j];
		if (b.start.getTime() >= a.end.getTime()) break;
		const overlap = Math.min(a.end.getTime(), b.end.getTime()) - b.start.getTime();
		if (overlap > 0) conflicts.push({
			a,
			b,
			overlapMinutes: Math.round(overlap / 6e4)
		});
	}
	return {
		ok: true,
		data: conflicts,
		evidence: conflicts.length === 0 ? `No overlaps across ${events.length} event${events.length === 1 ? "" : "s"}.` : `${conflicts.length} overlap${conflicts.length === 1 ? "" : "s"}, the longest ${Math.max(...conflicts.map((c) => c.overlapMinutes))} minutes.`
	};
}
var MEDIA_PACK = {
	appId: "ocade.media",
	displayName: "Image files",
	category: "graphics_media",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "media.identify",
			label: "Identify an image from its contents",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "media.dimensions",
			label: "Read an image's real size",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "media.check_extension",
			label: "Check a file is what its name claims",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Inspects image files only — format, size and whether the contents match the name. OCADE cannot operate Photoshop, Illustrator, Blender or any other editor application, and does not edit or export images. Video trimming, cropping and captioning are a separate pack (ocade.video.local) that drives a local encoder."
};
var MAGIC = [
	{
		format: "png",
		bytes: [
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		],
		offset: 0
	},
	{
		format: "jpeg",
		bytes: [
			255,
			216,
			255
		],
		offset: 0
	},
	{
		format: "gif",
		bytes: [
			71,
			73,
			70,
			56
		],
		offset: 0
	},
	{
		format: "bmp",
		bytes: [66, 77],
		offset: 0
	},
	{
		format: "webp",
		bytes: [
			87,
			69,
			66,
			80
		],
		offset: 8
	}
];
function matches(bytes, magic) {
	if (bytes.length < magic.offset + magic.bytes.length) return false;
	return magic.bytes.every((b, i) => bytes[magic.offset + i] === b);
}
/** Identify from content alone. Returns null when nothing matches. */
function identifyFormat(bytes) {
	if (matches(bytes, {
		bytes: [
			82,
			73,
			70,
			70
		],
		offset: 0
	})) return matches(bytes, MAGIC.find((m) => m.format === "webp")) ? "webp" : null;
	return MAGIC.find((m) => m.format !== "webp" && matches(bytes, m))?.format ?? null;
}
var be16 = (b, i) => b[i] << 8 | b[i + 1];
var be32 = (b, i) => (b[i] << 24 | b[i + 1] << 16 | b[i + 2] << 8 | b[i + 3]) >>> 0;
var le16 = (b, i) => b[i] | b[i + 1] << 8;
var le32 = (b, i) => (b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24) >>> 0;
/**
* Walk JPEG segments to the frame header.
*
* The dimensions are not at a fixed offset: they sit in an SOF marker that can
* be preceded by any number of EXIF, comment and quantisation segments. Reading
* a fixed offset produces a plausible-looking wrong number.
*/
function jpegSize(b) {
	let i = 2;
	while (i + 9 < b.length) {
		if (b[i] !== 255) return {
			ok: false,
			reason: "This JPEG's segment structure is damaged — OCADE can't read its size."
		};
		const marker = b[i + 1];
		if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) {
			i += 2;
			continue;
		}
		const length = be16(b, i + 2);
		if (length < 2) return {
			ok: false,
			reason: "This JPEG has an invalid segment length — the file is corrupt."
		};
		if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) return {
			ok: true,
			data: {
				height: be16(b, i + 5),
				width: be16(b, i + 7)
			},
			evidence: "from the frame header"
		};
		if (marker === 218) break;
		i += 2 + length;
	}
	return {
		ok: false,
		reason: "This JPEG has no frame header, so it's truncated or not really a JPEG."
	};
}
function webpSize(b) {
	const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
	if (chunk === "VP8X" && b.length >= 30) return {
		ok: true,
		data: {
			width: (b[24] | b[25] << 8 | b[26] << 16) + 1,
			height: (b[27] | b[28] << 8 | b[29] << 16) + 1
		},
		evidence: "from the extended header"
	};
	if (chunk === "VP8 " && b.length >= 30) return {
		ok: true,
		data: {
			width: le16(b, 26) & 16383,
			height: le16(b, 28) & 16383
		},
		evidence: "from the VP8 header"
	};
	if (chunk === "VP8L" && b.length >= 25) {
		const bits = le32(b, 21);
		return {
			ok: true,
			data: {
				width: (bits & 16383) + 1,
				height: (bits >> 14 & 16383) + 1
			},
			evidence: "from the lossless header"
		};
	}
	return {
		ok: false,
		reason: `This WebP uses a “${chunk.trim()}” chunk OCADE hasn't been tested against, so it won't report a size it isn't sure of.`
	};
}
/**
* Read an image's format and true dimensions from its bytes.
*
* Every failure path names what was wrong rather than returning zeros: a 0×0
* image reads as a measurement, and something downstream will divide by it.
*/
function inspectImage(bytes) {
	if (bytes.length === 0) return {
		ok: false,
		reason: "That file is empty."
	};
	const format = identifyFormat(bytes);
	if (!format) return {
		ok: false,
		reason: "OCADE doesn't recognise this file as an image it has been tested with (PNG, JPEG, GIF, WebP or BMP). It won't guess from the file name."
	};
	let size;
	switch (format) {
		case "png":
			if (bytes.length < 24) size = {
				ok: false,
				reason: "This PNG is truncated before its header."
			};
			else if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== "IHDR") size = {
				ok: false,
				reason: "This PNG's first chunk isn't IHDR, so the file is malformed."
			};
			else size = {
				ok: true,
				data: {
					width: be32(bytes, 16),
					height: be32(bytes, 20)
				},
				evidence: "from IHDR"
			};
			break;
		case "jpeg":
			size = jpegSize(bytes);
			break;
		case "gif":
			size = bytes.length < 10 ? {
				ok: false,
				reason: "This GIF is truncated before its header."
			} : {
				ok: true,
				data: {
					width: le16(bytes, 6),
					height: le16(bytes, 8)
				},
				evidence: "from the screen descriptor"
			};
			break;
		case "webp":
			size = bytes.length < 16 ? {
				ok: false,
				reason: "This WebP is truncated."
			} : webpSize(bytes);
			break;
		case "bmp":
			size = bytes.length < 26 ? {
				ok: false,
				reason: "This BMP is truncated before its header."
			} : {
				ok: true,
				data: {
					width: le32(bytes, 18),
					height: Math.abs(le32(bytes, 22) | 0)
				},
				evidence: "from the DIB header"
			};
			break;
	}
	if (!size.ok) return size;
	const { width, height } = size.data;
	if (width <= 0 || height <= 0) return {
		ok: false,
		reason: `This file reports ${width}×${height}, which isn't a real image size.`
	};
	const megapixels = width * height / 1e6;
	return {
		ok: true,
		data: {
			format,
			width,
			height,
			megapixels
		},
		evidence: `${format.toUpperCase()}, ${width}×${height} (${megapixels.toFixed(1)} MP), read ${size.evidence}.`
	};
}
var EXTENSION_ALIASES = {
	png: "png",
	jpg: "jpeg",
	jpeg: "jpeg",
	jpe: "jpeg",
	gif: "gif",
	webp: "webp",
	bmp: "bmp",
	dib: "bmp"
};
/**
* Does this file's content match the name it was given?
*
* A mismatch is reported, never corrected. The safe response to "this .png is
* actually something else" is to tell the user, not to rename it — the file may
* be exactly what someone intended it to be.
*/
function checkExtension(fileName, bytes) {
	const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
	if (!ext || ext === fileName.toLowerCase()) return {
		ok: false,
		reason: `“${fileName}” has no extension, so there's nothing to check it against.`
	};
	const actual = identifyFormat(bytes);
	const expected = EXTENSION_ALIASES[ext];
	if (!expected) return {
		ok: false,
		reason: `OCADE hasn't been tested with “.${ext}” files, so it won't judge whether this one is genuine.`
	};
	if (actual === null) return {
		ok: true,
		data: {
			claimed: ext,
			actual: null,
			matches: false
		},
		evidence: `“${fileName}” claims to be a ${ext.toUpperCase()} but its contents aren't any image format OCADE recognises. Treat it as untrusted.`
	};
	const ok = actual === expected;
	return {
		ok: true,
		data: {
			claimed: ext,
			actual,
			matches: ok
		},
		evidence: ok ? `“${fileName}” really is a ${actual.toUpperCase()}.` : `“${fileName}” is named .${ext} but is actually a ${actual.toUpperCase()}. OCADE won't rename it — the name may be deliberate.`
	};
}
var VIDEO_PACK = {
	appId: "ocade.video.local",
	displayName: "Video editing",
	category: "graphics_media",
	testedVersions: ["ffmpeg 6.", "ffmpeg 7."],
	capabilities: [
		{
			id: "video.probe",
			label: "Read a video's duration and size",
			methods: ["cli"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "video.trim",
			label: "Trim a video to a start and length",
			methods: ["cli"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "video.crop",
			label: "Crop a video to a rectangle",
			methods: ["cli"],
			mutating: true,
			verifyBy: "file",
			tested: true
		},
		{
			id: "video.caption",
			label: "Burn a caption into a video",
			methods: ["cli"],
			mutating: true,
			verifyBy: "file",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Trims, crops and captions video with a local encoder, and verifies every result by re-reading the file it produced. It does not composite, colour-grade, or edit audio, and it drives no third-party editor."
};
var RECORDS_PACK = {
	appId: "ocade.records",
	displayName: "Business record exports",
	category: "erp_crm_hcm_scm",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "records.validate",
			label: "Check an export against the columns it should have",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "records.duplicates",
			label: "Find records that appear more than once",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "records.orphans",
			label: "Find references pointing at records that aren't there",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Checks exported record files before they are imported elsewhere. OCADE cannot sign into SAP, Salesforce, Workday, NetSuite or any other business system, and never creates or changes a record."
};
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
var EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
function typeProblem(value, type) {
	switch (type) {
		case "text": return null;
		case "integer": return /^-?\d+$/.test(value) ? null : "should be a whole number";
		case "decimal": return /^-?\d+(\.\d+)?$/.test(value) ? null : "should be a number";
		case "date": {
			if (!ISO_DATE.test(value)) return "should be a date as YYYY-MM-DD";
			const [y, m, d] = value.split("-").map(Number);
			const dt = new Date(Date.UTC(y, m - 1, d));
			return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? null : "isn't a real date";
		}
		case "email": return EMAIL.test(value) ? null : "doesn't look like an email address";
	}
}
/**
* Check an export against the shape it is supposed to have.
*
* Missing columns are fatal — a validation run against the wrong file would
* otherwise report "0 problems", which reads as a pass.
*/
function validateRecords(table, rules) {
	if (rules.length === 0) return {
		ok: false,
		reason: "No rules were given, so there's nothing to check against."
	};
	const missingColumns = rules.filter((r) => !table.columns.includes(r.column)).map((r) => r.column);
	if (missingColumns.length > 0) return {
		ok: false,
		reason: `This export is missing ${missingColumns.length} expected column${missingColumns.length === 1 ? "" : "s"}: ${missingColumns.join(", ")}. OCADE won't report it as passing a check it couldn't run.`
	};
	const ruleColumns = new Set(rules.map((r) => r.column));
	const extraColumns = table.columns.filter((c) => !ruleColumns.has(c));
	const problems = [];
	table.rows.forEach((row, i) => {
		for (const rule of rules) {
			const value = (row[rule.column] ?? "").trim();
			if (value === "") {
				if (rule.required) problems.push({
					row: i + 2,
					column: rule.column,
					value: "",
					problem: "is required but empty"
				});
				continue;
			}
			const p = typeProblem(value, rule.type);
			if (p) problems.push({
				row: i + 2,
				column: rule.column,
				value,
				problem: p
			});
		}
	});
	return {
		ok: true,
		data: {
			problems,
			missingColumns,
			extraColumns,
			rowsChecked: table.rows.length
		},
		evidence: problems.length === 0 ? `All ${table.rows.length} rows match the expected columns and types.` : `${problems.length} problem${problems.length === 1 ? "" : "s"} across ${new Set(problems.map((p) => p.row)).size} row${new Set(problems.map((p) => p.row)).size === 1 ? "" : "s"} — first at row ${problems[0].row}, ${problems[0].column} ${problems[0].problem}.`
	};
}
/**
* ASCII unit separator, joining the parts of a composite key.
*
* It cannot appear in a CSV field, so no combination of values can be made to
* collide with a different record's key — which a joiner like "|" or "-" can.
*/
var KEY_SEPARATOR = String.fromCharCode(31);
/**
* Find keys that appear more than once.
*
* Blank keys are reported separately rather than grouped: fifty rows with an
* empty ID are fifty missing IDs, not one duplicate — and merging them would
* be a data-loss bug in whatever imports the file next.
*/
function findDuplicates(table, keyColumns) {
	if (keyColumns.length === 0) return {
		ok: false,
		reason: "No key columns were given."
	};
	const missing = keyColumns.filter((c) => !table.columns.includes(c));
	if (missing.length > 0) return {
		ok: false,
		reason: `There's no column called ${missing.join(", ")} in this export.`
	};
	const seen = /* @__PURE__ */ new Map();
	const blankKeyRows = [];
	table.rows.forEach((row, i) => {
		const parts = keyColumns.map((c) => (row[c] ?? "").trim());
		if (parts.every((p) => p === "")) {
			blankKeyRows.push(i + 2);
			return;
		}
		const key = parts.join(KEY_SEPARATOR);
		const rows = seen.get(key);
		if (rows) rows.push(i + 2);
		else seen.set(key, [i + 2]);
	});
	const duplicates = [...seen.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({
		key: key.split(KEY_SEPARATOR).join(" · "),
		rows
	}));
	const parts = [];
	parts.push(duplicates.length === 0 ? `No duplicates across ${table.rows.length} rows.` : `${duplicates.length} duplicated key${duplicates.length === 1 ? "" : "s"} — e.g. “${duplicates[0].key}” on rows ${duplicates[0].rows.join(", ")}.`);
	if (blankKeyRows.length > 0) parts.push(`${blankKeyRows.length} row${blankKeyRows.length === 1 ? " has" : "s have"} no key at all (row${blankKeyRows.length === 1 ? "" : "s"} ${blankKeyRows.slice(0, 5).join(", ")}${blankKeyRows.length > 5 ? "…" : ""}).`);
	return {
		ok: true,
		data: {
			duplicates,
			blankKeyRows
		},
		evidence: parts.join(" ")
	};
}
/**
* Find references that point at records which aren't in the other file.
*
* The classic migration failure: orders referencing customers that were
* filtered out of the customer export. The import succeeds, and the orders are
* silently unattached.
*/
function findOrphans(child, childColumn, parent, parentColumn) {
	if (!child.columns.includes(childColumn)) return {
		ok: false,
		reason: `There's no column called “${childColumn}” in the referencing file.`
	};
	if (!parent.columns.includes(parentColumn)) return {
		ok: false,
		reason: `There's no column called “${parentColumn}” in the referenced file.`
	};
	const known = new Set(parent.rows.map((r) => (r[parentColumn] ?? "").trim()).filter((v) => v !== ""));
	if (known.size === 0) return {
		ok: false,
		reason: `“${parentColumn}” is empty in every row of the referenced file, so every reference would look broken. Check you exported the right file.`
	};
	const orphans = [];
	child.rows.forEach((row, i) => {
		const v = (row[childColumn] ?? "").trim();
		if (v === "") return;
		if (!known.has(v)) orphans.push({
			row: i + 2,
			value: v
		});
	});
	return {
		ok: true,
		data: orphans,
		evidence: orphans.length === 0 ? `All ${child.rows.length} references resolve against ${known.size} known record${known.size === 1 ? "" : "s"}.` : `${orphans.length} of ${child.rows.length} reference${child.rows.length === 1 ? "" : "s"} point at records that aren't in the other file — first “${orphans[0].value}” on row ${orphans[0].row}.`
	};
}
var CLINICAL_PACK = {
	appId: "ocade.clinical",
	displayName: "Medical imaging files",
	category: "healthcare_imaging",
	testedVersions: ["3."],
	capabilities: [{
		id: "clinical.identify",
		label: "Confirm a file really is a DICOM image",
		methods: ["file"],
		mutating: false,
		verifyBy: "file",
		tested: true
	}, {
		id: "clinical.check_identifiers",
		label: "Check whether a scan still identifies the patient",
		methods: ["file"],
		mutating: false,
		verifyBy: "file",
		tested: true
	}],
	requiresLicensedInstall: false,
	coverageNote: "Reads DICOM file headers to check for patient identifiers. OCADE cannot open a PACS, view or decode images, interpret a scan, or remove identifiers — de-identification is governed work and must be done with an approved tool."
};
var PREAMBLE = 128;
/** Explicit-VR types whose length field is 4 bytes after 2 reserved ones. */
var LONG_FORM_VR = /* @__PURE__ */ new Set([
	"OB",
	"OW",
	"OF",
	"OD",
	"OL",
	"SQ",
	"UT",
	"UN",
	"UC",
	"UR"
]);
var UID_IMPLICIT_VR_LE = "1.2.840.10008.1.2";
var UID_EXPLICIT_VR_BE = "1.2.840.10008.1.2.2";
/**
* Tags that identify a patient, from DICOM PS3.15 Annex E (the Basic
* Application Level Confidentiality Profile). This is a working subset, not the
* complete list — `checkIdentifiers` says so in its own result rather than
* letting a clean report imply the file was fully audited.
*/
var IDENTIFYING_TAGS = {
	"0010,0010": "Patient name",
	"0010,0020": "Patient ID",
	"0010,0030": "Date of birth",
	"0010,0032": "Time of birth",
	"0010,0040": "Sex",
	"0010,1000": "Other patient IDs",
	"0010,1001": "Other patient names",
	"0010,1040": "Patient address",
	"0010,2154": "Patient telephone",
	"0010,2160": "Ethnic group",
	"0008,0090": "Referring physician",
	"0008,1048": "Physician of record",
	"0008,1050": "Performing physician",
	"0008,1070": "Operator name",
	"0008,0080": "Institution name",
	"0008,0081": "Institution address",
	"0008,1010": "Station name",
	"0038,0300": "Current patient location",
	"0040,A123": "Person name"
};
var tagKey = (group, element) => `${group.toString(16).padStart(4, "0").toUpperCase()},${element.toString(16).padStart(4, "0").toUpperCase()}`;
function readElements(b, view, start, end, explicitVr) {
	const out = [];
	let i = start;
	while (i + 8 <= end) {
		const group = view.getUint16(i, true);
		const element = view.getUint16(i + 2, true);
		let vr = null;
		let length;
		let valueOffset;
		if (explicitVr) {
			vr = String.fromCharCode(b[i + 4], b[i + 5]);
			if (!/^[A-Z]{2}$/.test(vr)) return {
				ok: false,
				reason: "This file's element structure doesn't match its declared encoding — it may be corrupt or use a transfer syntax OCADE hasn't been tested with."
			};
			if (LONG_FORM_VR.has(vr)) {
				if (i + 12 > end) break;
				length = view.getUint32(i + 8, true);
				valueOffset = i + 12;
			} else {
				length = view.getUint16(i + 6, true);
				valueOffset = i + 8;
			}
		} else {
			length = view.getUint32(i + 4, true);
			valueOffset = i + 8;
		}
		if (length === 4294967295) return {
			ok: false,
			reason: "This file contains a nested sequence of undefined length. OCADE hasn't been tested against those and won't report on a header it may have misread."
		};
		if (length < 0 || valueOffset + length > end) return {
			ok: false,
			reason: "This file's header runs past the end of the file — it's truncated."
		};
		out.push({
			tag: tagKey(group, element),
			vr,
			length,
			valueOffset
		});
		i = valueOffset + length + length % 2;
	}
	if (i < end) return {
		ok: false,
		reason: "This file's header runs past the end of the file — it's truncated."
	};
	return {
		ok: true,
		data: out,
		evidence: `${out.length} header elements.`
	};
}
function textValue(b, el) {
	let s = "";
	for (let i = el.valueOffset; i < el.valueOffset + el.length; i++) s += String.fromCharCode(b[i]);
	return s.replace(/\0+$/, "").trim();
}
/**
* Parse a DICOM file into its meta group and its dataset.
*
* The meta group is ALWAYS Explicit VR Little Endian and the dataset may not
* be, so the boundary between them has to be found before either is read.
* (0002,0000) holds the meta group's byte count and is always the first
* element; reading to end-of-file instead would parse an implicit-VR dataset
* with explicit-VR rules and produce nonsense.
*/
function parseDicom(bytes) {
	if (bytes.length < 132) return {
		ok: false,
		reason: "This file is too short to be a DICOM image."
	};
	if (String.fromCharCode(bytes[PREAMBLE], bytes[129], bytes[130], bytes[131]) !== "DICM") return {
		ok: false,
		reason: "This isn't a DICOM file — it has no DICM marker after the preamble. OCADE won't guess from the file name."
	};
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const metaStart = 132;
	if (144 > bytes.length) return {
		ok: false,
		reason: "This file ends before its meta group — it's truncated."
	};
	if (view.getUint16(metaStart, true) !== 2 || view.getUint16(134, true) !== 0) return {
		ok: false,
		reason: "This file's meta group doesn't start with a group length, so OCADE can't find where the image data begins."
	};
	const metaEnd = 144 + view.getUint32(140, true);
	if (metaEnd > bytes.length) return {
		ok: false,
		reason: "This file's meta group claims to be longer than the file — it's truncated."
	};
	const meta = readElements(bytes, view, 144, metaEnd, true);
	if (!meta.ok) return meta;
	const syntaxEl = meta.data.find((e) => e.tag === "0002,0010");
	const transferSyntax = syntaxEl ? textValue(bytes, syntaxEl) : "";
	if (!transferSyntax) return {
		ok: false,
		reason: "This file doesn't declare a transfer syntax, so OCADE can't know how to read it."
	};
	if (transferSyntax === UID_EXPLICIT_VR_BE) return {
		ok: false,
		reason: "This file uses Explicit VR Big Endian, which OCADE hasn't been tested against. It won't report on a header it may have misread."
	};
	const dataset = readElements(bytes, view, metaEnd, bytes.length, transferSyntax !== UID_IMPLICIT_VR_LE);
	if (!dataset.ok) return dataset;
	return {
		ok: true,
		data: {
			transferSyntax,
			metaElements: meta.data,
			dataset: dataset.data
		},
		evidence: `${meta.data.length} meta and ${dataset.data.length} data elements.`
	};
}
/**
* Report which identifying fields are still populated.
*
* Returns tag names and byte lengths only. See the module header for why the
* values are never returned — including in the evidence line, which is the one
* most likely to end up pasted into a ticket.
*/
function checkIdentifiers(bytes) {
	const parsed = parseDicom(bytes);
	if (!parsed.ok) return parsed;
	const findings = [];
	for (const el of parsed.data.dataset) {
		const label = IDENTIFYING_TAGS[el.tag];
		if (!label) continue;
		findings.push({
			tag: el.tag,
			label,
			populated: el.length > 0,
			byteLength: el.length
		});
	}
	const populated = findings.filter((f) => f.populated);
	const checkedTagCount = Object.keys(IDENTIFYING_TAGS).length;
	return {
		ok: true,
		data: {
			findings,
			populatedCount: populated.length,
			checkedTagCount
		},
		evidence: populated.length === 0 ? `No identifying fields are populated, out of the ${checkedTagCount} OCADE checks. That is not a full de-identification audit — other tags, private tags and text burned into the image itself are not covered.` : `${populated.length} identifying field${populated.length === 1 ? " is" : "s are"} still filled in: ${populated.map((p) => p.label).join(", ")}. OCADE has not shown you their contents, and won't remove them — use an approved de-identification tool.`
	};
}
var CAPTIONS_PACK = {
	appId: "ocade.captions",
	displayName: "Lecture captions and subtitles",
	category: "education",
	testedVersions: ["1."],
	capabilities: [
		{
			id: "captions.parse",
			label: "Read a caption file",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "captions.check_timing",
			label: "Find overlapping or out-of-order captions",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "captions.check_readability",
			label: "Find captions that pass too fast to read",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Reads and checks WebVTT and SubRip caption files. OCADE cannot sign into Moodle, Canvas, Blackboard or a video platform, does not transcribe audio, and does not upload or publish anything."
};
/**
* WebVTT uses `HH:MM:SS.mmm` (hours optional); SubRip uses `HH:MM:SS,mmm`.
* Both are accepted, because a file that mixes them still plays in most
* players and the mismatch is not what the user asked about.
*/
var TIMESTAMP = /^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})$/;
function parseTimestamp(s) {
	const m = TIMESTAMP.exec(s.trim());
	if (!m) return null;
	const [, h = "0", mm, ss, ms] = m;
	const minutes = Number(mm);
	const seconds = Number(ss);
	if (minutes > 59 || seconds > 59) return null;
	return Number(h) * 36e5 + minutes * 6e4 + seconds * 1e3 + Number(ms.padEnd(3, "0"));
}
/** Parse WebVTT or SubRip. The format is detected from the content, not the name. */
function parseCaptions(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That file is empty."
	};
	const lines = text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").split("\n");
	const isVtt = lines[0].trim().startsWith("WEBVTT");
	const cues = [];
	let i = isVtt ? 1 : 0;
	while (i < lines.length) {
		while (i < lines.length && lines[i].trim() === "") i++;
		if (i >= lines.length) break;
		if (isVtt && /^NOTE\b/.test(lines[i].trim())) {
			while (i < lines.length && lines[i].trim() !== "") i++;
			continue;
		}
		let arrowLine = lines[i];
		if (!arrowLine.includes("-->")) {
			i++;
			if (i >= lines.length) return {
				ok: false,
				reason: `Cue ${cues.length + 1} has no timing line — the file is truncated.`
			};
			arrowLine = lines[i];
		}
		const parts = arrowLine.split("-->");
		if (parts.length !== 2) return {
			ok: false,
			reason: `Cue ${cues.length + 1} has no valid timing line (“${arrowLine.trim().slice(0, 40)}”).`
		};
		const startMs = parseTimestamp(parts[0]);
		const endMs = parseTimestamp(parts[1].trim().split(/\s+/)[0]);
		if (startMs === null || endMs === null) return {
			ok: false,
			reason: `Cue ${cues.length + 1} has a timestamp OCADE can't read (“${arrowLine.trim().slice(0, 40)}”).`
		};
		if (endMs < startMs) return {
			ok: false,
			reason: `Cue ${cues.length + 1} ends before it starts, so this file is wrong.`
		};
		i++;
		const body = [];
		while (i < lines.length && lines[i].trim() !== "") {
			body.push(lines[i]);
			i++;
		}
		cues.push({
			index: cues.length + 1,
			startMs,
			endMs,
			text: body.join("\n").trim()
		});
	}
	if (cues.length === 0) return {
		ok: false,
		reason: "This file has no captions in it."
	};
	const empty = cues.filter((c) => c.text === "").length;
	return {
		ok: true,
		data: cues,
		evidence: empty > 0 ? `${cues.length} captions, ${empty} with no text.` : `${cues.length} captions, ending at ${formatMs(cues[cues.length - 1].endMs)}.`
	};
}
function formatMs(ms) {
	const s = Math.floor(ms / 1e3);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/**
* Check cue timing.
*
* A gap threshold of 0 disables the gap check rather than flagging every pause
* in the recording — a lecture legitimately contains silence, and a check that
* fires on all of it gets ignored along with the real problems.
*/
function checkTiming(cues, maxGapMs = 0) {
	if (cues.length === 0) return {
		ok: false,
		reason: "There are no captions to check."
	};
	const problems = [];
	for (const cue of cues) if (cue.endMs === cue.startMs) problems.push({
		cue: cue.index,
		kind: "zero_length",
		detail: `Caption ${cue.index} has no duration, so most players never show it.`
	});
	for (let i = 1; i < cues.length; i++) {
		const prev = cues[i - 1];
		const cur = cues[i];
		if (cur.startMs < prev.startMs) {
			problems.push({
				cue: cur.index,
				kind: "out_of_order",
				detail: `Caption ${cur.index} starts before caption ${prev.index}, so the file isn't in time order.`
			});
			continue;
		}
		if (cur.startMs < prev.endMs) problems.push({
			cue: cur.index,
			kind: "overlap",
			detail: `Captions ${prev.index} and ${cur.index} overlap by ${prev.endMs - cur.startMs} ms — both compete for the screen.`
		});
		else if (maxGapMs > 0 && cur.startMs - prev.endMs > maxGapMs) problems.push({
			cue: cur.index,
			kind: "gap_too_long",
			detail: `There's ${Math.round((cur.startMs - prev.endMs) / 1e3)}s with no captions before caption ${cur.index}.`
		});
	}
	return {
		ok: true,
		data: problems,
		evidence: problems.length === 0 ? `All ${cues.length} captions are in order and don't overlap.` : `${problems.length} timing problem${problems.length === 1 ? "" : "s"} — first: ${problems[0].detail}`
	};
}
function checkReadability(cues, maxCharactersPerSecond = 21) {
	if (cues.length === 0) return {
		ok: false,
		reason: "There are no captions to check."
	};
	if (maxCharactersPerSecond <= 0) return {
		ok: false,
		reason: "The reading-rate limit must be greater than zero."
	};
	const problems = [];
	for (const cue of cues) {
		const durationMs = cue.endMs - cue.startMs;
		if (durationMs <= 0 || cue.text === "") continue;
		const characters = cue.text.replace(/\n/g, " ").length;
		const cps = characters / (durationMs / 1e3);
		if (cps > maxCharactersPerSecond) problems.push({
			cue: cue.index,
			charactersPerSecond: Math.round(cps * 10) / 10,
			detail: `Caption ${cue.index} shows ${characters} characters in ${(durationMs / 1e3).toFixed(1)}s — ${Math.round(cps)} per second, above the ${maxCharactersPerSecond} limit.`
		});
	}
	return {
		ok: true,
		data: problems,
		evidence: problems.length === 0 ? `All ${cues.length} captions stay within ${maxCharactersPerSecond} characters per second.` : `${problems.length} of ${cues.length} captions pass too fast to read — the worst is caption ${problems.reduce((a, b) => b.charactersPerSecond > a.charactersPerSecond ? b : a).cue}.`
	};
}
var STREAMING_PACK = {
	appId: "ocade.streaming",
	displayName: "Stream playlists",
	category: "games_streaming",
	testedVersions: [
		"3",
		"4",
		"5",
		"6",
		"7"
	],
	capabilities: [
		{
			id: "streaming.parse_playlist",
			label: "Read a stream playlist",
			methods: ["file"],
			mutating: false,
			verifyBy: "file",
			tested: true
		},
		{
			id: "streaming.check_ladder",
			label: "Check the quality options make sense",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		},
		{
			id: "streaming.check_segments",
			label: "Find segments that will stall playback",
			methods: ["file"],
			mutating: false,
			verifyBy: "api",
			tested: true
		}
	],
	requiresLicensedInstall: false,
	coverageNote: "Reads HLS .m3u8 playlists. OCADE cannot sign into Twitch, YouTube or a game client, cannot start, stop or moderate a broadcast, and does not download or play media."
};
function parseAttributes(line) {
	const out = {};
	const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
	let m;
	while ((m = re.exec(line)) !== null) out[m[1]] = m[3] ?? m[2];
	return out;
}
/**
* Parse an HLS playlist, master or media.
*
* Refuses a file that declares both variants and segments: that is not a valid
* playlist, and guessing which half to believe would produce a confident report
* about a file no player will accept.
*/
function parsePlaylist(text) {
	if (!text.trim()) return {
		ok: false,
		reason: "That file is empty."
	};
	const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
	if (lines[0] !== "#EXTM3U") return {
		ok: false,
		reason: "That isn't an HLS playlist — it doesn't start with #EXTM3U. OCADE won't guess from the file extension."
	};
	const variants = [];
	const segments = [];
	let targetDuration = null;
	let ended = false;
	let pendingVariant = null;
	let pendingDuration = null;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (line === "") continue;
		if (line.startsWith("#EXT-X-STREAM-INF:")) {
			pendingVariant = parseAttributes(line.slice(18));
			continue;
		}
		if (line.startsWith("#EXT-X-TARGETDURATION:")) {
			const v = Number(line.slice(22));
			if (!Number.isFinite(v) || v <= 0) return {
				ok: false,
				reason: `Line ${i + 1} declares an invalid target duration.`
			};
			targetDuration = v;
			continue;
		}
		if (line === "#EXT-X-ENDLIST") {
			ended = true;
			continue;
		}
		if (line.startsWith("#EXTINF:")) {
			const v = Number(line.slice(8).split(",")[0]);
			if (!Number.isFinite(v) || v < 0) return {
				ok: false,
				reason: `Line ${i + 1} declares an invalid segment duration.`
			};
			pendingDuration = v;
			continue;
		}
		if (line.startsWith("#")) continue;
		if (pendingVariant) {
			const bandwidth = Number(pendingVariant.BANDWIDTH);
			if (!Number.isFinite(bandwidth) || bandwidth <= 0) return {
				ok: false,
				reason: `The quality option ending at line ${i + 1} declares no usable BANDWIDTH.`
			};
			variants.push({
				bandwidth,
				resolution: pendingVariant.RESOLUTION ?? null,
				codecs: pendingVariant.CODECS ?? null,
				uri: line
			});
			pendingVariant = null;
			continue;
		}
		if (pendingDuration !== null) {
			segments.push({
				durationSeconds: pendingDuration,
				uri: line,
				index: segments.length
			});
			pendingDuration = null;
			continue;
		}
	}
	if (pendingVariant) return {
		ok: false,
		reason: "This playlist ends with a quality option that has no URI — it's truncated."
	};
	if (pendingDuration !== null) return {
		ok: false,
		reason: "This playlist ends with a segment that has no URI — it's truncated."
	};
	if (variants.length > 0 && segments.length > 0) return {
		ok: false,
		reason: "This playlist lists both quality options and media segments. That isn't valid HLS, and OCADE won't guess which half to report on."
	};
	if (variants.length > 0) return {
		ok: true,
		data: {
			kind: "master",
			variants
		},
		evidence: `Master playlist with ${variants.length} quality option${variants.length === 1 ? "" : "s"}, from ${Math.round(Math.min(...variants.map((v) => v.bandwidth)) / 1e3)} to ${Math.round(Math.max(...variants.map((v) => v.bandwidth)) / 1e3)} kbps.`
	};
	if (segments.length === 0) return {
		ok: false,
		reason: "This playlist has neither quality options nor segments in it."
	};
	if (targetDuration === null) return {
		ok: false,
		reason: "This media playlist has no EXT-X-TARGETDURATION, which players require. OCADE won't check segments against a limit that isn't declared."
	};
	const total = segments.reduce((a, s) => a + s.durationSeconds, 0);
	return {
		ok: true,
		data: {
			kind: "media",
			targetDurationSeconds: targetDuration,
			segments,
			ended
		},
		evidence: `${ended ? "Complete" : "Live"} playlist, ${segments.length} segments, ${Math.round(total)}s total.`
	};
}
/**
* Find segments that will stall playback.
*
* HLS requires every segment to be no longer than the declared target
* duration, rounded to the nearest integer. Players size their buffers from
* that number, so a segment that exceeds it underruns the buffer — and the
* playlist still looks perfectly well-formed.
*/
function checkSegments(playlist) {
	if (playlist.kind !== "media") return {
		ok: false,
		reason: "This is a master playlist — its segments live in the individual quality playlists."
	};
	const problems = [];
	for (const s of playlist.segments) {
		if (Math.round(s.durationSeconds) > playlist.targetDurationSeconds) problems.push({
			segment: s.index + 1,
			detail: `Segment ${s.index + 1} is ${s.durationSeconds}s, over the declared target of ${playlist.targetDurationSeconds}s — players will underrun their buffer.`
		});
		if (s.durationSeconds === 0) problems.push({
			segment: s.index + 1,
			detail: `Segment ${s.index + 1} has zero duration.`
		});
	}
	return {
		ok: true,
		data: problems,
		evidence: problems.length === 0 ? `All ${playlist.segments.length} segments are within the ${playlist.targetDurationSeconds}s target.${playlist.ended ? "" : " This playlist is still live, so more may follow."}` : `${problems.length} segment${problems.length === 1 ? "" : "s"} will stall playback — first: ${problems[0].detail}`
	};
}
var BUILT_IN_PACKS = [
	{
		appId: "ocade.web",
		displayName: "Web pages",
		category: "browsers_transfer",
		testedVersions: ["1."],
		requiresLicensedInstall: false,
		capabilities: [
			{
				id: "tabs.list",
				label: "List open tabs",
				methods: ["adapter"],
				mutating: false,
				verifyBy: "api",
				tested: true
			},
			{
				id: "page.read",
				label: "Read a page you've allowed",
				methods: ["dom", "accessibility"],
				mutating: false,
				verifyBy: "api",
				tested: true
			},
			{
				id: "page.screenshot",
				label: "Capture a page, with credential fields masked",
				methods: ["adapter"],
				mutating: false,
				verifyBy: "api",
				tested: true
			}
		]
	},
	{
		appId: "ocade.email-web-work",
		displayName: "Email and authenticated web work",
		category: "chat_projects",
		testedVersions: ["1."],
		requiresLicensedInstall: false,
		coverageNote: "The workflow contract is tested with controlled connector and paired-browser hosts. A live mail account still requires an approved OAuth/API connector or a user-authenticated permitted site.",
		capabilities: [
			{
				id: "email.preview",
				label: "Validate recipients, attachments and preview a draft",
				methods: ["official_api", "dom"],
				mutating: false,
				verifyBy: "api",
				tested: true
			},
			{
				id: "email.send",
				label: "Send a confirmed preview and verify the provider receipt",
				methods: ["official_api", "dom"],
				mutating: true,
				verifyBy: "api",
				tested: true
			},
			{
				id: "web.edit",
				label: "Edit an authenticated permitted site",
				methods: ["dom", "accessibility"],
				mutating: true,
				verifyBy: "api",
				tested: true
			},
			{
				id: "web.transfer",
				label: "Upload or download an approved file",
				methods: ["dom"],
				mutating: true,
				verifyBy: "api",
				tested: true
			}
		]
	},
	{
		appId: "ocade.creative.control",
		displayName: "Creative application control",
		category: "graphics_media",
		testedVersions: [],
		requiresLicensedInstall: true,
		coverageNote: "The checkpoint, Blender route, sandbox, scene-inspection, render and export contracts are fixture-tested. OCADE cannot claim to drive an installed Blender or other creative application until its signed adapter and a real project pass live validation.",
		capabilities: [
			{
				id: "creative.checkpoint",
				label: "Create and independently verify a versioned project checkpoint",
				methods: ["adapter", "file"],
				mutating: false,
				verifyBy: "file",
				tested: true
			},
			{
				id: "creative.script",
				label: "Run an approved bounded creative script",
				methods: [
					"official_api",
					"adapter",
					"cli"
				],
				mutating: true,
				verifyBy: "api",
				tested: true
			},
			{
				id: "creative.render",
				label: "Render and inspect exact output media bytes",
				methods: [
					"official_api",
					"adapter",
					"cli"
				],
				mutating: true,
				verifyBy: "file",
				tested: true
			},
			{
				id: "creative.export",
				label: "Export and validate a conforming glTF deliverable",
				methods: [
					"official_api",
					"adapter",
					"file",
					"cli"
				],
				mutating: true,
				verifyBy: "file",
				tested: true
			}
		]
	},
	{
		appId: "ocade.engineering.control",
		displayName: "CAD and engineering application control",
		category: "engineering_cad",
		testedVersions: [],
		requiresLicensedInstall: true,
		coverageNote: "Duplicate-project routing, engineering-assumption guards, rebuild checks, exchange-file inspection and solver-result boundaries are fixture-tested. OCADE cannot claim to drive a licensed CAD/CAE product or validate an engineering result until a real installed application, model and solver output pass independent checks.",
		capabilities: [
			{
				id: "engineering.duplicate",
				label: "Create and verify a duplicate engineering project",
				methods: [
					"official_api",
					"adapter",
					"file",
					"cli"
				],
				mutating: false,
				verifyBy: "file",
				tested: true
			},
			{
				id: "engineering.model",
				label: "Edit units, dimensions and constraints under exact approval",
				methods: [
					"official_api",
					"adapter",
					"file",
					"cli"
				],
				mutating: true,
				verifyBy: "api",
				tested: true
			},
			{
				id: "engineering.export",
				label: "Export and independently reopen STEP, STL, DXF or DWG",
				methods: [
					"official_api",
					"adapter",
					"file",
					"cli"
				],
				mutating: true,
				verifyBy: "file",
				tested: true
			},
			{
				id: "engineering.solver",
				label: "Run a licensed solver and parse result evidence",
				methods: [
					"official_api",
					"adapter",
					"file",
					"cli"
				],
				mutating: true,
				verifyBy: "file",
				tested: true
			}
		]
	},
	{
		appId: "ocade.desktop.files",
		displayName: "Files, folders and windows",
		category: "os_utilities",
		testedVersions: [],
		requiresLicensedInstall: false,
		capabilities: [
			{
				id: "window.list",
				label: "List open windows",
				methods: ["adapter"],
				mutating: false,
				verifyBy: "api",
				tested: true
			},
			{
				id: "window.arrange",
				label: "Move or resize a window",
				methods: ["adapter"],
				mutating: true,
				verifyBy: "ui",
				tested: true
			},
			{
				id: "app.open",
				label: "Open an application you've allowed",
				methods: ["adapter"],
				mutating: true,
				verifyBy: "ui",
				tested: true
			},
			{
				id: "file.open",
				label: "Open a file or folder you've allowed",
				methods: ["file", "adapter"],
				mutating: true,
				verifyBy: "file",
				tested: true
			}
		]
	},
	{
		appId: "ocade.desktop.text",
		displayName: "Text and clipboard",
		category: "office_docs",
		testedVersions: [],
		requiresLicensedInstall: false,
		capabilities: [
			{
				id: "selection.read",
				label: "Read what you've selected",
				methods: ["accessibility", "adapter"],
				mutating: false,
				verifyBy: "api",
				tested: true
			},
			{
				id: "selection.replace",
				label: "Replace what you've selected",
				methods: ["accessibility", "adapter"],
				mutating: true,
				verifyBy: "ui",
				tested: true
			},
			{
				id: "clipboard.write",
				label: "Put text on the clipboard",
				methods: ["adapter"],
				mutating: true,
				verifyBy: "api",
				tested: true
			}
		]
	},
	GIT_PACK,
	LOCAL_FILES_PACK,
	DATA_PACK,
	INTEGRITY_PACK,
	ARCHIVE_PACK,
	VIDEO_PACK,
	GEO_PACK,
	MONEY_PACK,
	CALENDAR_PACK,
	MEDIA_PACK,
	RECORDS_PACK,
	CLINICAL_PACK,
	CAPTIONS_PACK,
	STREAMING_PACK
];
function clonePack(pack) {
	return {
		...pack,
		testedVersions: [...pack.testedVersions],
		capabilities: pack.capabilities.map((capability) => ({
			...capability,
			methods: [...capability.methods]
		}))
	};
}
function assertPackText(value, field, maxLength = 200) {
	if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) throw new Error(`Invalid skill pack ${field}.`);
}
var SAFE_PACK_ID = /^[a-z0-9][a-z0-9._-]*$/i;
/** Reject malformed or ambiguous metadata before it can become a coverage claim. */
function assertValidSkillPack(pack) {
	assertPackText(pack.appId, "appId");
	if (!SAFE_PACK_ID.test(pack.appId)) throw new Error("Invalid skill pack appId.");
	assertPackText(pack.displayName, "displayName");
	if (!SKILL_CATEGORIES.includes(pack.category)) throw new Error(`Invalid skill pack category for ${pack.appId}.`);
	if (typeof pack.requiresLicensedInstall !== "boolean") throw new Error(`Invalid skill pack licensing flag for ${pack.appId}.`);
	if (pack.coverageNote !== void 0) assertPackText(pack.coverageNote, "coverageNote", 1e3);
	if (!Array.isArray(pack.testedVersions)) throw new Error(`Invalid tested versions for ${pack.appId}.`);
	const versions = /* @__PURE__ */ new Set();
	for (const version of pack.testedVersions) {
		assertPackText(version, "tested version");
		if (versions.has(version)) throw new Error(`Duplicate tested version ${version} in ${pack.appId}.`);
		versions.add(version);
	}
	if (!Array.isArray(pack.capabilities) || pack.capabilities.length === 0) throw new Error(`Skill pack ${pack.appId} must declare at least one capability.`);
	const capabilityIds = /* @__PURE__ */ new Set();
	for (const capability of pack.capabilities) {
		assertPackText(capability.id, "capability id");
		if (!SAFE_PACK_ID.test(capability.id)) throw new Error(`Invalid capability id in ${pack.appId}.`);
		assertPackText(capability.label, "capability label");
		if (capabilityIds.has(capability.id)) throw new Error(`Duplicate capability ${capability.id} in ${pack.appId}.`);
		capabilityIds.add(capability.id);
		if (!Array.isArray(capability.methods) || capability.methods.length === 0) throw new Error(`Capability ${capability.id} must declare a control method.`);
		const methods = /* @__PURE__ */ new Set();
		for (const method of capability.methods) {
			if (!CONTROL_PREFERENCE.includes(method)) throw new Error(`Invalid control method in ${pack.appId}:${capability.id}.`);
			if (methods.has(method)) throw new Error(`Duplicate control method in ${pack.appId}:${capability.id}.`);
			methods.add(method);
		}
		if (![
			"file",
			"ui",
			"log",
			"api",
			"none"
		].includes(capability.verifyBy)) throw new Error(`Invalid verification method in ${pack.appId}:${capability.id}.`);
		if (typeof capability.mutating !== "boolean" || typeof capability.tested !== "boolean") throw new Error(`Invalid safety metadata in ${pack.appId}:${capability.id}.`);
		if (capability.tested && capability.verifyBy === "none") throw new Error(`Tested capability ${pack.appId}:${capability.id} must be verifiable.`);
	}
}
var PackRegistry = class {
	packs;
	constructor(initial = BUILT_IN_PACKS) {
		initial.forEach(assertValidSkillPack);
		this.packs = initial.map(clonePack);
	}
	list() {
		return this.packs.map(clonePack);
	}
	get(appId) {
		const pack = this.packs.find((p) => p.appId === appId);
		return pack ? clonePack(pack) : null;
	}
	byCategory(category) {
		return this.packs.filter((p) => p.category === category).map(clonePack);
	}
	/**
	* Add a pack. Replaces one with the same id rather than shadowing it, so a
	* lookup can never depend on registration order.
	*/
	register(pack) {
		assertValidSkillPack(pack);
		this.packs = [...this.packs.filter((p) => p.appId !== pack.appId), clonePack(pack)];
	}
	/** Capabilities across all packs that are backed by a real test. */
	testedCapabilities() {
		return this.packs.flatMap((p) => p.capabilities.filter((c) => c.tested).map((c) => ({
			appId: p.appId,
			capability: {
				...c,
				methods: [...c.methods]
			}
		})));
	}
};
var CATEGORY_LABELS = {
	os_utilities: "System, files and utilities",
	erp_crm_hcm_scm: "Business systems (ERP, CRM, HR, supply chain)",
	office_docs: "Documents, spreadsheets and slides",
	graphics_media: "Graphics, video, audio and 3D",
	dev_tools: "Code, version control, databases and CI/CD",
	engineering_cad: "CAD, simulation, GIS and industrial control",
	chat_projects: "Chat and project tools",
	security_networking: "Security, networking and identity",
	data_bi_ai: "Data, analytics and AI tools",
	browsers_transfer: "Browsers and file transfer",
	finance_commerce: "Accounting, tax, commerce and payments",
	healthcare_imaging: "Healthcare and medical imaging",
	education: "Education tools",
	games_streaming: "Games and streaming"
};
/**
* Honest coverage across every promised category.
*
* Categories with no pack are reported as unsupported rather than omitted —
* an omission reads as "fine", and the user needs to know before they rely on
* OCADE for that kind of work.
*/
function coverageReport(registry) {
	return SKILL_CATEGORIES.map((category) => {
		const packs = registry.byCategory(category);
		const testedCapabilities = packs.reduce((n, p) => n + p.capabilities.filter((c) => c.tested).length, 0);
		const withTests = packs.filter((p) => p.capabilities.some((c) => c.tested));
		return {
			category,
			label: CATEGORY_LABELS[category],
			packs: packs.length,
			testedCapabilities,
			supported: testedCapabilities > 0,
			formatOnly: withTests.length > 0 && withTests.every((p) => p.coverageNote !== void 0),
			limits: packs.map((p) => p.coverageNote).filter((n) => n !== void 0)
		};
	});
}
/**
* One-line summary for the UI.
*
* Never rounds an unsupported category up, and never lets file-format coverage
* pass as application control — the two are counted separately in the same
* sentence, because a single "10 of 14" would be read as the stronger claim.
*/
function describeCoverage(report) {
	const supported = report.filter((r) => r.supported);
	const formatOnly = supported.filter((r) => r.formatOnly).length;
	const full = supported.length - formatOnly;
	const base = `OCADE drives the applications in ${full} of ${report.length} software categories, and works on the file formats of ${formatOnly} more`;
	return formatOnly === 0 ? `OCADE has tested skill packs for ${full} of ${report.length} software categories. For anything else it will say so and offer to inspect the app first.` : `${base} — reading and checking files without operating the software itself. For anything else it will say so and offer to inspect the app first.`;
}
/**
* What OCADE can honestly say about an app it has no pack for.
* Never proposes acting blind.
*/
function describeUnsupported(appName) {
	return `OCADE doesn't have a tested skill pack for ${appName}. With your approval it can inspect the app once — its version, menus and accessibility tree — and save what it learns, so later tasks are fast. It won't act on guesswork before that.`;
}
/**
* Answer "what do you know about this program?" honestly.
*
* A pack whose name merely resembles what the user typed is NOT a claim to
* drive that program: a file-format pack answers with its own limits attached,
* so searching for a CAD package never comes back looking like a yes.
*/
function describeAppLookup(registry, appName) {
	const needle = appName.trim().toLowerCase();
	if (!needle) return "";
	const pack = registry.list().find((p) => p.displayName.toLowerCase().includes(needle));
	if (!pack) return describeUnsupported(appName);
	if (pack.coverageNote) return `OCADE has a tested pack for ${pack.displayName.toLowerCase()}, which covers files rather than the applications themselves. ${pack.coverageNote}`;
	return `OCADE has a tested skill pack for ${pack.displayName.toLowerCase()}, and can operate it directly.`;
}
//#endregion
export { runPlannedStep as A, parseCsv as C, parsePlaylist as D, parseMoney as E, validateRecords as M, planStep as O, parseCaptions as S, parseIcs as T, findOrphans as _, checkExtension as a, invoiceTotal as b, checkSegments as c, createDefaultExecutors as d, describeAppLookup as f, findDuplicates as g, findConflicts as h, boundingBox as i, summariseColumn as j, polygonArea as k, checkTiming as l, describeRunnable as m, RUNTIME_REALITY as n, checkIdentifiers as o, describeCoverage as p, allocate as r, checkReadability as s, PackRegistry as t, coverageReport as u, forgetAppMap as v, parseGeoJson as w, listAppMaps as x, inspectImage as y };
