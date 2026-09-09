/**
 * ONE ROUTE (OR A FEW), AGAINST THE PRODUCTION BUILD.
 *
 * The full pass is seventy-four routes at two widths, signed out and signed in,
 * and every false failure this harness has ever produced was diagnosed by
 * re-running it. This builds and serves exactly as the full pass does and then
 * measures only the routes named in `OCADE_ROUTE_FILTER`, so a suspect route
 * can be re-measured in a minute instead of forty.
 *
 * It is a diagnostic, not a gate: `audit:routes:prod` remains the pass that has
 * to be green.
 */
import { startServedBuild } from "./served-build.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const filter = process.env.OCADE_ROUTE_FILTER;
if (!filter) {
  console.error("set OCADE_ROUTE_FILTER to the route substring(s) to measure");
  process.exit(1);
}

const served = await startServedBuild({
  port: Number(process.env.OCADE_PREVIEW_PORT ?? 8097),
  outDir: ".output-routeqa-focused",
});

/*
 * REPEAT AGAINST ONE SERVER, because the failures worth chasing here are
 * intermittent.
 *
 * `/settings/voice` reported an emptied page once in three full runs and then
 * would not reproduce. Re-running the whole audit to try again costs a build
 * and forty minutes; repeating one route against a server that is already up
 * costs seconds, and an intermittent defect needs attempts, not patience.
 */
const REPEATS = Math.max(1, Number(process.env.OCADE_ROUTE_REPEAT ?? 1));

let failures = 0;
const storageState = join(tmpdir(), "ocade-focused-state.json");
for (let attempt = 1; attempt <= REPEATS; attempt += 1) {
  failures += (await served.run(`${filter}, SIGNED OUT (${attempt}/${REPEATS})`, [
    "scripts/e2e/route-qa.mjs",
  ]))
    ? 1
    : 0;
}
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
for (let attempt = 1; attempt <= REPEATS; attempt += 1) {
  failures += (await served.run(
    `${filter}, SIGNED IN (${attempt}/${REPEATS})`,
    ["scripts/e2e/route-qa.mjs"],
    { OCADE_STORAGE_STATE: storageState },
  ))
    ? 1
    : 0;
}

await served.stop();
process.exitCode = failures ? 1 : 0;
console.log(failures ? `\n${failures} STAGE(S) FAILED` : "\nFOCUSED ROUTES PASSED");
