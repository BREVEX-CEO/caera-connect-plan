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
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { startStubSupabase } from "../fixtures/stub-supabase.mjs";

const PORT = Number(process.env.OCADE_PREVIEW_PORT ?? 8099);
const BASE = `http://127.0.0.1:${PORT}`;

const children = [];
function spawnTracked(command, args, env = {}) {
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

/*
 * VITE_* values are inlined AT BUILD TIME, so the fixture URL has to be present
 * for the build and not merely for the server. Building without it produces a
 * bundle pointed at nothing, and every authenticated route then fails for a
 * reason that has nothing to do with the route.
 */
const env = {
  VITE_SUPABASE_URL: supabase.url,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
  SUPABASE_URL: supabase.url,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
};

function run(label, command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    console.log(`\n===== ${label} =====`);
    const child = spawnTracked(command, args, { ...env, ...extraEnv });
    child.stdout.on("data", (d) => process.stdout.write(String(d)));
    child.stderr.on("data", (d) => process.stderr.write(String(d)));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

/*
 * NODE PRESET FOR THE QA BUILD, DELIBERATELY.
 *
 * The shipping build targets cloudflare-module, and its preview command is
 * `wrangler dev` — which this sandbox cannot reach and which, in this nitro
 * version, crashes with "Cannot access 'preview' before initialization" before
 * serving anything. The node preset produces the SAME application from the
 * same source with a server this machine can actually run, which is what a
 * route audit needs. Deployment still targets Cloudflare; only the harness
 * changes.
 */
const built = await run("BUILD THE PRODUCT", "npm", ["run", "build"], {
  NITRO_PRESET: "node-server",
});
if (built !== 0) {
  console.error("the build failed, so there is nothing to test");
  process.exit(1);
}

const server = spawnTracked(process.execPath, [".output/server/index.mjs"], {
  ...env,
  PORT: String(PORT),
  HOST: "127.0.0.1",
});
server.stderr.on("data", (d) => process.stderr.write(String(d)));

let ready = false;
for (let i = 0; i < 60 && !ready; i += 1) {
  await sleep(1000);
  try {
    const response = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    ready = response.ok;
  } catch {
    /* not up yet */
  }
}
if (!ready) {
  console.error(`the built app never answered on ${BASE}`);
  process.exit(1);
}
console.log(`built app serving on ${BASE}\n`);

/*
 * A server that dies mid-run used to produce sixty-seven identical
 * ERR_CONNECTION_REFUSED failures, which reads as sixty-seven broken routes and
 * is really one broken server. Watching for the exit says which it was.
 */
let serverDied = false;
let stopping = false;
server.on("exit", (code) => {
  // Our own shutdown is an exit too. Reporting that as a death printed
  // "THE SERVER EXITED" at the end of a clean, fully passing run, which is
  // exactly the kind of alarming-but-wrong line an audit must not produce.
  if (stopping) return;
  serverDied = true;
  console.error(`\nTHE SERVER EXITED (code ${code}) — failures after this point are not routes.`);
});

let failures = 0;
failures += (await run("EVERY ROUTE, SIGNED OUT", process.execPath, ["scripts/e2e/route-qa.mjs"], {
  OCADE_BASE_URL: BASE,
}))
  ? 1
  : 0;

failures += (await run(
  "SIGN IN AND ONBOARD",
  process.execPath,
  ["scripts/e2e/sign-in-and-onboard.mjs"],
  { OCADE_BASE_URL: BASE },
))
  ? 1
  : 0;

failures += (await run("EVERY ROUTE, SIGNED IN", process.execPath, ["scripts/e2e/route-qa.mjs"], {
  OCADE_BASE_URL: BASE,
  OCADE_STORAGE_STATE: "/tmp/ocade-onboarded-state.json",
}))
  ? 1
  : 0;

stopping = true;
stopAll();
await supabase.close?.();

if (serverDied) {
  console.error("\nThe built app stopped serving during the run.");
  process.exitCode = 1;
} else if (failures) {
  console.error(`\n${failures} STAGE(S) FAILED`);
  process.exitCode = 1;
} else {
  console.log("\nEVERY ROUTE PASSED AGAINST THE PRODUCTION BUILD");
}
