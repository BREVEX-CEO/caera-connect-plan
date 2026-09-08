// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OFFLINE INTELLIGENCE PREPARES AFTER SIGN-IN, AND NOT BEFORE.
 *
 * PLAN.md §17 opens with "After authenticated login", and §28's verification
 * matrix asks for "automatic AUTHENTICATED preparation". The root shell ran the
 * bootstrap for every visitor instead, so an anonymous reader of the public
 * landing page began device probing, catalogue resolution, a storage-persistence
 * request and then a multi-gigabyte model transfer — without signing in, and
 * without being asked. On a phone on mobile data that is somebody's money, and
 * it is the kind of defect that never shows up as an error.
 *
 * It was found through the landing page's Total Blocking Time: the installer's
 * bootstrap was running inside the same task as hydration, on the one page a
 * first-time visitor is deciding about.
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

function Harness({ enabled }: { enabled: boolean }) {
  bootstrap({ enabled });
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
  it("does not start for a visitor who is not signed in", async () => {
    render(<Harness enabled={false} />);
    await settle();
    expect(install).not.toHaveBeenCalled();
  });

  it("starts once there is a session", async () => {
    render(<Harness enabled />);
    await settle();
    expect(install).toHaveBeenCalledTimes(1);
    expect(install.mock.calls[0]?.[0]).toMatchObject({ reason: "app_bootstrap" });
  });

  it("starts when a visitor signs in on the page they are already on", async () => {
    // The common case: land signed out, sign in, come back through the OAuth
    // redirect. The root does not remount, so the guard has to react.
    const view = render(<Harness enabled={false} />);
    await settle();
    expect(install).not.toHaveBeenCalled();
    view.rerender(<Harness enabled />);
    await settle();
    expect(install).toHaveBeenCalledTimes(1);
  });
});

describe("the root shell", () => {
  const ROOT = readFileSync("src/routes/__root.tsx", "utf8");

  it("derives the guard from a session rather than a constant", () => {
    const call = /useInstallationBootstrap\(\{ enabled: ([^}]+) \}\)/.exec(ROOT);
    expect(call, "the bootstrap call was not found").toBeTruthy();
    // `true` would pass every other assertion in this file and reintroduce the
    // exact defect, so it is named.
    expect(call![1].trim()).not.toBe("true");
    expect(call![1]).toMatch(/signedIn|session|user/i);
  });

  it("starts signed out rather than assuming a session it has not seen", () => {
    // Starting on a maybe is the same defect for anyone whose session lookup
    // is slow, offline or refused.
    expect(ROOT).toContain("const [signedIn, setSignedIn] = useState(false)");
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
