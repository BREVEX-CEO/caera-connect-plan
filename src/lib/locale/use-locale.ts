/**
 * THE LOCALE THIS PERSON READS IN.
 *
 * One hook, one storage key, one answer. The alternative — each surface asking
 * the browser for itself — is how the product ended up formatting a date three
 * different ways on three screens of the same account.
 *
 * THE CHOSEN LOCALE BEATS THE BROWSER'S, AND THAT ORDER MATTERS. Somebody who
 * picks English (India) on a laptop configured for en-US has said something
 * deliberate about how they want dates and numbers; falling back to the browser
 * would silently overrule them on every visit.
 *
 * IT ALSO SETS `lang` ON THE DOCUMENT. That attribute is not decoration: a
 * screen reader chooses its pronunciation from it, so a page of German text
 * announced as English is unintelligible rather than merely accented. The
 * server renders `lang="en"` because it does not know who is asking; this
 * corrects it as soon as the browser does.
 */

import { useCallback, useEffect, useState } from "react";
import {
  browserPreferredLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from "./supported-locales";

const STORAGE_KEY = "ocade.locale.v1";

export interface LocaleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): LocaleStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** The stored choice, or null when the person has not made one. */
export function readStoredLocale(
  storage: LocaleStorage | null = browserStorage(),
): SupportedLocale | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw && isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(
  locale: SupportedLocale,
  storage: LocaleStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, locale);
  } catch {
    /* Blocked or full. The choice applies to this session regardless. */
  }
}

/**
 * Resolve the locale from a choice and a browser, in that order.
 *
 * Pure, so the precedence can be tested without a browser or a store — which is
 * the part that is easy to get backwards and impossible to see once it is.
 */
export function resolvePreferredLocale(
  chosen: SupportedLocale | null,
  browserPreferences: readonly string[],
): SupportedLocale {
  if (chosen) return chosen;
  return browserPreferredLocale(browserPreferences);
}

export interface LocaleState {
  locale: SupportedLocale;
  /** True when the person picked it rather than it being inferred. */
  chosen: boolean;
  setLocale: (next: SupportedLocale) => void;
}

export function useLocale(): LocaleState {
  /*
   * The default on the first render, matching what the server produced. Reading
   * storage or the browser during render would make the two disagree for
   * anybody who has chosen a locale, and React resolves that by throwing the
   * server's HTML away.
   */
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    const resolved = resolvePreferredLocale(
      stored,
      typeof navigator === "undefined" ? [] : [...(navigator.languages ?? [])],
    );
    setLocaleState(resolved);
    setChosen(Boolean(stored));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: SupportedLocale) => {
    writeStoredLocale(next);
    setLocaleState(next);
    setChosen(true);
  }, []);

  return { locale, chosen, setLocale };
}

/** The key, exported so the local-data deletion authority can classify it. */
export const LOCALE_STORAGE_KEY = STORAGE_KEY;
