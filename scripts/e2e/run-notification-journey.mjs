/**
 * Build the product, sign in for real, then cause a notification and read it.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-notification-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-notifications",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "NOTIFICATIONS: CAUSE ONE, READ IT, MARK IT READ",
  ["scripts/e2e/notification-history-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(`\n${failures === 0 ? "NOTIFICATION JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
