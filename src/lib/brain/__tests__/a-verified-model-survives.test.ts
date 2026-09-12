import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE TWO LIFECYCLE EVENTS THAT COULD SILENTLY COST A GIGABYTE.
 *
 * `PLAN.md` Phase 5 names five things a verified model must survive: reload,
 * sign-in and sign-out, account deletion, a service-worker or application
 * deployment, and an ordinary revisit. Four of the five are already proved
 * behaviourally — `install-lifecycle.test.ts` covers reload, browser restart,
 * a new application deployment and revisit; `deletion-makes-no-model-request.ts`
 * covers account deletion, including the case where there is no model at all.
 *
 * The two that were not are the two whose code changed most recently, and both
 * fail in the same silent way: nothing errors, the person simply waits for a
 * multi-gigabyte transfer they already completed.
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

  it("never touches OPFS in the handlers that run on every update", () => {
    /*
     * `install` and `activate` run on every deployment. Model staging lives in
     * the Background Fetch handlers instead, which run only when a transfer was
     * explicitly handed to the service worker — so OPFS appearing in either of
     * these two would be new, and would be the defect.
     */
    for (const handler of ["install", "activate"]) {
      const start = SERVICE_WORKER.indexOf(`self.addEventListener("${handler}"`);
      expect(start, `the ${handler} handler was not found`).toBeGreaterThan(0);
      const body = SERVICE_WORKER.slice(start, SERVICE_WORKER.indexOf("});", start));
      expect(body, `the ${handler} handler reaches OPFS, where the weights are`).not.toContain(
        "getDirectory",
      );
      expect(body).not.toContain(MODEL_DIRECTORY);
    }
  });

  it("keeps the weights out of Cache Storage in the first place", () => {
    /*
     * The structural half. Weights in Cache Storage would be inside the very
     * thing `activate` prunes, and the prefix filter would be the only line
     * standing between a deployment and a redownload. They are in OPFS
     * instead, which `model-store.ts` owns and the service worker only writes
     * to through Background Fetch.
     */
    const staging = SERVICE_WORKER.slice(SERVICE_WORKER.indexOf("MODEL_ROOT"));
    expect(staging).toContain("navigator.storage.getDirectory()");
    expect(SERVICE_WORKER).not.toMatch(/caches\.open\([^)]*model/i);
  });
});
