/**
 * INTELLIGENT PRIVACY (plan 27.2.3 R12-03, 27.4.3): payment card numbers and IBANs that JARVIS
 * reads on the person's computer are shown to the online planner only as stable placeholders,
 * such as ⟦card·4f2a9c1e⟧. When the planner uses a placeholder in a step, OCADE puts the real
 * value back before the step goes to the person's own computer, so the authorized form gets the
 * exact value while the model provider never sees it. The values come only from this task's own
 * records; a placeholder the task never saw stays as it is (and fails validation honestly).
 */
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g;
const TOKEN = /⟦(card|iban)·([0-9a-f]{8})⟧/g;

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function ibanValid(value: string): boolean {
  const compact = value.replace(/ /g, "");
  if (compact.length < 15 || compact.length > 34) return false;
  const moved = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of moved) {
    const code = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** A short stable id for a value (FNV-1a), so the same number is the same placeholder. */
function id(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Replace sensitive values in text with placeholders, recording each in `seen`. */
export function maskSensitive(text: string, seen: Map<string, string>): string {
  return text
    .replace(CARD, (match) => {
      const digits = match.replace(/[ -]/g, "");
      if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return match;
      const token = `⟦card·${id(digits)}⟧`;
      seen.set(token, match);
      return token;
    })
    .replace(IBAN, (match) => {
      if (!ibanValid(match)) return match;
      const token = `⟦iban·${id(match.replace(/ /g, ""))}⟧`;
      seen.set(token, match);
      return token;
    });
}

/** Put the real values back into a step's arguments, only for placeholders this task saw. */
export function unmaskArguments<T>(value: T, seen: ReadonlyMap<string, string>): T {
  if (typeof value === "string")
    return value.replace(TOKEN, (token) => seen.get(token) ?? token) as T;
  if (Array.isArray(value)) return value.map((item) => unmaskArguments(item, seen)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        unmaskArguments(v, seen),
      ]),
    ) as T;
  return value;
}
