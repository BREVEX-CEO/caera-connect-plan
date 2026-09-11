/**
 * Build the product, sign in for real, then drive the billing console — first
 * as an ordinary account, then as an administrator without a second factor,
 * then with one.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-admin-billing-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-admin-billing",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "ADMIN BILLING: REFUSED, THEN READ, THEN GRANTED WITH A SECOND FACTOR",
  ["scripts/e2e/admin-billing-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(`\n${failures === 0 ? "ADMIN BILLING JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
