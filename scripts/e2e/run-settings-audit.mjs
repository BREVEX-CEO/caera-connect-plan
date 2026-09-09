/**
 * Build the product once, run every browser audit that shares its signed-in
 * fixture, then shut the stack down.
 *
 * This deliberately serves the production build. Vite dev can hold requests
 * open for hot reload and compile cold routes on demand; neither behavior is
 * part of the product and both make `networkidle` a misleading audit target.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-signed-in-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-settings",
  supabasePort: 54321,
});

let failures = 0;
/*
 * The public status feed first: it needs no sign-in, and a monitor reading it is
 * the one consumer that has to work before anybody is logged in at all.
 */
failures += (await served.run("PUBLIC STATUS FEED", ["scripts/e2e/status-feed.mjs"])) ? 1 : 0;
/*
 * The Help Center journey is public too, and it covers what the route audit
 * cannot: `/support/$slug` has a parameter, so the route sweep skips it and the
 * article page — the point of the Help Center — would otherwise never be opened
 * in a browser at all.
 */
failures += (await served.run("HELP CENTER JOURNEY", ["scripts/e2e/help-center-journey.mjs"]))
  ? 1
  : 0;
failures += (await served.run("SETTINGS, SIGNED OUT", ["scripts/e2e/settings-audit.mjs"])) ? 1 : 0;
failures += (await served.run("EVERY ROUTE, SIGNED OUT", ["scripts/e2e/route-qa.mjs"])) ? 1 : 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;

/* Run visual checks before later stages change motion preferences. */
failures += (await served.run(
  "3D BACKDROP AND ITS BUDGET",
  ["scripts/e2e/visual-performance.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;
failures += (await served.run("EVERY ROUTE, SIGNED IN", ["scripts/e2e/route-qa.mjs"], {
  OCADE_STORAGE_STATE: storageState,
}))
  ? 1
  : 0;
failures += (await served.run("SETTINGS, SIGNED IN", ["scripts/e2e/settings-audit.mjs"], {
  OCADE_STORAGE_STATE: storageState,
}))
  ? 1
  : 0;

/*
 * Accessibility on a RENDERED page, which is the half `a11y:check` deliberately
 * refuses to guess at: focus order, focus indicators, a focus trap, 200% zoom,
 * reduced motion, and whether any state is carried by colour alone. Run signed
 * out and signed in, because the signed-in surface has most of the controls.
 */
failures += (await served.run("ACCESSIBILITY, SIGNED OUT", [
  "scripts/e2e/accessibility-journey.mjs",
]))
  ? 1
  : 0;
failures += (await served.run(
  "ACCESSIBILITY, SIGNED IN",
  ["scripts/e2e/accessibility-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;
/*
 * The six widths PLAN.md §26 commits to. The route sweep covers 1280 and 390,
 * which catches most of what breaks; 320, 768 and 1920 are nowhere near either,
 * and each fails differently — a fixed minimum, a collapsing two-column layout,
 * and a line of prose stretched across a desktop.
 */
failures += (await served.run("RESPONSIVE WIDTHS, SIGNED OUT", [
  "scripts/e2e/responsive-widths.mjs",
]))
  ? 1
  : 0;
failures += (await served.run(
  "RESPONSIVE WIDTHS, SIGNED IN",
  ["scripts/e2e/responsive-widths.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

/*
 * LCP, CLS and TBT, the three numbers §26 commits to. Last, because it throttles
 * the CPU to a mid-tier device and would slow every stage that ran after it.
 */
failures += (await served.run("WEB VITALS", ["scripts/e2e/web-vitals.mjs"])) ? 1 : 0;
failures += (await served.run(
  "ONLINE → OFFLINE → ONLINE",
  ["scripts/e2e/offline-transitions.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(
  `\n${failures === 0 ? "ALL SETTINGS AUDIT STAGES PASSED" : `${failures} STAGE(S) FAILED`}`,
);
if (died) console.error("The built app stopped serving during the audit.");
process.exitCode = failures === 0 && !died ? 0 : 1;
