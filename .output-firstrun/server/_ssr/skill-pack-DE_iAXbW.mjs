import { d as riskOf, l as isProtectedText } from "./companion-bridge-CJ48JKAT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/skill-pack-DE_iAXbW.js
var SAFE_SCOPE_ID = /^[a-z0-9][a-z0-9._-]*$/i;
var SCOPE_STATUSES = /* @__PURE__ */ new Set([
	"active",
	"completed",
	"cancelled",
	"expired"
]);
function createTaskScope(input) {
	const now = input.now ?? /* @__PURE__ */ new Date();
	const ttlMs = input.ttlMs ?? 18e5;
	if (!Number.isFinite(now.getTime())) throw new Error("A task approval requires a valid grant time.");
	if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 18e5) throw new Error("A task approval duration must be positive and no longer than 30 minutes.");
	if (!SAFE_SCOPE_ID.test(input.id) || input.id.length > 200) throw new Error("A task approval requires a safe bounded id.");
	if (!input.summary.trim() || input.summary.length > 1e3) throw new Error("A task approval requires a bounded summary.");
	if (!Array.isArray(input.capabilities) || input.capabilities.length === 0 || input.capabilities.some((value) => !SAFE_SCOPE_ID.test(value))) throw new Error("A task approval requires at least one valid capability.");
	return {
		id: input.id,
		summary: input.summary,
		capabilities: [...new Set(input.capabilities)],
		apps: [...new Set(input.apps ?? [])],
		paths: [...new Set(input.paths ?? [])],
		grantedAt: now,
		expiresAt: new Date(now.getTime() + ttlMs),
		status: "active",
		steps: 0
	};
}
function validScope(scope, now) {
	const grantedAt = scope.grantedAt instanceof Date ? scope.grantedAt.getTime() : NaN;
	const expiresAt = scope.expiresAt instanceof Date ? scope.expiresAt.getTime() : NaN;
	return Number.isFinite(now.getTime()) && SAFE_SCOPE_ID.test(scope.id) && scope.id.length <= 200 && typeof scope.summary === "string" && scope.summary.trim().length > 0 && scope.summary.length <= 1e3 && Array.isArray(scope.capabilities) && scope.capabilities.length > 0 && scope.capabilities.every((value) => typeof value === "string" && SAFE_SCOPE_ID.test(value)) && Array.isArray(scope.apps) && scope.apps.every((value) => typeof value === "string" && value.trim().length > 0) && Array.isArray(scope.paths) && scope.paths.every((value) => typeof value === "string" && normalisePath(value) !== null) && Number.isFinite(grantedAt) && Number.isFinite(expiresAt) && expiresAt > grantedAt && expiresAt - grantedAt <= 18e5 && SCOPE_STATUSES.has(scope.status) && Number.isSafeInteger(scope.steps) && scope.steps >= 0;
}
/** Expire a scope that has run out of time. Pure. */
function expireScopeIfDue(scope, now = /* @__PURE__ */ new Date()) {
	if (scope.status !== "active") return scope;
	return now.getTime() >= scope.expiresAt.getTime() ? {
		...scope,
		status: "expired"
	} : scope;
}
/**
* Normalise a path for prefix comparison.
*
* Backslashes become forward slashes and the result is lower-cased, so a
* Windows path granted as `C:/Work` still matches `c:\work\invoices\a.pdf`.
* `..` segments are rejected outright rather than resolved: a scope check that
* tries to be clever about traversal is a scope check waiting to be bypassed.
*/
function normalisePath(p) {
	const s = p.replace(/\\/g, "/").trim();
	if (!s) return null;
	if (s.split("/").includes("..")) return null;
	return s.toLowerCase();
}
function withinPaths(target, allowed) {
	const t = normalisePath(target);
	if (t === null) return false;
	return allowed.some((a) => {
		const base = normalisePath(a);
		if (base === null) return false;
		return t === base || t.startsWith(base.endsWith("/") ? base : `${base}/`);
	});
}
/**
* Decide whether an action is covered by an approved scope.
*
* `escalate: true` means "ask the user about this specific step" — the task is
* legitimate but has reached beyond what was agreed. `escalate: false` means
* refuse outright: no additional approval can make it acceptable.
*/
function checkScope(action, scope, now = /* @__PURE__ */ new Date()) {
	if (riskOf(action) === "prohibited") return {
		allow: false,
		escalate: false,
		reason: "This step involves protected information. No approval can cover it — please enter it yourself."
	};
	if (!scope) return {
		allow: false,
		escalate: true,
		reason: "This task hasn't been approved yet."
	};
	if (!validScope(scope, now)) return {
		allow: false,
		escalate: false,
		reason: "This task approval is malformed or invalid, so it was refused."
	};
	const current = expireScopeIfDue(scope, now);
	if (current.status !== "active") return {
		allow: false,
		escalate: true,
		reason: current.status === "expired" ? "The approval for this task has expired. Approve it again to continue." : `This task was ${current.status}.`
	};
	if (!current.capabilities.includes(action.kind)) return {
		allow: false,
		escalate: true,
		reason: `“${current.summary}” didn't include permission to ${action.kind.replace(".", " ")}.`
	};
	if (action.kind === "app.open" && !current.apps.includes(action.appId)) return {
		allow: false,
		escalate: true,
		reason: `Opening ${action.appId} wasn't part of what you approved.`
	};
	if (action.kind === "file.open" && !withinPaths(action.path, current.paths)) return {
		allow: false,
		escalate: true,
		reason: "That file is outside the folders you approved for this task."
	};
	return {
		allow: true,
		scope: current
	};
}
/** Count a completed step, for the receipt at the end. */
function recordStep(scope) {
	return {
		...scope,
		steps: scope.steps + 1
	};
}
function cancelScope(scope) {
	return {
		...scope,
		status: "cancelled"
	};
}
/** Plain summary of what the user is being asked to approve. */
function describeScope(scope) {
	const parts = [`${scope.capabilities.length} kinds of action`];
	if (scope.apps.length > 0) parts.push(`${scope.apps.length} app${scope.apps.length === 1 ? "" : "s"}`);
	if (scope.paths.length > 0) parts.push(`${scope.paths.length} folder${scope.paths.length === 1 ? "" : "s"}`);
	const minutes = Math.round((scope.expiresAt.getTime() - scope.grantedAt.getTime()) / 6e4);
	return `${parts.join(", ")}, for ${minutes} minutes. OCADE will ask again for anything else.`;
}
/** Above this, an adapter still works but is slowing the task down. */
var SLOW_LATENCY_MS = 2e3;
function initialHealth(method) {
	return {
		method,
		state: "unknown",
		consecutiveFailures: 0,
		lastLatencyMs: null,
		lastCheckedAt: null
	};
}
/**
* Fold one observation into an adapter's health.
*
* A single success clears the failure count outright: adapters commonly fail
* for transient reasons (an app still launching), and holding a grudge would
* push OCADE onto the vision fallback long after the good route recovered.
*/
function recordOutcome(health, outcome) {
	const at = outcome.at ?? Date.now();
	if (outcome.ok) {
		const slow = (outcome.latencyMs ?? 0) > SLOW_LATENCY_MS;
		return {
			...health,
			state: slow ? "degraded" : "healthy",
			consecutiveFailures: 0,
			lastLatencyMs: outcome.latencyMs ?? null,
			lastCheckedAt: at,
			reason: slow ? "Working, but slower than usual." : void 0
		};
	}
	const failures = health.consecutiveFailures + 1;
	return {
		...health,
		state: failures >= 2 ? "failing" : "degraded",
		consecutiveFailures: failures,
		lastLatencyMs: outcome.latencyMs ?? null,
		lastCheckedAt: at,
		reason: outcome.reason ?? "The last attempt did not succeed."
	};
}
/** True when OCADE should stop choosing this adapter. */
function shouldRouteAround(health) {
	return health.state === "failing";
}
/**
* Choose among candidate methods, honouring both preference and health.
*
* A healthy but less-preferred method beats a failing preferred one: the point
* is to finish the task correctly, and a route that is currently broken is not
* "more reliable" however good it is on paper.
*/
function chooseHealthyMethod(candidates, health, rank) {
	const routedAround = [];
	const usable = candidates.filter((m) => {
		const h = health.get(m);
		if (h && shouldRouteAround(h)) {
			routedAround.push(m);
			return false;
		}
		return true;
	});
	if (usable.length === 0) return {
		method: null,
		routedAround
	};
	return {
		method: [...usable].sort((a, b) => rank(a) - rank(b))[0],
		routedAround
	};
}
function describeHealth(health) {
	switch (health.state) {
		case "healthy": return health.lastLatencyMs !== null ? `Working normally (${health.lastLatencyMs} ms).` : "Working normally.";
		case "degraded": return health.reason ?? "Working, but not reliably.";
		case "failing": return `Not working — OCADE is using another route. ${health.reason ?? ""}`.trim();
		default: return "Not checked yet.";
	}
}
/** Where a job should pick up: the first step not already finished. */
function resumePoint(job) {
	return job.steps.find((s) => s.status === "pending" || s.status === "failed") ?? null;
}
function jobProgress(job) {
	const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
	return {
		done,
		total: job.steps.length,
		complete: done === job.steps.length
	};
}
/**
* Steps whose assumptions must be re-checked before resuming.
*
* The world may have moved while the job was stopped. Resuming blind is how an
* automation overwrites something a human changed in the meantime, so every
* remaining step with a precondition is re-verified — not just the first.
*/
function preconditionsToRecheck(job) {
	const from = resumePoint(job);
	if (!from) return [];
	const idx = job.steps.indexOf(from);
	return job.steps.slice(idx).map((s) => s.precondition).filter((p) => Boolean(p));
}
function markStep(job, stepId, status, now = Date.now()) {
	return {
		...job,
		steps: job.steps.map((s) => s.id === stepId ? {
			...s,
			status
		} : s),
		updatedAt: now
	};
}
function describeResume(job) {
	const { done, total, complete } = jobProgress(job);
	if (complete) return "This task already finished.";
	const next = resumePoint(job);
	const checks = preconditionsToRecheck(job).length;
	const base = `Resuming at step ${done + 1} of ${total}: ${next?.summary ?? "the next step"}.`;
	return checks > 0 ? `${base} OCADE re-checks ${checks} ${checks === 1 ? "assumption" : "assumptions"} first, in case anything changed.` : base;
}
var DEFAULT_BUDGET = {
	maxConcurrent: 2,
	stepTimeoutMs: 3e4,
	jobTimeoutMs: 600 * 1e3
};
/**
* Predict whether a job will exceed its budget, BEFORE starting it.
*
* Saying "this will take about twelve minutes, which is over the limit" up
* front is far more useful than stopping halfway through with no explanation.
*/
function predictBudget(stepCount, averageStepMs, budget = DEFAULT_BUDGET) {
	const estimateMs = Math.ceil(stepCount * averageStepMs / Math.max(1, budget.maxConcurrent));
	if (averageStepMs > budget.stepTimeoutMs) return {
		withinBudget: false,
		estimateMs,
		reason: `Each step is expected to take longer than the ${Math.round(budget.stepTimeoutMs / 1e3)}s limit for a single step.`
	};
	if (estimateMs > budget.jobTimeoutMs) return {
		withinBudget: false,
		estimateMs,
		reason: `This looks like about ${Math.round(estimateMs / 6e4)} minutes of work, past the ${Math.round(budget.jobTimeoutMs / 6e4)}-minute limit. OCADE can do it in smaller batches.`
	};
	return {
		withinBudget: true,
		estimateMs,
		reason: `Estimated ${Math.max(1, Math.round(estimateMs / 1e3))}s.`
	};
}
/**
* Session recording, input display and replay safety.
*
* When OCADE works on the user's machine they should be able to watch it, and
* afterwards prove what happened. Two modes, with genuinely different rules:
*
*  - VIDEO ON  — the user is watching. OCADE moves the pointer visibly and uses
*                observable actions, so what they see is what happened. Hidden
*                keyboard shortcuts are avoided: a shortcut that silently does
*                something the viewer cannot see defeats the point of watching.
*  - VIDEO OFF — nobody is watching, so fast shortcuts are fine. A small corner
*                overlay shows which non-sensitive keys are being used, so the
*                user can glance over and understand.
*
* The rule that overrides both: protected keystrokes are NEVER recorded,
* displayed or replayed — not masked afterwards, not captured at all. Masking
* after capture still means the value existed in a buffer.
*/
/** Keys that are safe to show: navigation and command keys, never content. */
var SAFE_KEYS = /* @__PURE__ */ new Set([
	"Tab",
	"Enter",
	"Escape",
	"Backspace",
	"Delete",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	"Ctrl",
	"Alt",
	"Shift",
	"Meta",
	"Cmd",
	"Ctrl+C",
	"Ctrl+V",
	"Ctrl+S",
	"Ctrl+Z",
	"Ctrl+A",
	"Ctrl+F",
	"F1",
	"F2",
	"F3",
	"F5",
	"F11",
	"F12"
]);
/**
* Whether an input event may be shown or stored.
*
* A single printable character is refused even outside a protected field: a
* stream of individual characters IS the typed content, and reconstructing a
* password from a "safe" keystroke log is exactly the failure to avoid.
*/
function isRecordableInput(event) {
	if (event.inProtectedField) return false;
	if (event.kind === "pointer") return true;
	if (SAFE_KEYS.has(event.label)) return true;
	return false;
}
/** Filter an input stream down to what may be shown. */
function recordableInputs(events) {
	return events.filter(isRecordableInput);
}
/**
* How OCADE should perform actions in each mode.
*
* These are not cosmetic. With video on, an invisible shortcut produces a
* recording that does not explain what happened — which is worse than no
* recording, because it looks like evidence.
*/
function actionStyleFor(mode) {
	if (mode === "video_on") return {
		visiblePointer: true,
		allowShortcuts: false,
		showKeyOverlay: false,
		reason: "You're watching, so OCADE moves the pointer visibly and avoids hidden shortcuts — what you see is what it did."
	};
	return {
		visiblePointer: false,
		allowShortcuts: true,
		showKeyOverlay: true,
		reason: "Recording is off, so OCADE uses faster keyboard shortcuts. The corner overlay shows which keys — never what you type into a protected field."
	};
}
/**
* Regions that must be blanked before a frame is captured.
*
* Applied BEFORE capture, never after: masking a stored frame means the
* unmasked pixels existed on disk, however briefly.
*/
function captureMaskFor(protectedFieldIds) {
	const base = [
		"input[type=\"password\"]",
		"input[autocomplete*=\"one-time\"]",
		"input[autocomplete*=\"cc-\"]",
		"[data-ocade-protected]"
	];
	const extra = protectedFieldIds.filter((id) => id.trim().length > 0).map((id) => `[name="${id}"]`);
	return {
		maskSelectors: [.../* @__PURE__ */ new Set([...base, ...extra])],
		reason: extra.length > 0 ? "Protected fields on this screen are blanked before anything is captured." : "Credential fields are blanked before anything is captured."
	};
}
var REPLAY_CONTROLS = [
	"pause",
	"resume",
	"cancel",
	"emergency_stop",
	"undo",
	"replay"
];
/**
* Redact a replay log before it is shown or exported.
*
* Any step whose summary looks like protected content is replaced entirely
* rather than partially masked: partial masking still leaks length and context.
*/
function redactReplay(steps) {
	return steps.map((s) => isProtectedText(s.summary) ? {
		...s,
		summary: "[step involving protected information — details not recorded]"
	} : s);
}
/**
* Which steps can actually be undone, newest first.
*
* Undo stops at the first step that cannot be reversed: continuing past it
* would leave the machine in a state that matches neither before nor after,
* which is worse than not undoing at all.
*/
function undoableRange(steps) {
	const out = [];
	for (const s of [...steps].sort((a, b) => b.index - a.index)) {
		if (!s.undoable) break;
		out.push(s);
	}
	return out;
}
function describeUndo(steps) {
	const range = undoableRange(steps);
	if (range.length === 0) return "Nothing here can be undone automatically.";
	const total = steps.length;
	return range.length === total ? `All ${total} steps can be undone.` : `The last ${range.length} of ${total} steps can be undone — earlier ones can't be reversed automatically.`;
}
var SKILL_CATEGORIES = [
	"os_utilities",
	"erp_crm_hcm_scm",
	"office_docs",
	"graphics_media",
	"dev_tools",
	"engineering_cad",
	"chat_projects",
	"security_networking",
	"data_bi_ai",
	"browsers_transfer",
	"finance_commerce",
	"healthcare_imaging",
	"education",
	"games_streaming"
];
var CONTROL_PREFERENCE = [
	"official_api",
	"adapter",
	"accessibility",
	"dom",
	"file",
	"cli",
	"vision_input"
];
/** Lower is better. Used to choose between available methods. */
function methodRank(m) {
	const i = CONTROL_PREFERENCE.indexOf(m);
	return i === -1 ? CONTROL_PREFERENCE.length : i;
}
/**
* Pick the most reliable method available for a capability.
* Returns null when nothing is available — never falls back to guessing.
*/
function preferredMethod(available) {
	if (available.length === 0) return null;
	return [...available].sort((a, b) => methodRank(a) - methodRank(b))[0];
}
function versionMatches(pack, version) {
	if (pack.testedVersions.length === 0) return false;
	if (!version) return false;
	return pack.testedVersions.some((prefix) => version.startsWith(prefix));
}
/**
* Resolve an app to a pack, reporting HOW confident OCADE actually is.
*
* A pack for the right app but an untested version is deliberately downgraded
* to `probed`: menus and shortcuts move between releases, and acting on a stale
* map is exactly how an agent clicks the wrong thing.
*/
function matchPack(app, packs) {
	const pack = packs.find((p) => p.appId === app.appId);
	if (!pack) return {
		pack: null,
		confidence: "unknown",
		reason: `OCADE doesn't have a tested skill pack for ${app.displayName}. It can inspect the app once and learn it, with your approval.`
	};
	if (versionMatches(pack, app.version)) return {
		pack,
		confidence: "verified",
		reason: `Tested with ${pack.displayName} ${app.version}.`
	};
	return {
		pack,
		confidence: "probed",
		reason: `OCADE knows ${pack.displayName}, but not version ${app.version ?? "(unreported)"}. It will re-check the app's layout before acting.`
	};
}
/** Below this, OCADE re-inspects rather than acting. */
var CONFIDENCE_THRESHOLD = .7;
/**
* Score an action before it runs.
*
* Deliberately pessimistic: an untested capability, a stale version map, or a
* vision-only path all pull the score down, and a mutating action needs more
* confidence than a read.
*/
function assessAction(capability, packConfidence, availableMethods, freshMap) {
	const method = preferredMethod(capability.methods.filter((m) => availableMethods.includes(m)));
	if (!method) return {
		capability,
		method: null,
		confidence: 0,
		proceed: false,
		reason: "None of the ways OCADE knows to do this are available right now."
	};
	let score = packConfidence === "verified" ? .9 : packConfidence === "probed" ? .6 : .3;
	if (freshMap) score += Math.min(.2, .1 + freshMap.uses * .02);
	if (!capability.tested) score -= .15;
	if (method === "vision_input") score -= .2;
	if (capability.mutating && capability.verifyBy === "none") score -= .25;
	score = Math.max(0, Math.min(1, score));
	const proceed = score >= CONFIDENCE_THRESHOLD;
	return {
		capability,
		method,
		confidence: Number(score.toFixed(2)),
		proceed,
		reason: proceed ? `Using ${describeMethod(method)}.` : `OCADE isn't confident enough to do this unattended (${Math.round(score * 100)}%). It will inspect the app first.`
	};
}
function describeMethod(m) {
	switch (m) {
		case "official_api": return "the app's official API";
		case "adapter": return "a built-in adapter";
		case "accessibility": return "the accessibility tree";
		case "dom": return "the page structure";
		case "file": return "direct file access";
		case "cli": return "the app's command line";
		case "vision_input": return "screen reading with mouse and keyboard";
	}
}
function buildReceipt(input) {
	return {
		appId: input.app.appId,
		capabilityId: input.capability.id,
		method: input.method,
		at: (input.now ?? /* @__PURE__ */ new Date()).toISOString(),
		verified: input.verified,
		evidence: input.verified ? input.evidence : `NOT CONFIRMED: ${input.evidence || "no check was possible"}`
	};
}
//#endregion
export { methodRank as C, recordableInputs as D, recordStep as E, redactReplay as O, matchPack as S, recordOutcome as T, describeUndo as _, actionStyleFor as a, isRecordableInput as b, cancelScope as c, chooseHealthyMethod as d, createTaskScope as f, describeScope as g, describeResume as h, SKILL_CATEGORIES as i, captureMaskFor as l, describeMethod as m, DEFAULT_BUDGET as n, assessAction as o, describeHealth as p, REPLAY_CONTROLS as r, buildReceipt as s, CONTROL_PREFERENCE as t, checkScope as u, expireScopeIfDue as v, predictBudget as w, markStep as x, initialHealth as y };
