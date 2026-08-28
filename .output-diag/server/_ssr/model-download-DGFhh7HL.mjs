import { n as modelStore, t as ModelStore } from "./model-store-BPT0fGRD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/model-download-DGFhh7HL.js
var CHUNK_FLUSH_BYTES = 4 * 1024 * 1024;
/** Lowercase hex SHA-256 of a blob, using the platform's own crypto. */
async function sha256OfBlob(blob) {
	if (typeof crypto === "undefined" || !crypto.subtle) return null;
	try {
		const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
		return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	} catch {
		return null;
	}
}
/**
* Is there room for this download?
*
* Uses the origin's remaining quota, which is what actually bounds a browser
* download — free disk is invisible to a page. A browser that will not report
* a quota is treated as unknown and allowed to proceed, because refusing on no
* evidence would block every Firefox user.
*/
async function checkRoom(expectedBytes) {
	if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { ok: true };
	try {
		const estimate = await navigator.storage.estimate();
		if (estimate.quota === void 0) return { ok: true };
		const remaining = estimate.quota - (estimate.usage ?? 0);
		const needed = Math.ceil(expectedBytes * 1.1);
		if (remaining < needed) {
			const mb = (n) => `${Math.round(n / (1024 * 1024))} MB`;
			return {
				ok: false,
				reason: `This needs about ${mb(needed)} and the browser will only allow ${mb(remaining)} more.`
			};
		}
		return { ok: true };
	} catch {
		return { ok: true };
	}
}
async function downloadModel(request) {
	const store = request.store ?? modelStore;
	const doFetch = request.fetchImpl ?? globalThis.fetch;
	if (!ModelStore.isSupported()) return {
		ok: false,
		failure: "storage_unavailable",
		reason: "This browser cannot store a model between visits, so OCADE will not download one."
	};
	if (!doFetch) return {
		ok: false,
		failure: "network",
		reason: "No network client is available."
	};
	if (request.expectedBytes !== void 0) {
		const room = await checkRoom(request.expectedBytes);
		if (!room.ok) return {
			ok: false,
			failure: "insufficient_storage",
			reason: room.reason
		};
	}
	const alreadyHave = await store.sizeOf(request.key);
	const resumed = alreadyHave > 0;
	const existingMeta = await store.readMeta(request.key);
	if (alreadyHave > 0 && existingMeta?.verified) return {
		ok: true,
		key: request.key,
		bytes: alreadyHave,
		verified: true,
		resumed: true
	};
	let response;
	try {
		response = await doFetch(request.url, {
			signal: request.signal,
			headers: alreadyHave > 0 ? { Range: `bytes=${alreadyHave}-` } : void 0
		});
	} catch (error) {
		if (request.signal?.aborted) return {
			ok: false,
			failure: "cancelled",
			reason: "Download stopped."
		};
		return {
			ok: false,
			failure: "network",
			reason: `The download could not start: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	if (response.status === 416 && alreadyHave > 0) return await finishVerified(store, request, alreadyHave, true);
	let writeAt = alreadyHave;
	if (alreadyHave > 0 && response.status !== 206) {
		writeAt = 0;
		await store.remove(request.key);
	}
	if (!response.ok && response.status !== 206) return {
		ok: false,
		failure: "network",
		reason: `The model server answered ${response.status}.`
	};
	if (!response.body) return {
		ok: false,
		failure: "network",
		reason: "The model server sent no data."
	};
	const declared = Number(response.headers.get("content-length") ?? "");
	const totalBytes = request.expectedBytes ?? (Number.isFinite(declared) ? declared + writeAt : null);
	const reader = response.body.getReader();
	let received = writeAt;
	let buffer = [];
	let buffered = 0;
	const flush = async () => {
		if (buffered === 0) return true;
		const merged = new Uint8Array(new ArrayBuffer(buffered));
		let at = 0;
		for (const part of buffer) {
			merged.set(part, at);
			at += part.length;
		}
		const wroteAt = received - buffered;
		buffer = [];
		buffered = 0;
		return store.append(request.key, merged, wroteAt);
	};
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (request.signal?.aborted) {
				await flush();
				return {
					ok: false,
					failure: "cancelled",
					reason: "Download stopped."
				};
			}
			buffer.push(value);
			buffered += value.length;
			received += value.length;
			if (buffered >= CHUNK_FLUSH_BYTES) {
				if (!await flush()) return {
					ok: false,
					failure: "insufficient_storage",
					reason: "The browser stopped accepting data, which usually means storage is full."
				};
			}
			request.onProgress?.({
				receivedBytes: received,
				totalBytes,
				fraction: totalBytes ? Math.min(1, received / totalBytes) : null,
				resumedFromBytes: writeAt
			});
		}
		if (!await flush()) return {
			ok: false,
			failure: "insufficient_storage",
			reason: "The browser stopped accepting data, which usually means storage is full."
		};
	} catch (error) {
		await flush();
		if (request.signal?.aborted) return {
			ok: false,
			failure: "cancelled",
			reason: "Download stopped."
		};
		return {
			ok: false,
			failure: "network",
			reason: `The download was interrupted: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	return await finishVerified(store, request, await store.sizeOf(request.key), resumed);
}
/**
* Prefer weights this deployment serves itself over the publisher's host.
*
* A HEAD, not a GET: the question is only "is it there", and asking it with a
* GET would start pulling hundreds of megabytes just to find out. A deployment
* that does not self-host answers 404 in a millisecond on its own origin and
* the remote URL is used exactly as before.
*
* Any failure — 404, an origin that rejects HEAD, no network at all — falls
* through to `remoteUrl`. This can only ever AVOID an external request; it can
* never cause one, and it can never be the reason a download fails.
*/
async function preferredWeightsUrl(sameOriginUrl, remoteUrl, fetchImpl) {
	const doFetch = fetchImpl ?? globalThis.fetch;
	if (!sameOriginUrl || !doFetch) return {
		url: remoteUrl,
		local: false
	};
	try {
		if ((await doFetch(sameOriginUrl, { method: "HEAD" })).ok) return {
			url: sameOriginUrl,
			local: true
		};
	} catch {}
	return {
		url: remoteUrl,
		local: false
	};
}
/**
* Install weights from a file the user already has, with NO NETWORK AT ALL.
*
* WHY THIS EXISTS. Everything else in this module assumes the engine arrives
* over a connection, and `downloadModel` is careful about every way that can
* go wrong. What it cannot do is help the case where there is no connection to
* be careful with: an air-gapped machine, a locked-down site network, a
* metered link nobody will spend 470 MB on, or a fleet that must not fetch
* from a third-party host on first run. Those deployments could not obtain an
* engine at all, so "works offline once downloaded" quietly meant "does not
* work here, ever" — the first download was the one step that could not be
* done offline.
*
* This closes that. The bytes come from a file the operator already has, and
* the ONLY difference from a completed download is where they came from:
*
*  - it is written to the same key, so the adapter finds it with no special
*    case and the storage screen lists it like any other engine;
*  - it is hashed against the SAME committed digest, so an imported file is
*    held to exactly the standard a downloaded one is. A file someone was
*    handed on a USB stick deserves more scrutiny than one fetched over TLS,
*    not less;
*  - a mismatch DELETES it, for the reason given at the top of this file —
*    weights that are almost right load happily and answer nonsense.
*
* It calls no fetch and takes no URL, so it cannot silently fall back to the
* network. That is a property worth keeping deliberately: this function is the
* evidence that OCADE can reach a working engine with the radio off.
*/
async function importModelFile(request) {
	const store = request.store ?? modelStore;
	if (!ModelStore.isSupported()) return {
		ok: false,
		failure: "storage_unavailable",
		reason: "This browser cannot store a model between visits, so OCADE will not import one."
	};
	const totalBytes = request.file.size;
	const room = await checkRoom(totalBytes);
	if (!room.ok) return {
		ok: false,
		failure: "insufficient_storage",
		reason: room.reason
	};
	await store.remove(request.key);
	const reader = request.file.stream().getReader();
	let written = 0;
	let buffer = [];
	let buffered = 0;
	const flush = async () => {
		if (buffered === 0) return true;
		const merged = new Uint8Array(new ArrayBuffer(buffered));
		let at = 0;
		for (const part of buffer) {
			merged.set(part, at);
			at += part.length;
		}
		const wroteAt = written - buffered;
		buffer = [];
		buffered = 0;
		return store.append(request.key, merged, wroteAt);
	};
	const outOfRoom = async () => {
		await store.remove(request.key);
		return {
			ok: false,
			failure: "insufficient_storage",
			reason: "The browser stopped accepting data, which usually means storage is full."
		};
	};
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer.push(value);
		buffered += value.length;
		written += value.length;
		if (buffered >= CHUNK_FLUSH_BYTES && !await flush()) return await outOfRoom();
		request.onProgress?.({
			receivedBytes: written,
			totalBytes,
			fraction: totalBytes > 0 ? Math.min(1, written / totalBytes) : 1
		});
	}
	if (!await flush()) return await outOfRoom();
	const finished = await finishVerified(store, {
		key: request.key,
		url: "",
		sha256: request.sha256,
		expectedBytes: totalBytes
	}, await store.sizeOf(request.key), false);
	return finished.ok ? {
		ok: true,
		key: finished.key,
		bytes: finished.bytes,
		verified: finished.verified
	} : {
		ok: false,
		failure: "digest_mismatch",
		reason: finished.reason
	};
}
/**
* Hash what is on disk, record the result, and decide whether it may be used.
*
* Shared by the normal completion path and the 416 path, so a download that
* turned out to be already complete gets the SAME scrutiny as one that just
* finished streaming. Verifying in one place and trusting in the other is how
* a corrupt file ends up loaded.
*/
async function finishVerified(store, request, finalBytes, resumed) {
	let verified = false;
	if (request.sha256) {
		const blob = await store.readBlob(request.key);
		const actual = blob ? await sha256OfBlob(blob) : null;
		if (actual === null) verified = false;
		else if (actual.toLowerCase() !== request.sha256.toLowerCase()) {
			await store.remove(request.key);
			return {
				ok: false,
				failure: "digest_mismatch",
				reason: "The downloaded engine did not match its published fingerprint, so OCADE deleted it rather than run it."
			};
		} else verified = true;
	}
	await store.writeMeta(request.key, {
		verified,
		expectedBytes: request.expectedBytes ?? finalBytes,
		sha256: request.sha256
	});
	return {
		ok: true,
		key: request.key,
		bytes: finalBytes,
		verified,
		resumed
	};
}
//#endregion
export { importModelFile as n, preferredWeightsUrl as r, downloadModel as t };
