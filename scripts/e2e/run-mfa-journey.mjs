/**
 * Build the product, sign in for real, then drive the two-step sign-in journey.
 *
 * Serves the production build for the same reason every other audit here does:
 * Vite dev holds requests open for hot reload and compiles cold routes on
 * demand, and neither behaviour is part of the product.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-mfa-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-mfa",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SIGN IN AND ONBOARD", ["scripts/e2e/sign-in-and-onboard.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "TWO-STEP SIGN-IN: ENROLL, REFUSE, VERIFY, GATE",
  ["scripts/e2e/mfa-enrollment-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(`\n${failures === 0 ? "MFA JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
