// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OFFLINE INTELLIGENCE PREPARES ON THE FIRST VISIT, SIGNED IN OR NOT.
 *
 * THIS FILE PREVIOUSLY ASSERTED THE OPPOSITE, and it was right to at the time:
 * it was written against a plan revision whose §17 opened with "After
 * authenticated login". The current authorities say the reverse, in three
 * places and without hedging — `PLAN.md` line 15 ("may begin Offline
 * Intelligence preparation immediately in the background" on a first unseen
 * visit), `PLAN.md` Phase 5 ("Start Offline Intelligence preparation on first
 * visit without blocking landing/auth") and `docs/TRD.md` ("on the first
 * browser/device visit where capability permits, INCLUDING WHILE THE LANDING
 * PAGE IS DISPLAYED"). Neither phrase the old file quoted survives in the plan.
 *
 * THE CONCERN BEHIND THE OLD GATE IS NOT WAIVED, and this file still holds it.
 * It was found through the landing page's Total Blocking Time: the installer's
 * bootstrap was running inside the same task as hydration, on the one page a
 * first-time visitor is deciding about. The gate was the wrong instrument —
 * it did not make preparation cheaper, it made it not happen — and the right
 * instruments are asserted below: nothing is imported statically, and the
 * start is deferred to an idle callback rather than run inline.
 *
 * The hook is exercised for real rather than read, because the failure mode is
 * behavioural: a guard that is present in the source and wrong in its condition
 * reads exactly like a guard that works.
 */

const install = vi.fn(async (_options?: { reason?: string }) => ({ stage: "ready" }));

vi.mock("../installation-browser", () => ({
  installationAuthority: async () => ({
    install,
    isReady: () => false,
  }),
}));

let bootstrap: typeof import("../use-installation").useInstallationBootstrap;

beforeEach(async () => {
  install.mockClear();
  ({ useInstallationBootstrap: bootstrap } = await import("../use-installation"));
});

function Harness({ enabled }: { enabled?: boolean }) {
  bootstrap(enabled === undefined ? undefined : { enabled });
  return null;
}

/**
 * The hook starts on an idle callback, or a 200 ms timer where there is none.
 * jsdom has no `requestIdleCallback`, so the timer is the path under test.
 *
 * REAL TIME RATHER THAN FAKE. The start path is a timer followed by a dynamic
 * import followed by two promise hops, and a fake clock advances the timer
 * without advancing the module loader — so "never started" and "has not
 * started yet" become indistinguishable, which is the one thing this file
 * exists to tell apart. Half a second is cheap and unambiguous.
 */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe("automatic preparation", () => {
  it("starts for a visitor who has not signed in", async () => {
    render(<Harness />);
    await settle();
    expect(install).toHaveBeenCalledTimes(1);
    expect(install.mock.calls[0]?.[0]).toMatchObject({ reason: "app_bootstrap" });
  });

  it("does not start twice when the same visitor then signs in", async () => {
    /*
     * The common case: land signed out, sign in, come back through the OAuth
     * redirect. The root does not remount, so a second start here would be a
     * second transfer of the same model — the exact redownload `PLAN.md` Phase
     * 5 forbids, arriving through the front door.
     */
    const view = render(<Harness />);
    await settle();
    expect(install).toHaveBeenCalledTimes(1);
    view.rerender(<Harness />);
    await settle();
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("still honours an explicit refusal, so a caller can hold it back", async () => {
    // The option survives for a surface that must not start one — a test
    // harness, or a future screen that owns the decision. Nothing in the
    // product passes it today.
    render(<Harness enabled={false} />);
    await settle();
    expect(install).not.toHaveBeenCalled();
  });
});

describe("the root shell", () => {
  const ROOT = readFileSync("src/routes/__root.tsx", "utf8");

  it("does not gate preparation on a session", () => {
    const call = /useInstallationBootstrap\(([^)]*)\)/.exec(ROOT);
    expect(call, "the bootstrap call was not found").toBeTruthy();
    expect(
      call![1].trim(),
      "preparation is gated again, against PLAN.md Phase 5 and docs/TRD.md",
    ).toBe("");
  });

  it("loads the Supabase client on demand rather than at first paint", () => {
    /*
     * A static import puts 200 KiB of auth, PostgREST, realtime and storage in
     * the entry graph, which every visitor to a public page parses before the
     * page can answer a tap. Nothing the root does with it draws a pixel.
     */
    expect(ROOT).not.toMatch(/^import .*from "@\/integrations\/supabase\/client";$/m);
    expect(ROOT).toContain('import("@/integrations/supabase/client")');
  });
});

describe("the cost to the page it now starts on", () => {
  const HOOK = readFileSync("src/lib/brain/use-installation.ts", "utf8");

  it("loads the installer on demand, so the landing page never parses it", () => {
    /*
     * This is the half that actually protects the first-time visitor, and it
     * is the half the removed gate was standing in for. A static import here
     * puts the transfer engine, the streaming digest, the vault and the
     * catalogue into the entry bundle — 50 KiB the production budget gate has
     * already refused once.
     */
    expect(HOOK).not.toMatch(/^import .*from "\.\/installation-browser";$/m);
    expect(HOOK).toContain('import("./installation-browser")');
  });

  it("defers the start rather than running it inside hydration", () => {
    // An idle callback where there is one, a timer where there is not. Either
    // way the work lands in a later task than the one drawing the page.
    expect(HOOK).toContain("requestIdleCallback");
    expect(HOOK).toContain("window.setTimeout(start, 200)");
  });
});
