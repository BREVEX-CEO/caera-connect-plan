import { beforeEach, describe, expect, it } from "vitest";
import {
  clearErrorJournal,
  formatErrorJournal,
  JOURNAL_LIMIT,
  readErrorJournal,
  recordErrorInJournal,
  redactForJournal,
} from "../error-journal";

/*
 * A DIAGNOSTICS LOG IS A PLACE SECRETS GO TO LIVE FOREVER.
 *
 * A stack frame carries URLs, a URL carries a query string, and a query string
 * on an auth callback carries an access token. A message carries whatever was
 * interpolated into it, which on a sign-in path is somebody's email address.
 * Then the person copies the whole thing into a support ticket.
 *
 * So the redaction is tested harder than the storage is, and it runs on the way
 * IN — redacting at read time would mean the token sat in localStorage in the
 * meantime, which is the thing being prevented.
 */

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

describe("what never reaches the journal", () => {
  it("removes a session token", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N";
    expect(redactForJournal(`failed with ${jwt}`)).not.toContain(jwt);
    expect(redactForJournal(`failed with ${jwt}`)).toContain("[token]");
  });

  it("removes an email address", () => {
    expect(redactForJournal("no account for ada@example.com")).toBe("no account for [email]");
  });

  it.each([
    "access_token",
    "refresh_token",
    "token",
    "key",
    "apikey",
    "api_key",
    "code",
    "secret",
    "password",
  ])("removes a %s from a query string but keeps the URL", (param) => {
    const out = redactForJournal(`GET /auth/callback?${param}=s3cr3tvalue&next=/home`);
    expect(out).not.toContain("s3cr3tvalue");
    expect(out).toContain("/auth/callback");
    // The rest of the query string is the useful part and must survive.
    expect(out).toContain("next=/home");
  });

  it("removes a Supabase key of either kind", () => {
    expect(redactForJournal("sb_secret_abcdefghijklmnop")).toBe("[key]");
    expect(redactForJournal("sb_publishable_abcdefghijklmnop")).toBe("[key]");
  });

  it("removes a long opaque run that is plainly not prose", () => {
    const opaque = "A".repeat(48);
    expect(redactForJournal(`id ${opaque}`)).toBe("id [opaque]");
  });

  it("leaves ordinary English alone, which is the whole point of keeping it", () => {
    const message = "Could not reach the companion on this device. Try again.";
    expect(redactForJournal(message)).toBe(message);
  });

  it("redacts on the way in, so nothing sensitive is ever stored", () => {
    recordErrorInJournal({
      where: "auth",
      route: "/auth/callback?access_token=abcdefghijklmnop",
      message: "sign-in failed for ada@example.com",
    });
    const raw = store.get("ocade.diagnostics.errors.v1") ?? "";
    expect(raw).not.toContain("ada@example.com");
    expect(raw).not.toContain("abcdefghijklmnop");
  });
});

describe("the journal itself", () => {
  it("starts empty and says so in words", () => {
    expect(readErrorJournal()).toEqual([]);
    expect(formatErrorJournal([])).toMatch(/no errors/i);
  });

  it("keeps the newest first, because that is what you came for", () => {
    recordErrorInJournal({ where: "a", route: "/one", message: "first" });
    recordErrorInJournal({ where: "b", route: "/two", message: "second" });
    expect(readErrorJournal().map((e) => e.message)).toEqual(["second", "first"]);
  });

  it("never grows past its limit", () => {
    for (let i = 0; i < JOURNAL_LIMIT + 25; i += 1) {
      recordErrorInJournal({ where: "loop", route: "/", message: `error ${i}` });
    }
    expect(readErrorJournal()).toHaveLength(JOURNAL_LIMIT);
    // And it kept the RECENT ones, not the first fifty.
    expect(readErrorJournal()[0]?.message).toBe(`error ${JOURNAL_LIMIT + 24}`);
  });

  it("keeps a stack short enough to read", () => {
    recordErrorInJournal({
      where: "boundary",
      route: "/",
      message: "boom",
      stack: Array.from({ length: 40 }, (_, i) => `    at frame${i} (/x.js:1:1)`).join("\n"),
    });
    expect(readErrorJournal()[0]?.stack?.split("\n")).toHaveLength(5);
  });

  it("clears completely", () => {
    recordErrorInJournal({ where: "a", route: "/", message: "x" });
    clearErrorJournal();
    expect(readErrorJournal()).toEqual([]);
  });

  it("survives storage that refuses to cooperate", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("private browsing");
        },
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {
          throw new Error("nope");
        },
      },
    });
    // A journal that can break the page it is describing is worse than none.
    expect(() => recordErrorInJournal({ where: "a", route: "/", message: "x" })).not.toThrow();
    expect(readErrorJournal()).toEqual([]);
    expect(() => clearErrorJournal()).not.toThrow();
  });

  it("formats something a person can paste into a support message", () => {
    recordErrorInJournal({
      where: "authenticated_route",
      route: "/ocade/projects",
      message: "Browser Only vault is locked.",
    });
    const text = formatErrorJournal();
    expect(text).toContain("authenticated_route");
    expect(text).toContain("/ocade/projects");
    expect(text).toContain("vault is locked");
  });
});
