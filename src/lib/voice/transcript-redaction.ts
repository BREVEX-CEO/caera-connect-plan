/**
 * Protected-speech redaction (master plan Voice/Video — "Redact protected
 * data"; §2.3 protected actions; §8.2 voice runtime).
 *
 * ONE shared redactor for every surface that can carry spoken text:
 * microphone transcripts, live captions, stored transcripts, voice-activity
 * history, audit records, model-visible speech, text-to-speech output, mobile
 * voice messages and exported conversations. They must not each invent their
 * own rules — a secret redacted in the caption but stored raw in history has
 * still leaked.
 *
 * Why speech needs its own redactor, distinct from the `redactForAudit`
 * key=value scrubber: speech carries secrets in forms a `\d{4,}` never sees —
 * digits spoken one at a time ("four zero two nine one three"), digits spaced
 * out ("4 0 2 9 1 3"), grouped card numbers, and values introduced by a cue
 * word ("my PIN is 4417").
 *
 * DESIGN RULES
 *
 * 1. **Local and deterministic.** Pure string logic, no network, no model, no
 *    clock, no randomness. Same input always yields the same output, so it is
 *    independently testable and safe to run before anything reaches a cloud
 *    provider.
 * 2. **Keep the sentence readable.** Only the VALUE is masked; the cue word
 *    stays ("my code is [redacted]"), so a caption still makes sense.
 * 3. **Safe metadata only.** Callers that log or audit keep the category and
 *    the count — never the value. See `safeRedactionMetadata`.
 * 4. **Resist false positives.** Years, quantities, prices and ordinary
 *    sentences must survive. Uncued numbers are only masked when they are long
 *    enough to be a code, card or account (≥6 digits), or shaped exactly like a
 *    card or a spoken digit-by-digit run. An uncued single word is never
 *    masked.
 *
 * HONESTY BOUNDARY: this is defence-in-depth, not proof of secrecy. The real
 * guarantee that a typed secret is never captured is upstream — protected
 * fields are never recorded at all (see skills/session-recording). This catches
 * what is SPOKEN, where there is no field to mark protected.
 */

/** Written mask, for transcripts, captions, exports and audit records. */
export const REDACTION_MASK = "[redacted]";

/** Spoken mask. "[redacted]" would be read aloud as bracket-redacted-bracket. */
export const SPOKEN_MASK = "redacted";

export interface RedactionOptions {
  /** Replacement for a detected secret. Defaults to {@link REDACTION_MASK}. */
  readonly mask?: string;
}

export interface RedactionResult {
  /** The text with every detected secret replaced by the mask. */
  readonly text: string;
  /** How many values were masked. Safe to log. */
  readonly redactionCount: number;
  /** Which rules fired, sorted and de-duplicated. Safe to log. */
  readonly categories: readonly string[];
}

/* ------------------------------------------------------------ structured -- */

/**
 * Machine-shaped secrets, recognised without a cue because their shape alone is
 * conclusive. Checked first so a token is never chopped up by the number rules.
 */
const STRUCTURED: ReadonlyArray<{ readonly re: RegExp; readonly category: string }> = [
  {
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    category: "private-key",
  },
  // JSON Web Token: three base64url segments.
  { re: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, category: "access-token" },
  { re: /\bsk-[A-Za-z0-9_-]{16,}/g, category: "api-key" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, category: "api-key" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, category: "access-token" },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, category: "access-token" },
];

/* ------------------------------------------------------------------ cues -- */

/** Trigger words after which a value is treated as protected. Longest first. */
const CUES: readonly string[] = [
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
  "pin",
];

/** Words connecting a cue to its value; stepped over, not consumed. */
const CONNECTORS = new Set(["is", "are", "was", "of", "to", "equals", "will", "be", "the", "my"]);

/** Spoken digit words, plus "oh"/"o" for zero and spoken grouping words. */
const NUMBER_WORDS = new Set([
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
  "triple",
]);

