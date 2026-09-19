import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalOriginRedirect } from "@/lib/security/public-response";

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
    const response = canonicalOriginRedirect(
      new URL("https://www.ocade.in/pricing?plan=pro#compare"),
    );
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://ocade.in/pricing?plan=pro#compare");
  });

  /*
   * THE APPLICATION AND THE SIGN-IN PAGE WERE SERVED OVER PLAIN HTTP.
   *
   * `http://ocade.in/`, `/auth` and `/library` each answered 200 with HTML: the
   * redirect copied the incoming URL and changed only its hostname, so the
   * scheme — the other half of an origin — survived untouched. HSTS protects
   * every visit after the first and does nothing about the first.
   */
  it("answers plain HTTP with an upgrade rather than the application", () => {
    for (const path of ["/", "/auth", "/library"]) {
      const response = canonicalOriginRedirect(new URL(`http://ocade.in${path}`));
      expect(response?.status, `${path} was served over plain HTTP`).toBe(308);
      expect(response?.headers.get("location")).toBe(`https://ocade.in${path}`);
    }
  });

  it("fixes the scheme and the host in one hop, keeping path, query and fragment", () => {
    const response = canonicalOriginRedirect(
      new URL("http://www.ocade.in/pricing?plan=pro#compare"),
    );
    expect(response?.headers.get("location")).toBe("https://ocade.in/pricing?plan=pro#compare");
  });

  it("does not send an upgrade to a port nothing listens on", () => {
    const response = canonicalOriginRedirect(new URL("http://ocade.in:80/help"));
    expect(response?.headers.get("location")).toBe("https://ocade.in/help");
  });

  it("leaves the canonical origin, previews and development alone", () => {
    for (const href of [
      "https://ocade.in/",
      "http://127.0.0.1:8788/pricing",
      "http://localhost:3000/",
      "http://ocade.localhost:5173/",
      "https://ocade-web.pages.dev/",
    ]) {
      expect(canonicalOriginRedirect(new URL(href)), href).toBeNull();
    }
  });

  it("redirects before anything can serve the second origin", () => {
    const redirect = ENTRY.indexOf("const canonical = canonicalOriginRedirect(url)");
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
