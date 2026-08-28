import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  shouldIsolate,
  isolationHeadersFor,
  needsFullNavigation,
  isolationUpgradeTarget,
  ISOLATED_PATH_PREFIXES,
  NEVER_ISOLATED_PATH_PREFIXES,
  COEP_VALUE,
  COOP_ISOLATED,
  COOP_DEFAULT,
} from "../security/isolation";

/**
 * Which documents get cross-origin isolation, and — more important — which
 * never do.
 *
 * The asymmetry runs through all of this. A route wrongly left OUT of the
 * isolated set runs single-threaded: slower, and correct. A route wrongly put
 * IN can sever `window.opener` under a sign-in popup, or silently drop a
 * cross-origin resource. So every test here that looks paranoid about the
 * auth routes is guarding the expensive direction.
 */

describe("the routes that run inference are isolated", () => {
  it.each([
    "/demo/ocade",
    "/demo/control",
    "/demo/settings",
    "/ocade",
    "/ocade/chat",
    "/ocade/work",
    "/demo/ocade/",
    "/demo/ocade?next=/home",
    "/demo/ocade#section",
  ])("%s is isolated", (path) => {
    expect(shouldIsolate(path)).toBe(true);
  });

  it("carries both headers, which is what the platform requires", () => {
    // Either one alone produces a document that is NOT isolated, and therefore
    // has no SharedArrayBuffer and no threads.
    const headers = isolationHeadersFor("/demo/ocade");
    expect(headers["cross-origin-opener-policy"]).toBe(COOP_ISOLATED);
    expect(headers["cross-origin-embedder-policy"]).toBe(COEP_VALUE);
  });

  it("uses credentialless rather than require-corp", () => {
    /*
     * `require-corp` would silently drop every cross-origin subresource that
     * does not send a CORP header — the analytics beacon, images a conversation
     * references, media on public pages — none of which are ours to change.
     */
    expect(COEP_VALUE).toBe("credentialless");
  });
});

describe("AUTHENTICATION IS NEVER ISOLATED", () => {
  it.each([
    "/auth",
    "/auth/callback",
    "/auth/verify",
    "/auth?next=/home",
    "/.lovable/oauth/consent",
  ])("%s is not isolated", (path) => {
    // The auth SDK falls back to a popup that postMessages its opener when
    // OCADE is iframed. COOP same-origin severs that. Making sign-in faster
    // is not worth making sign-in conditional.
    expect(shouldIsolate(path)).toBe(false);
  });

  it("keeps opener-friendly COOP on the auth document", () => {
    expect(isolationHeadersFor("/auth/callback")["cross-origin-opener-policy"]).toBe(COOP_DEFAULT);
    expect(isolationHeadersFor("/auth/callback")["cross-origin-embedder-policy"]).toBeUndefined();
  });

  it("refuses auth even if an isolated prefix were added that covers it", () => {
    // The deny list is checked FIRST, so a future "/": prefix or a careless
    // "/a" could not drag the sign-in document into isolation.
    for (const denied of NEVER_ISOLATED_PATH_PREFIXES) {
      expect(shouldIsolate(denied)).toBe(false);
      expect(shouldIsolate(`${denied}/anything/below`)).toBe(false);
    }
  });
});

describe("the landing page and marketing pages are left alone", () => {
  it.each([
    "/",
    "/about",
    "/pricing",
    "/compare",
    "/blog",
    "/blog/a-post",
    "/download",
    "/support",
    "/status",
    "/demo",
  ])("%s is not isolated", (path) => {
    expect(shouldIsolate(path)).toBe(false);
  });

  it("does not isolate a marketing route that merely starts with the same letters", () => {
    // A plain startsWith would match these against "/ocade" and isolate a page
    // that has a Mux video on it.
    expect(shouldIsolate("/ocade-pricing")).toBe(false);
    expect(shouldIsolate("/ocadex")).toBe(false);
    expect(shouldIsolate("/products/ocade")).toBe(false);
  });
});

