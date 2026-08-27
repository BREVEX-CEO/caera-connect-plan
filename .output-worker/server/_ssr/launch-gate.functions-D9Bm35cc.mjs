import { c as stringType, n as booleanType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/launch-gate.functions-D9Bm35cc.js
/**
* Fail-closed policy for internal-alpha and controlled-beta expansion.
*
* The database stores reviewable launch-gate rows. This module is the shared
* decision owner used by the server mutation before a feature flag can expand.
* A local test receipt is never promoted to live cohort evidence: operators
* must attach an independently reviewable evidence URL to every required gate.
*/
var ROLLOUT_STAGES = [
	"demo",
	"private_alpha",
	"beta",
	"ga"
];
var ALPHA_ENTRY_GATE_KEYS = [
	"privacy_policy",
	"provider_disclosure",
	"secret_management",
	"incident_response"
];
var ALPHA_EXIT_GATE_KEYS = [
	"alpha_cohort",
	"alpha_task_library",
	"alpha_endurance_recovery",
	"alpha_performance",
	"alpha_usability",
	"alpha_security_review",
	"alpha_exit_review"
];
var BETA_EXIT_GATE_KEYS = [
	"beta_enrolment",
	"beta_telemetry_consent",
	"beta_coverage_limits",
	"beta_exit_review"
];
var CONTROLLED_ROLLOUT_GATE_KEYS = [...ALPHA_EXIT_GATE_KEYS, ...BETA_EXIT_GATE_KEYS];
var stageIndex = (stage) => ROLLOUT_STAGES.indexOf(stage);
function hasCoverageToken(modules, prefix) {
	return modules.some((module) => module.toLowerCase().startsWith(prefix) && module.length > prefix.length);
}
function gateApplies(gate, modules) {
	if (gate.applicable_modules.length === 0 || modules.length === 0) return true;
	const selected = new Set(modules.map((module) => module.toLowerCase()));
	return gate.applicable_modules.some((module) => selected.has(module.toLowerCase()));
}
function requiredGateKeys(stage, gates, modules) {
	if (stage === "demo") return [];
	if (stage === "private_alpha") return [...ALPHA_ENTRY_GATE_KEYS];
	if (stage === "beta") return [...ALPHA_ENTRY_GATE_KEYS, ...ALPHA_EXIT_GATE_KEYS];
	const applicableBlockers = gates.filter((gate) => gate.blocker && gateApplies(gate, modules)).map((gate) => gate.key);
	return [.../* @__PURE__ */ new Set([
		...ALPHA_ENTRY_GATE_KEYS,
		...ALPHA_EXIT_GATE_KEYS,
		...BETA_EXIT_GATE_KEYS,
		...applicableBlockers
	])];
}
function validateGate(gateKey, gates) {
	const gate = gates.find((candidate) => candidate.key === gateKey);
	if (!gate) return [{
		code: "gate_missing",
		gateKey,
		message: `Required rollout gate "${gateKey}" is not installed.`
	}];
	if (gate.status !== "complete") return [{
		code: "gate_incomplete",
		gateKey,
		message: `Required rollout gate "${gateKey}" is ${gate.status}; a waiver is not controlled-rollout evidence.`
	}];
	if (!gate.evidence_url) return [{
		code: "gate_evidence_missing",
		gateKey,
		message: `Required rollout gate "${gateKey}" has no independently reviewable evidence URL.`
	}];
	if (!gate.owner || !gate.reviewer || gate.owner.trim().toLowerCase() === gate.reviewer.trim().toLowerCase()) return [{
		code: "gate_review_conflict",
		gateKey,
		message: `Required rollout gate "${gateKey}" needs distinct owner and reviewer identities.`
	}];
	return [];
}
function evaluateRolloutAdvance(input) {
	const fromStage = input.fromStage ?? "demo";
	const refusals = [];
	const advancement = stageIndex(input.toStage) - stageIndex(fromStage);
	if (advancement < 0) return {
		allowed: true,
		fromStage,
		toStage: input.toStage,
		checkedGateKeys: []
	};
	if (advancement > 1) refusals.push({
		code: "stage_skip",
		message: `Rollout cannot skip from ${fromStage} to ${input.toStage}.`
	});
	if (input.enabled && input.toStage !== "demo") {
		if (!hasCoverageToken(input.applicableModules, "capability:") || !hasCoverageToken(input.applicableModules, "platform:")) refusals.push({
			code: "coverage_missing",
			message: "Enabled rollout requires at least one capability:* and one platform:* coverage limit."
		});
	}
	const checkedGateKeys = input.enabled && input.toStage !== "demo" ? requiredGateKeys(input.toStage, input.gates, input.applicableModules) : [];
	for (const gateKey of checkedGateKeys) refusals.push(...validateGate(gateKey, input.gates));
	if (refusals.length > 0) return {
		allowed: false,
		fromStage,
		toStage: input.toStage,
		checkedGateKeys,
		refusals
	};
	return {
		allowed: true,
		fromStage,
		toStage: input.toStage,
		checkedGateKeys
	};
}
function validateControlledGateAttestation(gate) {
	if (!CONTROLLED_ROLLOUT_GATE_KEYS.includes(gate.key)) return [];
	if (gate.status === "waived") return ["Controlled-rollout evidence gates cannot be waived."];
	if (gate.status !== "complete") return [];
	const issues = [];
	if (!gate.evidence_url) issues.push("Completion requires an independently reviewable evidence URL.");
	if (!gate.owner || !gate.reviewer) issues.push("Completion requires both an owner and a reviewer.");
	else if (gate.owner.trim().toLowerCase() === gate.reviewer.trim().toLowerCase()) issues.push("The owner and reviewer must be different people.");
	return issues;
}
/**
* Admin Launch Gate — server-side writers.
*
* All mutations go through here so we can:
*   - Verify caller is admin (never trust client claims).
*   - Append an immutable history row per status change.
*   - Write a compliance audit record for every change.
*/
var STATUS = [
	"not_started",
	"in_progress",
	"pending_review",
	"evidence_required",
	"complete",
	"waived"
];
var STAGE = [
	"demo",
	"private_alpha",
	"beta",
	"ga"
];
var updateItemInput = objectType({
	id: stringType().uuid(),
	status: enumType(STATUS).optional(),
	owner: stringType().max(200).nullable().optional(),
	reviewer: stringType().max(200).nullable().optional(),
	evidence_url: stringType().url().max(500).nullable().optional(),
	applicable_modules: arrayType(stringType().max(64)).max(20).optional(),
	due_date: stringType().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
	blocker: booleanType().optional(),
	notes: stringType().max(2e3).nullable().optional(),
	history_note: stringType().max(500).optional()
});
async function assertAdmin(supabase, userId) {
	const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
	if (error || !data) throw new Response("Forbidden: admin role required", { status: 403 });
}
var updateLaunchGateItem_createServerFn_handler = createServerRpc({
	id: "5a3c4a7e00ac6cead90838a2cf13fb371d2a9004e2591d1a0c077569f1991035",
	name: "updateLaunchGateItem",
	filename: "src/lib/launch-gate.functions.ts"
}, (opts) => updateLaunchGateItem.__executeServer(opts));
var updateLaunchGateItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => updateItemInput.parse(input)).handler(updateLaunchGateItem_createServerFn_handler, async ({ data, context }) => {
	await assertAdmin(context.supabase, context.userId);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.mjs");
	const { data: existing, error: readErr } = await supabaseAdmin.from("launch_gate_items").select("*").eq("id", data.id).maybeSingle();
	if (readErr || !existing) throw new Response("Launch gate item not found", { status: 404 });
	const attestationIssues = validateControlledGateAttestation({
		key: existing.key,
		status: data.status ?? existing.status,
		owner: data.owner !== void 0 ? data.owner : existing.owner,
		reviewer: data.reviewer !== void 0 ? data.reviewer : existing.reviewer,
		evidence_url: data.evidence_url !== void 0 ? data.evidence_url : existing.evidence_url
	});
	if (attestationIssues.length > 0) {
		await supabaseAdmin.from("compliance_audit_log").insert({
			user_id: context.userId,
			tenant_id: null,
			action: "admin.launch_gate.refused",
			feature_id: "admin.launch_gate",
			category: "approval",
			preview: {
				item_id: data.id,
				key: existing.key,
				to_status: data.status ?? existing.status,
				refusal_reasons: attestationIssues
			}
		});
		return {
			ok: false,
			message: attestationIssues.join(" ")
		};
	}
	const patch = { updated_by: context.userId };
	if (data.status !== void 0) patch.status = data.status;
	if (data.owner !== void 0) patch.owner = data.owner;
	if (data.reviewer !== void 0) patch.reviewer = data.reviewer;
	if (data.evidence_url !== void 0) patch.evidence_url = data.evidence_url;
	if (data.applicable_modules !== void 0) patch.applicable_modules = data.applicable_modules;
	if (data.due_date !== void 0) patch.due_date = data.due_date;
	if (data.blocker !== void 0) patch.blocker = data.blocker;
	if (data.notes !== void 0) patch.notes = data.notes;
	const { error: updErr } = await supabaseAdmin.from("launch_gate_items").update(patch).eq("id", data.id);
	if (updErr) throw new Response(`Update failed: ${updErr.message}`, { status: 500 });
	if (data.status !== void 0 && data.status !== existing.status) await supabaseAdmin.from("launch_gate_history").insert({
		item_id: data.id,
		from_status: existing.status,
		to_status: data.status,
		evidence_url: data.evidence_url ?? existing.evidence_url ?? null,
		note: data.history_note ?? null,
		changed_by: context.userId
	});
	await supabaseAdmin.from("compliance_audit_log").insert({
		user_id: context.userId,
		tenant_id: null,
		action: "admin.launch_gate.update",
		feature_id: "admin.launch_gate",
		category: "approval",
		preview: {
			item_id: data.id,
			key: existing.key,
			from_status: existing.status,
			to_status: data.status ?? existing.status,
			changed_fields: Object.keys(patch).filter((k) => k !== "updated_by")
		}
	});
	return { ok: true };
});
var updateFlagInput = objectType({
	id: stringType().min(1).max(200),
	description: stringType().max(500).nullable().optional(),
	enabled: booleanType().optional(),
	stage: enumType(STAGE).optional(),
	applicable_modules: arrayType(stringType().max(64)).max(20).optional()
});
var upsertFeatureFlag_createServerFn_handler = createServerRpc({
	id: "d2d824d5f2f877301cf762118da8003984ac8c20ae87ad1b8d9db48aa5cc8289",
	name: "upsertFeatureFlag",
	filename: "src/lib/launch-gate.functions.ts"
}, (opts) => upsertFeatureFlag.__executeServer(opts));
var upsertFeatureFlag = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => updateFlagInput.parse(input)).handler(upsertFeatureFlag_createServerFn_handler, async ({ data, context }) => {
	await assertAdmin(context.supabase, context.userId);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.mjs");
	const { data: existing, error: existingError } = await supabaseAdmin.from("feature_flags").select("*").eq("id", data.id).maybeSingle();
	if (existingError) return {
		ok: false,
		message: `Feature flag state could not be verified: ${existingError.message}`
	};
	const row = {
		id: data.id,
		updated_by: context.userId
	};
	row.enabled = data.enabled ?? existing?.enabled ?? false;
	row.stage = data.stage ?? existing?.stage ?? "demo";
	row.applicable_modules = data.applicable_modules ?? existing?.applicable_modules ?? [];
	row.description = data.description ?? existing?.description ?? null;
	const { data: gateRows, error: gatesError } = await supabaseAdmin.from("launch_gate_items").select("key,status,blocker,owner,reviewer,evidence_url,applicable_modules");
	if (gatesError) return {
		ok: false,
		message: `Rollout gates could not be verified: ${gatesError.message}`
	};
	const decision = evaluateRolloutAdvance({
		fromStage: existing?.stage ?? null,
		toStage: row.stage,
		enabled: row.enabled,
		applicableModules: row.applicable_modules,
		gates: gateRows ?? []
	});
	if (!decision.allowed) {
		await supabaseAdmin.from("compliance_audit_log").insert({
			user_id: context.userId,
			tenant_id: null,
			action: "admin.feature_flag.refused",
			feature_id: "admin.launch_gate",
			category: "approval",
			preview: {
				flag_id: data.id,
				from_stage: decision.fromStage,
				to_stage: decision.toStage,
				refusal_codes: decision.refusals.map((refusal) => refusal.code),
				gate_keys: decision.checkedGateKeys
			}
		});
		return {
			ok: false,
			message: decision.refusals.map((refusal) => refusal.message).join(" ")
		};
	}
	const { error } = await supabaseAdmin.from("feature_flags").upsert(row);
	if (error) return {
		ok: false,
		message: error.message
	};
	await supabaseAdmin.from("compliance_audit_log").insert({
		user_id: context.userId,
		tenant_id: null,
		action: "admin.feature_flag.upsert",
		feature_id: "admin.launch_gate",
		category: "approval",
		preview: {
			flag_id: data.id,
			from_stage: existing?.stage ?? null,
			to_stage: row.stage,
			from_enabled: existing?.enabled ?? null,
			to_enabled: row.enabled,
			applicable_modules: row.applicable_modules
		}
	});
	return { ok: true };
});
//#endregion
export { updateLaunchGateItem_createServerFn_handler, upsertFeatureFlag_createServerFn_handler };
