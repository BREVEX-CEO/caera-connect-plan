/**
 * THE DEPLOY-SHAPED SMOKE TEST.
 *
 * Signup, verification, login, the workspace, settings, logout and back in —
 * against the real Cloudflare Worker running in workerd, not against a node
 * server built from the same source.
 *
 * This is the closest a machine with no Cloudflare account can get to proving
 * the deployed product works. What remains after it is deployment itself: the
 * account, the secrets, DNS. `npm run deploy:check` names exactly what is
 * missing for that, and refuses cleanly rather than half-deploying.
 */
import { startServedWorker } from "./served-worker.mjs";

const served = await startServedWorker({
  port: Number(process.env.OCADE_WORKER_PORT ?? 8791),
  outDir: ".output-worker",
});

let failures = 0;
failures += (await served.run("EVERY ROUTE ON THE WORKER, SIGNED OUT", [
  "scripts/e2e/route-qa.mjs",
]))
  ? 1
  : 0;
failures += (await served.run("SIGN UP, VERIFY, SIGN IN, ONBOARD", [
  "scripts/e2e/sign-in-and-onboard.mjs",
]))
  ? 1
  : 0;
failures += (await served.run(
  "EVERY ROUTE ON THE WORKER, SIGNED IN",
  ["scripts/e2e/route-qa.mjs"],
  { OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json" },
))
  ? 1
  : 0;

const died = served.serverDied;
await served.stop();

if (died) {
  console.error("\nThe worker stopped serving during the run.");
  process.exitCode = 1;
} else if (failures) {
  console.error(`\n${failures} STAGE(S) FAILED ON THE WORKER`);
  process.exitCode = 1;
} else {
  console.log("\nTHE DEPLOYED SHAPE PASSED: every route, and the whole account journey");
}
