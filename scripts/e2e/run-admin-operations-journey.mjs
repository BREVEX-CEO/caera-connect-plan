/**
 * Build the product, sign in for real, then drive the operations console —
 * first as an ordinary account, then as an administrator.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-admin-operations-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-admin-operations",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SIGN IN AND ONBOARD", ["scripts/e2e/sign-in-and-onboard.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "ADMIN OPERATIONS: REFUSED, THEN GRANTED, THEN READ",
  ["scripts/e2e/admin-operations-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(
  `\n${failures === 0 ? "ADMIN OPERATIONS JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`,
);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
