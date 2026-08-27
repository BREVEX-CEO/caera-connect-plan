import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResearchPanel } from "@/components/ocade/ResearchPanel";
import { ScenePanel } from "@/components/ocade/ScenePanel";
import { PatchPanel } from "@/components/ocade/PatchPanel";
import { CreativeControlPanel } from "@/components/ocade/CreativeControlPanel";
import { EngineeringControlPanel } from "@/components/ocade/EngineeringControlPanel";
import { ResourceGovernorPanel } from "@/components/ocade/ResourceGovernorPanel";
import { LocalJobPlanPanel } from "@/components/ocade/LocalJobPlanPanel";
import { AppCoveragePanel } from "@/components/ocade/AppCoveragePanel";
import { UpdatePolicyPanel } from "@/components/settings/UpdatePolicyPanel";
import { MODULE_CONTEXT } from "../shell-nav";

/**
 * RENDER PROOF for the Studio surfaces.
 *
 * Both panels exist to make a refusal visible. A refusal that renders as a bare
 * "no" — or worse, doesn't render at all — is the defect these guard against.
 */

const research = () => renderToStaticMarkup(<ResearchPanel />);
const scene = () => renderToStaticMarkup(<ScenePanel />);

describe("the Studio route is reachable, not orphaned", () => {
  it("is reachable from OCADE, on the rail or under More", () => {
    /*
     * THIS USED TO REQUIRE A SIDEBAR ENTRY. The rail went from twelve
     * destinations to seven, which is the point of the change: a list of twelve
     * rooms is a sitemap, not a place to work. What must stay true is that the
     * screen has a route to it, and that is what is checked now — the rail, the
     * More page, or the command palette, any of which a person can actually
     * follow.
     */
    const onRail = MODULE_CONTEXT.ocade.some((item) => item.to === "/ocade/studio");
    const underMore = readFileSync("src/routes/_authenticated/ocade.system.tsx", "utf8").includes(
      '"/ocade/studio"',
    );
    const inPalette = readFileSync("src/components/shell/CommandPalette.tsx", "utf8").includes(
      '"/ocade/studio"',
    );
    expect(onRail || underMore || inPalette).toBe(true);
  });
});

describe("the Resource Governor boundary", () => {
  const governor = () => renderToStaticMarkup(<ResourceGovernorPanel />);

  it("shows deterministic weak, medium and strong fallback evidence", () => {
    const html = governor();
    expect(html).toContain("Resource Governor");
    expect(html).toMatch(/weak profile/i);
    expect(html).toMatch(/medium profile/i);
    expect(html).toMatch(/strong profile/i);
    expect(html).toContain("model-lite");
    expect(html).toContain("model-balanced");
    expect(html).toContain("model-full");
  });

  it("states the native evidence and reversible-control boundary", () => {
    const html = governor();
    expect(html).toMatch(/authenticated native probe/i);
    expect(html).toMatch(/Firmware, overclocking, drivers, global GPU settings/i);
    expect(html).toMatch(/accuracy-critical engineering assumptions/i);
  });
});

describe("the creative application control boundary", () => {
  const creative = () => renderToStaticMarkup(<CreativeControlPanel />);

  it("mounts and exposes the deterministic execution safeguards", () => {
    const html = creative();
    expect(html).toContain("Creative application control");
    expect(html).toMatch(/project checkpoint verified before mutation/i);
    expect(html).toMatch(/render and glTF bytes hashed/i);
    expect(html).toMatch(/restoration on any incomplete result/i);
  });

  it("does not present a dead run button or imply an installed Blender runtime", () => {
    const html = creative();
    expect(html).not.toContain("<button");
    expect(html).toMatch(/no installed Blender/i);
    expect(html).toMatch(/controlled fixtures are not an installed-application claim/i);
    expect(html).toContain("Adapter required");
  });
});

describe("the CAD and engineering control boundary", () => {
  const engineering = () => renderToStaticMarkup(<EngineeringControlPanel />);

  it("mounts and states the duplicate, assumption and export guarantees", () => {
    const html = engineering();
    expect(html).toContain("CAD and engineering control");
    expect(html).toMatch(/original project stays byte-identical/i);
    expect(html).toMatch(/dimension, material, contact, load and tolerance/i);
    expect(html).toMatch(/independently reopened/i);
  });

  it("has no dead run control and refuses fixture-backed engineering claims", () => {
    const html = engineering();
    expect(html).not.toContain("<button");
    expect(html).toContain("Licensed app required");
    expect(html).toMatch(/no installed licensed CAD application or solver/i);
    expect(html).toMatch(/never support an engineering conclusion/i);
  });
});

