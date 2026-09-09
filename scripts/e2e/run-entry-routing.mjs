/**
 * Build the product, serve it, sign in once, and prove the three `/` rules.
 *
 * Against the built application rather than the dev server for the same reason
 * `run-route-qa.mjs` is: entry routing depends on what the SERVER renders for a
 * document request, and the dev server is not what ships.
 */
import { startServedBuild } from "./served-build.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const served = await startServedBuild({
  port: Number(process.env.OCADE_PREVIEW_PORT ?? 8103),
  outDir: ".output-entry",
  supabasePort: 54325,
});

const storageState = join(tmpdir(), "ocade-entry-state.json");
let failures = 0;
failures += (await served.run("SIGN IN", ["scripts/e2e/sign-in-state.mjs"], {
  OCADE_STORAGE_STATE_OUT: storageState,
}))
  ? 1
  : 0;
failures += (await served.run("ENTRY ROUTING", ["scripts/e2e/entry-routing.mjs"], {
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
  console.log("\nENTRY ROUTING PASSED AGAINST THE PRODUCTION BUILD");
}
