import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_CATEGORIES } from "../categories";
import { resolveChannels } from "../channels";
import {
  defaultPreferences,
  normalisePreferences,
  type NotificationPreferences,
} from "../preferences";
import { normalisePreferences as normalise } from "../preferences";

/**
 * THE SCREEN MUST NOT OFFER A CONTROL THAT DOES NOTHING.
 *
 * That is the whole of PLAN.md §D's demand on the settings surface, and it has
 * three separate ways of being broken: a channel the deployment has not
 * configured rendered as a working toggle, a mute for a category the resolver
 * will ignore, and a browser permission prompt fired before the person has been
 * told what it is for. Each is invisible on a screenshot and each turns the
 * screen into a set of promises the product does not keep.
 */

const PANEL = readFileSync("src/components/settings/NotificationPreferencesPanel.tsx", "utf8");
const PANEL_TEXT = PANEL.replace(/\s+/g, " ");

describe("the settings surface", () => {
  it("was read at all, so a broken scan cannot pass", () => {
    expect(PANEL.length).toBeGreaterThan(3000);
    expect(PANEL).toContain("NOTIFICATION_CATEGORIES");
  });

  it("renders channels from the deployment rather than a hard-coded list", () => {
    expect(PANEL).toContain("deploymentChannelConfiguration()");
    expect(PANEL).toContain("resolveChannels(");
    // No channel name is spelled into the markup as a toggle of its own.
    expect(PANEL).not.toMatch(/checked=\{.*webPush/);
  });

  it("shows an unavailable channel's reason instead of a toggle", () => {
    expect(PANEL_TEXT).toContain("channel.unavailableReason");
    expect(PANEL_TEXT).toMatch(/Not available/);

    /*
     * The category toggles are drawn from AVAILABLE channels only — asserted on
     * the toggle block itself rather than on the file.
     *
     * The first version of this searched the whole source for the filter, and
     * an identical filter higher up (the memo that computes available ids)
     * satisfied it. Deleting the one that matters left the test green: it was
     * measuring that the WORDS existed somewhere, not that the toggles were
     * filtered.
     */
    const toggleBlock = PANEL.slice(PANEL.indexOf("What to be told about"));
    expect(toggleBlock).toContain("channel.available");
    expect(toggleBlock.indexOf("channel.available")).toBeLessThan(
      toggleBlock.indexOf("toggleChannel(category.id, channel.id)"),
    );
  });

  it("explains browser notifications before asking for permission", () => {
    /*
     * A prompt that appears the moment somebody opens Settings is the prompt
     * people refuse reflexively — and a refusal is sticky, so the reflex costs
     * them the feature permanently.
     */
    const explanation = PANEL_TEXT.indexOf("OCADE can show a notification outside the page");
    const request = PANEL_TEXT.indexOf("Allow browser notifications");
    expect(explanation).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(explanation);
    // And it is only ever called from the button's own handler.
    expect(PANEL).toContain("askForBrowserPermission");
    expect(PANEL).not.toMatch(/useEffect\([\s\S]{0,200}\.request\(\)/);
  });

  it("has somewhere to go after a refusal rather than a dead end", () => {
    expect(PANEL_TEXT).toMatch(/blocking OCADE notifications/i);
    expect(PANEL_TEXT).toMatch(/browser(&rsquo;|&#39;|'|’)s own site settings/i);
  });

  it("says the mute cannot silence the protected categories", () => {
    expect(PANEL_TEXT).toMatch(/Security, account recovery and billing are never muted/i);
    // And the in-app toggle for those is not offered as changeable.
    expect(PANEL).toContain('disabled={!category.optional && channel.id === "in_app"}');
  });

  it("claims cross-device sync only for a signed-in account", () => {
    /*
     * §D asks for cross-device synchronisation, and the account now has
     * somewhere to keep these — so the screen may say the settings follow you,
     * but ONLY when it is reading them from an account. Signed out there is no
     * account to follow, and saying otherwise is how somebody sets quiet hours
     * on a laptop and is woken by a phone that never heard about it.
     */
    expect(PANEL).toContain('source === "account"');
    expect(PANEL_TEXT).toMatch(/follow your account/i);
    expect(PANEL_TEXT).toMatch(/not signed in.*close this tab/i);
    // The browser copy is gone, so no wording may imply one is kept.
    expect(PANEL_TEXT, "the panel still claims a browser copy").not.toMatch(
      /this browser only|browser.s copy/i,
    );
  });

  it("confirms a save only when the account acknowledged it", () => {
    // `setSaved(true)` is guarded by the outcome, so an unreachable account
    // cannot produce a tick. The three outcomes are proven in
    // `preference-sync.test.ts`; this asserts the screen honours them.
    expect(PANEL).toContain('if (outcome.state !== "saved") return;');
    expect(PANEL).toContain("setSaved(true)");
    expect(PANEL).toContain("setSaved(false)");
  });

  it("shows an unreachable or refused save rather than swallowing it", () => {
    expect(PANEL).toContain('saveState && saveState.state !== "saved"');
    expect(PANEL_TEXT).toMatch(/refused this change/i);
  });

  it("draws its categories from the authority rather than restating them", () => {
    /*
     * The titles are deliberately NOT in this file. A panel that spelled the ten
     * categories into its own markup would be a second catalogue, and the first
     * time somebody added an eleventh it would be on the screen in one place and
     * absent in the other. Mapping the authority is what makes the screen and
     * the resolver impossible to disagree.
     */
    expect(PANEL).toContain("NOTIFICATION_CATEGORIES.map(");
    /*
     * Checked against the DESCRIPTIONS rather than the titles. "Security" is a
     * word that legitimately appears in this file's own copy — the sentence
     * explaining which categories cannot be muted — whereas a description is a
     * whole sentence that could only be here by having been copied.
     */
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(
        PANEL_TEXT.includes(category.description),
        `${category.id}'s description should NOT be hard-coded`,
      ).toBe(false);
    }
    expect(PANEL).toContain("{category.title}");
    expect(PANEL).toContain("{category.description}");
  });
});

describe("preferences are kept in the account, not in this browser", () => {
  it("writes no preference key to browser storage anywhere in the panel", () => {
    /*
     * There used to be a browser copy, kept as a cache. It survived sign-out,
     * so the next person to use the machine saw the previous person's quiet
     * hours until the account read landed — a settings screen showing the wrong
     * answer is one somebody can act on.
     */
    expect(PANEL).not.toMatch(/localStorage|sessionStorage/);
    expect(PANEL).not.toContain("preference-store");
  });

  it("still normalises whatever the account returns", () => {
    // The row is JSON in a database column and can hold anything.
    const read = normalise(
      {
        muteOptional: "yes",
        quietHours: { enabled: true, fromHour: 40, toHour: 7, timeZone: "Nowhere/At_All" },
      },
      ["in_app"],
    );
    expect(read.muteOptional).toBe(false);
    expect(read.quietHours.fromHour).toBe(22);
    expect(read.quietHours.timeZone).toBe("UTC");
  });

  it("says which copy is on screen, so defaults are not mistaken for choices", () => {
    // Showing the defaults as though somebody had chosen them is how a muted
    // category appears to be switched on.
    expect(PANEL_TEXT).toContain("what you see are the defaults");
    expect(PANEL_TEXT).toContain("These follow your account");
  });
});

describe("the settings catalogue", () => {
  it("lists the section, so it can be reached and searched", () => {
    const catalogue = readFileSync("src/lib/settings-sections.ts", "utf8");
    expect(catalogue).toContain('slug: "notifications"');
    expect(catalogue).toContain('label: "Notifications"');
  });

  it("renders it rather than falling through to Setup Required", () => {
    const route = readFileSync("src/routes/_authenticated/settings.$section.tsx", "utf8");
    expect(route).toContain("notifications: () => <NotificationPreferencesPanel />");
  });

  it("has a channel list the panel and the resolver agree on", () => {
    const ids = resolveChannels({}).map((channel) => channel.id);
    expect(ids).toEqual(["in_app", "email", "web_push", "fcm", "apns"]);
  });
});
