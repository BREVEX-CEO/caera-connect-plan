import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { a as ggufUrl, c as sameOriginGgufUrl, l as sha256For, n as WEBGPU_TIERS, o as resolvedFor, s as runtimeMemoryBytes, t as WASM_TIERS, u as storageKeyFor } from "./browser-catalogue-BYTmauOS.mjs";
import { n as modelStore, t as ModelStore } from "./model-store-BPT0fGRD.mjs";
import { o as publishInstallState } from "./installation-state-Wrzsjypr.mjs";
import { t as modelVault } from "./model-vault-Cdwm-pAI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/installation-browser-cz2yGPNC.js
var installation_browser_cz2yGPNC_exports = /* @__PURE__ */ __exportAll({
	n: () => installation_browser_exports,
	t: () => installationAuthority
});
var MIB = 1024 * 1024;
/**
* Chunk size bounds.
*
* A chunk is held in memory from the moment it finishes until the hasher has
* consumed it, so peak memory is roughly `chunkBytes × concurrency`. At the
* maximum of both that is 128 MB, which is survivable on a desktop and is why
* mobile gets a smaller chunk AND fewer of them.
*
* The floor is 1 MiB: smaller chunks mean more requests, more per-request
* overhead, and more checkpoint writes than the transfer is worth.
*
* Both are multiples of 64 so a completed chunk always lands on a SHA-256
* block boundary and the digest can be checkpointed there. That is not a
* detail — it is what makes a resume free instead of a re-read.
*/
var MIN_CHUNK_BYTES = 1 * MIB;
var MAX_CHUNK_BYTES = 16 * MIB;
/**
* Choose a starting plan from what the device will admit about itself.
*
* Deliberately conservative when nothing is known. A browser that reports no
* memory, no cores and no connection is most likely Safari, and Safari runs on
* phones; guessing high there costs a killed tab, and guessing low costs a few
* seconds that the adaptation below will win back within one measurement
* window.
*/
function planTransfer(signals) {
	const cores = clamp(signals.cores ?? 4, 1, 32);
	const memoryGb = signals.deviceMemoryGb ?? (signals.mobile ? 2 : 4);
	const effective = signals.effectiveType ?? null;
	const mobile = signals.mobile === true;
	if (effective === "slow-2g" || effective === "2g") return {
		chunkBytes: MIN_CHUNK_BYTES,
		concurrency: 1,
		because: "a very slow connection, so progress is saved often"
	};
	let concurrency;
	let chunkBytes;
	let because;
	if (mobile || memoryGb <= 2) {
		concurrency = 2;
		chunkBytes = 2 * MIB;
		because = "a mobile or low-memory device, kept within a small memory budget";
	} else if (memoryGb <= 4 || cores <= 4) {
		concurrency = 3;
		chunkBytes = 4 * MIB;
		because = "a modest device";
	} else {
		concurrency = 4;
		chunkBytes = 8 * MIB;
		because = "a capable device";
	}
	if ((signals.downlinkMbps ?? 0) >= 25 && !mobile) {
		concurrency += 2;
		because += " on a fast connection";
	} else if ((signals.downlinkMbps ?? Infinity) < 2) {
		concurrency = Math.max(1, concurrency - 1);
		because += " on a slow connection";
	}
	if (signals.saveData === true) {
		concurrency = Math.min(concurrency, 2);
		chunkBytes = Math.min(chunkBytes, 2 * MIB);
		because += ", with data saving respected";
	}
	return {
		chunkBytes: alignChunk(chunkBytes),
		concurrency: clamp(concurrency, 1, 8),
		because
	};
}
/**
* Adjust concurrency from what was actually achieved.
*
* The device's self-description is a guess; bytes per second is evidence. The
* rule is deliberately simple and deliberately slow to move:
*
*  - Throughput improved meaningfully after the last change → keep going in
*    that direction, one step.
*  - Throughput got meaningfully worse → step back, and stay there. More
*    connections than the bottleneck can use makes things worse, so having
*    found the edge, this does not immediately try the same edge again.
*  - Neither → leave it alone. Oscillating between two values costs
*    connection setup and buys nothing.
*
* FIVE PERCENT IS THE NOISE FLOOR. Below that a change is measurement jitter,
* and reacting to jitter is how a transfer ends up reconnecting continually on
* a train.
*/
function adaptConcurrency(current, previous, latest, bounds) {
	const min = bounds?.min ?? 1;
	const max = bounds?.max ?? 8;
	if (latest.ms <= 0 || latest.bytes <= 0) return clamp(current, min, max);
	if (!previous || previous.ms <= 0) return clamp(current, min, max);
	const now = latest.bytes / latest.ms;
	const before = previous.bytes / previous.ms;
	if (before <= 0) return clamp(current, min, max);
	const change = (now - before) / before;
	const direction = Math.sign(latest.concurrency - previous.concurrency);
	if (Math.abs(change) < .05) return clamp(current, min, max);
	if (change > 0) return clamp(current + (direction === 0 ? 1 : direction), min, max);
	return clamp(current - (direction === 0 ? 1 : direction), min, max);
}
/**
* Cut an artifact into ranges.
*
* `end` is inclusive because that is what `Range: bytes=start-end` means, and
* converting between the two conventions at the call site is how an off-by-one
* gets into a file that then fails its digest for no visible reason.
*
* IT HONOURS THE SIZE IT IS GIVEN. `planTransfer` owns the policy about what a
* sensible chunk is for a real device; this is arithmetic. Clamping here as
* well made the two disagree — a resume checkpointed at one size would be
* replanned at another, which is the one thing a resume must never do — and it
* made the module untestable at any scale below a megabyte. The only rule kept
* is 64-byte alignment, because a chunk boundary is where the running digest is
* checkpointed and a checkpoint off a SHA-256 block boundary is not a
* checkpoint at all.
*/
function planChunks(totalBytes, chunkBytes) {
	if (!Number.isFinite(totalBytes) || totalBytes <= 0) return [];
	if (!Number.isFinite(chunkBytes) || chunkBytes < 64) return [];
	const size = Math.floor(chunkBytes) - Math.floor(chunkBytes) % 64;
	const out = [];
	for (let start = 0, index = 0; start < totalBytes; start += size, index += 1) {
		const end = Math.min(start + size, totalBytes) - 1;
		out.push({
			index,
			start,
			end,
			bytes: end - start + 1
		});
	}
	return out;
}
function sourceLadder(input) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (url, kind) => {
		if (!url || seen.has(url)) return;
		seen.add(url);
		out.push({
			url,
			kind
		});
	};
	add(input.cdnUrl, "ocade_cdn");
	add(input.sameOriginUrl, "same_origin");
	add(input.publisherUrl, "publisher");
	return out;
}
/**
* How long to wait before attempt number `attempt`, with jitter.
*
* Exponential and BOUNDED. An unbounded backoff on a phone that has walked out
* of signal becomes a transfer that never resumes when signal returns, and a
* fixed delay from every tab at once is a stampede at the origin. The jitter
* is full-range on purpose: it is what stops several chunks that failed
* together from retrying together forever.
*/
function retryDelayMs(attempt, random = Math.random) {
	const base = Math.min(3e4, 500 * 2 ** Math.max(0, attempt - 1));
	return Math.round(base / 2 + random() * (base / 2));
}
/** Read what the browser will say about this device. Never throws. */
function readDeviceSignals() {
	if (typeof navigator === "undefined") return {};
	const nav = navigator;
	let mobile = null;
	try {
		mobile = typeof nav.userAgent === "string" ? /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(nav.userAgent) : null;
	} catch {
		mobile = null;
	}
	return {
		deviceMemoryGb: nav.deviceMemory ?? null,
		cores: nav.hardwareConcurrency ?? null,
		effectiveType: nav.connection?.effectiveType ?? null,
		downlinkMbps: nav.connection?.downlink ?? null,
		saveData: nav.connection?.saveData ?? null,
		mobile
	};
}
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, Math.round(value)));
}
/** Round down to a 64-byte multiple so chunk ends are digest checkpoints. */
function alignChunk(bytes) {
	const clamped = Math.max(MIN_CHUNK_BYTES, Math.min(MAX_CHUNK_BYTES, Math.floor(bytes)));
	return clamped - clamped % 64;
}
/**
* SHA-256 that can be fed in pieces, paused, written down, and picked up again.
*
* WHY THIS EXISTS RATHER THAN `crypto.subtle.digest`.
*
* The platform digest takes one buffer. To check a downloaded engine against
* its published fingerprint, the previous code did this:
*
*     crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
*
* On a gigabyte of weights that materialises the ENTIRE model in JavaScript
* memory in one allocation, on the main thread, at the exact moment the user is
* watching a progress bar. On a phone it is the documented way to have the tab
* killed — and it happens after a successful download, so the failure lands on
* the person who waited the longest.
*
* WebCrypto has no streaming digest, so this is a real SHA-256 implementation.
* That is a cost worth paying twice over, because it buys two things the
* platform primitive cannot give:
*
*  1. **Incremental.** Bytes are hashed as they arrive, in fixed blocks, with
*     nothing but the current block resident. Verification stops being a phase
*     after the download and becomes a property of it.
*
*  2. **Checkpointable.** SHA-256 is a block cipher over 64-byte blocks with a
*     256-bit running state. At any block boundary the whole computation is
*     eight 32-bit words plus a byte count — 40 bytes that can be persisted.
*     So a download interrupted at 70% resumes hashing at 70% instead of
*     re-reading 700 MB off disk to catch up. Resume becomes free rather than
*     merely possible.
*
* IT IS NOT WEAKER THAN THE PLATFORM'S. This computes the same function over
* the same bytes and is checked against `crypto.subtle.digest` in
* `streaming-digest.test.ts` over empty input, sub-block input, exact block
* multiples, block boundaries ±1, and multi-megabyte random input fed in
* deliberately awkward splits. If those disagree, this file is wrong and the
* suite says so. Nothing here relaxes the check to gain speed.
*/
/** SHA-256 round constants: cube roots of the first 64 primes. */
var K = new Uint32Array([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]);
/** Initial state: square roots of the first 8 primes. */
var H0 = new Uint32Array([
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
]);
var BLOCK_BYTES = 64;
/**
* Feed bytes in, get a lowercase hex digest out.
*
* The instance is stateful and NOT safe to share between two downloads; each
* transfer makes its own. `update` may be called with any sized chunk — a
* partial block is carried until the rest of it arrives.
*/
var StreamingSha256 = class StreamingSha256 {
	h = new Uint32Array(H0);
	/** Bytes of the current, not-yet-full 64-byte block. */
	tail = new Uint8Array(BLOCK_BYTES);
	tailLength = 0;
	totalBytes = 0;
	finished = false;
	/** Message schedule, allocated once rather than per block. */
	w = /* @__PURE__ */ new Uint32Array(64);
	/**
	* Resume from a checkpoint.
	*
	* A checkpoint is only ever taken on a block boundary, so there is no partial
	* block to restore. An unparseable checkpoint throws rather than silently
	* starting from zero: a hasher that quietly forgets its history would report
	* a mismatch on a perfectly good file, and the caller would then delete it.
	*/
	static resume(checkpoint) {
		const hasher = new StreamingSha256();
		if (!/^[0-9a-f]{64}$/.test(checkpoint.state)) throw new Error("Digest checkpoint state is not 64 hex characters.");
		if (!Number.isFinite(checkpoint.bytes) || checkpoint.bytes < 0) throw new Error("Digest checkpoint byte count is not a number.");
		if (checkpoint.bytes % BLOCK_BYTES !== 0) throw new Error("Digest checkpoints are only valid on 64-byte boundaries.");
		for (let i = 0; i < 8; i += 1) hasher.h[i] = Number.parseInt(checkpoint.state.slice(i * 8, i * 8 + 8), 16) >>> 0;
		hasher.totalBytes = checkpoint.bytes;
		return hasher;
	}
	/** Bytes consumed so far. */
	get length() {
		return this.totalBytes;
	}
	/** Absorb a chunk. Any length; partial blocks are carried. */
	update(chunk) {
		if (this.finished) throw new Error("This digest has already been finalised.");
		let offset = 0;
		const length = chunk.length;
		if (this.tailLength > 0) {
			const need = BLOCK_BYTES - this.tailLength;
			const take = Math.min(need, length);
			this.tail.set(chunk.subarray(0, take), this.tailLength);
			this.tailLength += take;
			offset = take;
			if (this.tailLength === BLOCK_BYTES) {
				this.compress(this.tail, 0);
				this.tailLength = 0;
			}
		}
		while (length - offset >= BLOCK_BYTES) {
			this.compress(chunk, offset);
			offset += BLOCK_BYTES;
		}
		if (offset < length) {
			this.tail.set(chunk.subarray(offset), 0);
			this.tailLength = length - offset;
		}
		this.totalBytes += length;
		return this;
	}
	/**
	* The computation so far, as something that can be written to storage.
	*
	* Returns null when the hasher is mid-block. That is deliberate: a checkpoint
	* that silently dropped the partial block would resume with a state that has
	* skipped bytes and produce a wrong digest for a correct file. Callers align
	* their checkpoints to block boundaries (chunk sizes here are multiples of
	* 64) and treat null as "not a checkpoint moment".
	*/
	checkpoint() {
		if (this.finished || this.tailLength !== 0) return null;
		let state = "";
		for (let i = 0; i < 8; i += 1) state += this.h[i].toString(16).padStart(8, "0");
		return {
			state,
			bytes: this.totalBytes
		};
	}
	/** Pad, absorb the length, and return the lowercase hex digest. */
	digest() {
		if (this.finished) throw new Error("This digest has already been finalised.");
		this.finished = true;
		const bitLength = this.totalBytes * 8;
		const padLength = this.tailLength < 56 ? 56 - this.tailLength : 120 - this.tailLength;
		const padding = new Uint8Array(padLength + 8);
		padding[0] = 128;
		const high = Math.floor(bitLength / 4294967296);
		const low = bitLength >>> 0;
		const view = new DataView(padding.buffer);
		view.setUint32(padLength, high, false);
		view.setUint32(padLength + 4, low, false);
		const counted = this.totalBytes;
		this.finished = false;
		this.update(padding);
		this.finished = true;
		this.totalBytes = counted;
		let out = "";
		for (let i = 0; i < 8; i += 1) out += this.h[i].toString(16).padStart(8, "0");
		return out;
	}
	/** One 64-byte block, read in place from `data` at `at`. */
	compress(data, at) {
		const w = this.w;
		for (let i = 0; i < 16; i += 1) {
			const j = at + i * 4;
			w[i] = (data[j] << 24 | data[j + 1] << 16 | data[j + 2] << 8 | data[j + 3]) >>> 0;
		}
		for (let i = 16; i < 64; i += 1) {
			const x = w[i - 15];
			const y = w[i - 2];
			const s0 = ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3) >>> 0;
			const s1 = ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10) >>> 0;
			w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
		}
		let a = this.h[0];
		let b = this.h[1];
		let c = this.h[2];
		let d = this.h[3];
		let e = this.h[4];
		let f = this.h[5];
		let g = this.h[6];
		let h = this.h[7];
		for (let i = 0; i < 64; i += 1) {
			const S1 = ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) >>> 0;
			const ch = (e & f ^ ~e & g) >>> 0;
			const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
			const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) >>> 0) + ((a & b ^ a & c ^ b & c) >>> 0) >>> 0;
			h = g;
			g = f;
			f = e;
			e = d + t1 >>> 0;
			d = c;
			c = b;
			b = a;
			a = t1 + t2 >>> 0;
		}
		this.h[0] = this.h[0] + a >>> 0;
		this.h[1] = this.h[1] + b >>> 0;
		this.h[2] = this.h[2] + c >>> 0;
		this.h[3] = this.h[3] + d >>> 0;
		this.h[4] = this.h[4] + e >>> 0;
		this.h[5] = this.h[5] + f >>> 0;
		this.h[6] = this.h[6] + g >>> 0;
		this.h[7] = this.h[7] + h >>> 0;
	}
};
/**
* SHA-256 of a blob, read in bounded pieces.
*
* The replacement for `blob.arrayBuffer()` at the call sites that genuinely
* have a blob and no running hasher — importing a file the user chose, and
* repairing a staging file whose checkpoint was lost. Memory stays at one
* `sliceBytes` regardless of how large the blob is.
*/
async function sha256OfBlobStreaming(blob, options) {
	const slice = options?.sliceBytes ?? 8 * 1024 * 1024;
	const hasher = new StreamingSha256();
	try {
		if (typeof blob.stream === "function") {
			const reader = blob.stream().getReader();
			let read = 0;
			for (;;) {
				if (options?.signal?.aborted) return null;
				const { done, value } = await reader.read();
				if (done) break;
				hasher.update(value);
				read += value.length;
				options?.onProgress?.(read);
			}
		} else for (let at = 0; at < blob.size; at += slice) {
			if (options?.signal?.aborted) return null;
			const part = blob.slice(at, Math.min(at + slice, blob.size));
			hasher.update(new Uint8Array(await part.arrayBuffer()));
			options?.onProgress?.(Math.min(at + slice, blob.size));
		}
		return hasher.digest();
	} catch {
		return null;
	}
}
/**
* Moving a gigabyte onto a device that keeps changing its mind.
*
* WHAT THIS REPLACED. One `fetch`, one `Range` header, one stream appended to
* one file, and a whole-file `blob.arrayBuffer()` hashed at the end. That works
* on a desk with fibre and fails on everything else: a single stream leaves
* most of a fast connection unused, a mid-transfer drop loses everything since
* the last four-megabyte flush, and the verification step materialises the
* entire model in memory on the main thread at the exact moment the user has
* been waiting longest.
*
* THE FOUR IDEAS HERE
*
* 1. **Chunks, not a stream.** The artifact is cut into ranges. Several are in
*    flight at once, so a fast link is actually used; each one that lands is a
*    unit that can be retried on its own, so a failure costs one chunk rather
*    than the whole transfer.
*
* 2. **Hashing is part of the download, not a phase after it.** Chunks are fed
*    to a running SHA-256 IN ORDER as they become available. When the last byte
*    arrives the digest is already computed. Nothing is ever re-read, and the
*    largest allocation is one chunk.
*
* 3. **A checkpoint is a place you can actually resume from.** It is taken only
*    when three things agree: the bytes are durable on disk, the digest state
*    covers exactly those bytes, and the count of contiguous chunks says so.
*    Anything past the contiguous frontier is re-fetched, which costs at most
*    a few chunks and is the reason a resume can never produce a file that
*    passes its digest with a hole in it.
*
* 4. **Sources are a ladder, not a dependency.** A source that fails repeatedly
*    is rotated away from. Every source is held to the same published digest,
*    so failover changes where bytes come from and never whether they count.
*
* WHAT IT WILL NOT DO. It will not activate anything — it returns a verdict and
* the caller decides. It will not delete anything. It will not treat a
* length as evidence. And it will not report `verified` for a digest it could
* not check: absence of a check is not a passing check.
*/
var DEFAULT_ATTEMPTS = 5;
/** How often throughput is measured and concurrency reconsidered. */
var SAMPLE_WINDOW_MS = 2500;
/**
* How much newly contiguous data may accumulate before it is written down.
*
* A checkpoint costs a flush, so it is not taken per chunk; this bounds what an
* interruption can cost. Sixteen megabytes is a few seconds on any connection
* worth planning for, and the failure and cancellation paths take one on the
* way out regardless, so this only governs the steady state.
*/
var CHECKPOINT_INTERVAL_BYTES = 16 * 1024 * 1024;
async function transferModel(request, deps) {
	const now = deps.now ?? (() => Date.now());
	const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
	const random = deps.random ?? Math.random;
	const startedAt = now();
	const metrics = {
		firstByteMs: null,
		totalMs: 0,
		retries: 0,
		sourceSwitches: 0,
		ranged: false,
		finalConcurrency: request.plan.concurrency,
		bytesPerSecond: null
	};
	const finish = (result) => {
		metrics.totalMs = now() - startedAt;
		return result;
	};
	if (request.sources.length === 0) return finish({
		ok: false,
		failure: "no_source",
		reason: "OCADE has nowhere to fetch this from.",
		retriable: false,
		checkpoint: null,
		metrics
	});
	let sourceIndex = 0;
	const source = () => request.sources[sourceIndex];
	const rotateSource = () => {
		if (sourceIndex + 1 >= request.sources.length) return false;
		sourceIndex += 1;
		metrics.sourceSwitches += 1;
		return true;
	};
	let totalBytes = request.totalBytes ?? 0;
	if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
		const discovered = await discoverSize(request, deps, () => source().url);
		if (discovered === null) return finish({
			ok: false,
			failure: "size_unknown",
			reason: "The source would not say how large this is, so OCADE cannot plan the transfer.",
			retriable: true,
			checkpoint: null,
			metrics
		});
		totalBytes = discovered;
	}
	const resumable = request.resume && request.resume.totalBytes === totalBytes && request.resume.chunkBytes > 0 ? request.resume : null;
	const chunkBytes = resumable ? resumable.chunkBytes : request.plan.chunkBytes;
	const chunks = planChunks(totalBytes, chunkBytes);
	if (chunks.length === 0) return finish({
		ok: false,
		failure: "size_unknown",
		reason: "This artifact reports a size OCADE cannot plan a transfer against.",
		retriable: false,
		checkpoint: null,
		metrics
	});
	let nextToHash = Math.min(resumable?.contiguousChunks ?? 0, chunks.length);
	let hasher;
	try {
		hasher = resumable?.digest && nextToHash > 0 ? StreamingSha256.resume(resumable.digest) : new StreamingSha256();
		if (!resumable?.digest) nextToHash = 0;
	} catch {
		hasher = new StreamingSha256();
		nextToHash = 0;
	}
	const resumedFromBytes = nextToHash > 0 ? hasher.length : 0;
	const state = {
		received: resumedFromBytes,
		concurrency: Math.max(1, request.plan.concurrency)
	};
	metrics.finalConcurrency = state.concurrency;
	const checkpointNow = () => ({
		contiguousChunks: nextToHash,
		digest: hasher.checkpoint(),
		chunkBytes,
		totalBytes
	});
	if (request.signal?.aborted) return finish({
		ok: false,
		failure: "cancelled",
		reason: "Preparation stopped.",
		retriable: true,
		checkpoint: checkpointNow(),
		metrics
	});
	if (nextToHash >= chunks.length) return finish(verdict());
	let sampleStart = now();
	let sampleBytes = 0;
	let previousSample = null;
	let bytesPerSecond = null;
	const report = () => {
		const remaining = totalBytes - state.received;
		request.onProgress?.({
			receivedBytes: state.received,
			totalBytes,
			fraction: totalBytes > 0 ? Math.min(1, state.received / totalBytes) : 0,
			resumedFromBytes,
			bytesPerSecond,
			etaSeconds: bytesPerSecond !== null && bytesPerSecond > 0 ? Math.round(remaining / bytesPerSecond) : null
		});
	};
	const sample = (bytes) => {
		state.received += bytes;
		sampleBytes += bytes;
		const elapsed = now() - sampleStart;
		if (elapsed >= SAMPLE_WINDOW_MS && sampleBytes > 0) {
			bytesPerSecond = sampleBytes / elapsed * 1e3;
			const latest = {
				bytes: sampleBytes,
				ms: elapsed,
				concurrency: state.concurrency
			};
			state.concurrency = adaptConcurrency(state.concurrency, previousSample, latest);
			metrics.finalConcurrency = state.concurrency;
			previousSample = latest;
			sampleStart = now();
			sampleBytes = 0;
		}
		report();
	};
	/** Chunks fetched but not yet hashed. Bounded by the dispatch window. */
	const landed = /* @__PURE__ */ new Map();
	let dispatchAt = nextToHash;
	let failure = null;
	let sequentialFallback = false;
	let draining = false;
	/**
	* Hash, write and release everything that is now contiguous.
	*
	* The order is deliberate: HASH FIRST, then write, then checkpoint. A
	* checkpoint claims "these bytes are on disk and the digest covers exactly
	* them", and the only way that stays true across a crash is to do the work
	* in the order the claim describes.
	*/
	const drainOnce = async () => {
		while (landed.has(nextToHash)) {
			const bytes = landed.get(nextToHash);
			landed.delete(nextToHash);
			hasher.update(bytes);
			const chunk = chunks[nextToHash];
			if (!await deps.writer.write(bytes, chunk.start)) {
				failure = {
					failure: "insufficient_storage",
					reason: "The browser stopped accepting data, which usually means storage is full.",
					retriable: false
				};
				return false;
			}
			nextToHash += 1;
		}
		return true;
	};
	/**
	* Drain, then checkpoint if enough new ground has been covered.
	*
	* A CHECKPOINT COSTS A FLUSH, SO IT IS NOT TAKEN PER CHUNK. Every 32 MB of
	* newly contiguous data, or when the frontier reaches the end. That bounds
	* what an interruption can cost to about the same amount, which on any
	* connection worth planning for is a few seconds of re-fetching.
	*/
	let sinceCheckpointBytes = 0;
	const drain = async () => {
		if (draining) return true;
		draining = true;
		try {
			const before = nextToHash;
			if (!await drainOnce()) return false;
			sinceCheckpointBytes += (nextToHash - before) * chunkBytes;
			if (sinceCheckpointBytes >= CHECKPOINT_INTERVAL_BYTES || nextToHash >= chunks.length) {
				sinceCheckpointBytes = 0;
				if (!await persist()) return false;
			}
			return true;
		} finally {
			draining = false;
		}
	};
	/** Make the frontier durable and tell the caller it may be remembered. */
	const persist = async () => {
		if (!await deps.writer.flush()) {
			failure = {
				failure: "storage",
				reason: "OCADE could not save what it has downloaded so far.",
				retriable: true
			};
			return false;
		}
		await request.onCheckpoint?.(checkpointNow());
		return true;
	};
	const fetchChunk = async (chunk) => {
		const attempts = request.maxAttemptsPerChunk ?? DEFAULT_ATTEMPTS;
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			if (request.signal?.aborted) return null;
			try {
				const response = await deps.fetchImpl(source().url, {
					signal: request.signal,
					headers: { Range: `bytes=${chunk.start}-${chunk.end}` }
				});
				if (response.status === 206) {
					metrics.ranged = true;
					const buffer = new Uint8Array(await response.arrayBuffer());
					if (metrics.firstByteMs === null) metrics.firstByteMs = now() - startedAt;
					if (buffer.length !== chunk.bytes) {
						metrics.retries += 1;
						await sleep(retryDelayMs(attempt, random));
						continue;
					}
					return buffer;
				}
				if (response.status === 200) {
					try {
						await response.body?.cancel();
					} catch {}
					sequentialFallback = true;
					return null;
				}
				if (response.status === 416) {
					if (!rotateSource()) {
						failure = {
							failure: "network",
							reason: "The source no longer has the expected file.",
							retriable: false
						};
						return null;
					}
					continue;
				}
				metrics.retries += 1;
				if (response.status >= 400 && response.status < 500) rotateSource();
				else if (attempt >= 2) rotateSource();
				await sleep(retryDelayMs(attempt, random));
			} catch (error) {
				if (request.signal?.aborted) return null;
				metrics.retries += 1;
				if (attempt >= 2) rotateSource();
				await sleep(retryDelayMs(attempt, random));
			}
		}
		failure = {
			failure: "network",
			reason: "The connection kept dropping while OCADE was preparing this device.",
			retriable: true
		};
		return null;
	};
	/** How many chunks may be outstanding or waiting to be hashed. */
	const dispatchWindow = () => Math.max(2, state.concurrency * 2);
	/**
	* One worker: take the next chunk, fetch it, park it, drain what it unblocked.
	*
	* THE DISPATCH WINDOW IS WHAT BOUNDS MEMORY. Chunks are held from arrival
	* until their turn to be hashed, so without a window one slow chunk at the
	* frontier — while everything behind it succeeds — would buffer the rest of
	* the model in JavaScript memory. That is the exact allocation this whole
	* design exists to avoid. Twice the concurrency keeps every worker fed and no
	* more.
	*
	* A worker that finds the window full YIELDS RATHER THAN EXITS, because the
	* frontier is advanced by its siblings' drains and will move; a worker that
	* finds the queue empty is finished.
	*/
	const worker = async () => {
		for (;;) {
			if (failure || sequentialFallback || request.signal?.aborted) return;
			if (dispatchAt >= chunks.length) return;
			if (dispatchAt >= nextToHash + dispatchWindow()) {
				await sleep(5);
				continue;
			}
			const chunk = chunks[dispatchAt];
			dispatchAt += 1;
			const bytes = await fetchChunk(chunk);
			if (bytes === null) return;
			landed.set(chunk.index, bytes);
			sample(bytes.length);
			if (!await drain()) return;
		}
	};
	const pool = /* @__PURE__ */ new Set();
	const spawn = () => {
		const task = worker().finally(() => pool.delete(task));
		pool.add(task);
	};
	for (let i = 0; i < Math.max(1, Math.min(state.concurrency, chunks.length)); i += 1) spawn();
	while (pool.size > 0) {
		await Promise.race(pool);
		if (failure || sequentialFallback || request.signal?.aborted) break;
		const wanted = Math.max(1, Math.min(state.concurrency, chunks.length - dispatchAt));
		while (pool.size < wanted && dispatchAt < chunks.length) spawn();
	}
	await Promise.allSettled([...pool]);
	if (!failure && !sequentialFallback && !request.signal?.aborted) await drain();
	if (!failure && !sequentialFallback && !request.signal?.aborted && nextToHash < chunks.length) failure = {
		failure: "network",
		reason: "The transfer stopped making progress.",
		retriable: true
	};
	if (sequentialFallback && !failure) {
		landed.clear();
		nextToHash = 0;
		hasher = new StreamingSha256();
		state.received = 0;
		const sequential = await transferSequentially({
			request,
			deps,
			chunks,
			totalBytes,
			hasher,
			onWrote: (chunkIndex) => {
				nextToHash = chunkIndex + 1;
			},
			onBytes: (n) => sample(n),
			persist,
			now
		});
		if (!sequential.ok) failure = sequential.error;
	}
	if (request.signal?.aborted) {
		await deps.writer.flush();
		await request.onCheckpoint?.(checkpointNow());
		return finish({
			ok: false,
			failure: "cancelled",
			reason: "Preparation stopped.",
			retriable: true,
			checkpoint: checkpointNow(),
			metrics
		});
	}
	if (failure) {
		await deps.writer.flush();
		await request.onCheckpoint?.(checkpointNow());
		return finish({
			...failure,
			ok: false,
			checkpoint: checkpointNow(),
			metrics
		});
	}
	if (!await persist()) return finish({
		ok: false,
		failure: failure ?? "storage",
		reason: "OCADE could not save what it downloaded.",
		retriable: true,
		checkpoint: checkpointNow(),
		metrics
	});
	return finish(verdict());
	/** Compute the digest and decide. Never activates anything. */
	function verdict() {
		metrics.bytesPerSecond = bytesPerSecondOverall();
		let digest = null;
		try {
			digest = hasher.digest();
		} catch {
			digest = null;
		}
		if (request.sha256) {
			if (digest === null) return {
				ok: true,
				bytes: totalBytes,
				verified: false,
				digest: null,
				resumedFromBytes,
				source: source(),
				metrics
			};
			if (digest.toLowerCase() !== request.sha256.toLowerCase()) return {
				ok: false,
				failure: "digest_mismatch",
				reason: "What arrived did not match its published fingerprint, so OCADE will not run it.",
				retriable: true,
				checkpoint: null,
				metrics
			};
		}
		return {
			ok: true,
			bytes: totalBytes,
			verified: Boolean(request.sha256) && digest !== null,
			digest,
			resumedFromBytes,
			source: source(),
			metrics
		};
	}
	function bytesPerSecondOverall() {
		const elapsed = now() - startedAt;
		const moved = state.received - resumedFromBytes;
		return elapsed > 0 && moved > 0 ? moved / elapsed * 1e3 : null;
	}
}
/**
* The whole file, in order, from a server that will not honour Range.
*
* Deliberately restarts from zero. A server that ignores Range answers 200 with
* the complete artifact; appending that to bytes already on disk produces a
* file of double length that passes every length check and fails its digest —
* the failure mode that is hardest to explain and easiest to avoid.
*/
async function transferSequentially(input) {
	const { request, deps, chunks, hasher } = input;
	try {
		const response = await deps.fetchImpl(request.sources[0].url, { signal: request.signal });
		if (!response.ok || !response.body) return {
			ok: false,
			error: {
				failure: "network",
				reason: `The source answered ${response.status}.`,
				retriable: true
			}
		};
		const reader = response.body.getReader();
		let pending = [];
		let pendingBytes = 0;
		let chunkIndex = 0;
		let written = 0;
		const commit = async (bytes) => {
			hasher.update(bytes);
			if (!await deps.writer.write(bytes, written)) return false;
			written += bytes.length;
			input.onWrote(chunkIndex);
			chunkIndex += 1;
			return true;
		};
		for (;;) {
			if (request.signal?.aborted) break;
			const { done, value } = await reader.read();
			if (done) break;
			pending.push(value);
			pendingBytes += value.length;
			input.onBytes(value.length);
			while (chunkIndex < chunks.length && pendingBytes >= chunks[chunkIndex].bytes) {
				const need = chunks[chunkIndex].bytes;
				const merged = new Uint8Array(new ArrayBuffer(pendingBytes));
				let at = 0;
				for (const part of pending) {
					merged.set(part, at);
					at += part.length;
				}
				if (!await commit(merged.subarray(0, need))) return {
					ok: false,
					error: {
						failure: "insufficient_storage",
						reason: "The browser stopped accepting data, which usually means storage is full.",
						retriable: false
					}
				};
				const rest = merged.subarray(need);
				pending = rest.length > 0 ? [new Uint8Array(rest)] : [];
				pendingBytes = rest.length;
				if (chunkIndex % 8 === 0) await input.persist();
			}
		}
		if (pendingBytes > 0 && chunkIndex < chunks.length) {
			const merged = new Uint8Array(new ArrayBuffer(pendingBytes));
			let at = 0;
			for (const part of pending) {
				merged.set(part, at);
				at += part.length;
			}
			if (!await commit(merged)) return {
				ok: false,
				error: {
					failure: "insufficient_storage",
					reason: "The browser stopped accepting data, which usually means storage is full.",
					retriable: false
				}
			};
		}
		return { ok: true };
	} catch (error) {
		if (request.signal?.aborted) return {
			ok: false,
			error: {
				failure: "cancelled",
				reason: "Stopped.",
				retriable: true
			}
		};
		return {
			ok: false,
			error: {
				failure: "network",
				reason: `The transfer was interrupted: ${error instanceof Error ? error.message : String(error)}`,
				retriable: true
			}
		};
	}
}
/**
* Ask the source how large the artifact is, without downloading it.
*
* A one-byte ranged GET rather than a HEAD: some object stores and CDNs answer
* HEAD differently from GET, or not at all, and `Content-Range` on a 206
* carries the total in a form that cannot be confused with a chunk length.
* Falls back to `Content-Length` on a 200, which is only correct because the
* response is discarded immediately.
*/
async function discoverSize(request, deps, url) {
	try {
		const response = await deps.fetchImpl(url(), {
			signal: request.signal,
			headers: { Range: "bytes=0-0" }
		});
		try {
			await response.body?.cancel();
		} catch {}
		const range = response.headers.get("content-range");
		const match = range ? /\/(\d+)\s*$/.exec(range) : null;
		if (match) {
			const total = Number(match[1]);
			if (Number.isFinite(total) && total > 0) return total;
		}
		const length = Number(response.headers.get("content-length") ?? "");
		if (response.status === 200 && Number.isFinite(length) && length > 0) return length;
		return null;
	} catch {
		return null;
	}
}
/**
* Bounded on purpose.
*
* An unbounded log of a long-running session is a memory leak that only shows
* up on the devices least able to afford one. Sixty events covers several
* complete install attempts, which is what anybody diagnosing this needs.
*/
var MAX_EVENTS = 60;
var ring = [];
var listeners = /* @__PURE__ */ new Set();
function recordInstallEvent(event) {
	const timed = {
		at: Date.now(),
		event
	};
	ring.push(timed);
	if (ring.length > MAX_EVENTS) ring.shift();
	for (const listener of listeners) listener(timed);
}
/**
* THE ONE THING THAT INSTALLS OCADE'S LOCAL INTELLIGENCE.
*
* WHAT WAS HERE BEFORE, AND WHY IT PRODUCED THE FAILURES WE SAW.
*
* There was no authority. There were five independent paths that could each
* start a download, and they did not know about each other:
*
*   - `use-brain.warm()`, fired from the composer's first keystroke;
*   - `use-local-chat-engine.send()`, which probes and loads on its own;
*   - the WebGPU adapter's `preload()`;
*   - the WebAssembly adapter's `preload()`;
*   - a second, third and fourth browser tab doing all of the above again.
*
* Every observed symptom follows directly from that. "Local engine
* unavailable" showing at the same time as "Preparing OCADE — 62%" is two
* paths holding two opinions, because `EngineState.status` and
* `PreparationState.stage` were separate stores that nothing reconciled.
* `warm()` and `send()` racing is two paths entering `ensureLoaded` at once. A
* "retrying" label with no retry behind it is a state written by a `catch` that
* had nothing left to try. Competing downloads across tabs are four paths with
* no lock between them.
*
* So the fix is not another guard in each path. It is that THERE IS ONE PATH,
* and every surface joins it:
*
*     landing page  ─┐
*     demo          ─┤
*     signed-in chat ┼──> install() ──> the current operation, or a new one
*     composer       │
*     another tab   ─┘
*
* `install()` is idempotent and joins. Called twice it returns the same
* promise. Called from a second tab it observes the first tab's progress rather
* than starting a competing transfer. Called when the engine is already
* installed it returns immediately without touching the network.
*
* THREE RULES THIS FILE ENFORCES AND NOTHING ELSE MAY BREAK
*
* 1. **One state.** There is a single state machine and one published snapshot.
*    Two surfaces cannot disagree because there is only one thing to read.
* 2. **Nothing unverified is ever activated.** The transfer computes a digest;
*    the vault refuses to point at a version whose metadata does not say it
*    matched. Corrupt bytes have no path to being loaded.
* 3. **Progress is never silently discarded.** A failure keeps its checkpoint.
*    Only a digest mismatch removes bytes, and only because weights that are
*    almost right load happily and answer nonsense.
*/
var INITIAL = {
	stage: "idle",
	fraction: null,
	etaSeconds: null,
	detail: null,
	problem: null,
	remedies: [],
	observing: false,
	retries: 0,
	path: null
};
/**
* How many times an install will retry itself before asking the user.
*
* BOUNDED, because an unbounded automatic retry is indistinguishable from a
* hang: the screen says "retrying" forever and nobody can tell whether to wait
* or to act. Three attempts covers the transient cases — a handover, a lift, a
* source having a bad minute — and anything past that is a condition the user
* needs to know about.
*/
var MAX_AUTOMATIC_ATTEMPTS = 3;
/** Triggers nobody pressed. These defer to a deliberate removal. */
var AUTOMATIC_REASONS = /* @__PURE__ */ new Set([
	"app_bootstrap",
	"warm",
	"resumed"
]);
var UNINSTALL_INTENT_KEY = "ocade.model.uninstalled.at.v1";
var ModelInstallationAuthority = class {
	state = INITIAL;
	listeners = /* @__PURE__ */ new Set();
	/** The operation in flight. THE reason two callers cannot compete. */
	running = null;
	controller = null;
	deps;
	now;
	startedAt = null;
	ladder = [];
	constructor(deps) {
		this.deps = deps;
		this.now = deps.now ?? (() => Date.now());
	}
	snapshot() {
		return this.state;
	}
	subscribe(listener) {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}
	/** The measured capability ladder, for the diagnostics surface only. */
	capabilities() {
		return this.ladder;
	}
	/** True when an engine is installed, verified and loaded. */
	isReady() {
		return this.state.stage === "ready";
	}
	publish(patch) {
		const next = {
			...this.state,
			...patch
		};
		if (next.stage === this.state.stage && next.fraction === this.state.fraction && next.etaSeconds === this.state.etaSeconds && next.detail === this.state.detail && next.problem === this.state.problem && next.observing === this.state.observing && next.retries === this.state.retries && next.path === this.state.path && next.remedies.length === this.state.remedies.length) return;
		this.state = next;
		for (const listener of this.listeners) listener(next);
		publishInstallState(next);
		this.deps.broadcast?.(next);
	}
	/**
	* Adopt another tab's state.
	*
	* A follower shows what the owner is doing rather than running its own
	* transfer. `observing` is set so a screen can be honest that the work is
	* happening elsewhere — and so the follower never offers a Retry button that
	* would start a second download.
	*/
	observe(state) {
		if (this.running) return;
		this.publish({
			...state,
			observing: true,
			remedies: []
		});
	}
	/**
	* Get the local intelligence ready. Safe to call from anywhere, any number
	* of times, from any number of tabs.
	*
	* THE JOIN IS THE WHOLE POINT. Returning the in-flight promise means a
	* keystroke, a route change, a second tab and a background warm-up all wait
	* on the SAME operation. There is no path by which a second download starts.
	*/
	install(options) {
		if (this.state.stage === "ready") return Promise.resolve(this.state);
		if (this.running) return this.running;
		if (AUTOMATIC_REASONS.has(options?.reason ?? "app_bootstrap")) {
			if (this.uninstallIntentActive()) {
				this.publish({
					stage: "idle",
					detail: "OCADE Intelligence is not installed on this device.",
					problem: null,
					remedies: [],
					fraction: null
				});
				return Promise.resolve(this.state);
			}
		} else this.clearUninstallIntent();
		this.controller = new AbortController();
		this.startedAt = this.now();
		const run = this.runInstall(this.controller.signal).finally(() => {
			this.running = null;
			this.controller = null;
		});
		this.running = run;
		return run;
	}
	/**
	* Stop, keeping everything already downloaded.
	*
	* Explicitly not "cancel and clean up". The bytes on disk and the digest
	* checkpoint beside them are exactly what makes the next attempt cheap, and
	* throwing them away because somebody navigated is how a user pays for the
	* same gigabyte twice.
	*/
	pause() {
		this.controller?.abort();
		if (this.state.stage !== "ready") this.publish({
			stage: "paused",
			detail: "Preparation paused. OCADE will carry on from here."
		});
	}
	/** A real retry: a new attempt, not a change of label. */
	async retry() {
		if (this.running) return this.running;
		this.publish({
			stage: "retrying",
			problem: null,
			remedies: [],
			retries: this.state.retries + 1
		});
		return this.install({ reason: "user_retry" });
	}
	async runInstall(signal) {
		if (this.deps.acquireLock) {
			let outcome = this.state;
			if (!await this.deps.acquireLock(async () => {
				outcome = await this.runOwnedInstall(signal);
			})) {
				this.publish({
					stage: this.state.stage === "idle" ? "checking_device" : this.state.stage,
					observing: true,
					detail: "OCADE is already preparing this device in another window."
				});
				return this.state;
			}
			return outcome;
		}
		return this.runOwnedInstall(signal);
	}
	async runOwnedInstall(signal) {
		const t0 = this.now();
		this.publish({
			stage: "checking_device",
			observing: false,
			problem: null,
			remedies: []
		});
		this.ladder = await this.deps.probeCapabilities();
		const usable = this.ladder.filter((rung) => rung.available);
		this.emit({
			kind: "device_checked",
			ms: this.now() - t0,
			paths: usable.length
		});
		if (usable.length === 0) return this.fail("fatal_error", this.refusalMessage(), ["pair_a_device", "use_another_device"]);
		let lastProblem = "OCADE could not prepare this device.";
		for (const rung of usable) {
			if (signal.aborted) return this.paused();
			const outcome = await this.attemptPath(rung.path, signal);
			if (outcome.ok) return this.state;
			lastProblem = outcome.reason;
			if (outcome.stop) return this.fail(outcome.stage ?? "recoverable_error", outcome.reason, outcome.remedies);
		}
		return this.fail("recoverable_error", lastProblem, ["retry", "use_another_device"]);
	}
	/** One rung of the ladder, from storage check to a warm engine. */
	async attemptPath(path, signal) {
		this.publish({ path });
		const target = await this.deps.resolveTarget(path);
		if (target === null) return this.activate(path, "local", signal);
		const existing = this.deps.vault.readMeta(target.version);
		const onDisk = await this.deps.vault.bytesOf(target.version);
		if (existing?.verified && onDisk > 0) {
			await this.deps.vault.activate(target.version);
			return this.activate(path, target.version, signal);
		}
		if (target.totalBytes !== null && onDisk === target.totalBytes && target.sha256) {
			this.publish({
				stage: "verifying",
				fraction: 1
			});
			const blob = await this.deps.vault.readArtifact(target.version);
			const digest = blob ? await this.deps.hashBlob(blob, signal) : null;
			if (digest !== null && digest.toLowerCase() === target.sha256.toLowerCase()) {
				this.deps.vault.writeMeta(target.version, {
					verified: true,
					expectedBytes: onDisk,
					sha256: target.sha256
				});
				await this.deps.vault.activate(target.version);
				this.emit({
					kind: "adopted_existing",
					version: target.version
				});
				return this.activate(path, target.version, signal);
			}
			if (digest !== null) {
				await this.deps.vault.removeVersion(target.version);
				this.emit({
					kind: "digest_mismatch",
					version: target.version
				});
			}
		}
		if (target.legacyKey) {
			if (await this.deps.vault.adoptLegacy(target.legacyKey, target.version, {
				sha256: target.sha256,
				expectedBytes: target.totalBytes
			})) {
				this.emit({
					kind: "adopted_existing",
					version: target.version
				});
				return this.activate(path, target.version, signal);
			}
		}
		this.publish({ stage: "checking_storage" });
		const headroom = await this.deps.storageHeadroom();
		const needed = target.totalBytes === null ? null : Math.ceil(target.totalBytes * 1.1);
		if (headroom !== null && needed !== null && headroom < needed) return {
			ok: false,
			reason: "OCADE needs more local storage on this device.",
			stop: true,
			stage: "insufficient_storage",
			remedies: [
				"free_storage",
				"remove_local_intelligence",
				"retry",
				"use_another_device"
			]
		};
		this.deps.requestPersistence().catch(() => false);
		this.publish({
			stage: "waiting_for_source",
			fraction: null
		});
		const plan = this.deps.plan ?? planTransfer((this.deps.deviceSignals ?? readDeviceSignals)());
		const sources = target.sources;
		if (sources.length === 0) return {
			ok: false,
			reason: "OCADE has nowhere to fetch this device's intelligence from.",
			stop: true,
			stage: "recoverable_error",
			remedies: ["retry"]
		};
		let writer = null;
		let result = null;
		const downloadStartedAt = this.now();
		for (let attempt = 1; attempt <= MAX_AUTOMATIC_ATTEMPTS; attempt += 1) {
			if (signal.aborted) return {
				ok: false,
				reason: "Paused.",
				stop: true,
				remedies: []
			};
			writer = await this.deps.vault.openWriter(target.version);
			if (!writer) return {
				ok: false,
				reason: "This browser will not let OCADE keep an engine between visits, so it cannot prepare one here.",
				stop: true,
				stage: "fatal_error",
				remedies: ["use_another_device", "pair_a_device"]
			};
			if (attempt > 1) this.publish({
				stage: "retrying",
				retries: this.state.retries + 1
			});
			else this.publish({ stage: "downloading" });
			const meta = this.deps.vault.readMeta(target.version);
			result = await transferModel({
				sources,
				totalBytes: target.totalBytes,
				sha256: target.sha256,
				plan,
				resume: checkpointFrom(meta, target.totalBytes),
				signal,
				onProgress: (progress) => this.reportProgress(progress),
				onCheckpoint: (checkpoint) => {
					this.deps.vault.patchMeta(target.version, {
						expectedBytes: target.totalBytes,
						sha256: target.sha256,
						digest: checkpoint.digest ?? void 0,
						contiguousChunks: checkpoint.contiguousChunks,
						chunkBytes: checkpoint.chunkBytes
					});
				}
			}, {
				fetchImpl: this.deps.fetchImpl,
				writer
			});
			await writer.close();
			if (result.ok) break;
			if (result.failure === "cancelled") return {
				ok: false,
				reason: "Paused.",
				stop: true,
				remedies: []
			};
			if (result.failure === "insufficient_storage") return {
				ok: false,
				reason: "OCADE needs more local storage on this device.",
				stop: true,
				stage: "insufficient_storage",
				remedies: [
					"free_storage",
					"remove_local_intelligence",
					"retry"
				]
			};
			if (result.failure === "digest_mismatch") {
				await this.deps.vault.removeVersion(target.version);
				this.emit({
					kind: "digest_mismatch",
					version: target.version
				});
				if (attempt >= MAX_AUTOMATIC_ATTEMPTS) return {
					ok: false,
					reason: "What arrived did not match its published fingerprint, so OCADE removed it rather than run it.",
					stop: true,
					stage: "recoverable_error",
					remedies: ["retry"]
				};
				continue;
			}
			if (!result.retriable || attempt >= MAX_AUTOMATIC_ATTEMPTS) return {
				ok: false,
				reason: result.reason,
				stop: true,
				stage: "recoverable_error",
				remedies: ["retry"]
			};
		}
		if (!result?.ok) return {
			ok: false,
			reason: "Preparation did not complete.",
			stop: true,
			remedies: ["retry"]
		};
		this.publish({
			stage: "verifying",
			fraction: 1
		});
		if (target.sha256 && !result.verified) return {
			ok: false,
			reason: "OCADE could not confirm this device's intelligence, so it will not run it.",
			stop: true,
			stage: "recoverable_error",
			remedies: ["retry"]
		};
		this.deps.vault.writeMeta(target.version, {
			verified: true,
			expectedBytes: result.bytes,
			sha256: target.sha256
		});
		await this.deps.vault.activate(target.version);
		this.emit({
			kind: "downloaded",
			version: target.version,
			ms: this.now() - downloadStartedAt,
			bytes: result.bytes,
			resumedBytes: result.resumedFromBytes,
			retries: result.metrics.retries,
			sourceKind: result.source.kind,
			ranged: result.metrics.ranged,
			concurrency: result.metrics.finalConcurrency,
			bytesPerSecond: result.metrics.bytesPerSecond
		});
		await this.deps.vault.pruneTo([target.version]);
		return this.activate(path, target.version, signal);
	}
	/** Load the runtime and prove it answers, then and only then say ready. */
	async activate(path, version, signal) {
		if (signal.aborted) return {
			ok: false,
			reason: "Paused.",
			stop: true,
			remedies: []
		};
		this.publish({
			stage: "loading",
			fraction: 1,
			etaSeconds: null
		});
		const loadStartedAt = this.now();
		const loaded = await this.deps.activateRuntime(path, version, (progress) => {
			this.publish({
				stage: progress.stage,
				fraction: progress.fraction,
				etaSeconds: null
			});
		});
		if (!loaded.ok) {
			this.emit({
				kind: "path_failed",
				path,
				reason: loaded.reason
			});
			return {
				ok: false,
				reason: loaded.reason,
				stop: false,
				remedies: []
			};
		}
		this.publish({ stage: "warming" });
		this.emit({
			kind: "loaded",
			path,
			ms: this.now() - loadStartedAt
		});
		this.publish({
			stage: "ready",
			fraction: 1,
			etaSeconds: null,
			detail: "OCADE is ready.",
			problem: null,
			remedies: [],
			observing: false
		});
		this.emit({
			kind: "ready",
			path,
			msFromStart: this.startedAt === null ? null : this.now() - this.startedAt
		});
		return { ok: true };
	}
	/**
	* Remove OCADE's local intelligence from this device.
	*
	* WHAT IT TOUCHES AND WHAT IT MUST NOT. Model artifacts, staging leftovers,
	* version metadata and the active pointer. NOT conversations, NOT the
	* account, NOT unrelated site preferences, NOT another origin's storage. A
	* control that quietly did more than it said would be the last one anybody
	* trusted, and "remove the engine" and "delete my account" are different
	* requests that happen to sit near each other on a settings page.
	*/
	async uninstall() {
		this.controller?.abort();
		this.running = null;
		const result = await this.deps.vault.removeEverything();
		this.ladder = [];
		this.recordUninstallIntent();
		this.publish({
			...INITIAL,
			detail: "OCADE Intelligence has been removed from this device."
		});
		this.emit({
			kind: "uninstalled",
			removed: result.versionsRemoved + result.legacyRemoved
		});
		return {
			ok: true,
			removed: result.versionsRemoved + result.legacyRemoved
		};
	}
	/** Put it back, now, because the user asked for it. */
	reinstall() {
		this.clearUninstallIntent();
		return this.install({ reason: "reinstall" });
	}
	/** True while a deliberate removal is still being honoured. */
	uninstallIntentActive(now = this.now()) {
		const at = this.deps.readIntent?.() ?? readIntentFromLocalStorage();
		return at !== null && now - at < 864e5;
	}
	recordUninstallIntent() {
		const at = this.now();
		if (this.deps.writeIntent) this.deps.writeIntent(at);
		else writeIntentToLocalStorage(at);
	}
	clearUninstallIntent() {
		if (this.deps.writeIntent) this.deps.writeIntent(null);
		else writeIntentToLocalStorage(null);
	}
	/**
	* Check what is on disk and put it back into a usable state.
	*
	* The case this exists for: a browser closed mid-write, or metadata lost
	* while the file survived. Both leave bytes that are neither trustworthy nor
	* worthless. Repair re-verifies rather than assuming either.
	*/
	async repair() {
		if (this.running) return this.running;
		this.publish({
			stage: "repairing",
			problem: null,
			remedies: []
		});
		for (const stored of await this.deps.vault.listVersions()) {
			const meta = stored.meta;
			if (!meta?.sha256 && !meta?.verified) await this.deps.vault.removeVersion(stored.version);
		}
		return this.install({ reason: "repair" });
	}
	reportProgress(progress) {
		this.publish({
			stage: this.state.stage === "retrying" ? "downloading" : this.state.stage,
			fraction: progress.fraction,
			etaSeconds: progress.etaSeconds,
			detail: null
		});
	}
	paused() {
		this.publish({
			stage: "paused",
			detail: "Preparation paused."
		});
		return this.state;
	}
	fail(stage, problem, remedies) {
		this.publish({
			stage,
			problem,
			remedies,
			detail: null,
			etaSeconds: null
		});
		this.emit({
			kind: "failed",
			stage,
			reason: problem
		});
		return this.state;
	}
	/**
	* What to say when nothing worked.
	*
	* Names the concrete limitation from the ladder rather than "unsupported
	* device", because a person whose browser blocks storage and a person on a
	* ten-year-old phone need different things, and neither is helped by a
	* sentence that could apply to either.
	*/
	refusalMessage() {
		const reasons = this.ladder.map((rung) => rung.why).filter(Boolean);
		if (reasons.length === 0) return "OCADE could not find a way to run its intelligence on this device.";
		return `OCADE tried every way it can run here and none of them worked: ${reasons[0]}`;
	}
	emit(event) {
		(this.deps.telemetry ?? recordInstallEvent)(event);
	}
};
/**
* The uninstall intent, in ordinary browser storage.
*
* localStorage rather than the vault, deliberately: it has to survive the vault
* being emptied, which is the exact event it records.
*/
function readIntentFromLocalStorage() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(UNINSTALL_INTENT_KEY);
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}
function writeIntentToLocalStorage(at) {
	if (typeof window === "undefined") return;
	try {
		if (at === null) window.localStorage.removeItem(UNINSTALL_INTENT_KEY);
		else window.localStorage.setItem(UNINSTALL_INTENT_KEY, String(at));
	} catch {}
}
/**
* Turn stored metadata back into something the transfer can resume from.
*
* Returns null unless every part agrees — the chunk count, the chunk size and
* the total. A partial checkpoint is not a cheaper resume, it is a wrong offset,
* and a wrong offset produces a digest mismatch on a file that was fine.
*/
function checkpointFrom(meta, totalBytes) {
	if (!meta || meta.verified) return null;
	if (!meta.contiguousChunks || !meta.chunkBytes) return null;
	if (totalBytes === null || meta.expectedBytes !== totalBytes) return null;
	return {
		contiguousChunks: meta.contiguousChunks,
		digest: meta.digest ?? null,
		chunkBytes: meta.chunkBytes,
		totalBytes
	};
}
/**
* Listen for the worker saying it has filed a completed transfer.
*
* The message says bytes were WRITTEN, never that they are good. The listener's
* job is to ask the authority to look, and the authority hashes before it
* activates — which is why a corrupt background fetch is caught by exactly the
* same check as a corrupt foreground one.
*/
function onBackgroundFetchStaged(listener) {
	if (typeof navigator === "undefined" || !navigator.serviceWorker) return () => {};
	const handler = (event) => {
		const data = event.data;
		if (data && data.type === "ocade:model-staged") listener(data.ok === true);
	};
	navigator.serviceWorker.addEventListener("message", handler);
	return () => navigator.serviceWorker.removeEventListener("message", handler);
}
/**
* The one installation authority this browser tab uses, wired to real things.
*
* `installation-authority.ts` is the machine and knows nothing about WebGPU,
* wllama, OPFS or Web Locks. This is where those are supplied, in one place, so
* there is exactly one construction of the authority in the whole application
* and no surface can accidentally build a second one.
*
* WHAT IS DECIDED HERE
*
*  - **The ladder.** Which ways this device could run OCADE, strongest first,
*    each with a measured reason. A rung is only declared unavailable after
*    something was actually checked.
*  - **The sources.** Where the bytes come from, OCADE's own distribution
*    first. Every source is held to the same committed digest.
*  - **Ownership.** One tab installs; the others watch its progress over a
*    BroadcastChannel. Web Locks decides which, because the browser releases a
*    lock when a page closes or is discarded, so failover is a platform
*    property rather than a heartbeat this code could get wrong.
*/
var installation_browser_exports = /* @__PURE__ */ __exportAll$1({
	cdnUrlFor: () => cdnUrlFor,
	installationAuthority: () => installationAuthority,
	probeBrowserCapabilities: () => probeBrowserCapabilities,
	resolveInstallTarget: () => resolveInstallTarget
});
var INSTALL_LOCK = "ocade.model.install";
var INSTALL_CHANNEL = "ocade.model.install.bus";
/**
* OCADE's own model distribution, when this deployment has one.
*
* Set to the base of an immutable, versioned object-storage path served through
* a CDN — see `docs/MODEL_DISTRIBUTION.md` for the bucket layout and the cache
* headers the artifacts must carry. Absent, the ladder simply starts one rung
* lower and a plain deployment keeps working with no configuration, which is
* what makes this safe to leave unset.
*/
function ocadeCdnBase() {
	try {
		const trimmed = "".trim().replace(/\/+$/, "");
		if (!trimmed) return null;
		return new URL(trimmed).protocol === "https:" ? trimmed : null;
	} catch {
		return null;
	}
}
/** The CDN path for one tier's artifact, versioned so it can be immutable. */
function cdnUrlFor(tier) {
	const base = ocadeCdnBase();
	const entry = resolvedFor(tier);
	if (!base || !entry) return null;
	return `${base}/models/${encodeURIComponent(tier.version)}/${encodeURIComponent(entry.path)}`;
}
/**
* Is WebGPU usable, and how much can it allocate at once?
*
* `maxBufferSize` is the largest single ALLOCATION, not a memory budget —
* browsers report a flat 2 GB on almost everything, including integrated
* graphics that cannot really run the larger tiers. It is used only to EXCLUDE
* a tier that certainly will not fit, never to justify one.
*/
async function probeWebGpu() {
	const gpu = globalThis.navigator?.gpu;
	if (!gpu) return {
		ok: false,
		bytes: null,
		why: "this browser cannot use the graphics card"
	};
	try {
		const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
		if (!adapter) return {
			ok: false,
			bytes: null,
			why: "the graphics card did not offer an adapter"
		};
		const limit = adapter.limits?.maxBufferSize;
		return {
			ok: true,
			bytes: typeof limit === "number" ? Number(limit) : null,
			why: "the graphics card offered an adapter"
		};
	} catch (error) {
		return {
			ok: false,
			bytes: null,
			why: `the graphics card could not be prepared: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}
/**
* Can this page run multithreaded WebAssembly?
*
* IT ASKS THE PLATFORM RATHER THAN ASSUMING. `crossOriginIsolated` is the only
* honest answer: `SharedArrayBuffer` can exist and still be unusable by the
* threaded build without isolation, and isolation depends on response headers
* this code cannot see from here.
*
* WHY THE APP IS NOT ISOLATED BY DEFAULT, AND WHAT CHANGED. The note in
* `browser-wasm.ts` said cross-origin isolation was avoided because COOP
* `same-origin` severs `window.opener` and would break the sign-in popups. That
* reasoning no longer describes this application: `auth.tsx` signs in through a
* FULL-PAGE REDIRECT to `/auth/callback`, not a popup, and COOP does not affect
* a redirect. So the blocker is COEP rather than COOP, and COEP is a real
* constraint — every cross-origin subresource would need CORP or CORS — which
* is a deployment-wide change that has to be proven against the live site
* rather than assumed here.
*
* The honest position, therefore: the threaded rung is offered the moment the
* platform says isolation is in force, and the single-threaded rung is always
* there underneath. Nothing claims threads it does not have.
*/
function threadsAvailable() {
	return typeof SharedArrayBuffer === "function" && typeof globalThis.crossOriginIsolated === "boolean" && globalThis.crossOriginIsolated;
}
/**
* Every way this device might run OCADE, strongest first.
*
* THE POINT OF A LADDER IS THAT ONE FAILURE IS NOT A REFUSAL. A device that
* cannot allocate enough graphics memory for the standard context gets a
* reduced one; a device with no usable graphics path gets the processor; a
* device that cannot do either is TOLD WHAT WAS ACTUALLY WRONG rather than
* "unsupported". A refusal is reached only after every rung has been measured.
*/
async function probeBrowserCapabilities() {
	const rungs = [];
	if (typeof window === "undefined") return [{
		path: "wasm_single",
		available: false,
		why: "there is no browser here"
	}];
	const gpu = await probeWebGpu();
	const smallest = WEBGPU_TIERS[0];
	const needed = smallest ? runtimeMemoryBytes(smallest) : 0;
	if (gpu.ok) {
		const fits = gpu.bytes === null || needed === 0 || gpu.bytes >= needed;
		rungs.push({
			path: "webgpu",
			available: fits,
			why: gpu.why
		});
		rungs.push({
			path: "webgpu_reduced",
			available: true,
			why: fits ? "a smaller working set, if the standard one does not start" : "the reported allocation limit is below the standard working set, so a smaller one is tried"
		});
	} else {
		rungs.push({
			path: "webgpu",
			available: false,
			why: gpu.why
		});
		rungs.push({
			path: "webgpu_reduced",
			available: false,
			why: gpu.why
		});
	}
	const wasmOk = typeof WebAssembly !== "undefined";
	const wasmWhy = wasmOk ? "the processor can run OCADE's engine" : "this browser cannot run OCADE's engine on the processor";
	const { selfHostedMultiThreadWasm } = await import("./browser-wasm-CfxOyK0w.mjs");
	const threadedBuild = wasmOk && threadsAvailable() ? await selfHostedMultiThreadWasm() : null;
	rungs.push({
		path: "wasm_threaded",
		available: wasmOk && threadedBuild !== null,
		why: !wasmOk ? wasmWhy : !threadsAvailable() ? "this page is not isolated, so it can only use one processor core" : threadedBuild === null ? "this deployment does not host the multi-core engine build" : "this page can use several processor cores"
	});
	rungs.push({
		path: "wasm_single",
		available: wasmOk,
		why: wasmWhy
	});
	if (!ModelStore.isSupported()) {
		const why = "this browser will not let OCADE keep anything between visits, which an on-device engine needs";
		for (const rung of rungs) if (rung.path !== "desktop_bridge" && rung.path !== "paired_device") {
			rung.available = false;
			rung.why = why;
		}
	}
	return rungs;
}
/**
* What a path needs downloaded, if anything.
*
* The WebGPU rungs return null, and that is a statement rather than an
* omission: their runtime fetches and caches its own shards, so OCADE has no
* single file to stream and no digest of its own to enforce there. It says so
* instead of pretending — and the runtime still reports through the authority,
* so there is one progress story either way.
*
* The processor rungs return a real target, because that is the artifact OCADE
* distributes, sizes, digests and verifies itself.
*/
async function resolveInstallTarget(path) {
	if (path === "desktop_bridge" || path === "paired_device") return null;
	if (path === "webgpu" || path === "webgpu_reduced") return null;
	const tier = WASM_TIERS[0];
	const entry = resolvedFor(tier);
	const publisher = ggufUrl(tier);
	if (!entry || !publisher) return null;
	return {
		version: tier.version,
		totalBytes: entry.sizeBytes,
		sha256: sha256For(tier),
		sources: sourceLadder({
			cdnUrl: cdnUrlFor(tier),
			sameOriginUrl: sameOriginGgufUrl(tier),
			publisherUrl: publisher
		}),
		legacyKey: storageKeyFor(tier)
	};
}
/**
* Run `work` only if this tab wins the install lock.
*
* Web Locks rather than a timestamp in localStorage: the lock is held by the
* page, so the browser releases it when that page closes, crashes or is
* discarded under memory pressure. The queue is the browser's too, so exactly
* one waiter is promoted and there is no window in which two tabs both believe
* they won.
*
* `ifAvailable` means a losing tab returns IMMEDIATELY as a follower rather
* than queueing behind a transfer that may take minutes. It watches the owner's
* progress instead, which is what a second tab should show.
*/
async function acquireInstallLock(work) {
	const locks = globalThis.navigator?.locks;
	if (!locks?.request) {
		await work();
		return true;
	}
	let won = false;
	await locks.request(INSTALL_LOCK, { ifAvailable: true }, async (lock) => {
		if (!lock) return;
		won = true;
		await work();
	});
	return won;
}
/** State published to, and received from, the other tabs. */
function createBus(onState) {
	if (typeof BroadcastChannel !== "function") return () => {};
	let channel;
	try {
		channel = new BroadcastChannel(INSTALL_CHANNEL);
	} catch {
		return () => {};
	}
	channel.onmessage = (event) => {
		if (event.data && typeof event.data === "object") onState(event.data);
	};
	return (state) => {
		try {
			channel.postMessage(state);
		} catch {}
	};
}
var authority = null;
/**
* The application's single installation authority.
*
* Lazily constructed and then permanent. Every surface calls this; nothing
* constructs `ModelInstallationAuthority` anywhere else, which is what makes
* "one canonical authority" a fact about the code rather than a convention
* somebody has to follow.
*/
function installationAuthority() {
	if (authority) return authority;
	const created = new ModelInstallationAuthority({
		vault: modelVault,
		fetchImpl: ((input, init) => globalThis.fetch(input, init)),
		probeCapabilities: probeBrowserCapabilities,
		resolveTarget: resolveInstallTarget,
		activateRuntime: (path, version, report) => activateBrowserRuntime(path, version, report),
		storageHeadroom: async () => {
			const nav = globalThis.navigator;
			if (!nav?.storage?.estimate) return null;
			try {
				const estimate = await nav.storage.estimate();
				if (estimate.quota === void 0) return null;
				return Math.max(0, estimate.quota - (estimate.usage ?? 0));
			} catch {
				return null;
			}
		},
		requestPersistence: () => modelStore.requestPersistence(),
		hashBlob: (blob, signal) => sha256OfBlobStreaming(blob, { signal }),
		acquireLock: acquireInstallLock,
		broadcast: (state) => bus(state)
	});
	const bus = createBus((state) => created.observe(state));
	onBackgroundFetchStaged((ok) => {
		if (!ok) return;
		created.install({ reason: "resumed" });
	});
	authority = created;
	return created;
}
/**
* Load the engine for a path and prove it starts.
*
* Imported lazily and only for the rung being tried, so a device that routes to
* the graphics engine never downloads the processor runtime's code and the
* other way round. Neither library is in the first-paint bundle.
*/
async function activateBrowserRuntime(path, version, report) {
	try {
		const { activateRuntimeForPath } = await import("./runtime-activation-Da4gjBZz.mjs").then((n) => n.n).then((n) => n.n);
		return await activateRuntimeForPath(path, version, report);
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "The engine could not be started."
		};
	}
}
//#endregion
export { installation_browser_cz2yGPNC_exports as n, installationAuthority as t };
