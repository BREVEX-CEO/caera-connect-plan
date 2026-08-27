/**
 * THE BROWSER HALF OF THE LOCAL-FIRST PROOF, RUN IN ONE PLACE.
 *
 * These probes existed and none of them was reachable from an npm script, so
 * none of them ran. A proof nobody runs is a comment.
 *
 * Each stage is a real Chromium against a real production build:
 *
 *   clean machine     a brand-new profile prepares itself with no button
 *                     pressed, and reaches no hosted inference provider
 *   service worker    the shell is cached and offline navigation is served
 *   manifest          the installable manifest and its icons resolve
 *   tab ownership     three tabs elect ONE model owner, and another takes
 *                     over when it closes
 *   consent           the legal gate cannot be walked past
 *
 * WHAT IS NOT HERE, AND WHY. Downloading the real engine needs about a
 * gigabyte of origin storage, and a CI container is not given that — the
 * product says so itself rather than half-downloading. The transfer mechanism
 * is proven instead by `npm run audit:download`, which drives the SHIPPED
 * downloader against a real Range-speaking server: interrupt, resume, a server
 * that ignores Range, a corrupted file, and a second call that issues zero
 * requests because the file is already there.
 */
import { startServedBuild } from "./served-build.mjs";

const served = await startServedBuild({
  port: Number(process.env.OCADE_LOCAL_PORT ?? 8096),
  outDir: ".output-local",
  supabasePort: Number(process.env.OCADE_LOCAL_SUPABASE_PORT ?? 54396),
});

const stages = [
  ["A CLEAN MACHINE PREPARES ITSELF", "scripts/e2e/clean-machine.mjs"],
  ["THE SERVICE WORKER SERVES OFFLINE", "scripts/e2e/sw-offline-probe.mjs"],
  ["THE INSTALLABLE MANIFEST RESOLVES", "scripts/e2e/manifest-probe.mjs"],
  ["THREE TABS, ONE MODEL OWNER", "scripts/e2e/multi-tab-ownership.mjs"],
  ["THE CONSENT GATE HOLDS", "scripts/e2e/legal-consent.mjs"],
  ["SIGNUP CANNOT SKIP CONSENT", "scripts/e2e/signup-consent.mjs"],
];

let failures = 0;
for (const [label, script] of stages) {
  // Every one of these reads BASE rather than the journey's OCADE_BASE_URL.
  const code = await served.run(label, [script], { BASE: served.base });
  if (code) failures += 1;
  if (served.serverDied) {
    console.error("\nThe server stopped serving during the run.");
    failures += 1;
    break;
  }
}

await served.stop();

if (failures) {
  console.error(`\n${failures} LOCAL/OFFLINE STAGE(S) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nEVERY LOCAL/OFFLINE STAGE PASSED");
}
