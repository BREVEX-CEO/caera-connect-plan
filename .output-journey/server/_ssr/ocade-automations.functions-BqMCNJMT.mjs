import { a as numberType, c as stringType, i as literalType, l as unionType, n as booleanType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { u as redactForAudit } from "./companion-bridge-CJ48JKAT.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { a as canResume, c as initialStatus, i as canPause, l as nextRunAt, n as applyApproval, r as canCancel, u as planRun } from "./ocade-automations-Dh0tqTFk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-automations.functions-BqMCNJMT.js
/**
* OCADE automations — server functions (Plan §33).
*
* Thin persistence + orchestration around the unit-tested engine in
* `ocade-automations.ts`. The engine decides plans, risk, approval, retry and
* cancellation; this module stores the result and enforces ownership.
*
* STATUS: backing tables ship in the READY-TO-APPLY migration
* `20260722110000_ocade_automations.sql`. Until it is applied the generated
* Database type has no knowledge of them, so access goes through the single
* documented bridge below (remove after types regenerate).
*/
var uuid = stringType().uuid();
var triggerSchema = unionType([
	objectType({ kind: literalType("manual") }),
	objectType({
		kind: literalType("interval"),
		everyMinutes: numberType().int().min(1).max(1440 * 30)
	}),
	objectType({
		kind: literalType("daily"),
		atHourUtc: numberType().int().min(0).max(23),
		atMinuteUtc: numberType().int().min(0).max(59).optional()
	}),
	objectType({
		kind: literalType("condition"),
		expression: stringType().min(1).max(500)
	})
]);
var actionSchema = unionType([
	objectType({ kind: literalType("screen.read") }),
	objectType({ kind: literalType("window.list") }),
	objectType({
		kind: literalType("window.focus"),
		target: stringType().min(1).max(300)
	}),
	objectType({
		kind: literalType("window.arrange"),
		layout: enumType([
			"left",
			"right",
			"maximize",
			"restore"
		]),
		target: stringType().max(300).optional()
	}),
	objectType({
		kind: literalType("app.open"),
		appId: stringType().min(1).max(300)
	}),
	objectType({
		kind: literalType("file.open"),
		path: stringType().min(1).max(1e3)
	}),
	objectType({
		kind: literalType("text.type"),
		text: stringType().max(5e3)
	}),
	objectType({ kind: literalType("clipboard.read") }),
	objectType({
		kind: literalType("clipboard.write"),
		text: stringType().max(5e3)
	}),
	objectType({ kind: literalType("selection.read") }),
	objectType({
		kind: literalType("selection.replace"),
		text: stringType().max(5e3)
	})
]);
function toEngine(row) {
	return {
		id: row.id,
		name: row.name,
		enabled: row.enabled,
		trigger: row.trigger,
		actions: row.actions,
		requiresApproval: row.requires_approval,
		dryRun: row.dry_run,
		maxAttempts: row.max_attempts
	};
}
var listAutomations_createServerFn_handler = createServerRpc({
	id: "d95b673cfc0252d9a6f6fef2fe4b2fe6d5387de6561ef081fecf6767bc71290f",
	name: "listAutomations",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => listAutomations.__executeServer(opts));
var listAutomations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listAutomations_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("ocade_automations").select("id, name, enabled, paused, trigger, actions, requires_approval, dry_run, max_attempts, next_run_at, last_run_at, updated_at").eq("user_id", context.userId).order("updated_at", { ascending: false });
	if (error) throw new Response(error.message, { status: 500 });
	return data ?? [];
});
var createAutomation_createServerFn_handler = createServerRpc({
	id: "6298a6776825c44f6c02e958701cf4ccb6b857b9656f80da07356e4daf9785de",
	name: "createAutomation",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => createAutomation.__executeServer(opts));
var createAutomation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	name: stringType().trim().min(1).max(200),
	trigger: triggerSchema.default({ kind: "manual" }),
	actions: arrayType(actionSchema).max(50).default([]),
	requiresApproval: booleanType().default(true),
	dryRun: booleanType().default(false),
	maxAttempts: numberType().int().min(1).max(10).default(3)
}).parse(i)).handler(createAutomation_createServerFn_handler, async ({ data, context }) => {
	const next = nextRunAt(data.trigger, /* @__PURE__ */ new Date());
	const { data: row, error } = await context.supabase.from("ocade_automations").insert({
		user_id: context.userId,
		name: data.name,
		trigger: data.trigger,
		actions: data.actions,
		requires_approval: data.requiresApproval,
		dry_run: data.dryRun,
		max_attempts: data.maxAttempts,
		next_run_at: next ? next.toISOString() : null
	}).select("id, name").single();
	if (error) throw new Response(error.message, { status: 500 });
	return row;
});
var updateAutomation_createServerFn_handler = createServerRpc({
	id: "cc5dae6cc8af16d10116e614b16bb61eb5eb0aa39c9a3cf2e85797b2fbe2d501",
	name: "updateAutomation",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => updateAutomation.__executeServer(opts));
var updateAutomation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	id: uuid,
	name: stringType().trim().min(1).max(200).optional(),
	enabled: booleanType().optional(),
	paused: booleanType().optional(),
	trigger: triggerSchema.optional(),
	actions: arrayType(actionSchema).max(50).optional(),
	requiresApproval: booleanType().optional(),
	dryRun: booleanType().optional(),
	maxAttempts: numberType().int().min(1).max(10).optional()
}).parse(i)).handler(updateAutomation_createServerFn_handler, async ({ data, context }) => {
	const patch = {};
	if (data.name !== void 0) patch.name = data.name;
	if (data.enabled !== void 0) patch.enabled = data.enabled;
	if (data.paused !== void 0) patch.paused = data.paused;
	if (data.actions !== void 0) patch.actions = data.actions;
	if (data.requiresApproval !== void 0) patch.requires_approval = data.requiresApproval;
	if (data.dryRun !== void 0) patch.dry_run = data.dryRun;
	if (data.maxAttempts !== void 0) patch.max_attempts = data.maxAttempts;
	if (data.trigger !== void 0) {
		patch.trigger = data.trigger;
		const next = nextRunAt(data.trigger, /* @__PURE__ */ new Date());
		patch.next_run_at = next ? next.toISOString() : null;
	}
	const { error } = await context.supabase.from("ocade_automations").update(patch).eq("id", data.id).eq("user_id", context.userId);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
var deleteAutomation_createServerFn_handler = createServerRpc({
	id: "c62a2a67fc3829362eb581a6dd7287f5ff7a6da515dfa2fcf570321f196faf96",
	name: "deleteAutomation",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => deleteAutomation.__executeServer(opts));
var deleteAutomation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteAutomation_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("ocade_automations").delete().eq("id", data.id).eq("user_id", context.userId);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
async function loadAutomation(supabase, userId, id) {
	const { data } = await supabase.from("ocade_automations").select("id, name, enabled, paused, trigger, actions, requires_approval, dry_run, max_attempts, next_run_at, last_run_at, updated_at").eq("id", id).eq("user_id", userId).maybeSingle();
	if (!data) throw new Response("Automation not found", { status: 404 });
	return data;
}
/**
* Compute the plan WITHOUT persisting anything — the dry-run/permission preview
* the user sees before approving.
*/
var previewAutomation_createServerFn_handler = createServerRpc({
	id: "9421b1f2ee9725c3de85707b687ff6bcfcfa5bab41bd6b3b1d96a310835bfdba",
	name: "previewAutomation",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => previewAutomation.__executeServer(opts));
var previewAutomation = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(previewAutomation_createServerFn_handler, async ({ data, context }) => {
	const plan = planRun(toEngine(await loadAutomation(context.supabase, context.userId, data.id)));
	return {
		...plan,
		steps: plan.steps.map((s) => ({
			...s,
			summary: redactForAudit(s.summary)
		}))
	};
});
var startAutomationRun_createServerFn_handler = createServerRpc({
	id: "08fcd7c3ba8a6c5bf93386ddf6b072da3ff2bd95af6d6e8d8610df716d87179c",
	name: "startAutomationRun",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => startAutomationRun.__executeServer(opts));
var startAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	id: uuid,
	dryRun: booleanType().optional(),
	deadlineAt: stringType().datetime().optional()
}).parse(i)).handler(startAutomationRun_createServerFn_handler, async ({ data, context }) => {
	const row = await loadAutomation(context.supabase, context.userId, data.id);
	const automation = toEngine(row);
	const dryRun = data.dryRun ?? automation.dryRun;
	const plan = planRun(automation);
	const status = initialStatus(plan, dryRun);
	if (data.deadlineAt && Date.parse(data.deadlineAt) <= Date.now()) throw new Response("The run deadline must be in the future.", { status: 400 });
	const redactedPlan = {
		...plan,
		steps: plan.steps.map((s) => ({
			summary: redactForAudit(s.summary),
			risk: s.risk,
			requiresConfirmation: s.requiresConfirmation
		}))
	};
	const startedAt = /* @__PURE__ */ new Date();
	const next = dryRun ? null : nextRunAt(automation.trigger, startedAt, startedAt);
	const { data: persisted, error } = await context.supabase.rpc("ocade_enqueue_automation_run", {
		p_automation_id: row.id,
		p_status: status,
		p_dry_run: dryRun,
		p_plan: redactedPlan,
		p_execution_steps: plan.blocked || dryRun ? [] : plan.steps,
		p_highest_risk: plan.highestRisk,
		p_blocked_reason: plan.blockedReason ?? void 0,
		p_deadline_at: data.deadlineAt ?? void 0,
		p_next_run_at: next ? next.toISOString() : void 0
	});
	if (error) throw new Response(error.message, { status: 500 });
	const run = Array.isArray(persisted) ? persisted[0] : persisted;
	if (!run || typeof run.id !== "string" || ![
		"pending",
		"awaiting_approval",
		"running",
		"paused",
		"succeeded",
		"blocked"
	].includes(String(run.status)) || typeof run.reused !== "boolean") throw new Response("The database returned an invalid automation enqueue result.", { status: 500 });
	return {
		id: run.id,
		status: run.status,
		dryRun,
		reused: run.reused,
		executed: false
	};
});
var listAutomationRuns_createServerFn_handler = createServerRpc({
	id: "4db1545afd5f327e9629c1728595b7823f58097fb6421c223a099179d739f52b",
	name: "listAutomationRuns",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => listAutomationRuns.__executeServer(opts));
var listAutomationRuns = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ automationId: uuid.optional() }).parse(i ?? {})).handler(listAutomationRuns_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("ocade_automation_runs").select("id, automation_id, status, attempt, dry_run, highest_risk, blocked_reason, error, approval_decision, approval_expires_at, cancel_requested_at, pause_requested_at, deadline_at, created_at, finished_at, plan").eq("user_id", context.userId);
	if (data.automationId) q = q.eq("automation_id", data.automationId);
	const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(100);
	if (error) throw new Response(error.message, { status: 500 });
	return rows ?? [];
});
var decideAutomationRun_createServerFn_handler = createServerRpc({
	id: "ac3a931faf150583f38972c8907abcfc44bd699c6df19e72f8f71b17767d4dee",
	name: "decideAutomationRun",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => decideAutomationRun.__executeServer(opts));
var decideAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	runId: uuid,
	decision: enumType(["approved", "denied"]),
	deviceId: uuid.optional()
}).parse(i)).handler(decideAutomationRun_createServerFn_handler, async ({ data, context }) => {
	const { data: run } = await context.supabase.from("ocade_automation_runs").select("id, status").eq("id", data.runId).eq("user_id", context.userId).maybeSingle();
	if (!run) throw new Response("Run not found", { status: 404 });
	const { status: next, reason } = applyApproval(run.status, data.decision);
	const { data: persisted, error } = await context.supabase.rpc("ocade_decide_automation_run", {
		p_run_id: data.runId,
		p_decision: data.decision,
		p_device_id: data.deviceId ?? void 0
	});
	if (error) throw new Response(error.message, { status: 500 });
	if (persisted === "approval_expired") throw new Response("The approval request expired before it was answered.", { status: 410 });
	if (persisted !== next) throw new Response("This run is no longer awaiting approval.", { status: 409 });
	return {
		status: next,
		reason
	};
});
var cancelAutomationRun_createServerFn_handler = createServerRpc({
	id: "ce556b6d003a1334990df87d6fb12e1c7cad96b1507ee410be10777df20c82cc",
	name: "cancelAutomationRun",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => cancelAutomationRun.__executeServer(opts));
var cancelAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(cancelAutomationRun_createServerFn_handler, async ({ data, context }) => {
	const { data: run } = await context.supabase.from("ocade_automation_runs").select("id, status").eq("id", data.runId).eq("user_id", context.userId).maybeSingle();
	if (!run) throw new Response("Run not found", { status: 404 });
	if (!canCancel(run.status)) throw new Response("This run has already finished and can't be cancelled.", { status: 409 });
	const { data: status, error } = await context.supabase.rpc("ocade_request_automation_cancel", { p_run_id: data.runId });
	if (error) throw new Response(error.message, { status: 500 });
	if (status !== "cancelled" && status !== "cancellation_requested") throw new Response("This run is no longer cancellable.", { status: 409 });
	return { status };
});
var pauseAutomationRun_createServerFn_handler = createServerRpc({
	id: "573a16232c0c15e1bc1b65c4bdc778bc6fbdd692104be4d0cae547c2e2a64516",
	name: "pauseAutomationRun",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => pauseAutomationRun.__executeServer(opts));
var pauseAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(pauseAutomationRun_createServerFn_handler, async ({ data, context }) => {
	const { data: run } = await context.supabase.from("ocade_automation_runs").select("id, status").eq("id", data.runId).eq("user_id", context.userId).maybeSingle();
	if (!run) throw new Response("Run not found", { status: 404 });
	if (!canPause(run.status)) throw new Response("This run is not currently pausable.", { status: 409 });
	const { data: status, error } = await context.supabase.rpc("ocade_request_automation_pause", { p_run_id: data.runId });
	if (error) throw new Response(error.message, { status: 500 });
	if (status !== "paused" && status !== "pause_requested") throw new Response("This run is no longer pausable.", { status: 409 });
	return { status };
});
var resumeAutomationRun_createServerFn_handler = createServerRpc({
	id: "f0bf6248a4fea76134f7dcb302c326522f29eebfb335b34e8d999d5d08101f13",
	name: "resumeAutomationRun",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => resumeAutomationRun.__executeServer(opts));
var resumeAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(resumeAutomationRun_createServerFn_handler, async ({ data, context }) => {
	const { data: run } = await context.supabase.from("ocade_automation_runs").select("id, status").eq("id", data.runId).eq("user_id", context.userId).maybeSingle();
	if (!run) throw new Response("Run not found", { status: 404 });
	if (!canResume(run.status)) throw new Response("Only a paused run can be resumed.", { status: 409 });
	const { data: status, error } = await context.supabase.rpc("ocade_resume_automation_run", { p_run_id: data.runId });
	if (error) throw new Response(error.message, { status: 500 });
	if (status !== "pending" && status !== "awaiting_approval") throw new Response("This run is no longer resumable.", { status: 409 });
	return { status };
});
var cancelAllRuns_createServerFn_handler = createServerRpc({
	id: "68ddfed8c81fadd90c0e901ad4879810e2b531d5936712753b70988f75b831c9",
	name: "cancelAllRuns",
	filename: "src/lib/ocade-automations.functions.ts"
}, (opts) => cancelAllRuns.__executeServer(opts));
var cancelAllRuns = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(cancelAllRuns_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.rpc("ocade_cancel_all_automation_runs");
	if (error) throw new Response(error.message, { status: 500 });
	const counts = data && typeof data === "object" && !Array.isArray(data) ? data : {};
	return {
		cancelled: Number(counts.cancelled ?? 0),
		cancellationRequested: Number(counts.cancellation_requested ?? 0)
	};
});
//#endregion
export { cancelAllRuns_createServerFn_handler, cancelAutomationRun_createServerFn_handler, createAutomation_createServerFn_handler, decideAutomationRun_createServerFn_handler, deleteAutomation_createServerFn_handler, listAutomationRuns_createServerFn_handler, listAutomations_createServerFn_handler, pauseAutomationRun_createServerFn_handler, previewAutomation_createServerFn_handler, resumeAutomationRun_createServerFn_handler, startAutomationRun_createServerFn_handler, updateAutomation_createServerFn_handler };
