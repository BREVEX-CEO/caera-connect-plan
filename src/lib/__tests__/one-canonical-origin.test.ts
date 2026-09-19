import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalHostRedirect } from "@/lib/security/public-response";

/**
 * TWO ORIGINS SERVING THE SAME PRODUCT IS TWO OF EVERYTHING THE BROWSER KEEPS.
 *
 * `wrangler.json` routes both `ocade.in/*` and `www.ocade.in/*` to this Worker,
 * and both answered 200. Storage is keyed by origin, so that is two sessions,
 * two IndexedDB databases, two OPFS roots, two service workers and — the
 * expensive one — two copies of a 484 MB offline release for one person on one
 * machine.
 *
 * The `www` route stays in `wrangler.json` deliberately: Cloudflare must still
 * receive those requests in order to answer them with a redirect. What must not
 * happen is the Worker SERVING them, and the redirect has to come before both
 * the asset binding and Nitro, because either would happily answer first.
 *
 * The redirect lives with the other response hardening rather than in the entry
 * point, which cannot be imported here at all: its first line loads Nitro. So
 * the behaviour is tested directly and the entry is only read to prove the
 * ORDER — that nothing else answers first.
 */
const ENTRY = readFileSync("src/cloudflare-entry.ts", "utf8");

describe("the canonical origin", () => {
  it("sends www to the apex, keeping the path, the query and the method", () => {
    const response = canonicalHostRedirect(
      new URL("https://www.ocade.in/pricing?plan=pro#compare"),
    );
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://ocade.in/pricing?plan=pro#compare");
  });

  it("leaves the apex, previews and development alone", () => {
    for (const href of [
      "https://ocade.in/",
      "http://127.0.0.1:8788/pricing",
      "http://localhost:3000/",
      "https://ocade-web.pages.dev/",
    ]) {
      expect(canonicalHostRedirect(new URL(href))).toBeNull();
    }
  });

  it("redirects before anything can serve the second origin", () => {
    const redirect = ENTRY.indexOf("const canonical = canonicalHostRedirect(url)");
    expect(redirect).toBeGreaterThan(0);
    expect(redirect).toBeLessThan(ENTRY.indexOf("env.ASSETS.fetch"));
    expect(redirect).toBeLessThan(ENTRY.indexOf("nitroApp.fetch"));
  });

  it("keeps the www route bound, because a redirect has to be served from it", () => {
    const wrangler = JSON.parse(readFileSync("wrangler.json", "utf8")) as {
      routes: { pattern: string }[];
    };
    expect(wrangler.routes.map((route) => route.pattern)).toEqual(["ocade.in/*", "www.ocade.in/*"]);
  });
});
