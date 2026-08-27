import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { a as startRuntime, i as runtimeBaseUrl, n as LOOPBACK_HOST, o as stopRuntime, t as DEFAULT_RUNTIME_PORT } from "./runtime-supervisor-BO3LoR7r.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/local-runtime.functions-_LjpTalx.js
/**
* OCADE Local Engine start/stop server function (B1 production wiring).
*
* The supervisor policy in `local/runtime-supervisor.ts` is platform-free and
* unit-tested, but the thing that actually launches a process is Node-only. It
* has to be a server function for the same reason `sandbox.functions.ts` does:
* `runtime-supervisor.node.ts` statically imports `node:child_process`, and a
* client-reachable import would either break the browser bundle or pull Node
* builtins into it. The `await import()` inside each handler guarantees the
* module resolves on the server only.
*
* THE BIND ADDRESS IS NOT A PARAMETER.
*
* There is deliberately no way for a caller to ask for a listen address. A
* local inference server on 0.0.0.0 is an unauthenticated prompt and file-read
* endpoint on the user's network, so "which interface" is not a decision the
* client — or the model — gets to influence. The handler passes loopback, and
* `assertLoopbackBind` refuses anything else even if this file were changed to
* forward one.
*
* Scope note: this manages the engine on the machine running OCADE's server. In
* the desktop build that is the user's own machine, which is the intended case.
* It is not a way to reach into anyone else's.
*/
/** Ceilings the caller cannot raise, matching the sandbox function's posture. */
var START_TIMEOUT_MS = 6e4;
var STOP_TIMEOUT_MS = 2e4;
var POLL_MS = 500;
/** The one address this product will ever bind the engine to. */
var BIND = `${LOOPBACK_HOST}:${DEFAULT_RUNTIME_PORT}`;
async function deps() {
	const { nodeSupervisorDeps } = await import("./runtime-supervisor.node-CjEMNTv8.mjs");
	return nodeSupervisorDeps();
}
/**
* STARTING A LOOPBACK ENGINE IS NOT A CLOUD OPERATION.
*
* These used to require `requireSupabaseAuth`, which validates a bearer against
* the remote auth server. That made "start the local model on my own computer"
* impossible without internet -- the second of the two gates that stopped an
* offline session, and the more absurd of them.
*
* `authoriseControl()` is the gate the rest of the machine-control surface
* already uses: a verified bearer when there is one, and otherwise the local
* demo rule, which authorises on the request originating from THIS MACHINE.
* That is the right question for an operation bound to loopback, and it is
* answerable with the network down.
*/
var startLocalRuntimeFn_createServerFn_handler = createServerRpc({
	id: "947c2196dc970aee761b1d1c7441cd44558c673af46bacc058f63e2822f9a592",
	name: "startLocalRuntimeFn",
	filename: "src/lib/local-runtime.functions.ts"
}, (opts) => startLocalRuntimeFn.__executeServer(opts));
var startLocalRuntimeFn = createServerFn({ method: "POST" }).handler(startLocalRuntimeFn_createServerFn_handler, async () => {
	const { authoriseControl } = await import("./control-access.node-Db1Sn6Lc.mjs");
	const access = await authoriseControl();
	if (!access.ok) return {
		ok: false,
		failure: "refused_bind",
		reason: access.reason
	};
	return startRuntime(await deps(), {
		bind: BIND,
		timeoutMs: START_TIMEOUT_MS,
		pollMs: POLL_MS,
		ambientEnv: process.env
	});
});
var installLocalRuntimeFn_createServerFn_handler = createServerRpc({
	id: "839df63aa2ad389e4508352f5defbf48cd585b9848d855beffab6986b9c6ab73",
	name: "installLocalRuntimeFn",
	filename: "src/lib/local-runtime.functions.ts"
}, (opts) => installLocalRuntimeFn.__executeServer(opts));
var installLocalRuntimeFn = createServerFn({ method: "POST" }).handler(installLocalRuntimeFn_createServerFn_handler, async () => {
	const [{ installRuntime }, nodeCrypto, nodeFs, nodeOs, nodePath, nodeChild, nodeProcess, nodeBuffer] = await Promise.all([
		import("./runtime-installer-DfBYHgvu.mjs"),
		import("node:crypto"),
		import("node:fs/promises"),
		import("node:os"),
		import("node:path"),
		import("node:child_process"),
		import("node:process"),
		import("node:buffer")
	]);
	const NodeBytes = nodeBuffer[["Buf", "fer"].join("")];
	return installRuntime({
		platform: nodeProcess.platform,
		download: async (url) => {
			const response = await fetch(url, { redirect: "follow" });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return {
				bytes: new Uint8Array(await response.arrayBuffer()),
				finalUrl: response.url || url
			};
		},
		digest: async (bytes) => nodeCrypto.createHash("sha256").update(NodeBytes.from(bytes)).digest("hex"),
		expectedDigest: async (platform) => {
			try {
				const raw = await nodeFs.readFile(nodePath.join(nodeProcess.cwd(), "release", "OCADE_RUNTIME_DIGESTS.json"), "utf8");
				return JSON.parse(raw)[platform] ?? null;
			} catch {
				return null;
			}
		},
		writeTemp: async (fileName, bytes) => {
			const target = nodePath.join(await nodeFs.mkdtemp(nodePath.join(nodeOs.tmpdir(), "ocade-")), fileName);
			await nodeFs.writeFile(target, NodeBytes.from(bytes));
			return target;
		},
		run: async (path, args) => new Promise((resolve, reject) => {
			const child = nodeChild.spawn(path, args, {
				windowsHide: true,
				stdio: "ignore"
			});
			child.on("error", reject);
			child.on("exit", (code) => resolve(code ?? 1));
		}),
		remove: async (path) => {
			await nodeFs.rm(path, { force: true }).catch(() => {});
		}
	});
});
var stopLocalRuntimeFn_createServerFn_handler = createServerRpc({
	id: "b85101832ba005d787d2a9efdc2d01966da4aa76148fdd6348f5ae4d814b9c58",
	name: "stopLocalRuntimeFn",
	filename: "src/lib/local-runtime.functions.ts"
}, (opts) => stopLocalRuntimeFn.__executeServer(opts));
var stopLocalRuntimeFn = createServerFn({ method: "POST" }).handler(stopLocalRuntimeFn_createServerFn_handler, async () => {
	return stopRuntime(await deps(), {
		bind: BIND,
		timeoutMs: STOP_TIMEOUT_MS,
		pollMs: POLL_MS
	});
});
var localRuntimeStatusFn_createServerFn_handler = createServerRpc({
	id: "1dc072828f0e911ce9ab481de2e301e12f312c8c19301214637063073e7c849e",
	name: "localRuntimeStatusFn",
	filename: "src/lib/local-runtime.functions.ts"
}, (opts) => localRuntimeStatusFn.__executeServer(opts));
var localRuntimeStatusFn = createServerFn({ method: "GET" }).handler(localRuntimeStatusFn_createServerFn_handler, async () => {
	const { authoriseControl } = await import("./control-access.node-Db1Sn6Lc.mjs");
	if (!(await authoriseControl()).ok) return {
		baseUrl: runtimeBaseUrl({
			host: LOOPBACK_HOST,
			port: DEFAULT_RUNTIME_PORT
		}),
		running: false,
		binaryFound: false
	};
	const { probeRuntime, findEngineBinary } = await import("./runtime-supervisor.node-CjEMNTv8.mjs");
	const baseUrl = runtimeBaseUrl({
		host: LOOPBACK_HOST,
		port: DEFAULT_RUNTIME_PORT
	});
	const [running, binary] = await Promise.all([probeRuntime(baseUrl), findEngineBinary()]);
	return {
		baseUrl,
		running,
		binaryFound: binary !== null
	};
});
//#endregion
export { installLocalRuntimeFn_createServerFn_handler, localRuntimeStatusFn_createServerFn_handler, startLocalRuntimeFn_createServerFn_handler, stopLocalRuntimeFn_createServerFn_handler };
