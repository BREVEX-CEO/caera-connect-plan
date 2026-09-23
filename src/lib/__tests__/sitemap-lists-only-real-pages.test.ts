import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLIC_PATHS } from "@/routes/sitemap[.]xml";
import { COMPANY_FACTS } from "@/config/company-facts";

/**
 * A SITEMAP IS A PROMISE TO A CRAWLER, AND IT WAS TWELVE-THIRTEENTHS FALSE.
 *
 * The list named `/company`, `/founder/haans-antoni`, `/products/ocade`,
 * `/compare`, `/blog`, `/careers`, `/team`, `/press`, `/status`, `/security`,
 * `/faq` and `/search`. None of them is a route in this application; every one
 * of them was a 404 offered to search engines as a canonical URL. Two pages
 * that do exist, `/about` and `/help`, were missing.
 *
 * Nothing noticed because nothing compared the list to the application. This
 * does, in both directions, against the generated route tree — which is written
 * by the router from the files that actually exist, so it cannot flatter the
 * list the way a second hand-written list would.
 */
const TREE = readFileSync("src/routeTree.gen.ts", "utf8");

/** Every path the router will actually serve. */
const served = new Set(
  [...TREE.matchAll(/fullPath: '([^']+)'/g)].map((match) => match[1]!.replace(/\/$/, "") || "/"),
);

/** Not a page a person reads: assets, APIs and the sign-in flow. */
const notAPage = (path: string) =>
  path.startsWith("/api/") ||
  path.startsWith("/auth") ||
  path.includes("$") ||
  path.endsWith(".xml") ||
  path.endsWith(".txt") ||
  // Reached from an email link, and listing it invites crawlers to a flow.
  path === "/reset-password" ||
  // Signed-in surfaces. A crawler cannot see them and should not be sent.
  ["/admin", "/library"].includes(path);

describe("the sitemap", () => {
  it("lists nothing the application does not serve", () => {
    expect(served.size).toBeGreaterThan(5);
    expect(PUBLIC_PATHS.filter((path: string) => !served.has(path))).toEqual([]);
  });

  it("lists every public page the application does serve", () => {
    const listed = new Set<string>(PUBLIC_PATHS);
    const missing = [...served].filter((path) => !notAPage(path) && !listed.has(path));
    expect(missing).toEqual([]);
  });

  it("advertises the canonical origin rather than whichever host was asked", () => {
    const source = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");
    expect(source).not.toMatch(/new URL\(request\.url\)/);
    expect(source).toContain("COMPANY_FACTS.siteOrigin");
    expect(COMPANY_FACTS.siteOrigin).toBe("https://ocade.in");
  });

  it("points robots at that same origin", () => {
    const robots = readFileSync("src/routes/robots[.]txt.ts", "utf8");
    expect(robots).not.toMatch(/new URL\(request\.url\)/);
    expect(robots).toContain("COMPANY_FACTS.siteOrigin");
  });
});
