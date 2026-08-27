import { d as riskOf } from "./companion-bridge-CJ48JKAT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-automations-Dh0tqTFk.js
/**
* OCADE automations and scheduling (Plan §33, decision #16-automations).
*
* V1 scope: manual runs, time-scheduled/recurring runs, and simple conditional
* triggers. Every automation is dry-runnable, gated by the same risk tiers as
* direct actions, cancellable, and produces an auditable run record.
*
* Safety: an automation can NEVER perform a prohibited (protected-credential)
* action, and destructive/irreversible steps always require explicit approval —
* an automation cannot silently self-authorise.
*
* Pure and deterministic; scheduling takes an explicit `now` so it is testable.
*/
/**
* Statuses that mean a run still occupies the automation.
*
* A run in any of these is "in flight": it has not reached a terminal state, so
* starting another run of the same automation would double-execute the work.
*/
var IN_FLIGHT_STATUSES = [
	"pending",
	"awaiting_approval",
	"running",
	"paused"
];
function summarise(action) {
	switch (action.kind) {
		case "screen.read": return "Read the visible screen";
		case "window.list": return "List open windows";
		case "window.focus": return `Focus window "${action.target}"`;
		case "window.arrange": return `Arrange window (${action.layout})`;
		case "app.open": return `Open application "${action.appId}"`;
		case "file.open": return `Open "${action.path}"`;
		case "text.type": return "Type approved text";
		case "clipboard.read": return "Read the clipboard";
		case "clipboard.write": return "Write to the clipboard";
		default: return "Unknown action";
	}
}
var RISK_ORDER = [
	"read_only",
	"low",
	"confirm",
	"high",
	"prohibited"
];
function maxRisk(a, b) {
	return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}
/**
* Build the execution plan. Always safe to call — it changes nothing and is the
* basis for both dry-run preview and the approval prompt.
*/
function planRun(automation) {
	const steps = automation.actions.map((action) => {
		const risk = riskOf(action);
		return {
			action,
			risk,
			summary: summarise(action),
			requiresConfirmation: risk === "confirm" || risk === "high"
		};
	});
	const highestRisk = steps.reduce((acc, s) => maxRisk(acc, s.risk), "read_only");
	const blocked = steps.length === 0 || highestRisk === "prohibited";
	return {
		automationId: automation.id,
		steps,
		highestRisk,
		blocked,
		blockedReason: steps.length === 0 ? "This automation has no steps, so there is nothing to execute." : highestRisk === "prohibited" ? "This automation includes a step involving protected information, which OCADE can never perform automatically." : void 0,
		requiresApproval: automation.requiresApproval || highestRisk === "confirm" || highestRisk === "high"
	};
}
/** Initial status for a run, derived from its plan. */
function initialStatus(plan, dryRun) {
	if (plan.blocked) return "blocked";
	if (dryRun) return "succeeded";
	return plan.requiresApproval ? "awaiting_approval" : "pending";
}
var MIN_MS = 60 * 1e3;
/**
* Next due time for a trigger. Manual and condition triggers are not
* time-scheduled and return null.
*/
function nextRunAt(trigger, from, lastRunAt) {
	switch (trigger.kind) {
		case "manual":
		case "condition": return null;
		case "interval": {
			const every = Math.max(1, Math.floor(trigger.everyMinutes)) * MIN_MS;
			let next = (lastRunAt ? lastRunAt.getTime() : from.getTime()) + every;
			if (next <= from.getTime()) {
				const missed = Math.ceil((from.getTime() - next) / every);
				next += missed * every;
				if (next <= from.getTime()) next += every;
			}
			return new Date(next);
		}
		case "daily": {
			const h = Math.min(23, Math.max(0, Math.floor(trigger.atHourUtc)));
			const m = Math.min(59, Math.max(0, Math.floor(trigger.atMinuteUtc ?? 0)));
			const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m, 0, 0));
			if (candidate.getTime() <= from.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);
			return candidate;
		}
	}
}
var MAX_BACKOFF_MS = 15 * MIN_MS;
/**
* Retry policy. Cancellations and blocked runs are never retried; genuine
* failures back off exponentially up to the automation's attempt limit.
*/
function decideRetry(input) {
	if (input.status === "cancelled") return {
		retry: false,
		delayMs: 0,
		reason: "Cancelled by the user."
	};
	if (input.status === "blocked") return {
		retry: false,
		delayMs: 0,
		reason: "Blocked by a safety rule."
	};
	if (input.status !== "failed") return {
		retry: false,
		delayMs: 0,
		reason: "Nothing to retry."
	};
	if (input.attempt >= input.maxAttempts) return {
		retry: false,
		delayMs: 0,
		reason: `Gave up after ${input.attempt} attempts.`
	};
	return {
		retry: true,
		delayMs: Math.min(MAX_BACKOFF_MS, 2 ** (input.attempt - 1) * MIN_MS),
		reason: `Retrying (attempt ${input.attempt + 1}).`
	};
}
function applyApproval(status, decision) {
	if (status !== "awaiting_approval") return {
		status,
		reason: "This run was not awaiting approval."
	};
	return decision === "approved" ? {
		status: "pending",
		reason: "Approved — queued to run."
	} : {
		status: "cancelled",
		reason: "Denied — nothing was run."
	};
}
/** A run can be cancelled while it is queued, awaiting approval, or running. */
function canCancel(status) {
	return status === "pending" || status === "awaiting_approval" || status === "running" || status === "paused";
}
function canPause(status) {
	return status === "pending" || status === "awaiting_approval" || status === "running";
}
function canResume(status) {
	return status === "paused";
}
/** User-facing copy that never mistakes persistence for execution. */
function describeRunEnqueue(result) {
	if (result.status === "blocked") return {
		tone: "error",
		message: "Run blocked — no action was executed."
	};
	if (result.dryRun) return {
		tone: "success",
		message: "Dry-run preview recorded — nothing was executed or changed."
	};
	if (result.status === "awaiting_approval") return {
		tone: "warning",
		message: result.reused ? "This run is already waiting for approval — no duplicate was created and nothing was executed." : "Run created — it needs your approval before anything can be queued for execution."
	};
	if (result.status === "pending") return {
		tone: "info",
		message: result.reused ? "This run is already queued — no duplicate was created and no action has executed." : "Run queued — no action has executed yet."
	};
	if (result.status === "running") return {
		tone: "info",
		message: "An existing run is marked running; no duplicate was created."
	};
	if (result.status === "paused") return {
		tone: "info",
		message: "An existing run is paused; no duplicate was created and no action is executing."
	};
	return {
		tone: "info",
		message: `Existing run status: ${result.status}. No new run was created.`
	};
}
//#endregion
export { canResume as a, initialStatus as c, canPause as i, nextRunAt as l, applyApproval as n, decideRetry as o, canCancel as r, describeRunEnqueue as s, IN_FLIGHT_STATUSES as t, planRun as u };
