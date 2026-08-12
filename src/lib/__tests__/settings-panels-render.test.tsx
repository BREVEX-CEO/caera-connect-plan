import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatSettingsPanel } from "@/components/settings/ChatSettingsPanel";
import { ImageSettingsPanel } from "@/components/settings/ImageSettingsPanel";
import { AboutLicencesPanel } from "@/components/settings/AboutLicencesPanel";
import { DEFAULT_CHAT_PREFS, parseChatPrefs } from "../use-chat-prefs";
import summary from "../../../release/THIRD_PARTY_SUMMARY.json";
import manifest from "../../../release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";
import { OCADE_MODEL_ID } from "../local/fixed-model";

/**
 * RENDER PROOF for the settings surfaces added with OCADE Chat.
 *
 * A section can be listed as `active`, be wired into the catch-all, pass every
 * static gate, and still throw the moment it mounts. "It is registered" and "a
 * person can read it" are different claims, and only the second one matters to
 * the user.
 *
 * Three panels are covered here — the ones that render from data rather than
 * from a live server call. The Local Engine, Providers and Diagnostics panels
 * issue authenticated server-function calls on mount, so a static render of
 * those would be asserting against a mocked backend rather than the product;
 * they are proven by the runtime evidence and the gates instead. Saying which
 * ones are NOT covered here is the point — an untested panel quietly folded
 * into a "settings render" suite is how coverage claims become false.
 */

const chat = () => renderToStaticMarkup(<ChatSettingsPanel />);
const images = () => renderToStaticMarkup(<ImageSettingsPanel />);
const about = () => renderToStaticMarkup(<AboutLicencesPanel />);

describe("Chat settings reach the screen", () => {
  it("mounts without throwing", () => {
    expect(() => chat()).not.toThrow();
  });

  it("offers every engine choice, including the local-only one", () => {
    const html = chat();
    expect(html).toContain("Automatic");
    expect(html).toContain("On this device only");
    expect(html).toContain("OCADE Cloud");
  });

  it("states that these settings do not leave this browser", () => {
    expect(chat()).toMatch(/stored in this browser only/i);
  });

  it("renders each preference as a real control bound to the stored value", () => {
    const html = chat();
    // The default engine is "auto", so that radio must be the checked one.
    expect(DEFAULT_CHAT_PREFS.defaultEngineTier).toBe("auto");
    expect(html).toContain('name="ocade-default-engine"');
    expect(html).toContain('name="ocade-send-key"');
    expect(html).toContain('id="ocade-render-markdown"');
    expect(html).toContain('id="ocade-show-timestamps"');
    expect(html).toContain('id="ocade-keep-drafts"');
  });
});

describe("Image settings are honest about what OCADE cannot do", () => {
  it("mounts without throwing", () => {
    expect(() => images()).not.toThrow();
  });

  it("states plainly that image generation is unavailable, and why", () => {
    const html = images();
    expect(html).toMatch(/OCADE cannot generate images/i);
    expect(html).toMatch(/not a switch that has been\s+left off/i);
  });

  it("never leaves the disabled generate control unexplained", () => {
    const html = images();
    // A disabled control with no reason is the exact defect the no-dead-button
    // policy exists to prevent, so the reason must be in the markup itself.
    expect(html).toContain("Generate an image");
    expect(html).toMatch(/disabled/i);
    expect(html).toMatch(/No image generation model or provider is available/i);
  });

  it("gives concrete setup steps rather than a shrug", () => {
    const html = images();
    expect(html).toMatch(/Settings . Local Engine|Settings › Local Engine/);
  });
});

describe("About and licences reach the screen", () => {
  it("mounts without throwing", () => {
    expect(() => about()).not.toThrow();
  });

  it("names the one engine the product installs, and no others", () => {
    /*
     * INVERTED DELIBERATELY. This used to require every tier in the manifest to
     * appear on the licensing page, which was correct when OCADE chose between
     * five engines and became a lie the moment it stopped. A licensing page
     * listing four models the product never loads is not thorough; it tells the
     * reader the product does something it does not do.
     *
     * The manifest still carries all five — it is a resolved registry artefact
     * with provenance — so this asserts the FILTER, at the point of display.
     */
    const html = about();
    expect(html).toContain(OCADE_MODEL_ID);
    for (const tier of manifest.tiers) {
      if (tier.tag === OCADE_MODEL_ID) continue;
      expect(html, `licensing page still advertises ${tier.tag}`).not.toContain(tier.tag);
    }
  });

  it("shows the real dependency count from the generated summary", () => {
    expect(about()).toContain(String(summary.productionPackages));
  });

  it("surfaces packages needing review instead of burying them", () => {
    const html = about();
    for (const entry of summary.needingReview) {
      expect(html, `missing review row: ${entry.package}`).toContain(entry.package);
    }
  });

  it("states that CAERA CADANE does not own the model weights", () => {
    expect(about()).toMatch(/does not own them and does not claim to/i);
  });
});

describe("chat preferences survive hostile storage", () => {
  it("falls back to defaults rather than throwing on corrupt input", () => {
    expect(parseChatPrefs("{not json")).toEqual(DEFAULT_CHAT_PREFS);
    expect(parseChatPrefs(null)).toEqual(DEFAULT_CHAT_PREFS);
  });

  it("rejects an out-of-range value instead of storing it", () => {
    const parsed = parseChatPrefs(
      JSON.stringify({ defaultEngineTier: "supercomputer", density: "enormous", sendKey: 7 }),
    );
    expect(parsed.defaultEngineTier).toBe(DEFAULT_CHAT_PREFS.defaultEngineTier);
    expect(parsed.density).toBe(DEFAULT_CHAT_PREFS.density);
    expect(parsed.sendKey).toBe(DEFAULT_CHAT_PREFS.sendKey);
  });

  it("keeps a valid non-default value", () => {
    const parsed = parseChatPrefs(
      JSON.stringify({ defaultEngineTier: "local", sendKey: "mod_enter", density: "compact" }),
    );
    expect(parsed.defaultEngineTier).toBe("local");
    expect(parsed.sendKey).toBe("mod_enter");
    expect(parsed.density).toBe("compact");
  });
});
