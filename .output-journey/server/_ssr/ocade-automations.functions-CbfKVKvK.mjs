import { a as numberType, c as stringType, i as literalType, l as unionType, n as booleanType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CySYIv4d.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-automations.functions-CbfKVKvK.js
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
var listAutomations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("d95b673cfc0252d9a6f6fef2fe4b2fe6d5387de6561ef081fecf6767bc71290f"));
var createAutomation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	name: stringType().trim().min(1).max(200),
	trigger: triggerSchema.default({ kind: "manual" }),
	actions: arrayType(actionSchema).max(50).default([]),
	requiresApproval: booleanType().default(true),
	dryRun: booleanType().default(false),
	maxAttempts: numberType().int().min(1).max(10).default(3)
}).parse(i)).handler(createSsrRpc("6298a6776825c44f6c02e958701cf4ccb6b857b9656f80da07356e4daf9785de"));
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
}).parse(i)).handler(createSsrRpc("cc5dae6cc8af16d10116e614b16bb61eb5eb0aa39c9a3cf2e85797b2fbe2d501"));
var deleteAutomation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(createSsrRpc("c62a2a67fc3829362eb581a6dd7287f5ff7a6da515dfa2fcf570321f196faf96"));
/**
* Compute the plan WITHOUT persisting anything — the dry-run/permission preview
* the user sees before approving.
*/
var previewAutomation = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(createSsrRpc("9421b1f2ee9725c3de85707b687ff6bcfcfa5bab41bd6b3b1d96a310835bfdba"));
/** Start a run. Blocked plans are recorded as blocked and never execute. */
var startAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	id: uuid,
	dryRun: booleanType().optional(),
	deadlineAt: stringType().datetime().optional()
}).parse(i)).handler(createSsrRpc("08fcd7c3ba8a6c5bf93386ddf6b072da3ff2bd95af6d6e8d8610df716d87179c"));
var listAutomationRuns = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ automationId: uuid.optional() }).parse(i ?? {})).handler(createSsrRpc("4db1545afd5f327e9629c1728595b7823f58097fb6421c223a099179d739f52b"));
/** Approve or deny a run awaiting a human decision. */
var decideAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	runId: uuid,
	decision: enumType(["approved", "denied"]),
	deviceId: uuid.optional()
}).parse(i)).handler(createSsrRpc("ac3a931faf150583f38972c8907abcfc44bd699c6df19e72f8f71b17767d4dee"));
/** Cancel a run. Terminal runs are rejected by the engine's canCancel guard. */
var cancelAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(createSsrRpc("ce556b6d003a1334990df87d6fb12e1c7cad96b1507ee410be10777df20c82cc"));
var pauseAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(createSsrRpc("573a16232c0c15e1bc1b65c4bdc778bc6fbdd692104be4d0cae547c2e2a64516"));
var resumeAutomationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ runId: uuid }).parse(i)).handler(createSsrRpc("f0bf6248a4fea76134f7dcb302c326522f29eebfb335b34e8d999d5d08101f13"));
/** Emergency stop: cancel every non-terminal run for this user at once. */
var cancelAllRuns = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("68ddfed8c81fadd90c0e901ad4879810e2b531d5936712753b70988f75b831c9"));
//#endregion
export { deleteAutomation as a, pauseAutomationRun as c, startAutomationRun as d, updateAutomation as f, decideAutomationRun as i, previewAutomation as l, cancelAutomationRun as n, listAutomationRuns as o, createAutomation as r, listAutomations as s, cancelAllRuns as t, resumeAutomationRun as u };
