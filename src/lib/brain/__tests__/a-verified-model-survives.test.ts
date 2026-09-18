import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineRelease } from "../offline-release";

/**
 * THE TWO LIFECYCLE EVENTS THAT COULD SILENTLY COST A GIGABYTE.
 *
 * `PLAN.md` Phase 5 names five things a verified model must survive: reload,
 * sign-in and sign-out, account deletion, a service-worker or application
 * deployment, and an ordinary revisit. The behavioural halves live where the
 * behaviour is — `an-update-does-not-redownload.test.ts` proves the authority
 * activates from disk without reaching the network, `install-once.test.ts`
 * proves a complete checkpoint asks for no ranges, and the offline browser
 * journey proves a reload starts nothing.
 *
 * What is left is the pair that no behavioural test can see, because the
 * failure is a call that should not exist. Both fail in the same silent way:
 * nothing errors, the person simply waits for a transfer they already paid for.
 *
 *   SIGNING OUT. Phase 2 rewrote this block, because it used to call
 *   `clearDevices()` and `clearApprovals()` — safe while those were local, and
 *   destructive the moment they became account rows. The block now clears what
 *   the TAB was holding. A future edit that reached one line further, into the
 *   model store, would unpair nothing and cost everything.
 *
 *   A SERVICE-WORKER UPDATE. `activate` deletes old caches, which is right, and
 *   is one careless `caches.keys()` away from deleting everything a browser
 *   holds for this origin. Weights are in OPFS rather than Cache Storage, so
 *   the deletion cannot reach them today — and the assertion is that the
 *   service worker keeps its hands off OPFS in the handlers that run on every
 *   update, not that OPFS happens to be a different API.
 *
 * Asserted against the source, because both are "this code must not call that
 * code" properties. There is no state to observe afterwards: the failure is a
 * call that should not exist, and the only moment it is visible is before it
 * ships.
 */

const ROOT = readFileSync("src/routes/__root.tsx", "utf8");
const SERVICE_WORKER = readFileSync("public/sw.js", "utf8");

/** Where the weights live. Named once here so the assertions cannot drift. */
const MODEL_DIRECTORY = "ocade-models";

/** The `SIGNED_OUT` branch of the auth subscription, and nothing else. */
function signOutBlock(): string {
  const start = ROOT.indexOf('if (event === "SIGNED_OUT") {');
  expect(start, "the SIGNED_OUT branch was not found in the root shell").toBeGreaterThan(0);
  const end = ROOT.indexOf("router.invalidate()", start);
  expect(end, "the end of the SIGNED_OUT branch was not found").toBeGreaterThan(start);
  return ROOT.slice(start, end);
}

describe("signing out", () => {
  it("clears what the tab was holding and nothing the device installed", () => {
    const block = signOutBlock();

    // What it IS allowed to forget: this tab's own scratch state.
    expect(block).toContain("forgetAllUnsyncedTurns()");

    /*
     * What it must never reach. Each of these is a way to lose the model:
     * the store itself, the authority that owns it, the OPFS root, or the
     * directory the weights are written into.
     */
    for (const forbidden of [
      "model-store",
      "installation-browser",
      "installationAuthority",
      "uninstall",
      "getDirectory",
      MODEL_DIRECTORY,
    ]) {
      expect(
        block,
        `signing out reaches ${forbidden}, which would throw away a verified model`,
      ).not.toContain(forbidden);
    }
  });

  /*
   * THE OTHER HALF OF THIS BLOCK IS ALREADY PINNED ELSEWHERE.
   * `device-store.test.ts` asserts the sign-out branch does not call
   * `module.clearDevices()` — the Phase 2 regression, held where it happened.
   * Repeating it here would be a second authority for one rule, and the two
   * would drift the first time somebody edited only one of them.
   */
});

describe("a service-worker update", () => {
  it("deletes only its own shell caches, by prefix", () => {
    const activate = SERVICE_WORKER.slice(
      SERVICE_WORKER.indexOf('self.addEventListener("activate"'),
      SERVICE_WORKER.indexOf('self.addEventListener("message"') > 0
        ? SERVICE_WORKER.indexOf('self.addEventListener("message"')
        : undefined,
    );
    expect(activate, "the activate handler was not found").toContain("caches.delete");
    /*
     * The filter is the whole safety property. `caches.keys().then(keys =>
     * keys.map(caches.delete))` — the version of this code without a filter —
     * reads almost identically and deletes every cache the origin holds,
     * including any a future feature puts there.
     */
    expect(activate).toContain("k.startsWith(SHELL_CACHE_PREFIX)");
    expect(activate).toContain("k !== VERSION");
  });

  it("never reaches OPFS at all, which is where the weights are", () => {
    /*
     * Stronger than it used to be. This once asserted only that `install` and
     * `activate` stayed out of OPFS, because the Background Fetch handlers
     * wrote model bytes there — a second writer, in unbundled worker
     * JavaScript, for a transfer nothing ever started. Both are gone, so the
     * service worker touches the shell and nothing else.
     */
    expect(SERVICE_WORKER).not.toContain("getDirectory");
    expect(SERVICE_WORKER).not.toContain(MODEL_DIRECTORY);
  });

  it("keeps the weights out of Cache Storage in the first place", () => {
    /*
     * Weights in Cache Storage would be inside the very thing `activate`
     * prunes, and the prefix filter would be the only line between a
     * deployment and a redownload. The artifact is reached through OCADE's
     * authorised delivery route, which this refuses to cache by path — it has
     * no name and no extension to match on, which is the point of it.
     */
    expect(SERVICE_WORKER).toContain("/api/offline/");
    expect(SERVICE_WORKER).not.toContain("CACHE_MODEL");
  });
});

describe("what identifies the model", () => {
  /*
   * `PLAN.md` Phase 7: "Model identity/version is independent of website/app
   * build SHA." A version derived from the build is a full redownload on every
   * deploy, for weights that did not change — the most expensive way to ship a
   * typo fix.
   */
  it("is the artifact's own digest, not anything about this build", () => {
    /*
     * An opaque id derived from the bytes. It cannot be a build SHA, it cannot
     * be a model name, and it changes exactly when the artifact does — which is
     * what makes a deploy free and an upgrade honest.
     */
    const release = offlineRelease();
    if (release) expect(release.releaseId).toMatch(/^ocr-[0-9a-f]{16}$/);
    // Null is the state before a release is published, and it is not a failure.
    expect(release === null || typeof release.releaseId === "string").toBe(true);
  });

  it("is not composed from a build identifier anywhere in the engine", () => {
    for (const file of [
      "src/lib/brain/offline-release.ts",
      "src/lib/brain/model-vault.ts",
      "src/lib/brain/installation-authority.ts",
      "src/lib/brain/installation-browser.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} reaches for a build identifier`).not.toMatch(
        /BUILD_SHA|VITE_BUILD|COMMIT_SHA|__BUILD__/,
      );
    }
  });

  it("stores the weights under that version, so a new build finds them where it left them", () => {
    const vault = readFileSync("src/lib/brain/model-vault.ts", "utf8");
    expect(vault).toContain("export function versionPath(version: string, name: string)");
  });
});
