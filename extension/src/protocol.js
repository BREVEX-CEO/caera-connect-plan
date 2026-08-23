/**
 * The contract between OCADE and this browser, and the rules that hold
 * whatever the page says.
 *
 * WHY A SEPARATE MODULE. The background service worker enforces these rules and
 * the tests assert them. Keeping them in one file means the test exercises the
 * SAME predicate the executor runs, rather than a restatement of it that can
 * drift — a re-implemented rule that agrees with itself proves nothing.
 */

/** Control states. STOPPED and HANDED_OVER are latches: only the user clears them. */
export const RUNNING = "running";
export const PAUSED = "paused";
export const STOPPED = "stopped";
export const HANDED_OVER = "handed_over";

/**
 * Inputs OCADE must never fill, however the page labels them.
 *
 * A password, a one-time code, a card verification value, a PIN or a recovery
 * code is the user's to type. Typing one on their behalf means holding it, and
 * a page that can persuade the agent to type a secret can persuade it to type
 * that secret somewhere else. So this is a refusal, not a preference: the run
 * pauses and asks the person to take over.
 *
 * Matched on the field's TYPE, name, id, autocomplete hint and visible label,
 * because a site that wants the value will supply at least one of them.
 */
const PROTECTED_PATTERNS = [
  /\bpass(word|phrase|code)\b/i,
  /\bpwd\b/i,
  /\botp\b/i,
  /\bone[-\s]?time\b/i,
  /\b(verification|security|auth(entication)?)[-\s]?code\b/i,
  /\b2fa\b/i,
  /\bmfa\b/i,
  /\btwo[-\s]?factor\b/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\bcsc\b/i,
  /\bcard[-\s]?(verification|security)\b/i,
  /\bpin\b/i,
  /\brecovery[-\s]?(code|key)\b/i,
  /\bbackup[-\s]?code\b/i,
  /\bseed[-\s]?phrase\b/i,
  /\bcaptcha\b/i,
];

/** Autocomplete tokens the browser itself uses for secrets. */
const PROTECTED_AUTOCOMPLETE = new Set([
  "current-password",
  "new-password",
  "one-time-code",
  "cc-csc",
]);

/**
 * Decide whether a field is the user's to fill. Pure, and given only the
 * descriptors the content script can read, so it is cheap to test exhaustively.
 */
export function isProtectedField({ type, name, id, autocomplete, label, placeholder, ariaLabel }) {
  if (String(type || "").toLowerCase() === "password") return true;
  if (PROTECTED_AUTOCOMPLETE.has(String(autocomplete || "").toLowerCase())) return true;
  /*
   * Separators are flattened to spaces before matching. Underscore is a WORD
   * character, so `\botp\b` does not match `otp_code` — and `otp_code`,
   * `oneTimeCode` and `card-cvv` are exactly how real fields are named. camelCase
   * is split for the same reason.
   */
  const haystack = [name, id, autocomplete, label, placeholder, ariaLabel]
    .filter(Boolean)
    .join(" ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.[\]]+/g, " ");
  return PROTECTED_PATTERNS.some((p) => p.test(haystack));
}

/**
 * Is this URL inside the scope the user approved for this run?
 *
 * Compared by ORIGIN, never by substring: "https://evil.com/#bank.com" contains
 * an approved host as text and is not that host. A page cannot widen this — the
 * list only changes when the user changes it.
 */
export function isAuthorized(url, approvedOrigins) {
  let origin;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    origin = parsed.origin;
  } catch {
    return false;
  }
  return Array.isArray(approvedOrigins) && approvedOrigins.includes(origin);
}

/**
 * Strip any instruction-shaped content out of text taken from a page before it
 * is handed back to the model.
 *
 * Page text is DATA. It describes what is on screen; it is never a source of
 * new goals or new permissions. This does not make the text safe to obey — the
 * model side must still treat it as untrusted — it removes the most direct
 * attempt to be obeyed, and flags that it did so, so a run that was targeted
 * can be seen to have been targeted.
 */
const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above) instructions?/gi,
  /disregard (all |any )?(previous|prior|above) instructions?/gi,
  /you are now (a|an|the)\b/gi,
  /\bsystem prompt\b/gi,
  /\bnew instructions?:/gi,
  /\bassistant:\s/gi,
];

export function sanitisePageText(text) {
  const original = String(text ?? "");
  let flagged = 0;
  let cleaned = original;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match) => {
      flagged += 1;
      return "[removed: instruction-shaped text from the page]";
    });
  }
  return { text: cleaned, injectionAttempts: flagged };
}

/** Commands the executor accepts. Anything else is refused by name. */
export const COMMANDS = new Set([
  "tabs.list",
  "tabs.open",
  "tabs.switch",
  "tabs.close",
  "navigate",
  "reload",
  "observe",
  "click",
  "type",
  "scroll",
  "form.fill",
  "media",
  "screenshot",
  "control.pause",
  "control.resume",
  "control.stop",
  "control.takeover",
  "control.status",
  "scope.list",
]);

/** Commands that change the page, and therefore must be verified after acting. */
export const MUTATING = new Set([
  "navigate",
  "reload",
  "click",
  "type",
  "scroll",
  "form.fill",
  "media",
]);
