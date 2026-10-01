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

/**
 * The headers Cloudflare stamps on a request it proxied, and the scheme the
 * visitor used. `wrangler dev` sends neither, which is what tells a local
 * session apart from a real one — see `reachedUsOverPlainHttp`.
 */
const fromEdge = (scheme: "http" | "https" = "https") =>
  new Headers({ "cf-ray": "8f0000000000abcd-DFW", "cf-visitor": `{"scheme":"${scheme}"}` });

/** A request that never went through Cloudflare: `wrangler dev`, or a probe. */
const local = () => new Headers();

describe("the canonical origin", () => {
  it("sends www to the apex, keeping the path, the query and the method", () => {
    const response = canonicalOriginRedirect(
      new URL("https://www.ocade.in/pricing?plan=pro#compare"),
      fromEdge(),
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
      const response = canonicalOriginRedirect(new URL(`http://ocade.in${path}`), fromEdge("http"));
      expect(response?.status, `${path} was served over plain HTTP`).toBe(308);
      expect(response?.headers.get("location")).toBe(`https://ocade.in${path}`);
    }
  });

  it("fixes the scheme and the host in one hop, keeping path, query and fragment", () => {
    const response = canonicalOriginRedirect(
      new URL("http://www.ocade.in/pricing?plan=pro#compare"),
      fromEdge("http"),
    );
    expect(response?.headers.get("location")).toBe("https://ocade.in/pricing?plan=pro#compare");
  });

  it("does not send an upgrade to a port nothing listens on", () => {
    const response = canonicalOriginRedirect(new URL("http://ocade.in:80/help"), fromEdge("http"));
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
      expect(canonicalOriginRedirect(new URL(href), fromEdge()), href).toBeNull();
    }
  });

  /*
   * THE LOOP THIS EXISTS TO PREVENT, AND IT HAPPENED.
   *
   * `wrangler dev` rewrites the request URL to the hostname in `wrangler.json`
   * and keeps the scheme it is served over, so every local request arrives as
   * `http://ocade.in/…`. An upgrade decided from the URL sent the local session
   * to itself for ever: every browser proof timed out against a server that was
   * answering correctly, and the loopback exemption never fired because by then
   * the hostname was not loopback.
   */
  it("leaves a request that never went through Cloudflare alone", () => {
    for (const href of ["http://ocade.in/", "http://ocade.in/auth", "http://www.ocade.in/help"]) {
      const response = canonicalOriginRedirect(new URL(href), local());
      if (href.includes("www.")) {
        // The second ORIGIN is still wrong whoever served it; only the scheme
        // needs the edge to have an opinion.
        expect(response?.headers.get("location")).toBe("http://ocade.in/help");
      } else {
        expect(response, href).toBeNull();
      }
    }
  });

  it("believes the visitor's scheme over the URL when Cloudflare states it", () => {
    // A request that reached the edge over TLS is not upgraded again, whatever
    // the URL handed to the Worker happens to say.
    expect(canonicalOriginRedirect(new URL("http://ocade.in/"), fromEdge("https"))).toBeNull();
  });

  it("redirects before anything can serve the second origin", () => {
    const redirect = ENTRY.indexOf(
      "const canonical = canonicalOriginRedirect(url, request.headers)",
    );
    expect(redirect).toBeGreaterThan(0);
    expect(redirect).toBeLessThan(ENTRY.indexOf("env.ASSETS.fetch"));
    expect(redirect).toBeLessThan(ENTRY.indexOf("nitroApp.fetch"));
  });

  it("keeps the www route bound, because a redirect has to be served from it", () => {
    const wrangler = JSON.parse(readFileSync("wrangler.json", "utf8")) as {
      routes: { pattern: string }[];
    };
    expect(wrangler.routes.map((route) => route.pattern)).toEqual([
      "ocade.in/*",
      "www.ocade.in/*",
      "admin.ocade.in",
    ]);
  });

  it("sends the console origin's other paths to the site before anything is served", () => {
    const routed = ENTRY.indexOf("consoleHostRedirect(url, isPublicAssetURL)");
    expect(routed).toBeGreaterThan(ENTRY.indexOf("const canonical = canonicalOriginRedirect"));
    expect(routed).toBeLessThan(ENTRY.indexOf("env.ASSETS.fetch"));
  });
});
