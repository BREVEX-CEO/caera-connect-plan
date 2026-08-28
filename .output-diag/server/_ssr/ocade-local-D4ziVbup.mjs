import { s as supportsThinkingField } from "./fixed-model-DezWsm1J.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-local-D4ziVbup.js
/**
* Bounds for streamed responses.
*
* Two streaming readers accumulated without any cap: the cloud chat reader in
* the OCADE route (`acc += decode(value)`) and the local-engine reader in
* `ocade-local` (`buffer += decode(value)`). Both stopped only when the server
* chose to stop.
*
* Cancellation was handled at both — an abort signal reaches the fetch — but
* cancellation is a USER action. Nothing bounded a server that simply keeps
* sending: memory grows until the tab dies, and in the route each chunk also
* triggers a re-render, so the page becomes unusable well before that.
*
* This is not only a remote-attacker concern. The local bridge URL is
* user-configurable, so it can point at something other than a local model
* server, and a wrong address that happens to stream is enough.
*
* Every other boundary in this codebase is bounded — the document decoders cap
* expanded XML, the relay caps request bodies, research caps redirects. These
* two were the exception.
*/
/** Total decoded characters a single streamed reply may accumulate. */
var MAX_STREAM_CHARS = 2e6;
/**
* Characters a single un-terminated line may reach in a line-delimited stream.
*
* NDJSON readers hold bytes until a newline arrives. A stream that never sends
* one grows the buffer indefinitely, so the line itself needs a ceiling
* independent of the total.
*/
var MAX_STREAM_LINE_CHARS = 1e6;
var StreamLimitError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "StreamLimitError";
	}
};
/**
* Throws when a stream exceeds its budget.
*
* Fails loudly rather than silently truncating: a reply quietly cut in half
* looks like a complete answer, which is worse than a visible failure.
*/
function assertStreamWithinLimit(chars, limit = MAX_STREAM_CHARS, what = "reply") {
	if (chars > limit) throw new StreamLimitError(`The streamed ${what} exceeded ${limit.toLocaleString()} characters and was stopped. OCADE will not keep buffering a response that does not end.`);
}
var LOCAL_PROFILE_LABEL = {
	general: "OCADE Local",
	fast: "OCADE Local Fast",
	vision: "OCADE Local Vision",
	code: "OCADE Local Code"
};
/**
* Map an engine descriptor to the user-facing capability label. Pure and total:
* any unexpected shape falls back to the safe generic labels, never a raw name.
*/
function capabilityLabelFor(engine) {
	if (engine.automatic) return "OCADE Automatic";
	return engine.profile ? LOCAL_PROFILE_LABEL[engine.profile] : "OCADE Local";
}
/**
* OCADE local-first engine (Plan §14, decisions #10, #11, #17, #20).
*
* Talks to a local Ollama-compatible runtime through a bridge URL (default
* http://localhost:11434). Local inference is UNLIMITED and stays on-device —
* this module never sends prompts to any server. Raw model/runtime names are
* used only internally for routing/diagnostics; every user-facing surface shows
* the OCADE capability label (OCADE Local / Fast / Vision / Code), never the raw
* name (decision #18).
*
* Classification and planning are pure (unit-tested). Discovery/health/streaming
* take an injectable fetch so they are testable and SSR-safe.
*/
var DEFAULT_LOCAL_BRIDGE_URL = "http://localhost:11434";
var VISION_HINT = /(llava|vision|vl(?::|-|\b)|minicpm-v|moondream|bakllava|internvl|pixtral|llama3\.2-vision)/i;
var CODE_HINT = /(coder|code|deepseek-coder|starcoder|codellama|codegemma)/i;
/**
* Does the runtime itself say this model takes images?
*
* Returns null when the runtime declares nothing, which is the ONLY case where
* guessing from the name is appropriate. A runtime that lists capabilities and
* omits "vision" is stating a fact, and a regex must not overrule it — sending
* images to a text-only model produces a confident answer about nothing.
*/
function declaredVision(raw) {
	const declared = raw.capabilities;
	if (!Array.isArray(declared) || declared.length === 0) return null;
	return declared.some((c) => String(c).toLowerCase() === "vision");
}
/** Parse "7.6B", "30.5B", "7B" → number of billions. */
function parseParamsB(paramSize) {
	if (!paramSize) return null;
	const m = /([\d.]+)\s*([bm])/i.exec(paramSize);
	if (!m) return null;
	const n = Number(m[1]);
	if (!Number.isFinite(n)) return null;
	return m[2].toLowerCase() === "m" ? n / 1e3 : n;
}
/**
* Classify a raw local model into an OCADE capability profile. Pure. Precedence:
* vision → code → fast (small) → general.
*/
function classifyLocalModel(raw) {
	const id = raw.name;
	const isCloudPointer = /:cloud$/i.test(id) || (raw.size ?? 0) === 0;
	const families = raw.details?.families ?? [];
	const vision = declaredVision(raw) ?? (VISION_HINT.test(id) || families.some((f) => /vision|clip|vit|vl$/i.test(f ?? "")));
	const paramsB = parseParamsB(raw.details?.parameter_size);
	let profile;
	if (vision) profile = "vision";
	else if (CODE_HINT.test(id)) profile = "code";
	else if (paramsB !== null && paramsB <= 4) profile = "fast";
	else profile = "general";
	return {
		id,
		sizeBytes: raw.size ?? 0,
		paramsB,
		vision,
		profile,
		label: capabilityLabelFor({
			locality: "local",
			profile
		}),
		isCloudPointer
	};
}
function getFetch(f) {
	if (f) return f;
	if (typeof fetch !== "undefined") return fetch;
	return null;
}
/**
* Default per-request budget for discovery.
*
* Was 4s shared across BOTH requests, which is how a machine with nine
* installed models reported "No on-device engine is installed" during a
* runtime evidence run — the engine was fine, one probe was briefly slow
* because it had just finished loading a 6 GB model, and a single shared
* deadline turned that into a false claim about the user's own computer.
* A local engine busy loading weights is the NORMAL case, not an outage.
*/
var DISCOVERY_TIMEOUT_MS = 8e3;
/** One request, with its own deadline. Never shares a budget with another. */
async function fetchWithDeadline(f, url, timeoutMs) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await f(url, { signal: ctrl.signal });
	} finally {
		clearTimeout(timer);
	}
}
var isAbort = (e) => e instanceof Error && e.name === "AbortError";
/**
* Did the transport give up waiting, rather than fail to connect?
*
* Node's fetch abandons a request whose first response byte takes longer than
* 300 seconds. Measured here: a 5,849-token document sent to a model that had
* to be RELOADED at a new context window ran past that limit and surfaced as
* "unreachable" — on a machine where the engine was running and working. The
* same request, once the model was warm at that window, returned headers in
* 37.9 seconds and the correct answer in 40.6.
*
* The distinction matters because it decides what the user is told to do:
* "start the engine" is useless advice for an engine that is already running.
*/
function isSlowResponseError(e) {
	if (!(e instanceof Error)) return false;
	const cause = e.cause;
	const code = cause?.code ?? "";
	const name = cause?.name ?? e.name;
	return code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT" || code === "ETIMEDOUT" || /timeout/i.test(name) || /timeout/i.test(e.message);
}
/** Health + installed-model discovery against the local bridge. */
async function discoverLocalModels(bridgeUrl = DEFAULT_LOCAL_BRIDGE_URL, fetchImpl, timeoutMs = DISCOVERY_TIMEOUT_MS) {
	const f = getFetch(fetchImpl);
	if (!f) return {
		ok: false,
		reachable: false,
		models: [],
		reason: "No fetch available."
	};
	const base = bridgeUrl.replace(/\/+$/, "");
	let version;
	try {
		const vres = await fetchWithDeadline(f, `${base}/api/version`, timeoutMs);
		if (vres.ok) version = (await vres.json()).version;
	} catch {
		version = void 0;
	}
	let tres;
	try {
		tres = await fetchWithDeadline(f, `${base}/api/tags`, timeoutMs);
	} catch (e) {
		if (!isAbort(e)) return {
			ok: false,
			reachable: false,
			models: [],
			reason: "Local engine unreachable."
		};
		try {
			tres = await fetchWithDeadline(f, `${base}/api/tags`, timeoutMs);
		} catch (retryError) {
			return {
				ok: false,
				reachable: isAbort(retryError),
				models: [],
				version,
				reason: isAbort(retryError) ? "The local engine is taking longer than expected — it may still be loading a model." : "Local engine unreachable."
			};
		}
	}
	try {
		if (!tres.ok) return {
			ok: false,
			reachable: true,
			version,
			models: [],
			reason: `Model list HTTP ${tres.status}.`
		};
		const models = ((await tres.json()).models ?? []).map(classifyLocalModel).filter((m) => !m.isCloudPointer);
		return {
			ok: models.length > 0,
			reachable: true,
			version,
			models,
			reason: models.length === 0 ? "No on-device models installed yet." : void 0
		};
	} catch (e) {
		const reason = isAbort(e) ? "Local engine timed out." : "Local engine unreachable.";
		return {
			ok: false,
			reachable: false,
			version,
			models: [],
			reason
		};
	}
}
/**
* The context window a request needs — and why OCADE has to name it.
*
* THE DEFECT THIS EXISTS TO CLOSE. The runtime defaults to a 4,096-token
* context and SILENTLY DROPS whatever does not fit. It does not warn, it does
* not fail, and the model answers confidently from the fragment that survived.
* Measured on this machine: a 220-line log with an access code on line 147 came
* to 5,654 tokens, and the same question that returns "742913" with a large
* enough window returned "74" — a number that appears nowhere in the document.
* A user attaching a report and getting an answer about the half of it that
* happened to fit is the worst failure this product can have, because nothing
* on screen says anything went wrong.
*
* WHY IT IS NOT SIMPLY SET LARGE. The KV cache scales with the window, and it
* is resident memory on a machine that is also running everything else the
* person is doing. So the window is sized to the REQUEST: short chats
* explicitly ask for the 4,096-token floor, and only a request that genuinely
* needs more asks for more. An explicit floor matters because model defaults
* are not stable: the installed vision model defaulted to 128,000 tokens and
* allocated about 13 GB for a one-image proof until OCADE bounded it.
*/
var CONTEXT_DEFAULT = 4096;
/**
* Steps rather than an exact figure: the runtime reallocates and reloads when
* the window changes, so a value that drifts with every message would reload
* the model constantly. Rounding to a step means consecutive turns in the same
* conversation usually ask for the same window and reuse the loaded weights.
*/
var CONTEXT_STEPS = [
	4096,
	8192,
	16384,
	32768
];
/** Room for the answer itself. A window that fits only the prompt cannot reply. */
var CONTEXT_REPLY_RESERVE = 1024;
/**
* A picture is not free. Vision models expand an image into hundreds of tokens
* before a word is read; 1,200 is a conservative figure that errs towards
* asking for a larger window rather than silently truncating one.
*/
var CONTEXT_TOKENS_PER_IMAGE = 1200;
/**
* The largest window OCADE will ever ask for.
*
* Beyond this the KV cache stops being affordable on any hardware this product
* targets. A request larger than the machine's ceiling is REPORTED rather than
* quietly cut.
*/
var CONTEXT_CEILING = 32768;
/**
* How large a window this particular machine can afford.
*
* MEASURED, not assumed. On the reference machine (15.65 GB, no acceleration)
* the 8B tier occupies 5.53 GB at the runtime's default window and 7.35 GB at
* 16,384 — an extra 1.82 GB of resident memory for the KV cache alone. At
* 32,768 the same model would approach 9 GB, which on a 16 GB laptop that is
* also running a browser and everything else is the point where the machine
* starts swapping and the whole system becomes unpleasant, not just the chat.
*
* So the ceiling scales with total memory. An unknown total gets the smallest
* step above the default: guessing upwards here is paid for by the user in
* responsiveness, and that is not OCADE's to spend.
*/
function contextCeilingFor(totalRamBytes) {
	const GIB = 1024 ** 3;
	if (!totalRamBytes || totalRamBytes <= 0) return 8192;
	if (totalRamBytes < 12 * GIB) return 8192;
	if (totalRamBytes < 20 * GIB) return 16384;
	return CONTEXT_CEILING;
}
/**
* Roughly how many tokens a message list costs.
*
* 3.5 characters per token is deliberately pessimistic for English — real
* tokenisers average closer to 4 — because underestimating means truncation
* and overestimating merely costs a little memory.
*/
function estimateTokens(messages) {
	let characters = 0;
	let images = 0;
	for (const message of messages) {
		characters += message.content.length;
		images += message.images?.length ?? 0;
	}
	return Math.ceil(characters / 3.5) + images * CONTEXT_TOKENS_PER_IMAGE;
}
/**
* Prompt-evaluation speed on a machine with no graphics acceleration.
*
* MEASURED, from the engine's own counters on the reference machine: a 5,654-
* token prompt took 458.4 seconds to evaluate — 12.3 tokens per second — after
* which generation itself took 3.8 seconds and the answer was correct. Reading
* is the whole cost; answering is almost free.
*
* This is the figure behind the warning. Eight minutes of silence with a
* spinner is indistinguishable from a hang, and a user who is told "this will
* take a few minutes" can decide to trim the document instead of concluding
* the product is broken.
*/
var CPU_PROMPT_TOKENS_PER_SECOND = 12.3;
/**
* How long the engine will spend reading, when that can be said honestly.
*
* Returns null unless the machine was MEASURED to have no acceleration. With a
* graphics card the figure is different by an order of magnitude and nothing
* here has measured it, so no estimate is offered rather than a made-up one —
* a wrong time estimate is worse than none, because people plan around it.
*/
function estimatedReadSeconds(estimatedTokens, hasDiscreteGpu) {
	if (hasDiscreteGpu !== false) return null;
	return Math.round(estimatedTokens / CPU_PROMPT_TOKENS_PER_SECOND);
}
/**
* Decide the window for one request. Pure, so the arithmetic is testable.
*
* `totalRamBytes` is what keeps this honest about the machine rather than about
* the model: pass the measured total and the ceiling scales with it; omit it
* and the smallest ceiling applies, because an unmeasured machine must not be
* charged for an assumption.
*/
function planContextWindow(messages, totalRamBytes, hasDiscreteGpu) {
	const ceiling = contextCeilingFor(totalRamBytes);
	const estimatedTokens = estimateTokens(messages);
	const readSeconds = estimatedReadSeconds(estimatedTokens, hasDiscreteGpu);
	const needed = estimatedTokens + CONTEXT_REPLY_RESERVE;
	if (needed <= 4096) return {
		numCtx: CONTEXT_DEFAULT,
		estimatedTokens,
		exceedsCeiling: false,
		estimatedReadSeconds: readSeconds
	};
	return {
		numCtx: CONTEXT_STEPS.filter((size) => size <= ceiling).find((size) => size >= needed) ?? ceiling,
		estimatedTokens,
		exceedsCeiling: needed > ceiling,
		estimatedReadSeconds: readSeconds
	};
}
/**
* Ask the runtime to load a model's weights WITHOUT sending a prompt.
*
* Cold start is the remaining lag, and it is entirely disk time. Re-measured on
* the reference machine against the engine OCADE actually ships, first token
* for the same question:
*
*     cold  294,547 ms
*     warm      672 ms
*
* Four hundred times. The warm figure is a genuinely fast assistant; the cold
* one is what a person meets when they open the app, and nothing on screen
* explains it to them. That gap is the entire argument for this function.
*
* The cold figure is a worst case — that machine was under heavy memory
* pressure when it was taken — and it is quoted rather than averaged away
* because the worst case is the one a user remembers.
*
* WHY THIS IS NOT CALLED ON MOUNT. Loading several gigabytes because someone
* glanced at a screen is its own way of making a machine unusable. The right
* trigger is intent — the caller invokes this when the user starts TYPING, so
* the weights land while they finish the sentence and nothing is loaded for a
* visit that was never going to send a message.
*
* Sends an empty message list, which the runtime treats as load-only: no
* prompt, no generation, nothing leaves the machine. Failure is silent by
* design — this is an optimisation, and a failed preload must never surface as
* an error for a message the user has not sent yet. The subsequent real
* request simply pays the load cost as before.
*/
async function preloadLocalModel(bridgeUrl, modelId, fetchImpl, numCtx) {
	const f = getFetch(fetchImpl);
	if (!f) return false;
	try {
		return (await f(`${bridgeUrl.replace(/\/+$/, "")}/api/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model: modelId,
				messages: [],
				options: { num_ctx: numCtx ?? 4096 },
				keep_alive: "30m"
			})
		})).ok;
	} catch {
		return false;
	}
}
/**
* Read one tool call, refusing anything that is not usable.
*
* Arguments arrive as an object from Ollama and as a JSON STRING from
* OpenAI-compatible runtimes, and a model under pressure sometimes emits a
* string that is not valid JSON at all. All three are handled here so the agent
* loop only ever sees a real object — a malformed call is dropped rather than
* passed on as `{}`, because an empty argument set on, say, a file action is
* not a harmless default.
*/
function readToolCall(raw) {
	const name = raw?.function?.name;
	if (typeof name !== "string" || !name.trim()) return null;
	const rawArgs = raw.function?.arguments;
	let args = {};
	if (typeof rawArgs === "string") try {
		const parsed = JSON.parse(rawArgs);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		args = parsed;
	} catch {
		return null;
	}
	else if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) args = rawArgs;
	return {
		...typeof raw.id === "string" ? { id: raw.id } : {},
		name: name.trim(),
		arguments: args
	};
}
/**
* Stream a chat completion directly from the local runtime (browser → device).
* The prompt never leaves the machine. Parses Ollama's NDJSON /api/chat stream.
* Supports cancellation via `signal`, and tool calls via `handlers.tools`.
*/
async function streamLocalChat(bridgeUrl, modelId, messages, handlers, fetchImpl) {
	const f = getFetch(fetchImpl);
	if (!f) return {
		ok: false,
		reason: "No fetch available."
	};
	const base = bridgeUrl.replace(/\/+$/, "");
	const context = planContextWindow(messages, handlers.totalRamBytes);
	handlers.onContextPlan?.(context);
	const send = (includeThink) => f(`${base}/api/chat`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			model: modelId,
			messages,
			stream: true,
			...includeThink ? { think: handlers.think === true } : {},
			...handlers.tools && handlers.tools.length > 0 ? { tools: handlers.tools } : {},
			options: { num_ctx: context.numCtx },
			keep_alive: "30m"
		}),
		signal: handlers.signal
	});
	let res;
	try {
		res = await send(supportsThinkingField(modelId));
		if (res.status === 400) {
			const detail = await res.clone().text();
			if (/think/i.test(detail)) res = await send(false);
		}
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") return {
			ok: false,
			reason: "cancelled"
		};
		if (isSlowResponseError(e)) return {
			ok: false,
			reason: "The engine did not send anything back in time. A long document can take several minutes to read on this computer."
		};
		return {
			ok: false,
			reason: "Local engine unreachable."
		};
	}
	if (!res.ok || !res.body) return {
		ok: false,
		reason: `Local engine HTTP ${res.status}.`
	};
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		let streamedChars = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			const piece = decoder.decode(value, { stream: true });
			streamedChars += piece.length;
			buffer += piece;
			assertStreamWithinLimit(streamedChars, MAX_STREAM_CHARS, "local reply");
			assertStreamWithinLimit(buffer.length, MAX_STREAM_LINE_CHARS, "local reply line");
			let nl;
			while ((nl = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (!line) continue;
				try {
					const obj = JSON.parse(line);
					const piece = obj.message?.content;
					if (piece) handlers.onToken(piece);
					const calls = obj.message?.tool_calls;
					if (calls && handlers.onToolCall) for (const call of calls) {
						const parsed = readToolCall(call);
						if (parsed) handlers.onToolCall(parsed);
					}
				} catch {}
			}
		}
		return { ok: true };
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") return {
			ok: false,
			reason: "cancelled"
		};
		if (e instanceof StreamLimitError) return {
			ok: false,
			reason: e.message
		};
		return {
			ok: false,
			reason: "Local stream interrupted."
		};
	}
}
//#endregion
export { preloadLocalModel as a, planContextWindow as i, capabilityLabelFor as n, streamLocalChat as o, discoverLocalModels as r, DEFAULT_LOCAL_BRIDGE_URL as t };
