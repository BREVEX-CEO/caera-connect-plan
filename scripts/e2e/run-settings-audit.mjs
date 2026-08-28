/**
 * Stand the stack up ONCE, run every audit that needs it, then shut it down.
 *
 * The settings audit and the offline audit both need a dev server, the Supabase
 * fixture and a real signed-in session. Starting that twice wastes a minute and
 * gives the second run a different session; worse, running either one against a
 * leftover server from the other is how an audit ends up failing for reasons
 * that have nothing to do with what it tests.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { startStubSupabase } from "../fixtures/stub-supabase.mjs";

/**
 * Refuse to start on top of somebody else's server.
 *
 * WHY THIS IS WORTH A PRE-FLIGHT CHECK. Another harness already holding 8080
 * does not stop this one: the dev server fails to bind, and every stage below
 * then drives whatever IS listening — or nothing. That produced a run reporting
 * a hundred route failures and one settings section rendering no controls, none
 * of which were true, and all of which read exactly like a regression.
 *
 * A test suite that can report a confident wrong answer is worse than one that
 * refuses to run, so this refuses to run.
 */
async function requireFreePort(port, what) {
  const free = await new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
  if (!free) {
    console.error(
      `port ${port} is already in use, and this audit needs it for ${what}.\n` +
        "Another harness is probably still running. Stop it and try again — " +
        "auditing against a server this run did not start proves nothing.",
    );
    process.exit(1);
  }
}

await requireFreePort(8080, "the dev server");
await requireFreePort(54321, "the Supabase fixture");

const children = [];
function run(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}
const stopAll = () =>
  children.forEach((c) => {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  });
process.on("exit", stopAll);
process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});

const supabase = await startStubSupabase({ port: 54321 });
console.log(`stub supabase: ${supabase.url}`);

const env = {
  VITE_SUPABASE_URL: supabase.url,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
  SUPABASE_URL: supabase.url,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
};
const dev = run("npx", ["vite", "dev", "--host", "127.0.0.1", "--port", "8080"], env);
let ready = false;
dev.stdout.on("data", (d) => {
  if (/Local:\s+http/.test(String(d))) ready = true;
});
dev.stderr.on("data", (d) => process.stderr.write(String(d)));
for (let i = 0; i < 60 && !ready; i += 1) await sleep(1000);
if (!ready) {
  console.error("dev server never became ready");
  process.exit(1);
}
await sleep(2500);
console.log("dev server ready\n");

function step(label, command, args, env2 = {}) {
  return new Promise((resolve) => {
    console.log(`\n===== ${label} =====`);
    const child = run(command, args, env2);
    child.stdout.on("data", (d) => process.stdout.write(String(d)));
    child.stderr.on("data", (d) => process.stderr.write(String(d)));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let failures = 0;
failures += (await step("SETTINGS, SIGNED OUT", process.execPath, [
  "scripts/e2e/settings-audit.mjs",
]))
  ? 1
  : 0;
failures += (await step("EVERY ROUTE, SIGNED OUT", process.execPath, ["scripts/e2e/route-qa.mjs"]))
  ? 1
  : 0;

failures += (await step("SIGN IN AND ONBOARD", process.execPath, [
  "scripts/e2e/sign-in-and-onboard.mjs",
]))
  ? 1
  : 0;

/*
 * THE VISUAL STAGE RUNS BEFORE ANYTHING THAT TOUCHES A CONTROL, and the order is
 * load bearing. The settings audit flips reduce-motion as part of its own work,
 * and so does the signed-in route audit, which presses every button on every
 * page — including the motion ones. Both leave the preference somewhere, and
 * the preference syncs to the account — so a visual check running afterwards
 * inherits a scene someone else configured and reports it as a backdrop that
 * fails to animate, or as one that ignores reduce motion. Measuring the interface before anything has
 * been changed is the only way that assertion means anything.
 */
failures += (await step(
  "3D BACKDROP AND ITS BUDGET",
  process.execPath,
  ["scripts/e2e/visual-performance.mjs"],
  { OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json" },
))
  ? 1
  : 0;

failures += (await step("EVERY ROUTE, SIGNED IN", process.execPath, ["scripts/e2e/route-qa.mjs"], {
  OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json",
}))
  ? 1
  : 0;
failures += (await step(
  "SETTINGS, SIGNED IN",
  process.execPath,
  ["scripts/e2e/settings-audit.mjs"],
  { OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json" },
))
  ? 1
  : 0;
failures += (await step(
  "ONLINE \u2192 OFFLINE \u2192 ONLINE",
  process.execPath,
  ["scripts/e2e/offline-transitions.mjs"],
  { OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json" },
))
  ? 1
  : 0;

stopAll();
console.log(
  `\n${failures === 0 ? "ALL SETTINGS AUDIT STAGES PASSED" : `${failures} STAGE(S) FAILED`}`,
);
process.exit(failures === 0 ? 0 : 1);
