/**
 * EVERY ROUTE, AGAINST THE PRODUCTION BUILD.
 *
 * The first version of this ran against `vite dev`, and that was the wrong
 * target twice over. A dev server compiles each route module the first time it
 * is asked for, so a cold route can take seconds to paint — which is not a
 * thing that happens to a customer, and which made the harness report blank
 * pages that were not blank. And a customer never meets the dev server at all.
 *
 * So this builds the product and serves the built output, which removes
 * on-demand compilation at the root rather than waiting longer around it, and
 * measures the thing that actually ships.
 *
 * The build-and-serve sequence itself now lives in `served-build.mjs`, because
 * the offline suite needs exactly the same thing and had been quietly assuming
 * somebody else would provide it.
 */
import { startServedBuild } from "./served-build.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const served = await startServedBuild({
  port: Number(process.env.OCADE_PREVIEW_PORT ?? 8099),
  outDir: ".output-routeqa",
});

let failures = 0;
const storageState = join(tmpdir(), "ocade-signed-in-state.json");
failures += (await served.run("EVERY ROUTE, SIGNED OUT", ["scripts/e2e/route-qa.mjs"])) ? 1 : 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run("EVERY ROUTE, SIGNED IN", ["scripts/e2e/route-qa.mjs"], {
  OCADE_STORAGE_STATE: storageState,
}))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();

if (died) {
  console.error("\nThe built app stopped serving during the run.");
  process.exitCode = 1;
} else if (failures) {
  console.error(`\n${failures} STAGE(S) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nEVERY ROUTE PASSED AGAINST THE PRODUCTION BUILD");
}
