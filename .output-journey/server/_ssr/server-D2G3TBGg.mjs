//#region node_modules/.nitro/vite/services/ssr/assets/server-D2G3TBGg.js
var HOUR = 3600 * 1e3;
/**
* The default policy. Quotas are deliberately generous: OCADE runs on the
* person's own device and costs nobody anything per call, so these exist to
* catch runaway loops and abuse, not to ration a product that is free.
*/
var DEFAULT_POLICY = {
	windows: [
		{
			id: "burst",
			durationMs: 5 * HOUR,
			quota: 600,
			label: "this session"
		},
		{
			id: "day",
			durationMs: 8 * HOUR,
			quota: 900,
			label: "today"
		},
		{
			id: "rolling",
			durationMs: 28 * HOUR,
			quota: 2e3,
			label: "the last day"
		}
	],
	warnings: {
		burst: [{
			utilization: .9,
			timePct: .72
		}],
		day: [{
			utilization: .75,
			timePct: .6
		}, {
			utilization: .5,
			timePct: .35
		}],
		rolling: [{
			utilization: .8,
			timePct: .5
		}]
	}
};
function emptyLimitState() {
	return { events: [] };
}
/**
* A rolling window, not a fixed bucket.
*
* A fixed bucket resetting on the hour lets somebody spend a whole quota at
* 10:59 and another at 11:00, which is exactly the burst the limit exists to
* prevent. A rolling window costs an array scan and does not have that hole.
*/
function statusFor(window, state, now, pendingCost) {
	const cutoff = now - window.durationMs;
	const inWindow = state.events.filter((event) => event.at > cutoff);
	const used = inWindow.reduce((total, event) => total + event.cost, 0);
	const resetsAt = (inWindow.length > 0 ? Math.min(...inWindow.map((event) => event.at)) : now) + window.durationMs;
	let retryAfterSeconds = 0;
	if (used + pendingCost > window.quota) {
		const needed = used + pendingCost - window.quota;
		let freed = 0;
		const ordered = [...inWindow].sort((a, b) => a.at - b.at);
		for (const event of ordered) {
			freed += event.cost;
			if (freed >= needed) {
				retryAfterSeconds = Math.max(1, Math.ceil((event.at + window.durationMs - now) / 1e3));
				break;
			}
		}
		if (retryAfterSeconds === 0) retryAfterSeconds = Math.max(1, Math.ceil((resetsAt - now) / 1e3));
	}
	return {
		id: window.id,
		label: window.label,
		used,
		quota: window.quota,
		utilization: Math.min(1, window.quota === 0 ? 1 : used / window.quota),
		resetsAt,
		retryAfterSeconds
	};
}
/** How much of a window has elapsed, for the early-warning rule. */
function timeProgress(status, window, now) {
	const windowStart = status.resetsAt - window.durationMs;
	return Math.max(0, Math.min(1, (now - windowStart) / window.durationMs));
}
function checkLimit(state, options = {}) {
	const policy = options.policy ?? DEFAULT_POLICY;
	const now = options.now ?? Date.now();
	const cost = options.cost ?? 1;
	const windows = policy.windows.map((window) => statusFor(window, state, now, cost));
	const rejected = windows.filter((status) => status.retryAfterSeconds > 0);
	if (rejected.length > 0) {
		const soonest = rejected.reduce((a, b) => a.retryAfterSeconds <= b.retryAfterSeconds ? a : b);
		return {
			outcome: "rejected",
			window: soonest,
			windows,
			retryAfterSeconds: soonest.retryAfterSeconds,
			message: `OCADE has done a lot for you ${soonest.label}. ${describeWait(soonest.retryAfterSeconds)}`
		};
	}
	for (const window of policy.windows) {
		const status = windows.find((candidate) => candidate.id === window.id);
		if (!status) continue;
		const thresholds = policy.warnings[window.id] ?? [];
		const elapsed = timeProgress(status, window, now);
		if (thresholds.find((threshold) => status.utilization >= threshold.utilization && elapsed <= threshold.timePct)) return {
			outcome: "allowed_warning",
			window: status,
			windows,
			retryAfterSeconds: 0,
			message: `You have used most of what OCADE allows ${status.label}, and there is a while to go. It will keep working; heavy jobs may pause later.`
		};
	}
	return {
		outcome: "allowed",
		window: null,
		windows,
		retryAfterSeconds: 0,
		message: null
	};
}
/** Record an action against the limit state. Returns the new state. */
function recordUse(state, options = {}) {
	const policy = options.policy ?? DEFAULT_POLICY;
	const now = options.now ?? Date.now();
	const cutoff = now - Math.max(...policy.windows.map((window) => window.durationMs));
	return { events: [...state.events.filter((event) => event.at > cutoff), {
		at: now,
		cost: options.cost ?? 1
	}] };
}
function describeWait(seconds) {
	if (seconds <= 60) return "Try again in a moment.";
	const minutes = Math.ceil(seconds / 60);
	if (minutes < 60) return `Try again in about ${minutes} minutes.`;
	const hours = Math.round(minutes / 60);
	return hours === 1 ? "Try again in about an hour." : `Try again in about ${hours} hours.`;
}
/**
* The `Retry-After` value for an HTTP response.
*
* Seconds rather than a date, because a date requires the client's clock to
* agree with the server's and a wrong clock turns a one-minute wait into an
* hour or into no wait at all.
*/
function retryAfterHeader(decision) {
	return decision.retryAfterSeconds > 0 ? { "retry-after": String(decision.retryAfterSeconds) } : {};
}
/**
* Rate limiting for the endpoints that cost somebody something.
*
* WHY THIS EXISTS ALONGSIDE THE DEVICE-LOCAL GOVERNOR
* ---------------------------------------------------
* `use-limits.ts` protects the user's own machine from a loop that got away,
* and it is honest that clearing browser storage resets it. That is fine for
* work the user's device does for the user.
*
* It is not fine for work that leaves the device. An outbound web search, a
* payment endpoint and an OAuth refresh all consume something the user does not
* own — a third party's quota, a provider's fraud budget, a mail sender's
* reputation — and a limit somebody can reset by clearing a cookie is not a
* limit on those at all.
*
* So these run server-side, keyed by account, in the Worker's memory.
*
* WHAT THAT DOES AND DOES NOT BUY, STATED PLAINLY
* -----------------------------------------------
* A Cloudflare Worker isolate is not a shared store. Two isolates hold two
* counters, and an isolate can be recycled between requests. So this raises the
* cost of hammering an endpoint from one account and does not make it
* impossible.
*
* That is worth having and it is not a security boundary, which is why the
* things that MUST NOT be brute-forced do not rely on it: Supabase enforces
* auth attempts, the payment provider verifies its own webhook signatures, and
* the webhook handler is idempotent by event id. This layer sits in front of
* those as the cheap first refusal, and says so rather than implying more.
*
* A durable counter belongs in KV or D1. When one is provisioned, `stores`
* below is the only thing that changes.
*/
var POLICIES = {
	research: {
		windows: [
			{
				id: "burst",
				durationMs: 5 * HOUR,
				quota: 120,
				label: "this session"
			},
			{
				id: "day",
				durationMs: 8 * HOUR,
				quota: 200,
				label: "today"
			},
			{
				id: "rolling",
				durationMs: 28 * HOUR,
				quota: 400,
				label: "the last day"
			}
		],
		warnings: { burst: [{
			utilization: .9,
			timePct: .72
		}] }
	},
	billing_read: {
		windows: [{
			id: "burst",
			durationMs: 5 * HOUR,
			quota: 200,
			label: "this session"
		}, {
			id: "rolling",
			durationMs: 28 * HOUR,
			quota: 600,
			label: "the last day"
		}],
		warnings: {}
	},
	billing_write: {
		windows: [{
			id: "burst",
			durationMs: 5 * HOUR,
			quota: 20,
			label: "this session"
		}, {
			id: "rolling",
			durationMs: 28 * HOUR,
			quota: 40,
			label: "the last day"
		}],
		warnings: {}
	},
	auth_mail: {
		windows: [
			{
				id: "burst",
				durationMs: 5 * HOUR,
				quota: 10,
				label: "this session"
			},
			{
				id: "day",
				durationMs: 8 * HOUR,
				quota: 14,
				label: "today"
			},
			{
				id: "rolling",
				durationMs: 28 * HOUR,
				quota: 20,
				label: "the last day"
			}
		],
		warnings: {}
	}
};
var stores = /* @__PURE__ */ new Map();
/**
* How many accounts are tracked before the oldest are dropped.
*
* A Map keyed by account id grows with traffic, and an isolate that never
* evicts is an isolate that eventually falls over — which would take the
* endpoint down rather than limit it. Eviction weakens the limit for whoever
* gets dropped; running out of memory removes it for everybody.
*/
var MAX_TRACKED = 1e4;
function keyFor(kind, accountId) {
	return `${kind}:${accountId}`;
}
function checkServerLimit(kind, accountId, options = {}) {
	const policy = POLICIES[kind];
	const key = keyFor(kind, accountId);
	const state = stores.get(key) ?? emptyLimitState();
	const decision = checkLimit(state, {
		policy,
		...options.now === void 0 ? {} : { now: options.now },
		...options.cost === void 0 ? {} : { cost: options.cost }
	});
	if (decision.outcome === "rejected") return {
		allowed: false,
		decision,
		headers: retryAfterHeader(decision)
	};
	if (stores.size >= MAX_TRACKED && !stores.has(key)) {
		const oldest = stores.keys().next().value;
		if (oldest !== void 0) stores.delete(oldest);
	}
	stores.set(key, recordUse(state, {
		policy,
		...options.now === void 0 ? {} : { now: options.now },
		...options.cost === void 0 ? {} : { cost: options.cost }
	}));
	return {
		allowed: true,
		decision,
		headers: {}
	};
}
/**
* Refuse a server function, in the shape its caller already handles.
*
* The message is the policy engine's, so the same limit reads identically
* whether it was hit in the browser or at the endpoint.
*/
function limitError(result) {
	const error = new Error(result.decision.message ?? "That has been asked for too many times. Try again shortly.");
	error.retryAfterSeconds = result.decision.retryAfterSeconds;
	return error;
}
//#endregion
export { limitError as a, emptyLimitState as i, checkLimit as n, recordUse as o, checkServerLimit as r, DEFAULT_POLICY as t };
