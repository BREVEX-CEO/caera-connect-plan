/**
 * TEXT OCADE MUST NEVER TYPE, READ BACK, RECORD OR PUT IN A NOTIFICATION.
 *
 * One rule, in one place, because it is applied by things that have nothing
 * else in common: the desktop companion refuses to type it, the browser bridge
 * refuses to read it out of a form, session recording refuses to keep it, and a
 * notification refuses to quote it. Four subsystems agreeing on what a
 * credential looks like is the whole point; four copies of the regex would be
 * four chances to disagree.
 *
 * It used to live in `native/companion-bridge.ts`. That made every consumer
 * import the companion action model, the risk tiers and the transport types to
 * get at two regular expressions — which put 10 KiB of computer-control code on
 * the first paint of every page, by way of the notification store.
 *
 * DELIBERATELY BROAD. A false positive costs a pause; a false negative costs a
 * credential.
 */

/**
 * Patterns that indicate protected content OCADE must never type or read.
 * Deliberately broad — a false positive costs a pause, a false negative costs a
 * credential.
 */
const PROTECTED_HINTS =
  /(password|passcode|passphrase|\botp\b|one[- ]time code|verification code|2fa|mfa|captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|aadhaar|passport number|pin\b|recovery code|seed phrase|private key|biometric)/i;

/** Long digit runs (card/OTP-like) are treated as protected. */
const DIGIT_RUN = /\b\d{4,}\b/;

export function isProtectedText(text: string): boolean {
  return PROTECTED_HINTS.test(text) || DIGIT_RUN.test(text);
}

/** Redact protected content from any string before it reaches logs/audit/replay. */
export function redactForAudit(text: string): string {
  if (!text) return text;
  return text.replace(/\b\d{4,}\b/g, "[redacted]").replace(PROTECTED_HINTS, "[redacted]");
}
