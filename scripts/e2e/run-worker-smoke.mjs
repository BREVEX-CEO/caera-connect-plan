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

/**
 * Run one stage, and give it a second chance if wrangler fell over.
 *
 * `wrangler dev` exits on a broken pipe — a client disconnecting mid-response,
 * which a browser does every time it navigates away mid-load. Neither the
 * worker code nor the page being checked is at fault, so the stage runs again
 * against a fresh worker rather than being reported as a product failure. A
 * second death IS reported: twice is not a coincidence.
 */
async function stage(label, args, extraEnv = {}) {
  const code = await served.run(label, args, extraEnv);
  if (!served.serverDied) return code ? 1 : 0;

  if (!(await served.restart())) {
    console.error(`the worker could not be restarted after ${label}`);
    return 1;
  }
  const retry = await served.run(`${label} (again, after restarting the worker)`, args, extraEnv);
  if (served.serverDied) {
    console.error(`the worker died twice during ${label} — that is not a disconnect`);
    return 1;
  }
  return retry ? 1 : 0;
}

let failures = 0;
failures += await stage("EVERY ROUTE ON THE WORKER, SIGNED OUT", ["scripts/e2e/route-qa.mjs"]);
failures += await stage("SIGN UP, VERIFY, SIGN IN, ONBOARD", ["scripts/e2e/sign-in-state.mjs"]);
failures += await stage("EVERY ROUTE ON THE WORKER, SIGNED IN", ["scripts/e2e/route-qa.mjs"], {
  OCADE_STORAGE_STATE: "/tmp/ocade-signed-in-state.json",
});

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
