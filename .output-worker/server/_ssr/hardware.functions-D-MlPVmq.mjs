import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as profileFrom } from "./detect-LJYWOPdG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hardware.functions-D-MlPVmq.js
/**
* Hardware detection server function (W2 production wiring).
*
* Node-only, for the same reason `sandbox.functions.ts` is: the measurement
* imports `node:os`, `node:fs/promises` and `node:child_process`, and a
* client-reachable import would pull Node builtins into the browser bundle. The
* `await import()` inside the handler keeps it on the server.
*
* What it returns is deliberately narrow. The raw snapshot carries a CPU model
* string and adapter names; the profile carries rounded sizes and a sentence.
* Only the profile crosses to the client, so nothing machine-identifying is
* handed to the page beyond what the user is being told anyway.
*/
var detectHardwareFn_createServerFn_handler = createServerRpc({
	id: "c46a232dd6774620a61cf21686cce6b9227630fe0ca2fec51566c382503bae2d",
	name: "detectHardwareFn",
	filename: "src/lib/hardware.functions.ts"
}, (opts) => detectHardwareFn.__executeServer(opts));
var detectHardwareFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(detectHardwareFn_createServerFn_handler, async () => {
	const { measureHardware } = await import("./detect.node-Dkb6xlhJ.mjs");
	return profileFrom(await measureHardware());
});
//#endregion
export { detectHardwareFn_createServerFn_handler };