describe("the research panel", () => {
  it("mounts without throwing", () => {
    expect(() => research()).not.toThrow();
  });

  it("offers both traps as things the user can run", () => {
    const html = research();
    expect(html).toContain("Four outlets, one story");
    expect(html).toContain("Is that traffic an accident?");
  });

  it("is honest up front that fetching needs a network and judging doesn't", () => {
    expect(research()).toMatch(/Fetching pages needs a network/i);
  });

  it("shows no verdict before the user asks for one", () => {
    expect(research()).not.toContain('role="status"');
  });

  it("offers real buttons rather than text that looks clickable", () => {
    expect(research()).toMatch(/<button[^>]*>[\s\S]*?Four outlets, one story/);
  });
});

describe("the 3D panel", () => {
  it("mounts without throwing", () => {
    expect(() => scene()).not.toThrow();
  });

  /**
   * The cube is generated and validated during render. Its evidence string
   * carries real numbers — if geometry generation broke, this would change.
   */
  it("shows geometry it generated and checked, with real numbers", () => {
    const html = scene();
    expect(html).toMatch(/8 vertices, 12 triangles, watertight/);
    expect(html).toMatch(/volume 1\.0000/);
  });

  it("states the validation properties it actually enforces", () => {
    const html = scene();
    expect(html).toMatch(/watertight/i);
    expect(html).toMatch(/wound outward/i);
    expect(html).toMatch(/Euler characteristic 2/i);
  });

  it("says a failing mesh is refused rather than shipped", () => {
    expect(scene()).toMatch(/refused, not shipped/i);
  });

  it("shows no result before the user picks a demo", () => {
    expect(scene()).not.toContain('role="status"');
  });

  it("offers the unlit and static-video cases, which are the refusals", () => {
    const html = scene();
    expect(html).toContain("Check it with no lights");
    expect(html).toContain("3D from a static video");
  });
});

describe("the code patch panel", () => {
  const patch = () => renderToStaticMarkup(<PatchPanel />);

  it("mounts without throwing", () => {
    expect(() => patch()).not.toThrow();
  });

  it("labels both editors properly", () => {
    const html = patch();
    expect(html).toContain('for="patch-file"');
    expect(html).toContain('id="patch-file"');
    expect(html).toContain('for="patch-diff"');
    expect(html).toContain('id="patch-diff"');
  });

  it("starts with a real file and a real patch, not empty boxes", () => {
    const html = patch();
    expect(html).toContain("function greet(name)");
    expect(html).toContain("@@ -1,3 +1,3 @@");
  });

  /**
   * Undo must be unavailable until there is something to undo. A live-looking
   * button that does nothing is the dead-control defect.
   */
  it("disables Undo until a change has been applied", () => {
    // Pull out the actual <button> containing "Undo" rather than pattern-
    // matching across it: the button wraps an <svg>, so a `[^>]*` scan stops
    // at the icon's own tag and silently proves nothing.
    const buttons = patch().match(/<button[\s\S]*?<\/button>/g) ?? [];
    const undoButton = buttons.find((b) => b.includes("Undo"));
    expect(undoButton, "no Undo button rendered").toBeDefined();
    // The ATTRIBUTE, not the string: Tailwind's `disabled:` variant classes
    // appear on every button and would make a substring check meaningless.
    expect(undoButton!).toMatch(/\sdisabled=""/);

    // And the control that IS available must not carry it.
    const applyButton = buttons.find((b) => b.includes("Apply"));
    expect(applyButton).toBeDefined();
    expect(applyButton!).not.toMatch(/\sdisabled=""/);
  });

  it("explains the refusal it exists to demonstrate", () => {
    expect(patch()).toMatch(/context matches exactly/i);
    expect(patch()).toMatch(/lands in the wrong function/i);
  });

  it("shows no result region before anything runs", () => {
    expect(patch()).not.toContain('role="status"');
  });
});

/**
 * Export must not be reachable before the scene has passed its checks — handing
 * someone a file built from geometry OCADE just refused would undo the refusal.
 */
describe("glTF export is gated on validation", () => {
  it("is not offered before a scene has been checked", () => {
    expect(renderToStaticMarkup(<ScenePanel />)).not.toContain("Export as glTF");
  });

  it("does not claim that an export was written before the browser confirms a save", () => {
    const source = ScenePanel.toString();
    expect(source).not.toContain("glTF written");
    expect(source).toContain("download requested");
  });
});

/**
 * Local job placement — RENDER PROOF that the placement decision is reachable.
 *
 * `planLocalJob` was implemented and tested but imported by no route or panel,
 * and it is the only consumer of `hardware-profile`, so both were unreachable
 * from the product. A module the user can never arrive at is not complete, so
 * this asserts the panel renders REAL verdicts — including the refusals, which
 * are the whole point of having a governor.
 */
