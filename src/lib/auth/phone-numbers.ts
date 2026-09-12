/**
 * TURNING WHAT SOMEBODY TYPES INTO A NUMBER A PROVIDER WILL ACCEPT.
 *
 * Supabase sends the code to an E.164 number: a leading `+`, a country calling
 * code, then the subscriber number, digits only. People do not type that. They
 * type `(555) 010-9999`, `0555 010 9999`, `+1 555 010 9999`, and in several
 * countries they type a leading trunk `0` that must be dropped once a country
 * code is attached.
 *
 * So the picker supplies the country and this supplies the arithmetic, in one
 * pure function that a test can exercise for every case without a network or a
 * phone. A number that cannot be made valid is refused here rather than sent to
 * a provider that answers with a message written for whoever operates it.
 *
 * THE LIST IS NOT EVERY COUNTRY. It is the calling codes OCADE can actually
 * deliver to, sorted by name, with the operating country first. Shipping a list
 * of 240 entries to every visitor to offer delivery OCADE has not configured
 * would be a longer menu and the same answer.
 */

export interface CallingCountry {
  /** ISO 3166-1 alpha-2, which is what the flag and the sort key come from. */
  code: string;
  name: string;
  /** The calling code, digits only, without the `+`. */
  dial: string;
}

export const CALLING_COUNTRIES: CallingCountry[] = [
  { code: "IN", name: "India", dial: "91" },
  { code: "AU", name: "Australia", dial: "61" },
  { code: "BR", name: "Brazil", dial: "55" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "FR", name: "France", dial: "33" },
  { code: "DE", name: "Germany", dial: "49" },
  { code: "ID", name: "Indonesia", dial: "62" },
  { code: "IE", name: "Ireland", dial: "353" },
  { code: "IT", name: "Italy", dial: "39" },
  { code: "JP", name: "Japan", dial: "81" },
  { code: "MY", name: "Malaysia", dial: "60" },
  { code: "MX", name: "Mexico", dial: "52" },
  { code: "NL", name: "Netherlands", dial: "31" },
  { code: "NZ", name: "New Zealand", dial: "64" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "PH", name: "Philippines", dial: "63" },
  { code: "PL", name: "Poland", dial: "48" },
  { code: "PT", name: "Portugal", dial: "351" },
  { code: "SA", name: "Saudi Arabia", dial: "966" },
  { code: "SG", name: "Singapore", dial: "65" },
  { code: "ZA", name: "South Africa", dial: "27" },
  { code: "KR", name: "South Korea", dial: "82" },
  { code: "ES", name: "Spain", dial: "34" },
  { code: "SE", name: "Sweden", dial: "46" },
  { code: "CH", name: "Switzerland", dial: "41" },
  { code: "AE", name: "United Arab Emirates", dial: "971" },
  { code: "GB", name: "United Kingdom", dial: "44" },
  { code: "US", name: "United States", dial: "1" },
];

export const DEFAULT_CALLING_COUNTRY = "IN";

export function callingCountry(code: string): CallingCountry {
  return (
    CALLING_COUNTRIES.find((country) => country.code === code) ??
    CALLING_COUNTRIES.find((country) => country.code === DEFAULT_CALLING_COUNTRY)!
  );
}

/** The flag, built from the code rather than shipped as an image. */
export function flagFor(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "empty" | "too_short" | "too_long" | "not_a_number" };

/**
 * The national number a person typed, plus a country, as E.164.
 *
 * A leading `+` in the input WINS over the picker, because somebody who typed
 * their full international number has said something more specific than the
 * default selection did. Otherwise the country's calling code is attached and a
 * single leading trunk `0` is dropped — the one thing that quietly produces an
 * unreachable number when it is not.
 *
 * The bounds are E.164's own: at most fifteen digits including the calling
 * code, and no fewer than four subscriber digits, which is the shortest thing
 * any of these countries issues.
 */
export function toE164(input: string, countryCode: string): PhoneResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (/[^\d\s()+\-.]/.test(trimmed)) return { ok: false, reason: "not_a_number" };

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 8) return { ok: false, reason: "too_short" };
    if (digits.length > 15) return { ok: false, reason: "too_long" };
    return { ok: true, e164: `+${digits}` };
  }

  const country = callingCountry(countryCode);
  const national = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (national.length < 4) return { ok: false, reason: "too_short" };
  const combined = `${country.dial}${national}`;
  if (combined.length > 15) return { ok: false, reason: "too_long" };
  return { ok: true, e164: `+${combined}` };
}

/** One line, in OCADE's words, for why a number was not accepted. */
export function describePhoneProblem(reason: Exclude<PhoneResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "empty":
      return "Enter your phone number.";
    case "too_short":
      return "That number looks too short. Check the digits and try again.";
    case "too_long":
      return "That number looks too long. Check the digits and try again.";
    case "not_a_number":
      return "Use digits only, with an optional leading +.";
  }
}
