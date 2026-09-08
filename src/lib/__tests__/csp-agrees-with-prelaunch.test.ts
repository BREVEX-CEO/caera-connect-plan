import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { securityHeadersForTest } from "@/lib/security/public-response";

/**
 * THE POLICY AND THE PAGE MUST AGREE ABOUT WHO ELSE IS INVOLVED.
 *
 * OCADE serves two HTML surfaces with their own policies: the pre-launch shell
 * in `launch/prelaunch-response.ts`, and the application, whose policy lives in
 * `security/public-response.ts`. They drifted, and a browser journey found it:
 * `PublicPage` requested a background video from a media host the application's
 * policy did not permit, so from the moment the launch gate opened every public
 * page logged a Content-Security-Policy violation on every visit. Nobody
 * notices a background video that is not there.
 *
 * WIDENING THE POLICY WAS THE WRONG FIX AND WAS MEASURED AS SUCH. With the host
 * allowed, the request actually left the browser and twenty public routes began
 * failing the audit's "no failing request outside loopback" check on any network
 * that cannot reach it. The video was removed instead.
 *
 * So the invariant asserted here is agreement in BOTH directions: the off-origin
 * media hosts the policy permits must be exactly the media hosts the component
 * requests. A host in the policy that nothing loads widens the door for nothing;
 * a host in the component that the policy forbids is a console error on every
 * page. Neither can be introduced without failing this.
 */
function directive(policy: string, name: string): string {
  const found = policy
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry === name || entry.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive in: ${policy}`);
  return found;
}

/**
 * Every policy the pre-launch shell emits, read from the source that emits it.
 *
 * There is more than one, and taking the first was a mistake worth recording:
 * the locked shell serves `default-src 'none'` with no media at all, and only
 * the PUBLIC-information response — the one that renders the marketing pages —
 * carries a backdrop. A test that read the strict one would have compared the
 * application's policy against a document that has no video in it.
 */
function prelaunchPolicies(): string[] {
  const source = readFileSync("src/lib/launch/prelaunch-response.ts", "utf8");
  const found = [...source.matchAll(/"content-security-policy":\s*`([^`]+)`/g)].map((m) => m[1]);
  if (found.length === 0) throw new Error("could not find any pre-launch content-security-policy");
  return found;
}

/** The one pre-launch policy that renders media, i.e. the public pages. */
function prelaunchMediaPolicy(): string {
  const withMedia = prelaunchPolicies().filter((policy) => /(^|;\s*)media-src\s/.test(policy));
  // Exactly one, so a second public shell cannot appear without this noticing.
  expect(withMedia).toHaveLength(1);
  return withMedia[0];
}

/** Off-origin hosts a policy's `media-src` permits. */
function permittedMediaHosts(policy: string): string[] {
  return directive(policy, "media-src")
    .split(/\s+/)
    .slice(1)
    .filter((source) => /^https?:\/\//.test(source))
    .sort();
}

/** Off-origin hosts the public shell component actually asks for. */
function requestedMediaHosts(): string[] {
  const component = readFileSync("src/components/public/PublicPage.tsx", "utf8");
  /*
   * Only real requests count, so the file's own account of what it used to load
   * is stripped first. A comment explaining a removal must not read as the
   * removal being undone.
   */
  const code = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...new Set([...code.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((match) => match[1]))]
    .map((host) => `https://${host}`)
    .sort();
}

describe("the application's media policy and its public shell agree", () => {
  it("was read at all, so a broken scan cannot pass", () => {
    expect(prelaunchPolicies().length).toBeGreaterThan(0);
    for (const policy of prelaunchPolicies()) expect(policy).toContain("default-src");
    expect(securityHeadersForTest()["content-security-policy"]).toContain("default-src");
  });

  it("permits exactly the off-origin media the public shell requests", () => {
    const policy = securityHeadersForTest()["content-security-policy"];
    expect(permittedMediaHosts(policy)).toEqual(requestedMediaHosts());
  });

  it("currently requests none, and permits none", () => {
    // Stated as its own assertion so the equality above cannot pass by both
    // sides drifting to the same wrong value.
    expect(requestedMediaHosts()).toEqual([]);
    expect(permittedMediaHosts(securityHeadersForTest()["content-security-policy"])).toEqual([]);
  });

  it("still allows the media the product genuinely produces itself", () => {
    // Recorded audio and generated blobs are OCADE's own and must keep working.
    const media = directive(securityHeadersForTest()["content-security-policy"], "media-src");
    for (const source of ["'self'", "blob:", "data:"]) expect(media).toContain(source);
  });

  it("leaves the pre-launch shell's own policy alone", () => {
    /*
     * The pre-launch shell is a separate, self-contained document with its own
     * inlined backdrop and its own policy that permits it. It is not this
     * application, and it is not changed by removing the application's video —
     * asserted so a future edit does not "tidy" one into the other.
     */
    const shell = prelaunchMediaPolicy();
    expect(permittedMediaHosts(shell).length).toBeGreaterThan(0);
  });
});
