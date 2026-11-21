/**
 * ANSWER LANGUAGE (plan 14E.8 Preferences, 14B language setting): the person chooses the language
 * Chat answers in; Automatic answers in the language they write. It is one short standing
 * instruction, kept on this device per account. OCADE's own screens stay in English (no
 * translation of the interface is claimed).
 */
export const ANSWER_LANGUAGES = [
  "Automatic",
  "English",
  "हिन्दी (Hindi)",
  "Español (Spanish)",
  "Français (French)",
  "Deutsch (German)",
  "Português (Portuguese)",
  "Italiano (Italian)",
  "Nederlands (Dutch)",
  "العربية (Arabic)",
  "বাংলা (Bengali)",
  "தமிழ் (Tamil)",
  "తెలుగు (Telugu)",
  "मराठी (Marathi)",
  "中文 (Chinese)",
  "日本語 (Japanese)",
  "한국어 (Korean)",
  "Русский (Russian)",
  "Türkçe (Turkish)",
] as const;
export type AnswerLanguage = (typeof ANSWER_LANGUAGES)[number];

const key = (account: string) => `ocade.answer-language.${account}`;

export function readAnswerLanguage(account: string): AnswerLanguage {
  if (typeof window === "undefined" || !account) return "Automatic";
  const stored = window.localStorage.getItem(key(account));
  return (ANSWER_LANGUAGES as readonly string[]).includes(stored ?? "")
    ? (stored as AnswerLanguage)
    : "Automatic";
}

export function saveAnswerLanguage(account: string, language: AnswerLanguage) {
  window.localStorage.setItem(key(account), language);
}

/** The standing instruction for a chosen language, or null for Automatic. */
export function languageInstruction(language: AnswerLanguage): string | null {
  if (language === "Automatic") return null;
  const name = language.includes("(") ? language.slice(language.indexOf("(") + 1, -1) : language;
  return `Answer in ${name}, whatever language the person writes in, unless they ask for another.`;
}
