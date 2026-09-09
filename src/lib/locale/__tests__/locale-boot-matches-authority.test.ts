import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  resolvePreferredLocale,
  writeStoredLocale,
  type LocaleStorage,
} from "../use-locale";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "../supported-locales";
import { keysForClass } from "@/lib/device/local-data";

/**
 * THE LOCALE LIST EXISTS TWICE, AND THAT IS DELIBERATE — SO IT IS CHECKED.
 *
 * The document's language has to be set before first paint: a screen reader
 * picks its pronunciation from `lang`, and correcting it after hydration means
 * the first thing read aloud is read wrong. A script that runs that early
 * cannot import a module, so the eight tags are inlined in the boot script in
 * `__root.tsx` — the same trade the theme already makes.
 *
 * An inlined copy is a duplicate authority unless something compares them. The
 * failure would be silent and slow: a locale added to the authority and not to
 * the boot script simply never sets `lang`, and nobody sighted would notice at
 * all.
 */

const ROOT = readFileSync("src/routes/__root.tsx", "utf8");

describe("the pre-paint boot script", () => {
  it("was found at all, so a broken scan cannot pass", () => {
    expect(ROOT).toContain("THEME_BOOT");
    expect(ROOT).toContain("d.lang");
  });

  it("carries exactly the locales the authority declares", () => {
    const inlined = /var L=\[([^\]]+)\]/.exec(ROOT);
    expect(inlined, "no inlined locale list found in the boot script").toBeTruthy();
    const tags = inlined![1]
      .split(",")
      .map((entry) => entry.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
    expect(tags).toEqual(SUPPORTED_LOCALES.map((locale) => locale.tag));
  });

  it("reads the same storage key the application writes", () => {
    expect(ROOT).toContain(LOCALE_STORAGE_KEY);
  });

  it("prefers the stored choice over the browser, as the hook does", () => {
    // Both halves must agree about precedence, or the language flips between
    // the first paint and hydration.
    const boot = ROOT.slice(ROOT.indexOf("var L=["), ROOT.indexOf("}catch(e){}})();"));
    expect(boot.indexOf("localStorage.getItem")).toBeLessThan(boot.indexOf("navigator.languages"));
    expect(resolvePreferredLocale("de-DE", ["en-GB"])).toBe("de-DE");
    expect(resolvePreferredLocale(null, ["de-DE"])).toBe("de-DE");
    expect(resolvePreferredLocale(null, [])).toBe(DEFAULT_LOCALE);
  });

  it("ignores a stored value that is not a locale", () => {
    // This runs before any of the application's validation exists.
    expect(ROOT).toContain("L.indexOf(l)!==-1");
  });
});

describe("the stored choice", () => {
  function memory(seed: Record<string, string> = {}): LocaleStorage {
    const entries = { ...seed };
    return {
      getItem: (key) => (key in entries ? entries[key] : null),
      setItem: (key, value) => {
        entries[key] = value;
      },
    };
  }

  it("round-trips", () => {
    const storage = memory();
    writeStoredLocale("ja-JP", storage);
    expect(readStoredLocale(storage)).toBe("ja-JP");
  });

  it("refuses a stored value that is not a supported locale", () => {
    expect(readStoredLocale(memory({ [LOCALE_STORAGE_KEY]: "klingon" }))).toBeNull();
    expect(readStoredLocale(memory({ [LOCALE_STORAGE_KEY]: "de" }))).toBeNull();
  });

  it("survives having no storage at all, as on the server", () => {
    expect(readStoredLocale(null)).toBeNull();
    expect(() => writeStoredLocale("en-GB", null)).not.toThrow();
  });

  it("is classified by the local-data deletion authority", () => {
    expect(keysForClass("preferences", [LOCALE_STORAGE_KEY])).toEqual([LOCALE_STORAGE_KEY]);
  });
});

describe("the settings screen", () => {
  const SETTINGS = readFileSync("src/routes/_authenticated/settings.index.tsx", "utf8");

  it("reads the authority rather than its own list", () => {
    // It had its own copy of all eight, which could not say which are actually
    // translated — so the screen offered them as though they were equivalent.
    expect(SETTINGS).toContain("SUPPORTED_LOCALES");
    expect(SETTINGS).not.toMatch(/const LOCALES = \[/);
  });

  it("says which languages are not translated rather than implying all are", () => {
    const text = SETTINGS.replace(/\s+/g, " ");
    expect(text).toMatch(/not translated yet/i);
    expect(text).toMatch(/rather than showing you a machine translation/i);
  });

  it("caches the choice locally so the first paint can act on it", () => {
    expect(SETTINGS).toContain("writeStoredLocale(");
  });
});
