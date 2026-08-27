import { n as supabase } from "./client-YIOAnk22.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/actions-CaB-ibgo.js
var registry$1 = /* @__PURE__ */ new Map();
function registerFeature(f) {
	if (f.status !== "active" && f.status !== "beta" && !f.reason) throw new Error(`[FeatureRegistry] ${f.id} has status "${f.status}" but no reason. Every non-active feature must explain why.`);
	registry$1.set(f.id, f);
}
function getFeature(id) {
	return registry$1.get(id);
}
function listFeatures(module) {
	const all = Array.from(registry$1.values());
	return module ? all.filter((f) => f.module === module) : all;
}
for (const f of [
	{
		id: "auth.sign_in",
		module: "core",
		title: "Sign in",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "auth.sign_out",
		module: "core",
		title: "Sign out",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "onboarding.wizard",
		module: "core",
		title: "Onboarding",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "home.dashboard",
		module: "core",
		title: "Home",
		status: "active",
		platforms: ["web"],
		viewOnly: true
	},
	{
		id: "settings.activity",
		module: "core",
		title: "Activity centre",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "demo.mode",
		module: "core",
		title: "Demo mode",
		status: "active",
		platforms: ["web"],
		viewOnly: true
	},
	{
		id: "settings.privacy",
		module: "core",
		title: "Privacy settings",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "settings.devices",
		module: "core",
		title: "Devices",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "settings.appearance",
		module: "core",
		title: "Appearance",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "settings.security",
		module: "core",
		title: "Security",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "settings.vault",
		module: "core",
		title: "Browser Vault",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "admin.launch_gate",
		module: "admin",
		title: "Launch Gate",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "admin.country_packs",
		module: "admin",
		title: "Country Packs",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "ocade.chat",
		module: "ocade",
		title: "OCADE chat",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "ocade.models",
		module: "ocade",
		title: "Model connections",
		status: "active",
		platforms: ["web"]
	},
	{
		id: "ocade.copilot",
		module: "ocade",
		title: "Computer Copilot",
		status: "planned",
		platforms: ["windows", "macos"],
		reason: "Requires the Native Companion (Cursor / Tauri build)."
	},
	{
		id: "ficia.placeholder",
		module: "ficia",
		title: "FICIA",
		status: "planned",
		platforms: ["web"],
		reason: "Coming later — not an AI model.",
		viewOnly: true
	},
	{
		id: "madee.placeholder",
		module: "madee",
		title: "MADEE",
		status: "planned",
		platforms: ["web"],
		reason: "Coming later — not an AI model.",
		viewOnly: true
	},
	{
		id: "cania.placeholder",
		module: "cania",
		title: "CANIA",
		status: "planned",
		platforms: ["web"],
		reason: "Coming later — not an AI model.",
		viewOnly: true
	}
]) registerFeature(f);
/**
* ActionRegistry — every triggerable app action must have an entry.
*
* Hardened in Prompt 5:
* - Actions declare confirmation strength, timeout, preview, log target.
* - executeAction() enforces confirmation + timeout and records success/failure.
* - validateRegistry() fails when a non-viewOnly active feature has no action.
*/
var registry = /* @__PURE__ */ new Map();
function registerAction(a) {
	if (a.log === "compliance" && !a.category) throw new Error(`[ActionRegistry] ${a.id} logs to compliance but has no category.`);
	if (a.confirmation === "strong" && !a.confirmPhrase) throw new Error(`[ActionRegistry] ${a.id} requires strong confirmation but has no confirmPhrase.`);
	registry.set(a.id, a);
}
function getAction(id) {
	return registry.get(id);
}
for (const a of [
	{
		id: "auth.sign_in",
		featureId: "auth.sign_in",
		title: "Sign in",
		log: "operational"
	},
	{
		id: "auth.sign_out",
		featureId: "auth.sign_out",
		title: "Sign out",
		log: "operational"
	},
	{
		id: "account.delete",
		featureId: "auth.sign_out",
		title: "Delete account and all account data",
		log: "compliance",
		category: "deletion",
		confirmation: "strong",
		confirmPhrase: "DELETE MY ACCOUNT"
	},
	{
		id: "onboarding.complete",
		featureId: "onboarding.wizard",
		title: "Complete onboarding",
		log: "operational"
	},
	{
		id: "settings.theme.change",
		featureId: "settings.appearance",
		title: "Change theme",
		log: "operational"
	},
	{
		id: "settings.appearance.change",
		featureId: "settings.appearance",
		title: "Change appearance",
		log: "operational",
		description: "Theme, cursor, motion or performance preference update."
	},
	{
		id: "settings.profile.update",
		featureId: "settings.appearance",
		title: "Update profile",
		log: "operational",
		description: "General profile fields (name, preferred name, occupation, personal OCADE instructions, language, timezone)."
	},
	{
		id: "settings.privacy.change",
		featureId: "settings.privacy",
		title: "Change privacy mode",
		log: "operational",
		description: "Per-data-class privacy toggle. Not a regulated change."
	},
	{
		id: "devices.register",
		featureId: "settings.devices",
		title: "Register device",
		log: "operational"
	},
	{
		id: "devices.revoke",
		featureId: "settings.devices",
		title: "Revoke device",
		log: "compliance",
		category: "role_change",
		description: "Revoking a device removes an approved access surface for the account.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "revoke"
	},
	{
		id: "vault.setup",
		featureId: "settings.vault",
		title: "Set up Browser Vault",
		log: "operational",
		description: "Creates an AES-GCM data key wrapped by a passphrase or WebAuthn PRF."
	},
	{
		id: "vault.unlock",
		featureId: "settings.vault",
		title: "Unlock Browser Vault",
		log: "operational"
	},
	{
		id: "vault.lock",
		featureId: "settings.vault",
		title: "Lock Browser Vault",
		log: "operational"
	},
	{
		id: "vault.rotate",
		featureId: "settings.vault",
		title: "Rotate vault credential",
		log: "compliance",
		category: "role_change",
		description: "Re-wraps the data key with a fresh credential.",
		requiresPreview: true,
		confirmation: "confirm"
	},
	{
		id: "vault.recovery_used",
		featureId: "settings.vault",
		title: "Recovered vault with recovery kit",
		log: "compliance",
		category: "role_change",
		description: "One-time recovery kit was used to unlock the browser vault."
	},
	{
		id: "activity.clear_operational",
		featureId: "settings.activity",
		title: "Clear old operational activity",
		log: "operational",
		description: "Deletes the user's own activity_log rows older than 30 days.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "clear"
	},
	{
		id: "admin.launch_gate.update",
		featureId: "admin.launch_gate",
		title: "Update launch-gate item",
		log: "compliance",
		category: "approval",
		description: "Admin changed status, evidence, owner or blocker flag on a launch-gate item.",
		requiresPreview: true,
		confirmation: "confirm"
	},
	{
		id: "admin.feature_flag.upsert",
		featureId: "admin.launch_gate",
		title: "Update feature flag stage",
		log: "compliance",
		category: "approval",
		description: "Admin changed a feature flag's stage, coverage or enabled state. Private-alpha, beta and GA expansion is refused until its required evidence gates pass.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "activate"
	},
	{
		id: "admin.country_pack.update_version",
		featureId: "admin.country_packs",
		title: "Update country-pack version",
		log: "compliance",
		category: "approval",
		description: "Admin edited rules, effective dates, applicability or pilot evidence on a country-pack version.",
		requiresPreview: true,
		confirmation: "confirm"
	},
	{
		id: "admin.country_pack.add_source",
		featureId: "admin.country_packs",
		title: "Add rule source reference",
		log: "compliance",
		category: "approval",
		description: "Admin attached a statute / notification / circular citation to a rule."
	},
	{
		id: "admin.country_pack.add_review",
		featureId: "admin.country_packs",
		title: "Submit professional pack review",
		log: "compliance",
		category: "approval",
		description: "Licensed reviewer signed off (or requested changes) on a country-pack version.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "sign"
	},
	{
		id: "admin.country_pack.run_tests",
		featureId: "admin.country_packs",
		title: "Run historical test harness",
		log: "operational",
		description: "Runs every historical test case for a country-pack version against its pinned rules."
	},
	{
		id: "admin.country_pack.promote",
		featureId: "admin.country_packs",
		title: "Promote country-pack version",
		log: "compliance",
		category: "approval",
		description: "Advances a country-pack version stage. GA is blocked by DB trigger without approved review, pilot evidence and passing tests.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "promote"
	},
	{
		id: "ocade.chat.send",
		featureId: "ocade.chat",
		title: "Send OCADE message",
		log: "operational"
	},
	{
		id: "ocade.chat.regenerate",
		featureId: "ocade.chat",
		title: "Regenerate OCADE response",
		log: "operational"
	},
	{
		id: "ocade.chat.stop",
		featureId: "ocade.chat",
		title: "Stop OCADE response",
		log: "operational"
	},
	{
		id: "ocade.chat.improve_prompt",
		featureId: "ocade.chat",
		title: "Improve prompt",
		log: "operational"
	},
	{
		id: "ocade.conversation.new",
		featureId: "ocade.chat",
		title: "New OCADE conversation",
		log: "operational"
	},
	{
		id: "ocade.conversation.rename",
		featureId: "ocade.chat",
		title: "Rename OCADE conversation",
		log: "operational"
	},
	{
		id: "ocade.conversation.pin",
		featureId: "ocade.chat",
		title: "Pin OCADE conversation",
		log: "operational"
	},
	{
		id: "ocade.conversation.archive",
		featureId: "ocade.chat",
		title: "Archive OCADE conversation",
		log: "operational"
	},
	{
		id: "ocade.conversation.export",
		featureId: "ocade.chat",
		title: "Export OCADE conversation",
		log: "operational"
	},
	{
		id: "ocade.conversation.delete",
		featureId: "ocade.chat",
		title: "Delete OCADE conversation",
		log: "operational",
		description: "Permanently removes a conversation and its messages.",
		requiresPreview: true,
		confirmation: "strong",
		confirmPhrase: "delete"
	},
	{
		id: "ocade.model.change",
		featureId: "ocade.models",
		title: "Change OCADE model",
		log: "operational"
	},
	{
		id: "ocade.providers.save_prefs",
		featureId: "ocade.models",
		title: "Save OCADE provider preferences",
		log: "operational"
	},
	{
		id: "ocade.providers.test_connection",
		featureId: "ocade.models",
		title: "Test OCADE provider connection",
		log: "operational"
	},
	{
		id: "ocade.providers.set_bridge_url",
		featureId: "ocade.models",
		title: "Set Ollama local bridge URL",
		log: "operational"
	},
	{
		id: "ocade.providers.enable_openai_direct",
		featureId: "ocade.models",
		title: "Enable OpenAI Direct",
		log: "operational"
	},
	{
		id: "devices.rename",
		featureId: "settings.devices",
		title: "Rename device",
		log: "operational",
		description: "Label change only. Does not alter what the device may do."
	},
	{
		id: "security.password_change",
		featureId: "settings.security",
		title: "Change password",
		log: "compliance",
		category: "role_change",
		description: "Adds or replaces the password credential for this account."
	},
	{
		id: "security.sign_out_all",
		featureId: "settings.security",
		title: "Sign out of all devices",
		log: "compliance",
		category: "role_change",
		description: "Revokes every active session for this account, including the current one.",
		confirmation: "confirm"
	}
]) registerAction(a);
/** Record an action against the correct log. Never throws to callers. */
async function recordAction({ actionId, metadata, tenantId }) {
	const a = registry.get(actionId);
	if (!a) {
		console.warn(`[ActionRegistry] unknown action id: ${actionId}`);
		return;
	}
	const { data: userData } = await supabase.auth.getUser();
	const uid = userData.user?.id;
	if (!uid) return;
	try {
		const meta = metadata ?? {};
		if (a.log === "operational") await supabase.from("activity_log").insert({
			user_id: uid,
			tenant_id: tenantId ?? null,
			action: a.id,
			feature_id: a.featureId,
			metadata: meta
		});
		else {
			const { writeComplianceLog } = await import("./compliance-log.functions-C8ow6n8X.mjs");
			await writeComplianceLog({ data: {
				action: a.id,
				featureId: a.featureId,
				category: a.category ?? "other",
				tenantId: tenantId ?? null,
				preview: metadata ?? {}
			} });
		}
	} catch (e) {
		console.error("[ActionRegistry] record failed", a.id, e);
	}
}
var ActionConfirmationError = class extends Error {
	constructor(msg) {
		super(msg);
		this.name = "ActionConfirmationError";
	}
};
/**
* Runs an action handler with timeout + confirmation enforcement and
* records success/failure to the appropriate log.
*/
async function executeAction(actionId, opts) {
	const a = registry.get(actionId);
	if (!a) throw new Error(`[ActionRegistry] unknown action id: ${actionId}`);
	const level = a.confirmation ?? "none";
	if (level !== "none" && !opts.confirmed) throw new ActionConfirmationError(`Action "${a.id}" requires confirmation.`);
	if (level === "strong" && a.confirmPhrase && opts.confirmPhrase !== a.confirmPhrase) throw new ActionConfirmationError(`Action "${a.id}" requires typing the phrase "${a.confirmPhrase}" exactly.`);
	const timeoutMs = a.timeoutMs ?? 3e4;
	let timer;
	try {
		const value = await Promise.race([opts.run(), new Promise((_res, rej) => {
			timer = setTimeout(() => rej(/* @__PURE__ */ new Error(`Action "${a.id}" timed out after ${timeoutMs}ms.`)), timeoutMs);
		})]);
		recordAction({
			actionId,
			metadata: {
				...opts.metadata ?? {},
				result: "success"
			},
			tenantId: opts.tenantId
		});
		return value;
	} catch (e) {
		recordAction({
			actionId,
			metadata: {
				...opts.metadata ?? {},
				result: "failure",
				error: e instanceof Error ? e.message : String(e)
			},
			tenantId: opts.tenantId
		});
		throw e;
	} finally {
		if (timer) clearTimeout(timer);
	}
}
/**
* Ensures the ActionRegistry and FeatureRegistry stay in sync.
* - Every Action must reference a registered Feature.
* - Every active/beta Feature (unless viewOnly) must have at least one Action.
* Returns an empty array on success; the caller may throw on issues.
*/
function validateRegistry() {
	const issues = [];
	for (const a of registry.values()) {
		if (!getFeature(a.featureId)) issues.push({
			kind: "action_missing_feature",
			id: a.id,
			message: `Action "${a.id}" references unknown feature "${a.featureId}".`
		});
		if (a.log === "compliance" && !a.category) issues.push({
			kind: "compliance_no_category",
			id: a.id,
			message: `Action "${a.id}" logs to compliance without a category.`
		});
	}
	const actionsByFeature = /* @__PURE__ */ new Map();
	for (const a of registry.values()) actionsByFeature.set(a.featureId, (actionsByFeature.get(a.featureId) ?? 0) + 1);
	for (const f of listFeatures()) {
		if (f.viewOnly) continue;
		if (f.status !== "active" && f.status !== "beta") continue;
		if ((actionsByFeature.get(f.id) ?? 0) === 0) issues.push({
			kind: "feature_missing_action",
			id: f.id,
			message: `Feature "${f.id}" is ${f.status} but has no registered actions.`
		});
	}
	return issues;
}
try {
	const issues = validateRegistry();
	if (issues.length > 0) {
		const msg = issues.map((i) => `  - ${i.message}`).join("\n");
		console.error(`[Registry] ${issues.length} issue(s):\n${msg}`);
	}
} catch (e) {}
//#endregion
export { recordAction as i, executeAction as n, getAction as r, ActionConfirmationError as t };
