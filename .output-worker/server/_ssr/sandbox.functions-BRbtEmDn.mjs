import { a as numberType, c as stringType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as runGeneratedSandbox } from "./generated-sandbox-Baqi4BRc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sandbox.functions-BRbtEmDn.js
/**
* Generated-code sandbox server function (P21 production wiring).
*
* `createNodePermissionSandboxHost` is the only real isolation boundary in the
* repository — a spawned Node process with the permission model, bounded
* resources and declared outputs. It was imported by nothing but tests, so the
* only host production could reach was the unavailable one, and
* `runGeneratedSandbox` refused every request.
*
* It has to be a server function. The host statically imports
* `node:child_process`, `node:fs/promises` and `node:os`; a client-reachable
* import would either break the browser bundle or, worse, pull Node builtins
* into it. The `await import()` inside the handler guarantees the module is
* only ever resolved on the server.
*
* Executing model-written code is the single most dangerous capability here,
* so the handler adds constraints of its own on top of the sandbox's:
* authentication is required, network access is never granted from this
* entry point, and the limits are capped server-side regardless of what the
* caller asks for.
*/
/**
* Ceilings the caller cannot raise.
*
* A client-supplied limit is a request, not an instruction. Letting a caller
* name its own timeout or memory ceiling would make the limits decorative.
*/
var MAX_TIMEOUT_MS = 15e3;
var MAX_MEMORY_MB = 256;
var MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
var sandboxInput = objectType({
	taskId: stringType().min(1).max(200),
	language: enumType(["javascript", "python"]),
	script: stringType().min(1).max(1e5),
	inputs: arrayType(objectType({
		path: stringType().max(200),
		content: stringType().max(1e6)
	})).max(20).default([]),
	outputs: arrayType(objectType({
		path: stringType().max(200),
		mediaType: stringType().max(100).default("application/octet-stream"),
		maxBytes: numberType().int().positive().optional()
	})).max(20).default([]),
	allowedImports: arrayType(stringType().max(100)).max(50).default([]),
	timeoutMs: numberType().int().positive().max(MAX_TIMEOUT_MS).default(5e3),
	memoryMb: numberType().int().positive().max(MAX_MEMORY_MB).default(128)
});
var runSandboxScript_createServerFn_handler = createServerRpc({
	id: "94d4f3644ba1bb4084f97a24df9623e21a5084ee0a9d491a2a0ad0426e889b05",
	name: "runSandboxScript",
	filename: "src/lib/sandbox.functions.ts"
}, (opts) => runSandboxScript.__executeServer(opts));
var runSandboxScript = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((raw) => sandboxInput.parse(raw)).handler(runSandboxScript_createServerFn_handler, async ({ data }) => {
	const { createNodePermissionSandboxHost } = await import("./generated-sandbox-node-9eeFPJNo.mjs");
	const host = createNodePermissionSandboxHost();
	const outcome = await runGeneratedSandbox({
		taskId: data.taskId,
		language: data.language,
		script: data.script,
		inputs: data.inputs.map((i) => ({
			path: i.path,
			content: i.content
		})),
		outputs: data.outputs.map((o) => ({
			path: o.path,
			mediaType: o.mediaType,
			maxBytes: Math.min(o.maxBytes ?? MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES)
		})),
		allowedImports: data.allowedImports,
		network: "disabled",
		limits: {
			wallTimeMs: Math.min(data.timeoutMs, MAX_TIMEOUT_MS),
			cpuTimeMs: Math.min(data.timeoutMs, MAX_TIMEOUT_MS),
			memoryMb: Math.min(data.memoryMb, MAX_MEMORY_MB),
			storageBytes: MAX_OUTPUT_BYTES,
			outputBytes: MAX_OUTPUT_BYTES
		}
	}, host);
	if (outcome.ok && outcome.data) return {
		ok: true,
		result: outcome.data
	};
	return {
		ok: false,
		reason: outcome.reason ?? (outcome.ok ? "The sandbox reported success but returned no result." : "The sandbox refused the request.")
	};
});
//#endregion
export { runSandboxScript_createServerFn_handler };