describe("crossing the boundary needs a real navigation", () => {
  it("is required entering an isolated route", () => {
    // A client-side transition keeps the current, un-isolated document, so
    // crossOriginIsolated stays false and threads never appear.
    expect(needsFullNavigation("/", "/demo/ocade")).toBe(true);
  });

  it("is required LEAVING one, too", () => {
    /*
     * The direction that is easy to forget. Routing from /ocade back to /auth
     * inside the same document would run the sign-in UI with window.opener
     * severed — the popup hazard, reached by the back button.
     */
    expect(needsFullNavigation("/ocade", "/auth")).toBe(true);
  });

  it("is not required between two isolated routes", () => {
    expect(needsFullNavigation("/demo/ocade", "/demo/settings")).toBe(false);
  });

  it("is not required between two ordinary routes", () => {
    expect(needsFullNavigation("/", "/pricing")).toBe(false);
  });
});

describe("the one-shot upgrade cannot loop", () => {
  it("asks for a navigation on an isolated route that is not isolated", () => {
    expect(
      isolationUpgradeTarget({ pathname: "/demo/ocade", isolated: false, alreadyTried: false }),
    ).toBe("/demo/ocade");
  });

  it("does nothing once isolation is in force", () => {
    expect(
      isolationUpgradeTarget({ pathname: "/demo/ocade", isolated: true, alreadyTried: false }),
    ).toBeNull();
  });

  it("NEVER asks twice, which is the whole safety property", () => {
    /*
     * A browser that does not implement `credentialless` reports false forever.
     * Without this guard the page would reload, still not be isolated, reload
     * again — an infinite loop on exactly the browsers least able to afford it.
     */
    expect(
      isolationUpgradeTarget({ pathname: "/demo/ocade", isolated: false, alreadyTried: true }),
    ).toBeNull();
  });

  it("does nothing on a route that was never meant to be isolated", () => {
    expect(
      isolationUpgradeTarget({ pathname: "/auth", isolated: false, alreadyTried: false }),
    ).toBeNull();
    expect(
      isolationUpgradeTarget({ pathname: "/", isolated: false, alreadyTried: false }),
    ).toBeNull();
  });
});

describe("hostile and malformed paths", () => {
  it("never throws, and never isolates something it does not recognise", () => {
    for (const path of ["", "//", "not-a-path", "../../etc", "/ocade/../auth", "?x=1", "#h"]) {
      expect(() => shouldIsolate(path)).not.toThrow();
    }
    // A traversal that textually contains /auth must not be treated as auth,
    // and must not be isolated either — it is simply not a route we know.
    expect(shouldIsolate("/ocade/../auth")).toBe(false);
  });

  it("treats a path with and without a trailing slash identically", () => {
    for (const prefix of ISOLATED_PATH_PREFIXES) {
      expect(shouldIsolate(prefix)).toBe(shouldIsolate(`${prefix}/`));
    }
  });
});

describe("the served application agrees with this module", () => {
  /*
   * The headers and the client-side guard read the SAME decision function. If
   * they ever diverged the result would be either a page that never gets
   * threads or one that reloads forever, so the wiring is asserted rather than
   * assumed.
   */
  it("the response headers are derived from shouldIsolate", () => {
    const source = readFileSync("src/lib/security/public-response.ts", "utf8");
    expect(source).toMatch(/isolationHeadersFor/);
  });

  it("the client guard is derived from the same module", () => {
    const source = readFileSync("src/lib/security/isolation-upgrade.ts", "utf8");
    expect(source).toMatch(/isolationUpgradeTarget/);
  });

  it("every isolated prefix is a real route in this application", () => {
    // A prefix for a route that does not exist is dead configuration that
    // reads as coverage.
    const routes = readFileSync("src/routeTree.gen.ts", "utf8");
    for (const prefix of ISOLATED_PATH_PREFIXES) {
      expect(routes.includes(`'${prefix}'`) || routes.includes(`"${prefix}"`)).toBe(true);
    }
  });
});
