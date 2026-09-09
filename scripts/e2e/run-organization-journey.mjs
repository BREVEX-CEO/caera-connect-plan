/**
 * Build the product, sign in for real, then drive team management as two people.
 *
 * The production build, for the same reason every other audit here uses it:
 * Vite dev holds requests open for hot reload and compiles cold routes on
 * demand, and neither behaviour ships.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServedBuild } from "./served-build.mjs";

const storageState = join(tmpdir(), "ocade-organization-state.json");
const served = await startServedBuild({
  port: 8080,
  outDir: ".output-organization",
  supabasePort: 54321,
});

let failures = 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run(
  "ORGANIZATION: CREATE, INVITE, ACCEPT, PROMOTE, PROTECT, DELETE",
  ["scripts/e2e/organization-journey.mjs"],
  { OCADE_STORAGE_STATE: storageState },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();
console.log(`\n${failures === 0 ? "ORGANIZATION JOURNEY PASSED" : `${failures} STAGE(S) FAILED`}`);
if (died) console.error("The built app stopped serving during the audit.");
process.exit(failures === 0 && !died ? 0 : 1);
