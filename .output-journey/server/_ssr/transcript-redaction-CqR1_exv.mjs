//#region node_modules/.nitro/vite/services/ssr/assets/transcript-redaction-CqR1_exv.js
var DEFAULT_WAKE_PHRASES = ["hello ocade", "hey ocade"];
/** Normalise a transcript for tolerant, local wake-phrase matching. */
function normalizeTranscript(raw) {
	return raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
/**
* Local wake-phrase match. Tolerates common mishearings of "OCADE" so the
* phrase is usable, without matching unrelated speech.
*/
function matchesWakePhrase(transcript, phrases = DEFAULT_WAKE_PHRASES) {
	const t = normalizeTranscript(transcript);
	if (!t) return false;
	const variants = [
		"ocade",
		"okade",
		"ocado",
		"o cade",
		"oh cade"
	];
	for (const phrase of phrases) {
		const [greet] = phrase.split(" ");
		if (!t.includes(greet)) continue;
		if (variants.some((v) => t.includes(v))) return true;
	}
	return false;
}
function timeOfDayGreeting(hour) {
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}
/**
* Build a personalised greeting. Defaults to first name with no title; falls
* back to a neutral line when no name is known. Never invents a title.
*/
function buildGreeting(prefs, hour = 12) {
	if (prefs.enabled === false) return "";
	const lead = timeOfDayGreeting(hour);
	const style = prefs.style ?? "first_name";
	if (style === "none") return `${lead}. How may I help?`;
	if (style === "custom_title" && prefs.customTitle?.trim()) return `${lead}, ${prefs.customTitle.trim()}.`;
	if (style === "full_name" && prefs.fullName?.trim()) return `${lead}, ${prefs.fullName.trim()}.`;
	const first = (prefs.preferredName ?? prefs.fullName ?? "").trim().split(/\s+/)[0];
	if (first) return `${lead}, ${first}.`;
	return `${lead}. How may I help?`;
}
var FEMALE_HINTS = /(female|woman|zira|aria|jenny|samantha|victoria|karen|serena|sonia|amelie|hazel|eva|nora|clara|lucia|emma|ava)/i;
var MALE_HINTS = /(male|man|david|mark|george|guy|ryan|daniel|alex|fred|thomas|liam|william|james|diego|jorge)/i;
/**
* Best-effort gender classification of a platform voice. Returns "unknown"
* rather than guessing when the name gives no signal — OCADE never asserts a
* gender it cannot determine.
*/
function classifyVoiceGender(voiceName) {
	if (FEMALE_HINTS.test(voiceName)) return "female";
	if (MALE_HINTS.test(voiceName)) return "male";
	return "unknown";
}
function toVoiceOptions(voices) {
	return voices.map((v) => ({
		id: v.voiceURI ?? v.name,
		name: v.name,
		lang: v.lang,
		gender: classifyVoiceGender(v.name)
	}));
}
/**
* Pick a voice for the requested gender + language. Language match takes
* priority (a right-language voice of unknown gender beats a wrong-language
* voice of the right gender). Returns null when nothing matches.
*/
function pickVoice(options, want) {
	if (options.length === 0) return null;
	const langPrefix = (want.lang ?? "").split("-")[0].toLowerCase();
	const sameLang = langPrefix ? options.filter((o) => o.lang.split("-")[0].toLowerCase() === langPrefix) : options;
	const pool = sameLang.length > 0 ? sameLang : options;
	if (want.gender && want.gender !== "unknown") {
		const byGender = pool.filter((o) => o.gender === want.gender);
		if (byGender.length > 0) return byGender[0];
	}
	return pool[0];
}
function isLanguageSupported(pack) {
	const v = pack.verified;
	return v.stt && v.tts && v.wake && v.commands;
}
/**
* Only verified packs may be presented as supported languages (decision #27).
* English ships verified; others are listed as in-progress until they pass.
*/
var LANGUAGE_PACKS = [{
	code: "en",
	label: "English",
	verified: {
		stt: true,
		tts: true,
		wake: true,
		commands: true
	}
}];
function supportedLanguages(packs = LANGUAGE_PACKS) {
	return packs.filter(isLanguageSupported);
}
/**
* The sentence being spoken at `charIndex`, for output captions.
*
* Speech synthesis reports a character offset as it progresses; showing the
* whole answer at once defeats the point of a caption, and showing a single
* word loses the meaning. A sentence is the readable unit.
*
* Total: any index, empty text, or text with no sentence punctuation still
* returns something displayable rather than throwing or returning "".
*/
function captionSentenceAt(text, charIndex, maxLength = 200) {
	const src = text ?? "";
	if (!src.trim()) return "";
	const idx = Math.min(Math.max(charIndex || 0, 0), Math.max(src.length - 1, 0));
	const BOUNDARY = /[.!?]/;
	let start = 0;
	for (let i = idx - 1; i >= 0; i--) if (BOUNDARY.test(src[i])) {
		start = i + 1;
		break;
	}
	let end = src.length;
	for (let i = idx; i < src.length; i++) if (BOUNDARY.test(src[i])) {
		end = i + 1;
		break;
	}
	const chosen = src.slice(start, end).trim() || src.slice(0, maxLength).trim();
	return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1)}…` : chosen;
}
var PART_LABELS = {
	stt: "speech input",
	tts: "spoken replies",
	wake: "the wake phrase",
	commands: "voice commands"
};
/**
* Honest status for a language code.
*
* Filtering unsupported languages out of the picker silently leaves a
* non-English speaker staring at a single option with no explanation. This
* reports WHY a language is unavailable — either it has no pack at all, or its
* pack exists but some part is unverified — so the UI can say so plainly.
*
* Matching is on the primary subtag, so "en-GB" and "en-US" both resolve to the
* "en" pack rather than reporting a false negative.
*/
function languageStatus(code, packs = LANGUAGE_PACKS) {
	const primary = (code ?? "").toLowerCase().split(/[-_]/)[0];
	const pack = packs.find((p) => p.code.toLowerCase().split(/[-_]/)[0] === primary);
	if (!pack) return {
		supported: false,
		reason: "OCADE Voice doesn't support this language yet.",
		missing: Object.values(PART_LABELS)
	};
	if (isLanguageSupported(pack)) return {
		supported: true,
		pack
	};
	const missing = Object.keys(PART_LABELS).filter((k) => !pack.verified[k]).map((k) => PART_LABELS[k]);
	return {
		supported: false,
		reason: `${pack.label} isn't fully verified yet — ${missing.join(", ")} still need work.`,
		missing
	};
}
/**
* The language OCADE Voice will actually use, given what the device asks for.
* Falls back to the first verified pack rather than failing outright.
*/
function resolveVoiceLanguage(requested, packs = LANGUAGE_PACKS) {
	const status = languageStatus(requested, packs);
	if (status.supported) return {
		code: status.pack.code,
		fellBack: false,
		status
	};
	return {
		code: supportedLanguages(packs)[0]?.code ?? "en",
		fellBack: true,
		status
	};
}
/**
* Honest capability probe — reports what the current device/browser can
* actually do rather than assuming.
*/
function detectVoiceCapabilities(win) {
	const synthesis = Boolean(win.speechSynthesis);
	const recognitionEngine = win.SpeechRecognition || win.webkitSpeechRecognition;
	const recognition = Boolean(recognitionEngine);
	const prototype = typeof recognitionEngine === "function" ? recognitionEngine.prototype : void 0;
	const wakePhrase = Boolean(prototype && "processLocally" in prototype);
	const caps = {
		synthesis,
		recognition,
		wakePhrase,
		wakeReason: recognition && !wakePhrase ? "This speech engine does not prove that recognition stays on-device, so continuous wake-phrase listening is disabled." : void 0
	};
	if (!synthesis && !recognition) caps.reason = "This browser doesn't provide speech input or output. OCADE Voice is unavailable here.";
	else if (!recognition) caps.reason = "This browser can speak but not listen. Push-to-talk is unavailable.";
	else if (!synthesis) caps.reason = "This browser can listen but not speak. Replies will be text only.";
	return caps;
}
/**
* The browser's own speech engine, as a registrable voice provider.
*
* This exists so the multimodal registry holds the provider that actually
* ships. It declares ONLY `speakAloud`, because that is all the Web Speech API
* can honestly do: `speechSynthesis` speaks through an utterance and never
* returns audio bytes, and its recognition reads a live microphone rather than
* a buffer. A `synthesize` or `transcribe` here would have to throw or return
* empty audio, which is a placeholder executor — so neither is declared.
*
* `isAvailable` re-probes on every call rather than caching: speech synthesis
* can disappear (a permissions change, a different tab, a browser without it),
* and a provider that answers from a stale probe would claim it can speak when
* it cannot.
*/
function createSystemVoiceProvider(win) {
	if (!win.speechSynthesis || !win.SpeechSynthesisUtterance) return null;
	return {
		id: "system-speech",
		type: "system",
		name: "System speech",
		isAvailable: async () => Boolean(win.speechSynthesis && win.SpeechSynthesisUtterance),
		speakAloud: (text) => new Promise((resolve, reject) => {
			const synthesis = win.speechSynthesis;
			const Utterance = win.SpeechSynthesisUtterance;
			if (!synthesis || !Utterance) {
				reject(/* @__PURE__ */ new Error("Speech synthesis disappeared before the utterance started."));
				return;
			}
			const utterance = new Utterance(text);
			utterance.onend = () => resolve();
			utterance.onerror = (event) => reject(new Error(event?.error ?? "The utterance failed before it finished."));
			synthesis.speak(utterance);
		})
	};
}
/**
* Registers the platform's speech provider, if there is one.
*
* Returns what happened so a caller can surface an honest reason rather than a
* silent no-op. Re-registration is not an error: the registry refuses duplicate
* ids, and a voice surface may mount more than once.
*/
function registerSystemVoice(registry, win) {
	const provider = createSystemVoiceProvider(win);
	if (!provider) return {
		registered: false,
		reason: "This browser provides no speech synthesis engine."
	};
	if (registry.getVoiceProvider(provider.id)) return {
		registered: false,
		reason: "The system speech provider is already registered."
	};
	registry.registerVoiceProvider(provider);
	return {
		registered: true,
		reason: "System speech is available and registered."
	};
}
/** Spoken mask. "[redacted]" would be read aloud as bracket-redacted-bracket. */
var SPOKEN_MASK = "redacted";
/**
* Machine-shaped secrets, recognised without a cue because their shape alone is
* conclusive. Checked first so a token is never chopped up by the number rules.
*/
var STRUCTURED = [
	{
		re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
		category: "private-key"
	},
	{
		re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g,
		category: "access-token"
	},
	{
		re: /\bsk-[A-Za-z0-9_-]{16,}/g,
		category: "api-key"
	},
	{
		re: /\bAKIA[0-9A-Z]{16}\b/g,
		category: "api-key"
	},
	{
		re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
		category: "access-token"
	},
	{
		re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
		category: "access-token"
	}
];
/** Trigger words after which a value is treated as protected. Longest first. */
var CUES = [
	"social security number",
	"protected authentication answer",
	"mother's maiden name",
	"mothers maiden name",
	"security question",
	"verification code",
	"authentication code",
	"confirmation code",
	"recovery code",
	"backup code",
	"security code",
	"access code",
	"one time code",
	"one-time code",
	"one time password",
	"one-time password",
	"routing number",
	"account number",
	"card number",
	"social security",
	"private key",
	"secret key",
	"access token",
	"refresh token",
	"bearer token",
	"seed phrase",
	"passphrase",
	"password",
	"passcode",
	"pass code",
	"api key",
	"apikey",
	"ssn",
	"otp",
	"cvv",
	"cvc",
	"pin"
];
/** Words connecting a cue to its value; stepped over, not consumed. */
var CONNECTORS = /* @__PURE__ */ new Set([
	"is",
	"are",
	"was",
	"of",
	"to",
	"equals",
	"will",
	"be",
	"the",
	"my"
]);
/** Spoken digit words, plus "oh"/"o" for zero and spoken grouping words. */
var NUMBER_WORDS = /* @__PURE__ */ new Set([
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"oh",
	"o",
	"double",
	"triple"
]);
function cueLabel(cue) {
	if (cue.includes("card")) return "card";
	if (cue.includes("routing")) return "routing";
	if (cue.includes("account number")) return "account";
	if (cue.includes("social") || cue === "ssn") return "ssn";
	if (cue.includes("maiden") || cue.includes("security question") || cue.includes("authentication answer")) return "auth-answer";
	if (cue.includes("recovery") || cue.includes("backup code")) return "recovery-code";
	if (cue.includes("private key")) return "private-key";
	if (cue.includes("token")) return "access-token";
	if (cue.includes("api key") || cue === "apikey" || cue.includes("secret key")) return "api-key";
	if (cue.includes("seed phrase")) return "seed-phrase";
	if (cue === "cvv" || cue === "cvc") return "cvv";
	if (cue === "pin") return "pin";
	if (cue.includes("pass")) return "password";
	return "otp";
}
var isDigit = (c) => c >= "0" && c <= "9";
var isWordChar = (c) => /[A-Za-z0-9']/.test(c);
/** Length of the `[A-Za-z0-9]+` run at `at`, or 0. */
function wordLengthAt(input, at) {
	let k = at;
	while (k < input.length && /[A-Za-z0-9]/.test(input[k])) k += 1;
	return k - at;
}
/**
* Redact protected values from spoken text. Pure and total: any string in, a
* string out; never throws, never mutates its input.
*/
function redactSpokenSecrets(transcript, options = {}) {
	const mask = options.mask ?? "[redacted]";
	if (typeof transcript !== "string" || transcript.length === 0) return {
		text: typeof transcript === "string" ? transcript : "",
		redactionCount: 0,
		categories: []
	};
	const categories = /* @__PURE__ */ new Set();
	let count = 0;
	const hit = (category) => {
		categories.add(category);
		count += 1;
	};
	let text = maskStructured(transcript, mask, hit);
	text = maskCued(text, mask, hit);
	text = maskUncuedNumbers(text, mask, hit);
	return {
		text,
		redactionCount: count,
		categories: [...categories].sort()
	};
}
function maskStructured(input, mask, hit) {
	let text = input;
	for (const { re, category } of STRUCTURED) text = text.replace(new RegExp(re.source, re.flags), () => {
		hit(category);
		return mask;
	});
	return text;
}
function maskCued(input, mask, hit) {
	const lower = input.toLowerCase();
	let out = "";
	let i = 0;
	while (i < input.length) {
		const cue = matchCueAt(lower, i);
		if (!cue) {
			out += input[i];
			i += 1;
			continue;
		}
		out += input.slice(i, cue.end);
		const span = findValueAfterCue(input, lower, cue.end);
		if (span) {
			out += input.slice(cue.end, span.start);
			out += mask;
			hit(cue.label);
			i = span.end;
		} else i = cue.end;
	}
	return out;
}
/**
* Locate the protected VALUE belonging to a cue, or null when the cue is just
* being talked about ("I need to reset my password").
*
* Two stages:
*  1. Step over English connectors / `:` / `=` and take the value directly.
*  2. If that finds nothing, look ahead over at most TWO intervening words for a
*     digit or spoken-number run. This is what keeps the redactor fail-closed
*     when the sentence is not English — "mein PIN ist 4417" has a connector
*     ("ist") this module does not know, and the digits must still be masked.
*     The window is bounded and only accepts NUMBERS, so ordinary prose such as
*     "I forgot my password yesterday and paid 45 dollars" keeps its 45.
*/
function findValueAfterCue(input, lower, from) {
	const skip = skipConnectors(input, lower, from);
	const direct = consumeValue(input, skip.end, skip.crossed);
	if (direct > skip.end) {
		let start = skip.end;
		while (start < input.length && /\s/.test(input[start])) start += 1;
		return {
			start,
			end: direct
		};
	}
	let j = skip.end;
	for (let hop = 0; hop < 2; hop += 1) {
		while (j < input.length && /\s/.test(input[j])) j += 1;
		const len = wordLengthAt(input, j);
		if (len === 0) return null;
		j += len;
		let k = j;
		while (k < input.length && /\s/.test(input[k])) k += 1;
		if (k >= input.length) return null;
		if (isDigit(input[k])) {
			const end = consumeDigitRun(input, k);
			if (end > k) return {
				start: k,
				end
			};
		}
		const words = consumeNumberWords(input, k);
		if (words > k) return {
			start: k,
			end: words
		};
	}
	return null;
}
function matchCueAt(lower, at) {
	if (at > 0 && isWordChar(lower[at - 1])) return null;
	for (const cue of CUES) {
		if (!lower.startsWith(cue, at)) continue;
		const end = at + cue.length;
		if (end < lower.length && isWordChar(lower[end])) continue;
		return {
			end,
			label: cueLabel(cue)
		};
	}
	return null;
}
/**
* Step over connector words and `:`/`=` separators between a cue and its value.
* `crossed` records whether an explicit assignment signal was seen — without
* one, a bare following word is NOT treated as a secret ("I forgot my password
* yesterday" must not mask "yesterday").
*/
function skipConnectors(input, lower, from) {
	let j = from;
	let crossed = false;
	for (;;) {
		while (j < input.length && (/\s/.test(input[j]) || input[j] === ":" || input[j] === "=")) {
			if (input[j] === ":" || input[j] === "=") crossed = true;
			j += 1;
		}
		const len = wordLengthAt(input, j);
		if (len > 0 && CONNECTORS.has(lower.slice(j, j + len))) {
			j += len;
			crossed = true;
			continue;
		}
		return {
			end: j,
			crossed
		};
	}
}
/**
* Consume a secret VALUE starting at `start`; return the index just past it, or
* `start` when there is nothing to take. Digit runs and spoken number-word runs
* are always taken. A single ordinary word is taken only when an explicit
* assignment signal was crossed.
*/
function consumeValue(input, start, crossed) {
	let j = start;
	while (j < input.length && /\s/.test(input[j])) j += 1;
	if (j >= input.length) return start;
	if (isDigit(input[j])) {
		const end = consumeDigitRun(input, j);
		if (end > j) return end;
	}
	const words = consumeNumberWords(input, j);
	if (words > j) return words;
	if (crossed) {
		const len = wordLengthAt(input, j);
		if (len > 0) return j + len;
	}
	return start;
}
/** Digits, allowing single spaces/dashes/dots BETWEEN digits (spoken forms). */
function consumeDigitRun(input, start) {
	let k = start;
	let last = start;
	while (k < input.length) {
		if (isDigit(input[k])) {
			k += 1;
			last = k;
			continue;
		}
		if ((input[k] === " " || input[k] === "-" || input[k] === ".") && k + 1 < input.length && isDigit(input[k + 1])) {
			k += 1;
			continue;
		}
		break;
	}
	return last;
}
function consumeNumberWords(input, start) {
	const lower = input.toLowerCase();
	let j = start;
	let end = start;
	for (;;) {
		let k = j;
		while (k < input.length && /\s/.test(input[k])) k += 1;
		const len = wordLengthAt(input, k);
		if (len === 0 || !NUMBER_WORDS.has(lower.slice(k, k + len))) break;
		j = k + len;
		end = j;
	}
	return end;
}
/**
* Uncued numeric secrets. Each pattern is deliberately narrow so ordinary
* speech survives:
*  - SSN shape (123-45-6789)
*  - card shape: four groups of four digits
*  - a contiguous run of ≥6 digits (code, account, long card)
*  - ≥6 SINGLE digits separated by spaces/dashes — the spoken "4 0 2 9 1 3"
*    form. Requiring single-digit groups is what stops "2024 2025 2026" from
*    being swallowed as one long run.
*  - ≥6 consecutive spoken number words — "four zero two nine one three"
*/
var UNCUED = [
	{
		re: /\b\d{3}[ -]\d{2}[ -]\d{4}\b/g,
		category: "ssn"
	},
	{
		re: /\b\d{4}(?:[ -]\d{4}){3}\b/g,
		category: "card"
	},
	{
		re: /\b\d{6,}\b/g,
		category: "numeric-run"
	},
	{
		re: /\b\d(?:[ -]\d){5,}\b/g,
		category: "spoken-digits"
	}
];
var NUMBER_WORD_RUN = new RegExp(`\\b(?:${[...NUMBER_WORDS].join("|")})(?:[ -](?:${[...NUMBER_WORDS].join("|")})){5,}\\b`, "gi");
function maskUncuedNumbers(input, mask, hit) {
	let text = input;
	for (const { re, category } of UNCUED) text = text.replace(new RegExp(re.source, re.flags), () => {
		hit(category);
		return mask;
	});
	text = text.replace(NUMBER_WORD_RUN, () => {
		hit("spoken-digits");
		return mask;
	});
	return text;
}
/**
* Text-to-speech gate. OCADE must never READ A SECRET ALOUD — a spoken OTP is
* audible to everyone in the room and to any recording in progress. Callers
* must speak `text`, never the original.
*/
function redactForSpeech(text) {
	const result = redactSpokenSecrets(text, { mask: SPOKEN_MASK });
	return {
		...result,
		containedProtected: result.redactionCount > 0
	};
}
//#endregion
export { languageStatus as a, redactForSpeech as c, resolveVoiceLanguage as d, supportedLanguages as f, detectVoiceCapabilities as i, redactSpokenSecrets as l, buildGreeting as n, matchesWakePhrase as o, toVoiceOptions as p, captionSentenceAt as r, pickVoice as s, DEFAULT_WAKE_PHRASES as t, registerSystemVoice as u };
