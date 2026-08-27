/**
 * Build the product, serve it, and walk one customer from nothing to signed
 * back in. See customer-journey.mjs for what the walk proves and what it does
 * not.
 */
import { startServedBuild } from "./served-build.mjs";

const served = await startServedBuild({
  port: Number(process.env.OCADE_JOURNEY_PORT ?? 8097),
  outDir: ".output-journey",
  supabasePort: Number(process.env.OCADE_JOURNEY_SUPABASE_PORT ?? 54397),
});

const code = await served.run("THE CUSTOMER JOURNEY", ["scripts/e2e/customer-journey.mjs"]);
const died = served.serverDied;
await served.stop();

if (died) {
  console.error("\nThe server stopped during the journey.");
  process.exitCode = 1;
} else if (code) {
  process.exitCode = 1;
}