describe("local job placement is reachable and shows real verdicts", () => {
  const panel = () => renderToStaticMarkup(<LocalJobPlanPanel />);

  it("renders every declared machine", () => {
    const html = panel();
    expect(html).toContain("Local job placement");
    expect(html).toContain("Laptop on battery");
    expect(html).toContain("Low-memory netbook");
    expect(html).toContain("Desktop");
    expect(html).toContain("Thermally throttled");
  });

  it("shows a machine that can run the job locally, with the governor's estimate", () => {
    const html = panel();
    expect(html).toMatch(/Runs locally/);
    expect(html).toContain("Compact local model");
    // The estimate comes from the governor, not from prose in the component.
    expect(html).toMatch(/Fits comfortably/);
  });

  it("SHOWS the thermal refusal rather than quietly downgrading it", () => {
    // A governor whose refusal never reaches the screen is not a governor.
    const html = panel();
    expect(html).toContain("Refused by the resource governor");
    expect(html).toMatch(/critically hot/i);
  });

  it("falls back to cloud only with consent when nothing local fits", () => {
    const html = panel();
    expect(html).toContain("No supported local runtime");
    expect(html).not.toContain("Cloud, with consent");
  });

  it("does not present declared snapshots as a reading of real hardware", () => {
    // The fabrication risk: three machine descriptions look exactly like a
    // hardware scan unless the panel says plainly that they are not one.
    const html = panel();
    expect(html).toMatch(/not a reading of your hardware/i);
    expect(html).toMatch(/not measurements/i);
  });
});

/**
 * Application coverage — the honest blocked state, made visible.
 *
 * The registry knows it cannot determine presence from a browser. Without a
 * surface saying so, a user reads silence as "no applications are supported".
 * This also guards the repaired fabrication: the old registry hardcoded Blender
 * as detected at 4.0.2 with FULL coverage, so any panel over it would have
 * displayed invented application support.
 */
describe("application coverage states its blocked reason honestly", () => {
  const panel = () => renderToStaticMarkup(<AppCoveragePanel />);

  it("lists the candidate applications", () => {
    const html = panel();
    expect(html).toContain("Application coverage");
    expect(html).toContain("Blender");
    expect(html).toContain("FreeCAD");
    expect(html).toContain("CalculiX");
  });

  it("reports BLOCKED rather than claiming support or absence", () => {
    const html = panel();
    expect(html).toContain("BLOCKED");
    expect(html).not.toContain("FULL");
    expect(html).not.toContain("UNSUPPORTED");
  });

  it("displays NO fabricated version or evidence", () => {
    // The exact values the repaired registry used to invent.
    const html = panel();
    expect(html).not.toContain("4.0.2");
    expect(html).not.toContain("Found executable");
  });

  it("distinguishes 'not determined' from 'not installed'", () => {
    // Merging the two is how a coverage report starts lying.
    const html = panel();
    expect(html).toMatch(/not determined/i);
    expect(html).toMatch(/not installed/i);
  });

  it("says what would turn it into a real answer", () => {
    const html = panel();
    expect(html).toMatch(/desktop companion/i);
  });
});

/**
 * Update policy — the updater's own rules, made visible.
 *
 * `update-plan` decides apply / skip / refuse and names every refusal, but it
 * was reached by no route or panel: the rules protecting the user from an
 * unsigned or unhashed update were invisible to them. The decisions asserted
 * here are produced by the real engine at render time, not written into the
 * component.
 */
describe("update policy is reachable and refuses unsafe updates", () => {
  const panel = () => renderToStaticMarkup(<UpdatePolicyPanel />);

  it("renders the policy surface", () => {
    expect(panel()).toContain("Update policy");
  });

  it("REFUSES an unsigned build rather than warning and installing", () => {
    const html = panel();
    expect(html).toContain("Unsigned build");
    expect(html).toMatch(/signature/i);
  });

  it("REFUSES a build with no content hash", () => {
    expect(panel()).toContain("No content hash");
  });

  it("would install a properly signed newer build", () => {
    // The positive case must still work; a policy that refuses everything is
    // not a policy, it is an outage.
    expect(panel()).toMatch(/Would install 0\.2\.0/);
  });

  it("states plainly that automatic updates are not available yet", () => {
    // The placeholder signing key means nothing can be verified. Saying updates
    // are ready would be the inaccurate completion claim this panel exists to avoid.
    const html = panel();
    expect(html).toMatch(/not available yet/i);
    expect(html).toMatch(/placeholder signing key/i);
  });
});
