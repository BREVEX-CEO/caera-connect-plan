// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  LANDING_SEEN_COOKIE,
  hasSeenLanding,
  hasStoredSupabaseSession,
  markLandingSeen,
  readCookie,
  rootEntryFor,
  sessionStorageKeyFor,
} from "../root-entry";

describe("the three entry rules for /", () => {
  it("shows the landing page to a device that has not seen it", () => {
    expect(rootEntryFor({ seenLanding: false, storedSession: false })).toBe("landing");
  });

  it("sends a returning signed-out visitor to sign in rather than back through marketing", () => {
    expect(rootEntryFor({ seenLanding: true, storedSession: false })).toBe("sign-in");
  });

  it("sends a returning signed-in visitor straight to the workspace", () => {
    expect(rootEntryFor({ seenLanding: true, storedSession: true })).toBe("workspace");
  });

  it("prefers a session over a missing landing flag", () => {
    /*
     * A deep link, a shared machine or a restored profile can carry a session
     * without the cookie. Showing that person marketing would be the same
     * obstacle the returning rule exists to remove.
     */
    expect(rootEntryFor({ seenLanding: false, storedSession: true })).toBe("workspace");
  });
});

describe("the landing-seen device flag", () => {
  it("reads its own cookie and not one whose name merely starts the same", () => {
    const header = `${LANDING_SEEN_COOKIE}_at=999; ${LANDING_SEEN_COOKIE}=1; other=x`;
    expect(readCookie(header, LANDING_SEEN_COOKIE)).toBe("1");
    expect(hasSeenLanding(header)).toBe(true);
  });

  it("treats an absent, empty or unrelated cookie header as a first visit", () => {
    expect(hasSeenLanding(null)).toBe(false);
    expect(hasSeenLanding("")).toBe(false);
    expect(hasSeenLanding("session=abc")).toBe(false);
    expect(hasSeenLanding(`${LANDING_SEEN_COOKIE}=0`)).toBe(false);
  });

  it("writes the flag once and does not rewrite it", () => {
    const written: string[] = [];
    const document = globalThis.document as unknown as { cookie: string };
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => written.join("; "),
      set: (value: string) => {
        written.push(value.split(";")[0]!);
      },
    });
    try {
      markLandingSeen();
      markLandingSeen();
      expect(written).toEqual([`${LANDING_SEEN_COOKIE}=1`]);
    } finally {
      if (original) Object.defineProperty(document, "cookie", original);
      else delete (document as unknown as Record<string, unknown>).cookie;
    }
  });
});

describe("the session probe", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("derives the key the way @supabase/supabase-js derives it", () => {
    expect(sessionStorageKeyFor("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
    expect(sessionStorageKeyFor("http://127.0.0.1:54321")).toBe("sb-127-auth-token");
  });

  it("has no key to look under when no project is bound", () => {
    expect(sessionStorageKeyFor(undefined)).toBeNull();
    expect(sessionStorageKeyFor("not a url")).toBeNull();
  });

  it("answers from the bound project's key, not another project's leftovers", () => {
    window.localStorage.setItem("sb-other-auth-token", "{}");
    expect(hasStoredSupabaseSession("https://abcdefgh.supabase.co")).toBe(false);
    window.localStorage.setItem("sb-abcdefgh-auth-token", "{}");
    expect(hasStoredSupabaseSession("https://abcdefgh.supabase.co")).toBe(true);
  });

  it("falls back to any session-shaped key when no project is bound", () => {
    expect(hasStoredSupabaseSession(undefined)).toBe(false);
    window.localStorage.setItem("sb-abcdefgh-auth-token", "{}");
    expect(hasStoredSupabaseSession(undefined)).toBe(true);
  });
});
