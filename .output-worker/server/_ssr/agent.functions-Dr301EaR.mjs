import { c as stringType, o as objectType, r as enumType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-BQwRVjSw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/agent.functions-Dr301EaR.js
/**
* The agent loop's production owner (server function).
*
* WHY THIS FILE HAS TO EXIST
* --------------------------
* `agent/adapters.node.ts` spawns the Python native-control host and the
* Playwright browser host. Both are `node:child_process`, so the module can
* never be imported from the browser bundle — the same constraint that put the
* generated-code sandbox behind `sandbox.functions.ts`. The `await import()`
* inside each handler is what keeps Node builtins out of the client build.
*
* WHAT THE CALLER DOES NOT GET TO DECIDE
* --------------------------------------
* 1. **Where the sidecars live.** Paths are resolved on the server from the
*    project root. A client-supplied interpreter path would be arbitrary code
*    execution wearing a JSON hat.
* 2. **Whether authentication applies.** `requireSupabaseAuth` is not optional
*    on any handler here; this is the entry point to a real computer.
* 3. **How many steps a task may take.** The loop's own ceiling applies and is
*    not a parameter.
*
* TWO ENTRY POINTS, AND THE DIFFERENCE BETWEEN THEM IS THE PRODUCT
* ----------------------------------------------------------------
* `observeComputerFn` answers questions about this computer and refuses every
* mutating tool. It is what ordinary OCADE Chat may reach, so a chat message can
* never move the mouse.
*
* `controlWorkTaskFn` is Control + Work's own route, and the only one that may
* change anything. Even there, autonomy is passed per task rather than stored,
* and `high`-risk tools are refused outright — see the note on that handler.
*/
var observeInput = objectType({
	/** What the user typed. Bounded: this becomes a model prompt. */
	request: stringType().min(1).max(4e3),
	/** Optional window hint, so "what's in Chrome?" does not need a tool round trip. */
	windowTitle: stringType().max(256).optional()
});
/**
* Answer a question about this computer, using the observe → plan → verify loop.
*
* Read-only by construction. The tools the loop can reach here are the ones
* marked non-mutating in the registry; anything else is refused by `permit`
* before an adapter ever sees it.
*/
var observeComputerFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(observeInput).handler(createSsrRpc("8d73eecd0e91abeff88f638616b994b53355e1a803396c8638e5bde1cb57b79a"));
createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("73f810a6103278c69034436cdbb4d3ffad53748b88b1ad2d6392db3fc51277a4"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("8da950533f3cb72186a8d056026094e782ec8713a0c6b0358106e0280b48d6b3"));
var controlInput = objectType({
	request: stringType().min(1).max(4e3),
	/**
	* `observe` looks and answers. `act` allows the loop to change things.
	*
	* A parameter rather than a setting, because the GUI arms it per task: the
	* user pressing "Let OCADE act" for one instruction has not consented to the
	* next one, and a stored preference would quietly turn that into standing
	* permission.
	*/
	autonomy: enumType(["observe", "act"]).default("observe")
});
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(controlInput).handler(createSsrRpc("66038743829029124311018a0f25fe8868a5c41fe73dd530907550e0c43a5ff6"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(objectType({
	text: stringType().min(1).max(1200),
	language: stringType().max(8).optional()
})).handler(createSsrRpc("6f0bb46e7cd55a9361f3d24693ce8382317436e46cf9800dfa94680a5fde26c7"));
//#endregion
export { observeComputerFn };
