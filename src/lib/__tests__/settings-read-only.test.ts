import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Settings are readable without an account, and provably not writable.
 *
 * THE SHAPE OF THE REQUIREMENT. A signed-out visitor must be able to open every
 * settings category and see what OCADE actually does, with each control
 * DISABLED and explained — not hidden. Hiding is the easy implementation and
 * the wrong one: it answers "what can this thing be made to do?" with silence.
 *
 * THE DEFECT THIS PINS. The first implementation dimmed the control and set
 * `inert={"" as unknown as boolean}`. React 19 treats `inert` as a genuine
 * boolean prop, so an empty string is falsy and the attribute is DROPPED. The
 * result passed every visual check — greyed out, unclickable — while remaining
 * in the tab order, so a keyboard user could still focus and toggle a setting
 * that would never persist. Confirmed in a real browser: `hasInertAttr` was
 * false and `document.activeElement` became the switch after `.focus()`.
 *
 * Read-only is therefore enforced in three independent places, and this file
 * checks the two that live in source: the gate route and the field wrapper. The
 * third is the server functions, which require a session regardless of what the
 * client renders — a disabled input is a courtesy, not a security boundary.
 */

const GATE = readFileSync("src/components/settings/SettingsGate.tsx", "utf8");
const ROUTE = readFileSync("src/routes/_authenticated/route.tsx", "utf8");

/** Strip comments, so prose describing a bug never satisfies a test about it. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

const GATE_CODE = code(GATE);
const ROUTE_CODE = code(ROUTE);

describe("signed-out settings are reachable", () => {
  it("lets /settings through the authenticated gate without a session", () => {
    expect(ROUTE_CODE).toMatch(/pathname\.startsWith\(\s*["']\/settings["']\s*\)/);
    // The redirect must be conditional on NOT being settings, otherwise the
    // category list is unreachable and the whole feature is decorative.
    expect(ROUTE_CODE).toMatch(/!signedIn\s*&&\s*!isSettings/);
  });

  it("still redirects every other authenticated route", () => {
    expect(ROUTE_CODE).toMatch(/throw redirect\(\s*\{\s*to:\s*["']\/auth["']/);
  });

  it("returns a context with a null user rather than nothing", () => {
    // A bare `return;` produces a context union without `user`, which the
    // layout then cannot read. This was a real type error.
    expect(ROUTE_CODE).toMatch(/if\s*\(\s*!signedIn\s*\)\s*return\s*\{\s*user:\s*null\s*\}/);
  });
});

describe("signed-out settings are not writable", () => {
  it("passes edit permission down from the real session state", () => {
    expect(ROUTE_CODE).toMatch(/<SettingsAccessProvider\s+canEdit=\{signedIn\}/);
  });

  it("does not install an engine for an account that does not exist", () => {
    expect(ROUTE_CODE).toMatch(/signedIn\s*\?\s*<OfflineIntelligenceProgress\s*\/>\s*:\s*null/);
  });

  it("passes inert as a boolean, never as an empty string", () => {
    expect(GATE_CODE).toMatch(/inert=\{!canEdit\}/);
    // The exact spelling that silently did nothing under React 19.
    expect(GATE_CODE).not.toMatch(/inert:\s*["']["']/);
    expect(GATE_CODE).not.toMatch(/inert=["']["']/);
  });

  it("dims as well as inerts, because inert alone is invisible", () => {
    // An unreachable control that looks reachable is worse than a dead one.
    expect(GATE_CODE).toMatch(/!canEdit\s*&&\s*["'][^"']*opacity-50/);
  });

  it("states the reason in one place instead of per panel", () => {
    expect(GATE_CODE).toMatch(/reason\s*=\s*["']Sign in to change this setting\.["']/);
  });
});

describe("every read-only category explains itself", () => {
  const PANELS = [
    "src/components/settings/AccessibilityPanel.tsx",
    "src/components/settings/ChatSettingsPanel.tsx",
    "src/components/settings/MotionPanel.tsx",
    "src/components/settings/OfflineStoragePanel.tsx",
    "src/routes/_authenticated/settings.appearance.tsx",
  ];

  it.each(PANELS)("%s renders the read-only banner", (path) => {
    expect(code(readFileSync(path, "utf8"))).toMatch(/<ReadOnlyBanner\b[^>]*\/>/);
  });
});

describe("no settings section is a dead end when signed out", () => {
  /**
   * TWO DEAD ROUTES, FOUND BY WALKING ALL 41 SECTIONS AS A SIGNED-OUT VISITOR.
   *
   * Settings is readable without an account, which made every section
   * reachable — including two that had never been opened in that state:
   *
   *   /settings/ocade-models  `status: "external"` redirected unconditionally
   *                           to /ocade/models, which IS behind the auth gate.
   *                           A visitor reading through Settings was thrown out
   *                           to the sign-in page with no explanation, losing
   *                           the screen they were on.
   *
   *   /settings/vault         `refresh()` returned early when there was no
   *                           user, leaving `loading` true forever. That page
   *                           is gone — `PLAN.md` Phase 2 removed the browser
   *                           vault it configured — and `/settings/data`
   *                           replaced it. The defect it demonstrated is
   *                           general, so the rule it produced is asserted
   *                           against the screen that took its place.
   */
  const SECTION = readFileSync("src/routes/_authenticated/settings.$section.tsx", "utf8");
  const DATA = readFileSync("src/routes/_authenticated/settings.data.tsx", "utf8");
  const PANEL = readFileSync("src/components/settings/AccountDataPanel.tsx", "utf8");

  it("does not forward a signed-out visitor into a gated route", () => {
    expect(code(SECTION)).toMatch(
      /item\.status === "external" && item\.externalTo && canEditSettings/,
    );
  });

  it("reads the real edit permission rather than assuming it", () => {
    expect(code(SECTION)).toMatch(/const \{ canEdit: canEditSettings \} = useSettingsAccess\(\)/);
  });

  it("has nothing to load before an account arrives, so it cannot spin forever", () => {
    /*
     * The precise shape of the old bug: an early return that skipped
     * `setLoading` turned "nothing to load" into "loading forever". The screen
     * that replaced it reads nothing on mount at all — the export and the
     * deletions are things a person presses — so there is no state that can be
     * left true.
     */
    expect(code(DATA), "the data screen fetches on mount and can strand a spinner").not.toMatch(
      /useEffect|useQuery/,
    );
  });

  it("says what an unsigned visitor is looking at rather than showing a spinner", () => {
    // Settings is readable signed out, so this screen has to be readable too.
    expect(DATA).toMatch(/Export everything OCADE holds/);
  });

  it("does not offer a control that cannot work without an account", () => {
    /*
     * The panel's controls call server functions that require a session, and
     * `SettingsAccessProvider` renders the whole section inert when there is
     * none. What must not happen is a control that looks pressable and fails
     * silently, so the panel reports every refusal it gets.
     */
    expect(PANEL).toMatch(/toast\.error/);
  });
});
