//#region node_modules/.nitro/vite/services/ssr/assets/model-store-DhsdXagY.js
/**
* Which model a browser gets, and why.
*
* SEPARATE FROM THE DESKTOP MANIFEST ON PURPOSE. The desktop tiers are GGUF
* weights pulled by a local runtime that already knows the machine. A browser
* is a different world: the weights must fit in GPU memory it cannot query
* precisely, arrive over the network as static files, and survive being
* evicted by the browser at any moment. Sharing one table would force one set
* of numbers to be wrong for one of them.
*
* THE SIZES ARE DELIBERATELY BOUNDED, BUT QUALITY IS A HARD GATE. The former
* 0.5B base loaded quickly yet failed the production-weight knowledge,
* arithmetic and freshness suite. It is therefore not a shippable default.
* The 1.5B tier is the smallest offered model; anything larger is offered only
* after a real memory/latency check, never on optimism.
*/
var RESOLVED = new Map({
	schemaVersion: 1,
	generatedAt: "2026-08-24T14:07:10.352Z",
	generatedBy: "scripts/resolve-browser-catalogue.mjs",
	provenance: "Sizes and SHA-256 digests were READ from each publisher's own file index at the time above and committed here. Nothing is hand-typed. The digest protects against a truncated, corrupted or substituted transfer; it is not an independent attestation of the weights themselves, and pinning it at review time is what gives it force.",
	entries: [{
		"id": "wasm-qwen2.5-1.5b-instruct-q4_k_m",
		"label": "OCADE Browser (compatibility)",
		"repo": "Qwen/Qwen2.5-1.5B-Instruct-GGUF",
		"path": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
		"sizeBytes": 1117320736,
		"sha256": "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
		"url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true"
	}]
}.entries.map((entry) => [entry.id, entry]));
/**
* How much of the window the system message may take.
*
* The rest is the conversation. At 4,096 this leaves about 2,700 tokens for
* history and the answer, which is a usable chat; giving the prompt more would
* buy stricter rules the user could not then talk to.
*/
var SYSTEM_PROMPT_BUDGET_FRACTION = .35;
/** Tokens available for the system message on a tier. */
function systemPromptBudgetFor(tier) {
	return Math.floor(tier.contextTokens * SYSTEM_PROMPT_BUDGET_FRACTION);
}
var MB = 1024 * 1024;
/**
* WebGPU tiers.
*
* Ids are WebLLM's prebuilt ones. They are checked against the library's own
* `prebuiltAppConfig` at probe time rather than trusted, because a hardcoded
* id that disappears in a library update would otherwise fail as a confusing
* runtime error instead of an honest "not available".
*/
var WEBGPU_TIERS = [{
	rank: 0,
	label: "OCADE Browser",
	webllmId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
	version: "qwen2.5-1.5b-instruct-q4f16_1-mlc",
	downloadBytes: 900 * MB,
	requiredMemoryBytes: Math.round(1629.75 * MB),
	contextTokens: 4096,
	thinkingSuitable: true,
	because: "The smallest Qwen that passes OCADE's production answer-quality gate. It remains bounded for browser graphics memory."
}, {
	rank: 1,
	label: "OCADE Browser Plus",
	webllmId: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
	version: "qwen2.5-3b-instruct-q4f16_1-mlc",
	downloadBytes: 1800 * MB,
	requiredMemoryBytes: Math.round(2504.76 * MB),
	contextTokens: 4096,
	thinkingSuitable: true,
	because: "A larger Qwen, offered only after this device ran the base engine quickly enough and exposes sufficient graphics capacity."
}];
/** What a tier really needs at runtime: the published figure plus headroom. */
function runtimeMemoryBytes(tier) {
	return Math.round(tier.requiredMemoryBytes * 1.15);
}
/**
* WebAssembly tiers.
*
* Only the smallest quality-qualified model is offered, and that is a decision
* rather than an omission. WASM inference is slower than WebGPU, but the old
* 0.5B fallback gave materially wrong production answers. A fast wrong answer
* is not a working fallback, so compatibility starts at 1.5B and reports its
* preparation cost honestly.
*/
var WASM_TIERS = [{
	rank: 0,
	label: "OCADE Browser (compatibility)",
	catalogueId: "wasm-qwen2.5-1.5b-instruct-q4_k_m",
	downloadBytes: 1117320736,
	requiredMemoryBytes: 1600 * MB,
	contextTokens: 4096,
	version: "qwen2.5-1.5b-instruct-q4_k_m",
	thinkingSuitable: false,
	because: "This browser cannot use its graphics card for OCADE, so the engine runs on the processor instead. It is slower, and it is the reason OCADE still works here at all."
}];
/**
* WHERE OCADE WOULD SERVE A WEBGPU TIER FROM ITSELF.
*
* The WebGPU path had no OCADE-controlled distribution at all. The runtime's
* own record points its weights at the publisher's host and its compiled
* library at `raw.githubusercontent.com` — two third parties, on the first
* run, before the user has agreed to anything, and both of them ordinary
* casualties of a corporate egress policy or an air-gapped install. The
* WebAssembly path already had `sameOriginGgufUrl` for exactly this reason;
* this is the same idea for the other engine.
*
* A MIRROR, NOT A SECOND CATALOGUE. These functions do not decide which files
* a tier needs — the installed runtime does, and it stays the only thing that
* knows which compiled library matches its own version. They take the URLs it
* asks for and answer one question: what would the same file be called if this
* deployment served it? An operator who mirrors the files gets a first run
* with no third-party request; one who does not is unaffected, because the
* adapter probes before it substitutes and a 404 simply means the publisher's
* URL is used as before.
*
* Versioned and immutable by construction: the path carries the tier's
* `version`, so a future tier cannot collide with a cached copy of this one
* and a mirrored file can be served with a long immutable cache lifetime.
*/
function webgpuMirrorWeightsUrl(tier) {
	return tier.webllmId ? `/models/webllm/${tier.version}` : null;
}
/**
* The mirrored path for one of the runtime's own files.
*
* `publisherUrl` is whatever the runtime asked for; only its final path
* segment is used, so nothing about the third party's directory layout — or a
* hostile value in it — can escape the mirror directory. A URL that carries no
* usable filename returns null rather than a guess.
*/
function webgpuMirrorFileUrl(tier, publisherUrl) {
	const base = webgpuMirrorWeightsUrl(tier);
	if (!base) return null;
	let name;
	try {
		name = new URL(publisherUrl, "https://example.invalid").pathname.split("/").pop() ?? "";
	} catch {
		return null;
	}
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.includes("..")) return null;
	return `${base}/${name}`;
}
/** The committed, reviewed facts for a tier — or null if OCADE cannot fetch it. */
function resolvedFor(tier) {
	return tier.catalogueId ? RESOLVED.get(tier.catalogueId) ?? null : null;
}
/** Where a tier's weights are fetched from. Static hosting, no AI server. */
function ggufUrl(tier) {
	return resolvedFor(tier)?.url ?? null;
}
/**
* The path this deployment would serve the weights from itself.
*
* WHY THIS IS NOT THE SAME QUESTION AS `ggufUrl`. The catalogue URL points at
* the publisher's host, which is correct for a public deployment and useless
* for the ones that most need a local engine: an air-gapped install, a site
* whose egress policy blocks the model host, a fleet that must not fetch
* anything from a third party on first run. Those are exactly the environments
* where "download it once while online" is not a step anyone can take.
*
* An operator who drops the .gguf into `public/models/` therefore gets a
* first run with no external request at all, and one who does not is
* unaffected — this is probed, and a 404 simply means the catalogue URL is
* used as before. Nothing is assumed present.
*
* The digest is enforced identically either way: self-hosting changes where
* the bytes come from, never whether they are checked.
*/
function sameOriginGgufUrl(tier) {
	const entry = resolvedFor(tier);
	return entry ? `/models/${entry.path}` : null;
}
/** The digest the download must match, from the committed catalogue. */
function sha256For(tier) {
	return resolvedFor(tier)?.sha256;
}
/** Stable storage key for a tier's weights. */
function storageKeyFor(tier) {
	const entry = resolvedFor(tier);
	return entry ? `wasm/${entry.repo.replace(/[^a-z0-9]+/gi, "-")}/${entry.path}` : null;
}
function tiersFor(kind) {
	return kind === "webgpu" ? WEBGPU_TIERS : WASM_TIERS;
}
/**
* Choose a tier for this device.
*
* START SMALL, PROMOTE ON EVIDENCE — and note what that rules out.
*
* The obvious implementation asks the GPU how much memory it has and picks the
* biggest model that fits. It does not work, and this is worth recording
* because the code originally did exactly that: WebGPU's `maxBufferSize` is
* the largest single ALLOCATION an adapter permits, and browsers report a flat
* 2 GB default for it on almost everything — including the integrated Intel
* Iris Xe this was measured on. Treated as a memory budget it promoted nearly
* every device to the larger tier, which is precisely the optimism that makes
* a laptop unusable.
*
* So the ceiling can only ever EXCLUDE a tier, never justify one. Promotion
* requires `benchmark` — evidence that this device already completed a real
* generation at that rank, quickly enough to be worth it. An unmeasured
* device gets the smallest model, every time.
*/
function chooseBrowserTier(kind, ceilingBytes, benchmark) {
	const tiers = [...tiersFor(kind)].sort((a, b) => a.rank - b.rank);
	const skipped = [];
	let chosen = tiers[0];
	for (const t of tiers.slice(1)) {
		if (ceilingBytes !== null && ceilingBytes > 0 && runtimeMemoryBytes(t) > ceilingBytes) {
			skipped.push({
				label: t.label,
				why: `needs about ${(runtimeMemoryBytes(t) / MB).toFixed(0)} MB in one allocation; this device permits ${(ceilingBytes / MB).toFixed(0)} MB`
			});
			continue;
		}
		if (benchmark?.failedRank !== void 0 && t.rank >= benchmark.failedRank) {
			skipped.push({
				label: t.label,
				why: "this engine did not run properly on this device last time, so OCADE is staying with the one that works"
			});
			continue;
		}
		if (!benchmark || benchmark.provenRank < t.rank - 1) {
			skipped.push({
				label: t.label,
				why: "this device has not yet run a smaller engine fast enough to justify a larger one"
			});
			continue;
		}
		if (benchmark.firstTokenMs > 4e3) {
			skipped.push({
				label: t.label,
				why: `the smaller engine already takes ${(benchmark.firstTokenMs / 1e3).toFixed(1)}s to start answering here, so a larger one would be worse`
			});
			continue;
		}
		chosen = t;
	}
	return {
		tier: chosen,
		skipped
	};
}
/** Bytes → "340 MB", for the one line shown before a download starts. */
function formatSize(bytes) {
	return bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(2)} GB` : `${Math.round(bytes / MB)} MB`;
}
/**
* Where browser-side model weights live.
*
* OPFS (the Origin Private File System) rather than IndexedDB or Cache
* Storage, for reasons that matter at this size:
*
*  - It streams. A 400 MB GGUF can be written chunk by chunk and read back as
*    a Blob without ever holding the whole thing in memory. IndexedDB wants a
*    value; Cache Storage wants a Response. Both push you toward materialising
*    hundreds of megabytes at once, which is how a tab dies on a phone.
*  - It has real files. Resuming a partial download means knowing exactly how
*    many bytes are on disk, which is a `getSize()` call here and a
*    reconstruction exercise anywhere else.
*
* EVERY METHOD DEGRADES RATHER THAN THROWS. A browser without OPFS — or one in
* private mode that refuses it — must leave the product working, just without
* a browser engine. `isSupported()` is the honest gate and the adapters check
* it before promising anything.
*
* NOTHING HERE TALKS TO A SERVER. It is storage, not transfer.
*/
var MODEL_DIRECTORY = "ocade-models";
function opfsAvailable() {
	return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function" && typeof FileSystemFileHandle !== "undefined";
}
var ModelStore = class {
	static isSupported() {
		return opfsAvailable();
	}
	async root() {
		if (!opfsAvailable()) return null;
		try {
			return await (await navigator.storage.getDirectory()).getDirectoryHandle(MODEL_DIRECTORY, { create: true });
		} catch {
			return null;
		}
	}
	/**
	* Ask the browser to stop evicting this data.
	*
	* Without it, weights live in "best effort" storage and can be cleared the
	* next time the device is short of space — so a user who downloaded 400 MB
	* on a train discovers it gone. The browser may refuse, and refusing is a
	* legitimate answer that gets reported rather than retried in a loop.
	*/
	async requestPersistence() {
		if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
		try {
			if (await navigator.storage.persisted?.()) return true;
			return await navigator.storage.persist();
		} catch {
			return false;
		}
	}
	/** Bytes already written for this key. 0 when absent — the resume offset. */
	async sizeOf(key) {
		const handle = await this.fileHandle(key, false);
		if (!handle) return 0;
		try {
			return (await handle.getFile()).size;
		} catch {
			return 0;
		}
	}
	async fileHandle(key, create) {
		const root = await this.root();
		if (!root) return null;
		const parts = key.split("/").filter(Boolean);
		const name = parts.pop();
		if (!name) return null;
		let dir = root;
		try {
			for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
			return await dir.getFileHandle(name, { create });
		} catch {
			return null;
		}
	}
	/**
	* Append bytes at the end of the stored file.
	*
	* `at` is passed explicitly rather than inferred so a caller resuming a
	* download cannot accidentally append to the wrong offset after a retry.
	*/
	async append(key, chunk, at) {
		const handle = await this.fileHandle(key, true);
		if (!handle) return false;
		try {
			const writable = await handle.createWritable({ keepExistingData: true });
			await writable.write({
				type: "write",
				position: at,
				data: chunk
			});
			await writable.close();
			return true;
		} catch {
			return false;
		}
	}
	/** Read the whole model back, for handing to an engine. */
	async readBlob(key) {
		const handle = await this.fileHandle(key, false);
		if (!handle) return null;
		try {
			return await handle.getFile();
		} catch {
			return null;
		}
	}
	async remove(key) {
		const root = await this.root();
		if (!root) return false;
		const parts = key.split("/").filter(Boolean);
		const name = parts.pop();
		if (!name) return false;
		try {
			let dir = root;
			for (const part of parts) dir = await dir.getDirectoryHandle(part);
			await dir.removeEntry(name);
			await this.writeMeta(key, null);
			return true;
		} catch {
			return false;
		}
	}
	metaKey(key) {
		return `ocade.model.meta.${key}`;
	}
	async readMeta(key) {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.localStorage.getItem(this.metaKey(key));
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}
	async writeMeta(key, meta) {
		if (typeof window === "undefined") return;
		try {
			if (meta === null) window.localStorage.removeItem(this.metaKey(key));
			else window.localStorage.setItem(this.metaKey(key), JSON.stringify(meta));
		} catch {}
	}
	/** Everything the storage settings page needs, with unknowns left unknown. */
	async report() {
		if (!opfsAvailable()) return {
			supported: false,
			persistent: false,
			usedBytes: null,
			quotaBytes: null,
			models: [],
			problem: "This browser does not provide the private file storage OCADE needs to keep a model between visits."
		};
		let usedBytes = null;
		let quotaBytes = null;
		try {
			const estimate = await navigator.storage.estimate();
			usedBytes = estimate.usage ?? null;
			quotaBytes = estimate.quota ?? null;
		} catch {}
		let persistent = false;
		try {
			persistent = await navigator.storage.persisted?.() ?? false;
		} catch {
			persistent = false;
		}
		return {
			supported: true,
			persistent,
			usedBytes,
			quotaBytes,
			models: await this.list()
		};
	}
	/** Every model file currently stored, walked depth-first. */
	async list() {
		const root = await this.root();
		if (!root) return [];
		const out = [];
		const walk = async (dir, prefix) => {
			const iterable = dir;
			for await (const [name, handle] of iterable.entries()) {
				const key = prefix ? `${prefix}/${name}` : name;
				if (handle.kind === "directory") await walk(handle, key);
				else try {
					const file = await handle.getFile();
					const meta = await this.readMeta(key);
					out.push({
						key,
						bytes: file.size,
						verified: meta?.verified ?? false
					});
				} catch {}
			}
		};
		try {
			await walk(root, "");
		} catch {
			return out;
		}
		return out.sort((a, b) => a.key.localeCompare(b.key));
	}
	/** Delete everything OCADE stored. Used by Settings › Storage. */
	async clear() {
		const models = await this.list();
		let removed = 0;
		for (const model of models) if (await this.remove(model.key)) removed += 1;
		return removed;
	}
};
var modelStore = new ModelStore();
//#endregion
export { ggufUrl as a, runtimeMemoryBytes as c, storageKeyFor as d, systemPromptBudgetFor as f, formatSize as i, sameOriginGgufUrl as l, webgpuMirrorWeightsUrl as m, WASM_TIERS as n, modelStore as o, webgpuMirrorFileUrl as p, chooseBrowserTier as r, resolvedFor as s, ModelStore as t, sha256For as u };
