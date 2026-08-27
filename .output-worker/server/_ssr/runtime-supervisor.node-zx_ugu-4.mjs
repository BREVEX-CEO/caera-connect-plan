import { r as spawn } from "./child_process-B0BEqryb.mjs";
import { r as engineBinaryCandidates } from "./runtime-supervisor-BO3LoR7r.mjs";
import processModule from "node:process";
import { access, constants } from "node:fs/promises";
import { dirname, resolve } from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-supervisor.node-zx_ugu-4.js
/**
* Node-side execution for the OCADE Local Engine supervisor (B1).
*
* The policy lives in `runtime-supervisor.ts` and is platform-free. This file is
* the only place that touches processes, and it is Node-only — it must never be
* imported from browser or SSR-shared code. The naming follows the existing
* `code/generated-sandbox-node.ts` split.
*
* The allowlist is enforced HERE as well as declared in the policy: a candidate
* path is expanded, resolved, and then checked to still sit under the directory
* the allowlist named. Without that, `%LOCALAPPDATA%` pointing somewhere unusual
* would be enough to launch an arbitrary executable.
*/
/** Expand %VAR% on Windows and $VAR elsewhere, from the real environment. */
function expand(candidate, env) {
	const expanded = candidate.replace(/%([^%]+)%/g, (_, name) => env[name] ?? "\0");
	return expanded.includes("\0") ? null : expanded;
}
async function isExecutableFile(path) {
	try {
		await access(path, constants.X_OK);
		return true;
	} catch {
		try {
			await access(path, constants.F_OK);
			return processModule.platform === "win32";
		} catch {
			return false;
		}
	}
}
/**
* Resolve the engine binary from the allowlist only.
*
* Deliberately does NOT consult PATH: PATH is user-writable, so resolving
* through it would let anything named `ollama.exe` earlier in PATH be launched
* by the product.
*/
async function findEngineBinary(env = processModule.env, platform = processModule.platform) {
	for (const candidate of engineBinaryCandidates(platform)) {
		const expanded = expand(candidate, env);
		if (!expanded) continue;
		const full = resolve(expanded);
		if (dirname(full).length === 0) continue;
		if (await isExecutableFile(full)) return full;
	}
	return null;
}
/** Probe the runtime. Any non-error HTTP response means something is listening. */
async function probeRuntime(baseUrl, timeoutMs = 2e3) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return (await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })).ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
/**
* Launch detached so the engine outlives this process, with stdio ignored so it
* cannot block on a full pipe nobody is draining.
*/
async function spawnEngineDetached(binary, args, env) {
	const child = spawn(binary, args, {
		detached: true,
		stdio: "ignore",
		env: {
			...processModule.env,
			...env
		},
		windowsHide: true
	});
	child.unref();
	if (child.pid === void 0) throw new Error("the engine process did not start");
}
/** Stop the engine process by image name. Idempotent at the caller's level. */
async function terminateEngine() {
	const [command, args] = processModule.platform === "win32" ? ["taskkill", [
		"/IM",
		"ollama.exe",
		"/F"
	]] : ["pkill", ["-f", "ollama serve"]];
	await new Promise((resolveDone) => {
		const child = spawn(command, [...args], {
			stdio: "ignore",
			windowsHide: true
		});
		child.on("close", () => resolveDone());
		child.on("error", () => resolveDone());
	});
}
/** Real dependencies for the supervisor on this machine. */
function nodeSupervisorDeps() {
	return {
		findBinary: () => findEngineBinary(),
		spawnDetached: spawnEngineDetached,
		probe: (baseUrl) => probeRuntime(baseUrl),
		terminate: terminateEngine,
		sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
		now: () => Date.now()
	};
}
//#endregion
export { findEngineBinary, nodeSupervisorDeps, probeRuntime };
