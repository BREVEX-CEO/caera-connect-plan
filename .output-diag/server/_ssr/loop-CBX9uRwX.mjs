import { n as __exportAll } from "../_runtime.mjs";
import { a as signatureOf, n as isRetryable, r as isTerminal } from "./outcomes-wNfoXf5Q.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as schemasFor, t as findTool } from "./tool-registry-BXQ-LCdE.mjs";
import { t as ocadeCorePolicy } from "./ocade-core-policy-CVfg3zp2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loop-CBX9uRwX.js
var loop_CBX9uRwX_exports = /* @__PURE__ */ __exportAll({
	a: () => compactTranscript,
	c: () => parseTokenBudget,
	i: () => runAgentTask,
	l: () => classifyDeterministic,
	n: () => describe,
	o: () => estimateTranscriptTokens,
	r: () => loop_exports,
	s: () => runQuery,
	t: () => Revision
});
/**
* Stage 1 of tool routing: decide WHICH KIND of help a request needs, before
* loading a single tool schema.
*
* THE PROBLEM THIS SOLVES
* -----------------------
* A complete OCADE tool catalogue — browser, desktop, files, system, research,
* connectors, devices — is several thousand tokens of JSON schema. Sending all
* of it on every turn costs context that the actual conversation needs, slows
* the first token on a local 8B model measurably, and measurably worsens
* choices: a model shown eighty tools picks the wrong one far more often than a
* model shown six.
*
* So the router runs first and cheaply. It answers one question — which
* domains? — and only those domains' schemas are loaded in stage 2.
*
* WHY A KEYWORD PASS EXISTS ALONGSIDE THE MODEL
* ---------------------------------------------
* Not as a shortcut, but as a floor. "stop", "what's on my screen" and "open
* chrome" must classify correctly even when the model is cold, busy or
* mid-download. The deterministic pass handles the unambiguous cases in under a
* millisecond and defers everything else to the model, which is where genuine
* ambiguity belongs. It is a fast path, never an override: when the
* deterministic pass is unsure it returns nothing rather than guessing.
*/
var DOMAINS = [
	"os_app",
	"files",
	"content",
	"web",
	"connectors",
	"cross_device",
	"conversation"
];
var DOMAIN_LABELS = {
	os_app: "operating system and application control",
	files: "finding and organising files",
	content: "creating documents, media and other output",
	web: "browsing and researching on the web",
	connectors: "connected services and smart-home",
	cross_device: "phones and other paired devices",
	conversation: "talking, and what OCADE remembers about the user between sessions"
};
var CERTAIN = [
	{
		pattern: /\bon (my|the) screen\b|\bwhat do you see\b|\bwhat can you see\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(click|press|tap) (the )?[\w ]{1,30}\b(button)?\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\bopen (chrome|edge|a browser|the browser)\b/i,
		domains: ["web", "os_app"]
	},
	{
		pattern: /\b(open|launch|start|run|focus|switch to|bring up)\s+[\w.\-+ ]{2,40}\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\btype\b|\bpress (enter|tab|escape|the \w+ key)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(search|google|look up)\b(?!.*\b(my|this|the) (documents?|files?|folders?|desktop|downloads?|pictures?|computer|pc|machine|drive)\b)/i,
		domains: ["web"]
	},
	{
		pattern: /\b(browse|navigate) to\b|\bgo to https?:\/\//i,
		domains: ["web"]
	},
	{
		pattern: /\b(find|locate|search) (my|the|a|all|through)? ?(file|files|document|documents|folder|folders|pdf|pdfs|spreadsheet|desktop|downloads)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(save|write|store|put|record|note|jot)\b.{0,40}\b(to|in|into|as)\b.{0,20}\b(a )?(file|note|txt|text file|document)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(file|note) called\b|\bcalled [\w-]+\.(txt|md|csv|json|log)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(organis|organiz)e (these|my|the) (files|photos|documents|downloads)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(copy|move|rename|delete|trash|restore)\b.{0,30}\b(file|files|folder|document|documents)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(volume|brightness|battery|cpu|ram|memory|disk space|running (apps|programs))\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(make my (pc|computer) faster|why is my (pc|computer) slow)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(fix|explain) (this |the )?error\b/i,
		domains: ["os_app", "web"]
	},
	{
		pattern: /\b(on my phone|my android|my iphone|paired device)\b/i,
		domains: ["cross_device"]
	},
	{
		pattern: /\b(remember (that|this|i|my|to)|don'?t forget|make a note that|keep in mind that|note that i)\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\b(what do you (know|remember) about|do you remember|forget (that|what|about)|your memory)\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\b(brief(ing)? me|catch me up|what did i (do|work on)|where did we (leave|get) (off|to)|recap)\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\b(keep an eye on|watch (for|the )?news|follow (the )?(topic|story)|notify me (about|when))\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\b(call me|my name is|address me as|i'?m called|what should i call you|your name is|rename yourself|call yourself)\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\b(i'?m (working|building) on|my project|the project i'?m)\b/i,
		domains: ["conversation"]
	},
	{
		pattern: /\bremind me\b|\bset a reminder\b|\bwake me\b|\bmy reminders\b/i,
		domains: ["os_app", "conversation"]
	},
	{
		pattern: /\b(weather|forecast|is it (going to )?rain)\b/i,
		domains: ["web"]
	},
	{
		pattern: /\bflights?\b.{0,30}\b(to|from)\b|\bfly (to|from)\b/i,
		domains: ["web"]
	},
	{
		pattern: /\b(news (on|about)|latest on|compare .+ (and|vs|versus)|how much (is|does)|price of)\b/i,
		domains: ["web"]
	},
	{
		pattern: /\b(webcam|my camera|through the camera|what does the camera see)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(review|debug|refactor|explain) (this |my |the )?(code|function|script|file)\b|\bwhat(?:'?s| is) wrong with (this|my) (code|function|script)\b/i,
		domains: ["files"]
	},
	{
		pattern: /\b(steam|epic games|my games)\b.{0,30}\b(update|updating|installed)\b|\bupdate my games\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(clipboard|what i (just )?copied|translate this|summarise this|summarize this)\b/i,
		domains: ["os_app", "conversation"]
	},
	{
		pattern: /\b(on my phone|from my phone|phone dashboard|pair my phone|qr code)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(start (with|on) (windows|boot|login|start ?up)|launch at (start ?up|login)|auto ?start)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(wifi|wi-fi|shut ?down|restart the (pc|computer)|reboot|lock the (pc|computer|screen)|go to sleep)\b/i,
		domains: ["os_app"]
	},
	{
		pattern: /\b(home assistant|slack|github issue|smart (light|home))\b/i,
		domains: ["connectors"]
	}
];
/** Sub-millisecond pass. Returns null when the request is genuinely ambiguous. */
function classifyDeterministic(request) {
	const text = request.trim();
	if (!text) return null;
	const hit = /* @__PURE__ */ new Set();
	for (const rule of CERTAIN) if (rule.pattern.test(text)) rule.domains.forEach((d) => hit.add(d));
	return hit.size > 0 ? [...hit] : null;
}
/**
* The classification prompt.
*
* Constrained hard: a fixed list, JSON only, and an explicit instruction to
* choose `conversation` when no tool is needed. A classifier that reaches for
* a tool domain on "how are you" makes every greeting slow and, worse, tempts
* the model into taking an action nobody asked for.
*/
function classificationPrompt(request) {
	return [
		"Classify the user's request into one or more capability domains.",
		"",
		"Domains:",
		DOMAINS.map((d) => `- ${d}: ${DOMAIN_LABELS[d]}`).join("\n"),
		"",
		"Answer with JSON only, in the form {\"domains\":[\"...\"]}.",
		"Choose \"conversation\" when the request is about talking, or about what OCADE should remember, recall or forget about the user — it needs no access to the computer itself.",
		"Choose every domain the request genuinely needs, and no others.",
		"A request that spans two domains needs both. Naming only the first half is worse than naming none.",
		"",
		`Request: ${request.slice(0, 600)}`
	].join("\n");
}
/**
* Read the model's answer without trusting its formatting.
*
* Small local models wrap JSON in prose, in code fences, and occasionally in a
* `<think>` block. Extracting the first balanced object and keeping only known
* domain names means a chatty reply still classifies correctly, and an invented
* domain name is dropped rather than propagated into tool loading.
*/
function parseClassification(reply) {
	const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/gi, "");
	const match = /\{[\s\S]*?\}/.exec(withoutThinking);
	if (!match) return null;
	let parsed;
	try {
		parsed = JSON.parse(match[0]);
	} catch {
		return null;
	}
	const raw = parsed?.domains;
	if (!Array.isArray(raw)) return null;
	const known = raw.map((d) => String(d).trim().toLowerCase()).filter((d) => DOMAINS.includes(d));
	return known.length > 0 ? [...new Set(known)] : null;
}
/**
* Classify a request. Deterministic first, model second, conversation last.
*
* Never throws and never returns an empty list: a classifier that fails should
* degrade to plain conversation, which is safe, rather than to "all tools",
* which is the thing this whole stage exists to avoid.
*/
async function classify(request, deps, signal) {
	const quick = classifyDeterministic(request);
	if (quick) return {
		domains: quick,
		basis: "deterministic"
	};
	let reply = null;
	try {
		reply = await deps.complete(classificationPrompt(request), signal);
	} catch {
		return {
			domains: ["conversation"],
			basis: "fallback",
			note: "The classifier could not be reached, so OCADE answered without tools."
		};
	}
	const parsed = reply ? parseClassification(reply) : null;
	if (!parsed) return {
		domains: ["conversation"],
		basis: "fallback",
		note: "The classifier did not return a usable answer, so OCADE answered without tools."
	};
	return {
		domains: parsed,
		basis: "model"
	};
}
var SHORTHAND_START_RE = /^\s*\+(\d+(?:\.\d+)?)\s*(k|m|b)\b/i;
var SHORTHAND_END_RE = /\s\+(\d+(?:\.\d+)?)\s*(k|m|b)\s*[.!?]?\s*$/i;
var VERBOSE_RE = /\b(?:use|spend)\s+(\d+(?:\.\d+)?)\s*(k|m|b)\s*tokens?\b/i;
new RegExp(VERBOSE_RE.source, "gi");
var MULTIPLIERS = {
	k: 1e3,
	m: 1e6,
	b: 1e9
};
function parseBudgetMatch(value, suffix) {
	return parseFloat(value) * MULTIPLIERS[suffix.toLowerCase()];
}
function parseTokenBudget(text) {
	const startMatch = text.match(SHORTHAND_START_RE);
	if (startMatch) return parseBudgetMatch(startMatch[1], startMatch[2]);
	const endMatch = text.match(SHORTHAND_END_RE);
	if (endMatch) return parseBudgetMatch(endMatch[1], endMatch[2]);
	const verboseMatch = text.match(VERBOSE_RE);
	if (verboseMatch) return parseBudgetMatch(verboseMatch[1], verboseMatch[2]);
	return null;
}
function getBudgetContinuationMessage(pct, turnTokens, budget) {
	const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
	return `Stopped at ${pct}% of token target (${fmt(turnTokens)} / ${fmt(budget)}). Keep working \u2014 do not summarize.`;
}
var COMPLETION_THRESHOLD = .9;
var DIMINISHING_THRESHOLD = 500;
function createBudgetTracker() {
	return {
		continuationCount: 0,
		lastDeltaTokens: 0,
		lastGlobalTurnTokens: 0,
		startedAt: Date.now()
	};
}
function checkTokenBudget(tracker, agentId, budget, globalTurnTokens) {
	if (agentId || budget === null || budget <= 0) return {
		action: "stop",
		completionEvent: null
	};
	const turnTokens = globalTurnTokens;
	const pct = Math.round(turnTokens / budget * 100);
	const deltaSinceLastCheck = globalTurnTokens - tracker.lastGlobalTurnTokens;
	const isDiminishing = tracker.continuationCount >= 3 && deltaSinceLastCheck < DIMINISHING_THRESHOLD && tracker.lastDeltaTokens < DIMINISHING_THRESHOLD;
	if (!isDiminishing && turnTokens < budget * COMPLETION_THRESHOLD) {
		tracker.continuationCount++;
		tracker.lastDeltaTokens = deltaSinceLastCheck;
		tracker.lastGlobalTurnTokens = globalTurnTokens;
		return {
			action: "continue",
			nudgeMessage: getBudgetContinuationMessage(pct, turnTokens, budget),
			continuationCount: tracker.continuationCount,
			pct,
			turnTokens,
			budget
		};
	}
	if (isDiminishing || tracker.continuationCount > 0) return {
		action: "stop",
		completionEvent: {
			continuationCount: tracker.continuationCount,
			pct,
			turnTokens,
			budget,
			diminishingReturns: isDiminishing,
			durationMs: Date.now() - tracker.startedAt
		}
	};
	return {
		action: "stop",
		completionEvent: null
	};
}
var DEFAULT_MAX_TURNS = 10;
var DEFAULT_COMPACT_THRESHOLD = 12e3;
/**
* The output ceiling asked for when retrying a truncated turn.
*
* Raised rather than removed: an unbounded retry on a model that is repeating
* itself produces a very long repetition. One raise, then the loop accepts what
* it has and says the answer was cut short.
*/
var RECOVERY_OUTPUT_TOKENS = 4096;
var MAX_OUTPUT_RECOVERIES = 1;
async function runQuery(params, onEvent) {
	const { deps, systemPrompt, tools, signal } = params;
	const maxTurns = params.maxTurns ?? DEFAULT_MAX_TURNS;
	const compactThreshold = params.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD;
	const budget = params.tokenBudget ?? null;
	const budgetTracker = budget ? createBudgetTracker() : null;
	const state = {
		messages: [...params.messages],
		turnCount: 1,
		maxOutputTokensOverride: void 0,
		maxOutputTokensRecoveryCount: 0,
		hasAttemptedReactiveCompact: false,
		transition: void 0
	};
	const emit = (event) => onEvent?.(event);
	const collected = [];
	let spokenText = "";
	let turnTokens = 0;
	const finish = (terminal) => ({
		terminal,
		text: spokenText,
		messages: state.messages,
		toolResults: collected,
		turns: state.turnCount
	});
	while (true) {
		if (signal?.aborted) return finish({ reason: "aborted_streaming" });
		const stopped = deps.shouldStop?.();
		if (stopped) return finish({
			reason: "stop_hook_prevented",
			error: stopped
		});
		if (state.turnCount > maxTurns) return finish({ reason: "max_turns" });
		const tokens = deps.countTokens(state.messages);
		if (tokens > compactThreshold) {
			const compacted = await deps.compact(state.messages);
			if (compacted) {
				emit({
					kind: "compacted",
					before: tokens,
					after: deps.countTokens(compacted)
				});
				state.messages = compacted;
			}
		}
		emit({
			kind: "turn_started",
			turn: state.turnCount
		});
		const input = {
			messages: state.messages,
			systemPrompt,
			tools,
			...signal ? { signal } : {},
			...params.onToken ? { onToken: (chunk) => {
				spokenText += chunk;
				params.onToken?.(chunk);
				emit({
					kind: "text",
					text: chunk
				});
			} } : {},
			...state.maxOutputTokensOverride === void 0 ? {} : { maxOutputTokensOverride: state.maxOutputTokensOverride }
		};
		let turn;
		try {
			turn = await deps.callModel(input);
		} catch (error) {
			if (signal?.aborted) return finish({ reason: "aborted_streaming" });
			const tooLong = isPromptTooLong(error);
			if (tooLong && !state.hasAttemptedReactiveCompact) {
				const compacted = await deps.compact(state.messages);
				if (compacted) {
					state.hasAttemptedReactiveCompact = true;
					state.messages = compacted;
					state.transition = { reason: "reactive_compact_retry" };
					emit({
						kind: "transition",
						transition: state.transition
					});
					continue;
				}
			}
			return finish({
				reason: tooLong ? "prompt_too_long" : "model_error",
				error
			});
		}
		if (!params.onToken && turn.text) spokenText += turn.text;
		turnTokens += turn.usage?.output_tokens ?? estimateTokens(turn.text);
		state.messages = [...state.messages, {
			role: "assistant",
			content: turn.text
		}];
		if (turn.stopReason === "max_tokens" && state.maxOutputTokensRecoveryCount < MAX_OUTPUT_RECOVERIES) {
			state.maxOutputTokensRecoveryCount += 1;
			state.maxOutputTokensOverride = RECOVERY_OUTPUT_TOKENS;
			state.messages = [...state.messages, {
				role: "user",
				content: "Continue exactly where you stopped. Do not repeat yourself."
			}];
			state.turnCount += 1;
			state.transition = { reason: "max_output_tokens_recovery" };
			emit({
				kind: "transition",
				transition: state.transition
			});
			continue;
		}
		if (turn.toolCalls.length > 0) {
			emit({
				kind: "tool_calls",
				calls: turn.toolCalls
			});
			if (signal?.aborted) return finish({ reason: "aborted_tools" });
			const results = await deps.runTools(turn.toolCalls, signal);
			collected.push(...results);
			emit({
				kind: "tool_results",
				results
			});
			state.messages = [...state.messages, ...results.map((result) => ({
				role: "user",
				content: `Result of ${result.name}: ${result.content}`
			}))];
			state.turnCount += 1;
			state.transition = { reason: "tool_use" };
			emit({
				kind: "transition",
				transition: state.transition
			});
			continue;
		}
		if (budgetTracker && budget) {
			const decision = checkTokenBudget(budgetTracker, void 0, budget, turnTokens);
			if (decision.action === "continue") {
				state.messages = [...state.messages, {
					role: "user",
					content: decision.nudgeMessage
				}];
				state.turnCount += 1;
				state.transition = { reason: "token_budget_continuation" };
				emit({
					kind: "transition",
					transition: state.transition
				});
				continue;
			}
		}
		return finish({ reason: "completed" });
	}
}
/**
* Whether an engine failure means "this prompt does not fit".
*
* The browser engines report it as prose rather than a code, so this matches on
* the phrases they actually use. A miss costs a long conversation; a false
* positive costs one compaction, so the list errs towards matching.
*/
function isPromptTooLong(error) {
	const message = error instanceof Error ? error.message : String(error ?? "");
	return /context|token limit|too long|exceeds|kv cache|out of memory|prompt is too large/i.test(message);
}
/**
* A token estimate for engines that do not report usage.
*
* Four characters per token is the ratio measured across English prose and code
* on this product's models. It decides when to compact, so being wrong by a
* third is tolerable and being absent is not: with no estimate the loop would
* either never compact or compact constantly.
*/
function estimateTokens(text) {
	return Math.ceil(text.length / 4);
}
/** Token estimate for a whole transcript. */
function estimateTranscriptTokens(messages) {
	let total = 0;
	for (const message of messages) total += typeof message.content === "string" ? estimateTokens(message.content) : estimateTokens(JSON.stringify(message.content));
	return total;
}
var RESULT_PREFIX = /^Result of ([a-z0-9_]+): ?/i;
/** The tool a result came from, or null when the line is not a result. */
function toolOfResult(message) {
	if (message.role !== "user" || typeof message.content !== "string") return null;
	const match = message.content.match(RESULT_PREFIX);
	return match ? match[1] : null;
}
function analyseTranscript(messages) {
	const analysis = {
		total: 0,
		user: 0,
		assistant: 0,
		byTool: {},
		supersededResults: []
	};
	/** Last index seen for each identical result, so earlier copies are stale. */
	const lastSeen = /* @__PURE__ */ new Map();
	messages.forEach((message, index) => {
		const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
		analysis.total += content.length;
		const tool = toolOfResult(message);
		if (tool !== null) {
			analysis.byTool[tool] = (analysis.byTool[tool] ?? 0) + content.length;
			const previous = lastSeen.get(content);
			if (previous !== void 0) analysis.supersededResults.push(previous);
			lastSeen.set(content, index);
			return;
		}
		if (message.role === "assistant") analysis.assistant += content.length;
		else analysis.user += content.length;
	});
	analysis.supersededResults.sort((a, b) => a - b);
	return analysis;
}
/** What replaces a cleared body. Deliberately says what happened. */
var CLEARED_MARKER = "[Earlier tool output cleared to save room.]";
/**
* How many recent tool results keep their content.
*
* Four covers the observations the next decision is actually made from. Fewer
* and the model loses what it just looked at; more and there is nothing left to
* clear on the transcripts that need it.
*/
var KEEP_INTACT = 4;
/** Below this a body is not worth clearing -- the marker costs nearly as much. */
var MIN_BODY_LENGTH = 200;
/**
* A tool result, as this transcript writes them.
*
* The prefix is the one `runTools` produces. Matching on it rather than on a
* list of tool names means a tool added tomorrow is covered today.
*/
function isToolResult$1(message) {
	return message.role === "user" && typeof message.content === "string" && message.content.startsWith("Result of ");
}
/** The first line of a result, which names the tool and is worth keeping. */
function headlineOf(content) {
	const newline = content.indexOf("\n");
	const headline = newline === -1 ? content : content.slice(0, newline);
	return headline.length > 200 ? `${headline.slice(0, 200)}…` : headline;
}
/**
* Empty the bodies of old tool results.
*
* Returns null when there was nothing worth clearing, so the caller can tell
* "this did not help" from "this helped a little" without measuring twice.
*/
function microCompact(messages, keepIntact = KEEP_INTACT) {
	const resultIndexes = [];
	messages.forEach((message, index) => {
		if (isToolResult$1(message)) resultIndexes.push(index);
	});
	const superseded = new Set(analyseTranscript(messages).supersededResults);
	const byAge = resultIndexes.slice(0, Math.max(0, resultIndexes.length - keepIntact));
	const clearable = [.../* @__PURE__ */ new Set([...superseded, ...byAge])].sort((a, b) => a - b);
	if (clearable.length === 0) return null;
	const toClear = new Set(clearable.filter((index) => {
		const content = messages[index].content;
		return typeof content === "string" && content.length >= MIN_BODY_LENGTH;
	}));
	if (toClear.size === 0) return null;
	return messages.map((message, index) => {
		if (!toClear.has(index)) return message;
		const content = message.content;
		return {
			...message,
			content: `${headlineOf(content)}\n${CLEARED_MARKER}`
		};
	});
}
/**
* How many recent messages survive intact.
*
* Twelve covers roughly four exchanges plus their tool results, which is the
* window in which a model's next decision is actually grounded. Fewer and it
* loses the thread of what it just did; more and compaction stops saving
* anything on the transcripts that need it.
*/
var KEEP_RECENT = 12;
/** Below this, compaction cannot save enough to be worth the disruption. */
var MIN_MESSAGES_TO_COMPACT = 16;
/**
* How far the cut may move back to land on a round boundary.
*
* A long unbroken chain of tool calls has no boundary inside it, and walking
* back to the start of the conversation looking for one would mean never
* compacting the transcripts that need it most. Eight is generous enough to
* clear an ordinary exchange and small enough that the search always ends.
*/
var MAX_BOUNDARY_SEARCH = 8;
/** A tool result, as this transcript writes them. */
function isToolResult(message) {
	return message.role === "user" && typeof message.content === "string" && message.content.startsWith("Result of ");
}
/**
* Move a cut back to the start of an exchange.
*
* TAKEN FROM THE ARCHIVE, WHICH GROUPS ITS TRANSCRIPT BY ROUND BEFORE
* COMPACTING FOR EXACTLY THIS REASON: a window that opens part-way through a
* round begins with the RESULTS of a request the model can no longer see. It
* then has observations with no question attached, and the reliable failure is
* that it invents the question — usually a plausible one, which is worse.
*
* A round starts at a real user turn. A tool result is written as a user
* message here, so it is explicitly not one.
*/
function roundBoundary(messages, cut) {
	const floor = Math.max(0, cut - MAX_BOUNDARY_SEARCH);
	for (let index = cut; index > floor; index -= 1) {
		const message = messages[index];
		if (message && message.role === "user" && !isToolResult(message)) return index;
	}
	return cut;
}
/** Whether a candidate saved enough to be worth the disruption. */
function savesEnough(candidate, original) {
	return estimateTranscriptTokens(candidate) < estimateTranscriptTokens(original) * .9;
}
async function compactTranscript(messages) {
	if (messages.length < MIN_MESSAGES_TO_COMPACT) return null;
	const trimmed = microCompact(messages);
	if (trimmed && savesEnough(trimmed, messages)) return trimmed;
	const working = trimmed ?? messages;
	const first = working.find((message) => message.role === "user");
	const cut = roundBoundary(working, working.length - KEEP_RECENT);
	const recent = working.slice(cut);
	const middle = working.slice(0, cut).filter((message) => message !== first);
	if (middle.length === 0) return null;
	const droppedTools = middle.filter(isToolResult).length;
	const summary = {
		role: "user",
		content: [
			`[Earlier in this conversation: ${middle.length} messages were condensed to save room`,
			droppedTools > 0 ? `, including ${droppedTools} tool results` : "",
			". The original request and the most recent exchanges are intact below.]"
		].join("")
	};
	const compacted = [
		...first ? [first] : [],
		summary,
		...recent
	];
	if (!savesEnough(compacted, messages)) return null;
	return compacted;
}
/**
* The agent loop: observe → plan → act → observe → verify → continue.
*
* WHAT WAS MISSING, EXACTLY
* -------------------------
* OCADE could answer, and OCADE could act, and nothing joined the two. The
* chat route talked to a model; the companion, the browser host and the file
* layer each executed typed actions when a developer called them. There was no
* component whose job was to turn a sentence into actions and then check what
* those actions did. This is that component.
*
* FOUR RULES IT WILL NOT BEND
*
* 1. **Never act on a stale view.** A plan is made against an observation, and
*    the observation is re-taken after every mutating step. A long sequence
*    emitted from one model turn is not executed as a batch — each step is
*    re-decided with the world as it is now. This is the difference between
*    automation and a macro.
*
* 2. **"Done" requires verification.** A tool returning `success` is a claim
*    that a call was accepted. `verified === false` means the adapter looked
*    for the expected change and did not find it, and the loop reports that
*    plainly rather than summarising it as completion.
*
* 3. **A repeated failure is a stop, not a rhythm.** The same tool, with the
*    same arguments, failing the same way twice ends the loop with an
*    explanation. Nothing about a third attempt changes a permission refusal.
*
* 4. **The user may change their mind at any moment.** A revision cancels the
*    FUTURE branch and keeps everything already produced. Work that has already
*    happened is never repeated, and irreversible steps are never re-run.
*/
var loop_exports = /* @__PURE__ */ __exportAll$1({
	Revision: () => Revision,
	describe: () => describe,
	runAgentTask: () => runAgentTask,
	systemPromptWith: () => systemPromptWith
});
var SYSTEM_PROMPT = [
	ocadeCorePolicy("control"),
	"",
	"When the task is done, say briefly what you did and what you verified."
].join("\n");
/**
* Put what OCADE remembers about this person in front of the model.
*
* THE MISSING HALF OF THE MEMORY FEATURE, AND IT WAS MISSING ENTIRELY.
* --------------------------------------------------------------------
* The engine could store the user's name, their honorific, their city, their
* preferences and their open projects. It could be asked to recall any of it.
* And `context_for_prompt()` — the function that turns all of it into the four
* or five sentences a model needs — was called by nothing at all.
*
* So OCADE remembered in the way a filing cabinet remembers. Told "my name is
* Alex" it wrote that down and then addressed the next sentence to nobody,
* because the name never travelled to the prompt. Every session started cold
* while the memory file sat there, full and unread.
*
* The context goes AFTER the instructions and is labelled as facts rather than
* as orders. A 3B model handed "Address them as Sir" at the top of its prompt
* reliably starts every reply with "Sir," including the ones that are a single
* word; below the instructions and marked as background, it uses it the way a
* person would.
*
* It is also kept SHORT by the engine (twelve lines by default). A small model
* given two thousand words of history answers the history instead of the
* question, which is a failure that looks like the model being stupid rather
* than like the prompt being wrong.
*/
function systemPromptWith(memoryContext) {
	const context = (memoryContext ?? "").trim();
	if (!context) return SYSTEM_PROMPT;
	return [
		SYSTEM_PROMPT,
		"",
		"What you already know about this person, from previous sessions:",
		context,
		"",
		"Use it naturally when it is relevant. Do not recite it back, and do not",
		"mention that you are reading it from a memory."
	].join("\n");
}
/**
* A revision handle the UI can hold onto.
*
* Separate from `AbortSignal` on purpose: aborting kills the task, whereas a
* revision keeps everything already done and changes only what happens next.
* "Actually, Facebook" must not throw away the post that was already written.
*/
var Revision = class {
	pending = null;
	submit(instruction) {
		this.pending = instruction;
	}
	take() {
		const value = this.pending;
		this.pending = null;
		return value;
	}
};
async function runAgentTask(deps, input) {
	const emit = (event) => deps.onEvent?.(event);
	const classification = input.domains && input.domains.length > 0 ? {
		domains: input.domains,
		basis: "caller"
	} : await classify(input.request, deps, input.signal);
	const domains = classification.domains;
	const wireTools = schemasFor(domains, input.request);
	emit({
		kind: "classified",
		classification,
		tools: wireTools.map((t) => t.function.name)
	});
	const steps = [];
	const seenFailures = /* @__PURE__ */ new Map();
	let text = "";
	/**
	* Set when governance ends the run for a reason the loop cannot see.
	*
	* Written inside the dependency closures and read after `runQuery` returns.
	* Typed through a holder rather than a bare `let` because TypeScript's
	* control-flow analysis cannot see the assignments across the closure
	* boundary and narrows the variable to `never` at the read.
	*/
	const governance = { stop: null };
	const pending = [];
	const callModel = async (modelInput) => {
		const interrupted = await deps.stopRequested?.();
		if (interrupted?.stopped) {
			governance.stop = {
				reason: "cancelled",
				text: interrupted.heard ? `Stopped — I heard \u201c${interrupted.heard}\u201d.` : "Stopped at your request."
			};
			return {
				text: "",
				toolCalls: [],
				stopReason: "end_turn"
			};
		}
		const revised = input.revision?.take();
		if (revised) {
			pending.push({
				role: "user",
				content: `Change of plan, starting now: ${revised}\nKeep everything already completed. Do not repeat steps you have already finished.`
			});
			emit({
				kind: "revised",
				instruction: revised
			});
		}
		const messages = [...modelInput.messages.map((message) => ({
			role: message.role,
			content: typeof message.content === "string" ? message.content : JSON.stringify(message.content)
		})), ...pending.splice(0, pending.length)];
		const turn = await deps.turn(messages, wireTools, {
			...input.onToken ? { onToken: input.onToken } : {},
			...input.signal ? { signal: input.signal } : {}
		});
		if (turn.text) {
			text = turn.text;
			emit({
				kind: "thinking",
				text: turn.text
			});
		}
		return {
			text: turn.text,
			toolCalls: turn.toolCalls.map((call, index) => ({
				id: call.id ?? `${call.name}-${index}`,
				name: call.name,
				arguments: call.arguments
			})),
			stopReason: turn.toolCalls.length > 0 ? "tool_use" : "end_turn"
		};
	};
	const runTools = async (calls, signal) => {
		const results = [];
		for (const call of calls) {
			if (signal?.aborted) break;
			const toolCall = {
				name: call.name,
				arguments: call.arguments,
				id: call.id
			};
			const definition = findTool(call.name);
			if (!definition) {
				const outcome = {
					kind: "unsupported",
					detail: `There is no tool called ${call.name}.`
				};
				steps.push({
					call: toolCall,
					outcome
				});
				emit({
					kind: "tool_end",
					call: toolCall,
					outcome
				});
				results.push({
					id: call.id,
					name: call.name,
					content: describe(outcome),
					isError: true
				});
				continue;
			}
			if (definition.mutating) {
				if (!await deps.permit(toolCall, definition.risk)) {
					const outcome = {
						kind: "permission_required",
						detail: "The user did not approve this action, so it was not carried out."
					};
					steps.push({
						call: toolCall,
						outcome
					});
					emit({
						kind: "refused",
						call: toolCall,
						reason: outcome.detail
					});
					governance.stop = {
						reason: "blocked",
						text: outcome.detail
					};
					results.push({
						id: call.id,
						name: call.name,
						content: describe(outcome),
						isError: true
					});
					break;
				}
			}
			emit({
				kind: "tool_start",
				call: toolCall,
				risk: definition.risk
			});
			let outcome = await deps.execute(toolCall, input.signal);
			if (isRetryable(outcome.kind) && !input.signal?.aborted) outcome = await deps.execute(toolCall, input.signal);
			steps.push({
				call: toolCall,
				outcome
			});
			emit({
				kind: "tool_end",
				call: toolCall,
				outcome
			});
			results.push({
				id: call.id,
				name: call.name,
				content: describe(outcome),
				isError: outcome.kind !== "success",
				...outcome.verified === void 0 ? {} : { verified: outcome.verified }
			});
			if (outcome.kind !== "success") {
				const signature = signatureOf(call.name, call.arguments, outcome.kind);
				const count = (seenFailures.get(signature) ?? 0) + 1;
				seenFailures.set(signature, count);
				if (count >= 2) {
					governance.stop = {
						reason: "repeating",
						text: `OCADE stopped because the same step kept failing the same way: ${outcome.detail}`
					};
					break;
				}
				if (isTerminal(outcome.kind)) {
					governance.stop = {
						reason: outcome.kind === "cancelled" ? "cancelled" : "blocked",
						text: outcome.detail
					};
					break;
				}
			}
		}
		return results;
	};
	const result = await runQuery({
		messages: [...(input.history ?? []).map((message) => ({
			role: message.role === "tool" ? "user" : message.role,
			content: message.role === "tool" ? `Result of ${message.toolName ?? "the action"}: ${message.content}` : message.content
		})), {
			role: "user",
			content: input.request
		}],
		systemPrompt: systemPromptWith(input.memoryContext),
		tools: wireTools.map((tool) => ({
			name: tool.function.name,
			description: tool.function.description,
			input_schema: tool.function.parameters
		})),
		deps: {
			callModel,
			runTools,
			compact: compactTranscript,
			countTokens: estimateTranscriptTokens,
			shouldStop: () => governance.stop?.text ?? null,
			uuid: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
		},
		...input.signal ? { signal: input.signal } : {},
		maxTurns: 12
	});
	const governedStop = governance.stop;
	if (governedStop) text = governedStop.text || text;
	else if (result.text) text = result.text;
	let stop = governedStop ? governedStop.reason : result.terminal.reason === "max_turns" ? "step_limit" : result.terminal.reason === "aborted_streaming" || result.terminal.reason === "aborted_tools" ? "cancelled" : result.terminal.reason === "model_error" || result.terminal.reason === "prompt_too_long" ? "blocked" : steps.length > 0 ? "verified" : "answered";
	if (!governedStop && (result.terminal.reason === "model_error" || result.terminal.reason === "prompt_too_long")) {
		const cause = result.terminal.error;
		text = `OCADE could not reach its engine: ${cause instanceof Error ? cause.message : String(cause)}`;
	}
	const failedSteps = steps.filter(({ outcome }) => outcome.kind !== "success");
	const mutatingSteps = steps.filter(({ call }) => findTool(call.name)?.mutating);
	const allVerified = failedSteps.length === 0 && (mutatingSteps.length === 0 || mutatingSteps.every(({ outcome }) => outcome.kind === "success" && outcome.verified !== false));
	if (stop === "step_limit" && !text) text = "OCADE stopped after a number of steps without finishing, so it has not claimed success.";
	if (stop === "verified" && !allVerified) {
		stop = "answered";
		const unverified = mutatingSteps.filter(({ outcome }) => outcome.verified === false).length;
		text = [
			text,
			"",
			failedSteps.length > 0 ? `${failedSteps.length} step${failedSteps.length === 1 ? "" : "s"} did not succeed, so OCADE has not treated this as finished.` : `${unverified} step${unverified === 1 ? "" : "s"} could not be confirmed on screen, so OCADE has not treated this as finished.`
		].join("\n");
	}
	emit({
		kind: "finished",
		reason: stop,
		text
	});
	return {
		reason: stop,
		text,
		steps,
		classification,
		allVerified
	};
}
/**
* Render a tool result for the model.
*
* Prose rather than raw JSON: a small local model follows "The window did not
* change" far more reliably than `{"verified":false}`, and the payload is
* appended as compact JSON only when there is something to read.
*
* FOUND LIVE: THIS USED TO SHOW THE MODEL NO RESULTS AT ALL.
*
* It appended `outcome.observation` and nothing else. But `ok(data, detail)`
* — the helper almost every adapter returns — puts the payload in
* `outcome.data`. Only the handful of adapters that also passed
* `observation:` explicitly were ever readable.
*
* So "check how much memory this computer is using, then save that number to
* a file" produced exactly one tool call and stopped. The model asked for the
* system status, and was told:
*
*     Result: success. Read this computer's processor, memory, disk and
*     battery state.
*
* That is the tool's own description with no numbers in it. There was nothing
* to write to the file, so the model stopped — and because the only step so
* far was a read, nothing downgraded the run and it ended as "verified".
*
* The failure looks identical to a model too weak to plan, which is what it
* was mistaken for: the same task was blamed on qwen3:4b being slow, then on
* qwen2.5 stopping early. Neither was true. A raw two-turn probe against the
* same model, handed the actual numbers, called `workspace_write` correctly
* on the second turn.
*
* `observation` is still preferred where an adapter sets it deliberately —
* it is the post-action re-read, which is the more truthful thing to show —
* and `data` is the fallback rather than an addition, so a tool that provides
* both does not send the same payload twice.
*/
function describe(outcome) {
	const lines = [`Result: ${outcome.kind}. ${outcome.detail}`];
	if (outcome.verified === false) lines.push("The expected change was NOT observed. Do not report this as done.");
	if (outcome.verified === true) lines.push("This was confirmed by looking afterwards.");
	const payload = outcome.observation !== void 0 ? outcome.observation : outcome.data;
	if (payload !== void 0 && payload !== null) {
		const json = JSON.stringify(payload);
		if (json && json !== "{}" && json !== "[]") lines.push(`Observed: ${json.length > 6e3 ? `${json.slice(0, 6e3)}…` : json}`);
	}
	return lines.join("\n");
}
//#endregion
export { estimateTranscriptTokens as a, runAgentTask as c, describe as i, runQuery as l, classifyDeterministic as n, loop_CBX9uRwX_exports as o, compactTranscript as r, parseTokenBudget as s, Revision as t };
