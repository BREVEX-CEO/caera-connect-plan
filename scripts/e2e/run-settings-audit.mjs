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

const storageState = join(tmpdir(), "ocade-onboarded-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-settings",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SETTINGS, SIGNED OUT", ["scripts/e2e/settings-audit.mjs"])) ? 1 : 0;
failures += (await served.run("EVERY ROUTE, SIGNED OUT", ["scripts/e2e/route-qa.mjs"])) ? 1 : 0;
failures += (await served.run("SIGN IN AND ONBOARD", ["scripts/e2e/sign-in-and-onboard.mjs"], {
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