function cueLabel(cue: string): string {
  if (cue.includes("card")) return "card";
  if (cue.includes("routing")) return "routing";
  if (cue.includes("account number")) return "account";
  if (cue.includes("social") || cue === "ssn") return "ssn";
  if (
    cue.includes("maiden") ||
    cue.includes("security question") ||
    cue.includes("authentication answer")
  ) {
    return "auth-answer";
  }
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

/* --------------------------------------------------------------- scanning -- */

const isDigit = (c: string) => c >= "0" && c <= "9";
const isWordChar = (c: string) => /[A-Za-z0-9']/.test(c);

/** Length of the `[A-Za-z0-9]+` run at `at`, or 0. */
function wordLengthAt(input: string, at: number): number {
  let k = at;
  while (k < input.length && /[A-Za-z0-9]/.test(input[k])) k += 1;
  return k - at;
}

/**
 * Redact protected values from spoken text. Pure and total: any string in, a
 * string out; never throws, never mutates its input.
 */
export function redactSpokenSecrets(
  transcript: string,
  options: RedactionOptions = {},
): RedactionResult {
  const mask = options.mask ?? REDACTION_MASK;
  if (typeof transcript !== "string" || transcript.length === 0) {
    return {
      text: typeof transcript === "string" ? transcript : "",
      redactionCount: 0,
      categories: [],
    };
  }

  const categories = new Set<string>();
  let count = 0;
  const hit = (category: string) => {
    categories.add(category);
    count += 1;
  };

  let text = maskStructured(transcript, mask, hit);
  text = maskCued(text, mask, hit);
  text = maskUncuedNumbers(text, mask, hit);

  return { text, redactionCount: count, categories: [...categories].sort() };
}

function maskStructured(input: string, mask: string, hit: (c: string) => void): string {
  let text = input;
  for (const { re, category } of STRUCTURED) {
    text = text.replace(new RegExp(re.source, re.flags), () => {
      hit(category);
      return mask;
    });
  }
  return text;
}

/* ----------------------------------------------------------------- cued -- */

function maskCued(input: string, mask: string, hit: (c: string) => void): string {
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

    out += input.slice(i, cue.end); // keep the cue word itself
    const span = findValueAfterCue(input, lower, cue.end);

    if (span) {
      out += input.slice(cue.end, span.start); // whatever sat between, verbatim
      out += mask;
      hit(cue.label);
      i = span.end;
    } else {
      i = cue.end; // a cue with no value after it — leave the sentence alone
    }
  }
  return out;
}

interface ValueSpan {
  readonly start: number;
  readonly end: number;
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
function findValueAfterCue(input: string, lower: string, from: number): ValueSpan | null {
  const skip = skipConnectors(input, lower, from);
  const direct = consumeValue(input, skip.end, skip.crossed);
  if (direct > skip.end) {
    let start = skip.end;
    while (start < input.length && /\s/.test(input[start])) start += 1;
    return { start, end: direct };
  }

  let j = skip.end;
  for (let hop = 0; hop < 2; hop += 1) {
    while (j < input.length && /\s/.test(input[j])) j += 1;
    const len = wordLengthAt(input, j);
    if (len === 0) return null;
    j += len; // step over the unrecognised word

    let k = j;
    while (k < input.length && /\s/.test(input[k])) k += 1;
    if (k >= input.length) return null;

    if (isDigit(input[k])) {
      const end = consumeDigitRun(input, k);
      if (end > k) return { start: k, end };
    }
    const words = consumeNumberWords(input, k);
    if (words > k) return { start: k, end: words };
  }
  return null;
}

function matchCueAt(lower: string, at: number): { end: number; label: string } | null {
  if (at > 0 && isWordChar(lower[at - 1])) return null; // must start a word
  for (const cue of CUES) {
    if (!lower.startsWith(cue, at)) continue;
    const end = at + cue.length;
    // Must end a word, so "pinned" never matches the cue "pin".
    if (end < lower.length && isWordChar(lower[end])) continue;
    return { end, label: cueLabel(cue) };
  }
  return null;
}

/**
 * Step over connector words and `:`/`=` separators between a cue and its value.
 * `crossed` records whether an explicit assignment signal was seen — without
 * one, a bare following word is NOT treated as a secret ("I forgot my password
 * yesterday" must not mask "yesterday").
 */
function skipConnectors(
  input: string,
  lower: string,
  from: number,
): { end: number; crossed: boolean } {
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
    return { end: j, crossed };
  }
}

/**
 * Consume a secret VALUE starting at `start`; return the index just past it, or
 * `start` when there is nothing to take. Digit runs and spoken number-word runs
 * are always taken. A single ordinary word is taken only when an explicit
 * assignment signal was crossed.
 */
function consumeValue(input: string, start: number, crossed: boolean): number {
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
function consumeDigitRun(input: string, start: number): number {
  let k = start;
  let last = start;
  while (k < input.length) {
    if (isDigit(input[k])) {
      k += 1;
      last = k;
      continue;
    }
    const sep = input[k] === " " || input[k] === "-" || input[k] === ".";
    if (sep && k + 1 < input.length && isDigit(input[k + 1])) {
      k += 1;
      continue;
    }
    break;
  }
  return last;
}

function consumeNumberWords(input: string, start: number): number {
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

/* -------------------------------------------------------------- uncued -- */

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
const UNCUED: ReadonlyArray<{ readonly re: RegExp; readonly category: string }> = [
  { re: /\b\d{3}[ -]\d{2}[ -]\d{4}\b/g, category: "ssn" },
  { re: /\b\d{4}(?:[ -]\d{4}){3}\b/g, category: "card" },
  { re: /\b\d{6,}\b/g, category: "numeric-run" },
  { re: /\b\d(?:[ -]\d){5,}\b/g, category: "spoken-digits" },
];

const NUMBER_WORD_RUN = new RegExp(
  `\\b(?:${[...NUMBER_WORDS].join("|")})(?:[ -](?:${[...NUMBER_WORDS].join("|")})){5,}\\b`,
  "gi",
);

function maskUncuedNumbers(input: string, mask: string, hit: (c: string) => void): string {
  let text = input;
  for (const { re, category } of UNCUED) {
    text = text.replace(new RegExp(re.source, re.flags), () => {
      hit(category);
      return mask;
    });
  }
  text = text.replace(NUMBER_WORD_RUN, () => {
    hit("spoken-digits");
    return mask;
  });
  return text;
}

/* ------------------------------------------------------- surface helpers -- */

export interface SpeechSafety extends RedactionResult {
  /** True when something protected was found and removed before speaking. */
  readonly containedProtected: boolean;
}

/**
 * Text-to-speech gate. OCADE must never READ A SECRET ALOUD — a spoken OTP is
 * audible to everyone in the room and to any recording in progress. Callers
 * must speak `text`, never the original.
 */
export function redactForSpeech(text: string): SpeechSafety {
  const result = redactSpokenSecrets(text, { mask: SPOKEN_MASK });
  return { ...result, containedProtected: result.redactionCount > 0 };
}

/**
 * The ONLY part of a redaction that may be persisted to a log, receipt, audit
 * record or telemetry event: what kind, and how many. Never the value, never
 * the surrounding sentence.
 */
export function safeRedactionMetadata(result: RedactionResult): {
  redactionCount: number;
  categories: readonly string[];
} {
  return { redactionCount: result.redactionCount, categories: result.categories };
}

/**
 * Guard for anything leaving the device (cloud speech-to-text, a remote model,
 * a synced transcript). Redaction runs locally first so a protected value is
 * never transmitted, and the caller is told whether that happened.
 */
export function redactBeforeCloud(text: string): SpeechSafety {
  const result = redactSpokenSecrets(text);
  return { ...result, containedProtected: result.redactionCount > 0 };
}
