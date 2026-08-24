/**
 * THE OFFLINE JOURNEY, AGAINST THE PRODUCTION BUILD.
 *
 * `offline-transitions.mjs` expected something to already be listening on
 * 127.0.0.1:8080 and said nothing about it. Run on its own by somebody who had
 * a dev server up, it passed. Run as part of a full launch sweep, it died with
 * ERR_CONNECTION_REFUSED — which in a proof reads as "OCADE does not survive
 * going offline", a far more alarming claim than "the harness had no server".
 *
 * A suite that only passes when you already know how to run it is a suite that
 * will eventually be believed about something it never tested.
 */
import { startServedBuild } from "./served-build.mjs";

const served = await startServedBuild({
  port: Number(process.env.OCADE_PREVIEW_PORT ?? 8098),
  outDir: ".output-offline",
  supabasePort: 54322,
});

const failed = await served.run("OFFLINE AND BACK", ["scripts/e2e/offline-transitions.mjs"]);

const died = served.serverDied;
await served.stop();

if (died) {
  console.error("\nThe built app stopped serving during the run.");
  process.exit(1);
}
if (failed) {
  console.error("\nTHE OFFLINE JOURNEY FAILED");
  process.exit(1);
}
console.log("\nOFFLINE AND BACK PASSED AGAINST THE PRODUCTION BUILD");
