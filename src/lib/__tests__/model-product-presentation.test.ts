import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SETTINGS = readFileSync("src/components/settings/BrowserStoragePanel.tsx", "utf8");
/*
 * The one uninstall button, which lives here rather than on the storage panel.
 *
 * Both surfaces existed and NEITHER was mounted: removal was offered only as a
 * remedy on the corner panel that appears when preparation fails, and that
 * panel renders nothing once the model is ready — so an account with Offline
 * Intelligence installed had no way to remove it. Settings › Local engine
 * mounts this control; the storage panel below it owns persistence only.
 */
const REMOVAL_CONTROL = readFileSync(
  "src/components/ocade/setup/LocalIntelligenceControl.tsx",
  "utf8",
);
const LOCAL_ENGINE_SETTINGS = readFileSync(
  "src/components/settings/LocalEngineSettingsPanel.tsx",
  "utf8",
);
const RENDERED_SETTINGS = SETTINGS.replace(/\/\*[\s\S]*?\*\//g, "");
const PROGRESS = readFileSync("src/components/ocade/setup/OfflineIntelligenceProgress.tsx", "utf8");
/*
 * Comments stripped. The component's own documentation quotes the modal markup
 * it replaced, which is the reason to keep that paragraph rather than a reason
 * to fail — what matters is what it RENDERS.
 */
const PROGRESS_CODE = PROGRESS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const AUTHENTICATED_LAYOUT = readFileSync("src/routes/_authenticated/route.tsx", "utf8");

describe("ordinary OCADE Intelligence presentation", () => {
  it("uses the canonical ModelVault view instead of raw engine files", () => {
    expect(SETTINGS).toContain("modelVault.installationView()");
    expect(SETTINGS).not.toContain("storage.models");
    expect(SETTINGS).not.toContain("model.key");
    expect(SETTINGS).not.toContain("model.verified");
  });

  it("shows only product language, never model implementation details", () => {
    expect(RENDERED_SETTINGS).toContain("OCADE Intelligence");
    expect(RENDERED_SETTINGS).toContain("Stored securely on this device");
    // One uninstall operation, one button, and it is not this panel's.
    expect(REMOVAL_CONTROL).toContain("Remove OCADE Intelligence");
    expect(RENDERED_SETTINGS.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).not.toContain(
      "Remove OCADE Intelligence",
    );
    expect(RENDERED_SETTINGS).not.toMatch(
      /Qwen|GGUF|quantisation|fingerprint verified|not verified/i,
    );
    expect(RENDERED_SETTINGS).not.toMatch(/\b(?:KB|MB|GB)\b/);
  });

  it("reports preparation from the corner and never takes the product away", () => {
    /*
     * THE DEFECT THIS REPLACED, because it is the reason the rule is written
     * this way rather than as a preference.
     *
     * Preparation used to mount `role="dialog" aria-modal="true"` over the
     * whole signed-in application, and it stayed there when preparation
     * FAILED. Reproduced in a browser: a new account signed in, landed on
     * /onboarding, filled the form, and could not press Continue — the button
     * was visible and enabled, and the modal above it swallowed every click.
     * There was no way forward and no way out.
     *
     * `PLAN.md` §17 asks for automatic preparation with lower-left progress
     * and "no confirmation screen or Prepare button".
     */
    expect(AUTHENTICATED_LAYOUT).toContain("<OfflineIntelligenceProgress />");
    expect(AUTHENTICATED_LAYOUT).not.toMatch(/FirstInstallationGate|SetupExperience/);

    // It reports. It does not demand.
    expect(PROGRESS_CODE).toContain('role="status"');
    expect(PROGRESS_CODE).toContain('aria-live="polite"');
    expect(PROGRESS_CODE).not.toContain('role="dialog"');
    expect(PROGRESS_CODE).not.toContain("aria-modal");

    /*
     * Lower-left, beneath dialogs so it can never cover one, and RAISED CLEAR
     * of the corner the sidebar footer occupies.
     *
     * It shipped at `bottom-4 left-4`, which is where the Account menu is, at
     * the same `z-40` as the sidebar — and being rendered later it painted on
     * top. `audit:journey` failed every sign-out attempt with this panel named
     * as the element intercepting the click, permanently on a device that
     * failed with `insufficient_storage` because that state never clears.
     */
    expect(PROGRESS_CODE).toMatch(/fixed bottom-20 left-4 z-40/);

    /*
     * Nothing is made inert or unclickable by preparation.
     *
     * `pointer-events-none` ON THE PANEL IS PART OF THAT, not a violation of
     * it. This assertion used to forbid the class outright, which had it
     * backwards: a `role="status"` region that absorbs clicks is precisely how
     * preparation makes something else unclickable. The panel passes them
     * through and its own controls opt back in one at a time.
     *
     * The structural half is still the stronger one: this component takes no
     * `children`, so unlike the gate it replaced there is nothing it COULD
     * wrap, conceal or disable. A future edit that gives it children is the
     * edit that would bring the trap back.
     */
    expect(PROGRESS_CODE).not.toMatch(/\binert\b/);
    expect(PROGRESS_CODE).not.toMatch(/children/);
    expect(PROGRESS_CODE).toMatch(/"pointer-events-none"/);
    // Every control inside it is still reachable.
    expect(PROGRESS_CODE).toMatch(/pointer-events-auto -mr-1\.5 -mt-1\.5/);
    expect(PROGRESS_CODE).toMatch(/pointer-events-auto mt-2 flex flex-wrap/);

    // The dismiss control is a real touch target, not a bare glyph. It shipped
    // at 20x18 and the route audit failed it at phone width on every route.
    expect(PROGRESS_CODE).toMatch(/h-7 w-7/);
  });

  it("keeps the measured narrative and the remedies it used to carry", () => {
    // Removing the blocking screen must not remove what it correctly told
    // people: the stage in product language, and what to do when a device is
    // too full to finish.
    expect(PROGRESS).toMatch(
      /s === "verifying" \|\| s === "loading" \|\| s === "warming".*line: "Almost ready"/,
    );
    expect(PROGRESS).toContain("Preparing offline intelligence");
    for (const remedy of ["Try again", "How to free up space", "Remove OCADE Intelligence"]) {
      expect(PROGRESS, remedy).toContain(remedy);
    }
    // And it still never invents a number.
    expect(PROGRESS).toContain("The percentage is measured");
    expect(PROGRESS_CODE).toMatch(/state\.fraction === null \? null/);
  });
});

describe("the offline intelligence controls are actually mounted", () => {
  /*
   * A CONTROL NOBODY CAN REACH IS NOT A CONTROL. `PLAN.md`: "Only explicit
   * Remove Offline Intelligence deletes it. Deliberate removal suppresses
   * auto-reinstall until the user explicitly chooses Install." Both halves were
   * built and neither was rendered on any route.
   */
  it("mounts the remove-and-install control on the local engine settings page", () => {
    expect(LOCAL_ENGINE_SETTINGS).toContain("<LocalIntelligenceControl />");
  });

  it("mounts the browser storage panel beside it, for persistence", () => {
    expect(LOCAL_ENGINE_SETTINGS).toContain("<BrowserStoragePanel />");
  });

  it("offers the install back after a deliberate removal", () => {
    expect(REMOVAL_CONTROL).toContain("Reinstall OCADE");
  });
});
