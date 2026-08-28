import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/local-runtime.functions-D7k5JAT3.js
var fail = (failure, reason) => ({
	ok: false,
	failure,
	reason
});
function gb(bytes) {
	return `${(bytes / 1e9).toFixed(1)} GB`;
}
/**
* Downloading needs room for the model AND working space while the runtime
* assembles blobs. 1.15x is the margin; below it the pull is refused up front
* rather than failing mid-transfer with a partially written store.
*/
var DISK_MARGIN = 1.15;
/** Would this model fit on disk, with margin? Pure. */
function checkDisk(modelBytes, freeStorageBytes) {
	const needBytes = Math.round(modelBytes * DISK_MARGIN);
	if (!Number.isFinite(freeStorageBytes) || freeStorageBytes <= 0) return {
		needBytes,
		freeBytes: freeStorageBytes,
		sufficient: true
	};
	const sufficient = needBytes <= freeStorageBytes;
	return {
		needBytes,
		freeBytes: freeStorageBytes,
		sufficient,
		reason: sufficient ? void 0 : `Needs about ${gb(needBytes)} of free disk (model plus working space) but only ${gb(freeStorageBytes)} is free.`
	};
}
var base = (bridgeUrl) => bridgeUrl.replace(/\/+$/, "");
/**
* Pull a model through the local runtime.
*
* Resumability is the runtime's: it stores completed blobs and re-requests only
* what is missing, so an interrupted pull resumed later continues rather than
* restarting. That is why cancelling here is safe and why this does not
* implement its own chunking — reimplementing it would be less reliable, not
* more.
*/
async function pullModel(bridgeUrl, modelId, opts = {}) {
	const f = opts.fetchImpl ?? globalThis.fetch;
	if (!f) return fail("unreachable", "No fetch implementation is available.");
	if (opts.expectedBytes !== void 0 && opts.freeStorageBytes !== void 0) {
		const disk = checkDisk(opts.expectedBytes, opts.freeStorageBytes);
		if (!disk.sufficient) return fail("insufficient_disk", disk.reason);
	}
	const started = Date.now();
	let res;
	try {
		res = await f(`${base(bridgeUrl)}/api/pull`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model: modelId,
				stream: true
			}),
			signal: opts.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
		return fail("unreachable", "The local engine is not reachable.");
	}
	if (!res.ok || !res.body) return fail("runtime_error", `The local engine refused the download (HTTP ${res.status}).`);
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let lastStatus = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl;
			while ((nl = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line) continue;
				let obj;
				try {
					obj = JSON.parse(line);
				} catch {
					continue;
				}
				if (obj.error) return fail("runtime_error", obj.error);
				lastStatus = obj.status ?? lastStatus;
				const completedBytes = obj.completed ?? 0;
				const totalBytes = obj.total ?? 0;
				opts.onProgress?.({
					status: lastStatus,
					completedBytes,
					totalBytes,
					percent: totalBytes > 0 ? Math.min(100, completedBytes / totalBytes * 100) : null,
					digest: obj.digest
				});
			}
		}
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") return fail("cancelled", "Download cancelled. Progress so far is kept and can be resumed.");
		return fail("runtime_error", "The download stream was interrupted.");
	}
	return {
		ok: true,
		modelId,
		elapsedMs: Date.now() - started,
		lastStatus
	};
}
/**
* Confirm a model is actually present after a pull, and read its digest.
*
* A pull that reports "success" but leaves nothing in the model list is a
* failure, and this is what catches it.
*/
async function verifyInstalled(bridgeUrl, modelId, fetchImpl) {
	const f = fetchImpl ?? globalThis.fetch;
	if (!f) return fail("unreachable", "No fetch implementation is available.");
	let tags;
	try {
		tags = await f(`${base(bridgeUrl)}/api/tags`);
	} catch {
		return fail("unreachable", "The local engine is not reachable.");
	}
	if (!tags.ok) return fail("runtime_error", `Could not list models (HTTP ${tags.status}).`);
	const found = ((await tags.json()).models ?? []).find((m) => m.name === modelId);
	if (!found) return fail("not_installed", `${modelId} is not installed — the download reported success but the model is not present.`);
	const digest = found.digest ?? null;
	return {
		ok: true,
		modelId,
		sizeBytes: found.size ?? 0,
		digest,
		digestVerified: typeof digest === "string" && digest.length > 0
	};
}
/** Remove a model and free its disk. */
async function removeModel(bridgeUrl, modelId, fetchImpl) {
	const f = fetchImpl ?? globalThis.fetch;
	if (!f) return fail("unreachable", "No fetch implementation is available.");
	let res;
	try {
		res = await f(`${base(bridgeUrl)}/api/delete`, {
			method: "DELETE",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ model: modelId })
		});
	} catch {
		return fail("unreachable", "The local engine is not reachable.");
	}
	if (!res.ok) return res.status === 404 ? fail("not_installed", `${modelId} is not installed, so there is nothing to remove.`) : fail("runtime_error", `The local engine could not remove ${modelId} (HTTP ${res.status}).`);
	return {
		ok: true,
		modelId
	};
}
/**
* Decide whether a freshly installed model may be called READY.
*
* This is the rule in P05.S05, and it exists because "downloaded" and "usable"
* are different claims. A model that is present but cannot answer, or that
* ignores cancellation, is a model that will hang a user with no way out — so
* neither condition may be assumed from a successful transfer.
*/
async function activateModel(modelId, deps) {
	const t0 = Date.now();
	let inference;
	try {
		inference = await deps.runInference(modelId, "Reply with exactly: OCADE_READY");
	} catch {
		return fail("inference_failed", `${modelId} was installed but could not answer a prompt.`);
	}
	const firstTokenMs = Date.now() - t0;
	if (!inference.ok || inference.text.trim().length === 0) return fail("inference_failed", `${modelId} was installed but returned no answer.`);
	let cancel;
	try {
		cancel = await deps.runCancellable(modelId);
	} catch {
		return fail("cancellation_not_honoured", `${modelId} answered but did not stop when cancelled, so it will not be used.`);
	}
	if (!cancel.cancelled) return fail("cancellation_not_honoured", `${modelId} answered but did not stop when cancelled, so it will not be used.`);
	return {
		ok: true,
		inferenceOk: true,
		cancellationOk: true,
		firstTokenMs,
		replyPreview: inference.text.trim().slice(0, 120)
	};
}
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
/** The one address this product will ever bind the engine to. */
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
var startLocalRuntimeFn = createServerFn({ method: "POST" }).handler(createSsrRpc("947c2196dc970aee761b1d1c7441cd44558c673af46bacc058f63e2822f9a592"));
/**
* Install the local engine runtime when the machine has never had one.
*
* WITHOUT THIS, A CLEAN MACHINE DEAD-ENDS. `startRuntime` searches a fixed list
* of install paths and returns `binary_not_found` -- accurate, and useless to
* somebody who installed OCADE and was never told a separate runtime existed.
*
* The Node capabilities live here because `runtime-installer.ts` is deliberately
* pure: every dangerous operation (fetch, write, spawn) is injected, so the
* refusals can be tested without a network and without executing anything.
*/
var installLocalRuntimeFn = createServerFn({ method: "POST" }).handler(createSsrRpc("839df63aa2ad389e4508352f5defbf48cd585b9848d855beffab6986b9c6ab73"));
var stopLocalRuntimeFn = createServerFn({ method: "POST" }).handler(createSsrRpc("b85101832ba005d787d2a9efdc2d01966da4aa76148fdd6348f5ae4d814b9c58"));
var localRuntimeStatusFn = createServerFn({ method: "GET" }).handler(createSsrRpc("1dc072828f0e911ce9ab481de2e301e12f312c8c19301214637063073e7c849e"));
//#endregion
export { removeModel as a, verifyInstalled as c, pullModel as i, installLocalRuntimeFn as n, startLocalRuntimeFn as o, localRuntimeStatusFn as r, stopLocalRuntimeFn as s, activateModel as t };
