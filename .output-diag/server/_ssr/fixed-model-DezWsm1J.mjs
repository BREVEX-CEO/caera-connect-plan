//#region node_modules/.nitro/vite/services/ssr/assets/fixed-model-DezWsm1J.js
/**
* ~1.9 GB. Every OCADE installation, on every platform, gets exactly this.
*
* The id is the runtime's own name for it and is never shown to a user; the
* interface says "OCADE Local" and nothing else. Changing this constant changes
* the model for the whole product, which is the point — there is no second
* place to look.
*
* WHY THIS IS QWEN2.5 AND NOT QWEN3
* ---------------------------------
* qwen3:4b cannot be stopped from reasoning. Its chat template ends the
* generation prompt with an unconditional `<think>` — no guard on the line —
* so every single generation begins inside a reasoning block whatever the
* request asks for, and Ollama's `think` field only decides which field the
* reasoning is filed under. Driving `/api/generate` with `raw:true` and a
* prompt that closes the block immediately did not help either: still 40
* seconds of "Okay, let's see, the user wants..." before anything usable.
*
* For Chat that is a cost. For Control + Work it was a defect, because the
* reasoning consumed the whole token budget before the tool call was written:
*
*     num_predict 300    no tool call at all      24 s
*     num_predict 800    no tool call at all      83 s
*     num_predict 2000   tool call, finally       125 s  (+94 s next turn)
*
* A tool call that never arrives is not a slow success. Qwen2.5 has no forced
* thinking block, supports Ollama tool calling, and at 3B is smaller than the
* model it replaces — so the reasoning tax disappears and the weights are
* ~600 MB lighter to download on first run.
*
* `scripts/measure-thinking-modes.mjs` is how these numbers were taken, and
* how to re-take them before changing this line again.
*/
var OCADE_MODEL_ID = "qwen2.5:3b";
var FIXED_MODEL = {
	id: OCADE_MODEL_ID,
	family: "Qwen2.5",
	parameters: "3B",
	quantisation: "Q4_K_M",
	approxBytes: 1929e6,
	runtime: "gguf_http",
	formFactor: "desktop",
	vision: false
};
/**
* Whether the model reasons before answering, per surface.
*
* THE `think` FIELD DOES NOT CONTROL THINKING ON THIS MODEL
* ---------------------------------------------------------
* Measured against qwen3:4b on the target machine with `scripts/measure-
* thinking-modes.mjs`: three warm-up turns, five timed runs per mode, one
* instruction ("Open Notepad") and one tool.
*
*   mode                       native tool_calls   median
*   think:false                        0/5         22.4 s
*   think:true                         0/5         21.2 s
*   think omitted                      0/5         21.6 s
*   /no_think in the system prompt     5/5         14.4 s
*
* Two things follow, and the second one was a live defect.
*
* First: the `think` field changes only WHERE the reasoning is put, never
* whether it happens. `think:false` leaves ~865 characters of "Okay, the user
* wants me to..." in `content`; `think:true` moves the same reasoning to the
* separate `thinking` field. Neither is faster. The `/no_think` TOKEN is what
* actually suppresses it, and doing so is ~35% quicker.
*
* Second: with reasoning on, this model narrates the tool call as prose
* INSTEAD of emitting one. `ocade-local.ts` reads `message.tool_calls` and has
* no content-JSON fallback, so those turns produced nothing to execute. The
* agent turn shipped `think: false` and was therefore getting zero tool calls
* from a model that looked, in the logs, like it was answering.
*
* An earlier revision of this comment concluded the opposite. It measured
* whether `content` parsed as JSON, which the loop does not read.
*
* So: Control + Work suppresses thinking with the token, because a turn that
* cannot be executed is not a slower success, it is a failure. Chat keeps it,
* because a person is reading the answer and the reasoning improves it — and
* there the reasoning goes to its own field, out of the reply.
*
* The real latency win for control is not this flag at all. It is not calling
* the model: `work/fast-router.ts` answers deterministic instructions in under
* a millisecond, against 14 s here.
*
* A FUNCTION, NOT A CONSTANT, because the day a model handles `think:false`
* properly this is the one line to change — and the script above is how to
* re-take the measurement before changing it.
*/
function thinkingFor(surface, preference) {
	if (surface === "control") return false;
	return preference ?? true;
}
/**
* Whether Ollama's `think` field may be sent for this model at all.
*
* IT MAY NOT, AND SENDING IT IS A 400 RATHER THAN A NO-OP.
*
*   POST /api/chat  {"model":"qwen2.5:3b","think":true}
*   → 400 {"error":"\"qwen2.5:3b\" does not support thinking"}
*
* Qwen2.5 has no reasoning mode to switch, so Ollama rejects the field rather
* than ignoring it. `think:false` happens to be accepted today, but relying on
* one of two values being tolerated is relying on an implementation detail —
* and the failure is a hard error that would take Chat down entirely, not a
* degraded answer somebody notices later.
*
* So the field is not sent. This function exists so that decision is made in
* one place with the evidence attached, rather than as an omission somebody
* later "fixes" by adding the flag back.
*/
function supportsThinkingField(modelId = OCADE_MODEL_ID) {
	return /^qwen3[:-]/i.test(modelId);
}
/**
* The system-prompt clause that makes Chat's thinking switch a real thing.
*
* WHY A PROMPT CLAUSE AND NOT A FLAG
* -----------------------------------
* The switch has to change what the model is actually asked, or it is
* decoration. On a model with a native reasoning mode the flag does that. On
* qwen2.5 there is no such mode and the flag is refused, so the honest
* equivalent is an instruction: it changes the request bytes, it changes the
* answer, and the user can see the difference.
*
* Deliberately NOT "think step by step and show your working" — that produces
* a wall of reasoning in the reply, which is the thing the reasoning field
* existed to keep out. It asks for the deliberation to happen and the answer
* to arrive whole.
*/
function deliberationClause(thinking) {
	return thinking ? " Work the question through carefully before answering, considering the cases that could make a quick answer wrong. Give the reasoned answer itself, not a transcript of arriving at it." : " Answer directly and briefly. Do not deliberate at length.";
}
/**
* Qwen3's own suppression token.
*
* IT GOES IN THE SYSTEM MESSAGE, NEVER IN THE USER'S TEXT.
*
* Appending it to the prompt works equally well and cost a real bug: a search
* once ran for the literal string "/no_think" because the token had been glued
* onto the end of what the user typed and nothing downstream knew it was not
* part of the query. Keeping it in the system message means user text is never
* something that has to be cleaned up afterwards.
*/
var NO_THINK_TOKEN = "/no_think";
/**
* The system-message suffix that enforces `thinking` for one turn.
*
* Returns the token when reasoning must be off, and an empty string otherwise,
* so callers can append unconditionally.
*/
function thinkingSuffix(thinking) {
	return thinking ? "" : ` ${NO_THINK_TOKEN}`;
}
function formFactorOf(platform) {
	return platform === "android" || platform === "ios" ? "mobile" : "desktop";
}
/**
* The one function that says which model OCADE uses. It takes a platform and
* ignores it for the WEIGHTS, using it only to say how they are hosted.
*
* Kept as a function rather than exporting the constant directly so every
* caller keeps going through one place — and so the day a platform genuinely
* cannot host this model, there is somewhere to say so rather than a constant
* scattered through forty files.
*/
function resolveFixedModel(platform) {
	if (formFactorOf(platform) === "desktop") return FIXED_MODEL;
	return {
		...FIXED_MODEL,
		runtime: "gguf_embedded",
		formFactor: "mobile"
	};
}
/**
* Detect the platform from the running environment.
*
* Capacitor is checked FIRST. A Capacitor app is a web view, so every
* browser-shaped check below would answer "desktop" on a phone and hand a
* 5 GB download to a device that cannot take it.
*/
function detectPlatform(env) {
	const capacitor = env?.capacitorPlatform ?? readCapacitorPlatform();
	if (capacitor === "android") return "android";
	if (capacitor === "ios") return "ios";
	const node = env?.nodePlatform ?? readNodePlatform();
	if (node === "win32") return "windows";
	if (node === "darwin") return "macos";
	if (node === "linux") return "linux";
	const agent = (env?.userAgent ?? readUserAgent() ?? "").toLowerCase();
	if (/android/.test(agent)) return "android";
	if (/iphone|ipad|ipod/.test(agent)) return "ios";
	if (/mac os x|macintosh/.test(agent)) return "macos";
	if (/linux/.test(agent)) return "linux";
	return "windows";
}
function readCapacitorPlatform() {
	if (typeof globalThis === "undefined") return null;
	const platform = globalThis.Capacitor?.getPlatform?.();
	return platform && platform !== "web" ? platform : null;
}
function readNodePlatform() {
	const proc = globalThis.process;
	return proc?.versions?.node && proc.platform ? proc.platform : null;
}
function readUserAgent() {
	return globalThis.navigator?.userAgent ?? null;
}
var NOT_CHOSEN_REASON = "OCADE always uses its own configured engine on this platform.";
/**
* Choose the model for a request.
*
* Size, RAM, GPU and measured latency are not inputs and cannot be passed in.
* The only branch is capability: an image needs a vision model.
*/
function selectFixedModel(input) {
	const spec = resolveFixedModel(input.platform);
	const usable = input.installed.filter((m) => !m.isCloudPointer);
	const notChosen = usable.filter((m) => m.id !== spec.id).map((m) => ({
		modelId: m.id,
		why: NOT_CHOSEN_REASON
	}));
	if (input.visionRequired) {
		const vision = usable.find((m) => m.vision === true);
		if (!vision) return {
			ok: false,
			modelId: null,
			spec,
			basis: "vision_unavailable",
			reason: "This request includes an image, and no engine on this device can read images. Install a vision engine, or remove the image.",
			notChosen
		};
		return {
			ok: true,
			modelId: vision.id,
			spec,
			basis: "fixed_vision_substitute",
			notChosen: notChosen.filter((m) => m.modelId !== vision.id)
		};
	}
	if (!usable.some((m) => m.id === spec.id)) return {
		ok: false,
		modelId: null,
		spec,
		basis: "not_installed",
		reason: `OCADE's engine (${spec.family} ${spec.parameters}) is not installed on this device yet.`,
		notChosen
	};
	return {
		ok: true,
		modelId: spec.id,
		spec,
		basis: "fixed",
		notChosen
	};
}
//#endregion
export { resolveFixedModel as a, thinkingFor as c, detectPlatform as i, thinkingSuffix as l, OCADE_MODEL_ID as n, selectFixedModel as o, deliberationClause as r, supportsThinkingField as s, FIXED_MODEL as t };
