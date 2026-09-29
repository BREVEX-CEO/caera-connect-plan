#!/usr/bin/env node
/**
 * ONE COMMAND THAT STANDS THE PRODUCT UP AND PROVES IT IN A BROWSER.
 *
 * The journeys in this directory all want the same two things running: the
 * loopback Supabase stub, and a served production build that was compiled
 * against it. Standing those up by hand is three commands with two ways to be
 * silently wrong, and both of them produce FAILING CHECKS THAT LOOK LIKE
 * PRODUCT BUGS:
 *
 *   - a build compiled without `VITE_SUPABASE_URL` ships a browser client
 *     pointed at nothing, so every signed-in journey stops at the sign-in
 *     screen and reads as "the account menu is missing";
 *   - a server left running across a rebuild keeps the previous build's asset
 *     manifest, so every hashed chunk 404s, nothing hydrates, and every
 *     control reads as permanently disabled.
 *
 * Both cost an investigation before they were recognised as harness faults.
 * Neither is possible here: the build and the server are one step, and the
 * server is always newer than the build it serves.
 *
 * Usage:
 *   node scripts/e2e/harness.mjs                 # every journey
 *   node scripts/e2e/harness.mjs chat usage      # only those
 *   node scripts/e2e/harness.mjs --no-build chat # reuse the current build
 *   node scripts/e2e/harness.mjs --serve         # build, then keep it running
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const WEB_PORT = 8788;
const SUPABASE_PORT = 54321;
const SUPABASE_URL = `http://127.0.0.1:${SUPABASE_PORT}`;
const BASE = `http://127.0.0.1:${WEB_PORT}`;

const ALL = [
  "shell",
  "auth",
  "chat",
  "usage",
  "pricing",
  "online",
  "offline",
  "library",
  "settings",
  "polish",
  "final",
  "jarvis",
  "visual",
  "browsers",
  "admin",
];

const requested = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const journeys = requested.length > 0 ? requested : ALL;
const skipBuild = process.argv.includes("--no-build");

const unknown = journeys.filter((name) => !ALL.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown journey: ${unknown.join(", ")}. Known: ${ALL.join(", ")}`);
  process.exit(2);
}

/**
 * The stub answers as the project, so the build must be compiled against it.
 *
 * Which sign-in methods appear is not set here. The product asks the project
 * at `/auth/v1/settings`, and the stub answers that call — so the journeys
 * exercise the same path production does rather than a build flag standing in
 * for it.
 */
const BUILD_ENVIRONMENT = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_loopback_stub",
};

const children = [];

/**
 * Kill the GROUP, not the process.
 *
 * `wrangler dev` spawns `workerd`, which outlives a SIGTERM sent only to
 * wrangler. A surviving `workerd` holds port 8788 with the PREVIOUS build's
 * asset manifest, so the next run's server silently fails to bind and every
 * hashed chunk 404s against the old one — which reads as a product whose
 * controls are all disabled. Each child is therefore its own process group and
 * the negative pid takes the whole tree with it.
 */
function stopEverything() {
  for (const child of children) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      /* Already gone. */
    }
  }
}

process.on("exit", stopEverything);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

async function waitForPort(url, name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`${name} did not answer on ${url} within ${timeoutMs}ms.`);
}

if (!skipBuild) {
  console.log("=== build (compiled against the loopback stub) ===");
  /*
   * `npm`, not `node $npm_execpath`. That variable is only set when this script
   * is itself run by an npm script, so `node scripts/e2e/harness.mjs` — the
   * documented usage at the top of this file — resolved to `node ./npm` and
   * died with MODULE_NOT_FOUND before building anything.
   */
  const npmPath = process.env.npm_execpath;
  const built = spawnSync(
    npmPath ? process.execPath : "npm",
    npmPath ? [npmPath, "run", "build"] : ["run", "build"],
    {
      stdio: "inherit",
      shell: !npmPath && process.platform === "win32",
      windowsHide: true,
      env: { ...process.env, ...BUILD_ENVIRONMENT },
    },
  );
  if (built.error) throw built.error;
  if (built.status !== 0) process.exit(built.status ?? 1);
}

/*
 * The server functions read the same three names the Worker reads in
 * production. Passed as flags because `wrangler dev` forwards neither the
 * parent environment nor a `.dev.vars` file that is not beside the config --
 * and the config is the repository root one, where a real `.dev.vars` may hold
 * a developer's own values that a harness must never overwrite.
 */
const STUB_VARS = [
  `SUPABASE_URL:${SUPABASE_URL}`,
  `SUPABASE_PUBLISHABLE_KEY:${BUILD_ENVIRONMENT.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  "SUPABASE_SERVICE_ROLE_KEY:sb_secret_loopback_stub",
].flatMap((pair) => ["--var", pair]);

console.log("=== supabase stub ===");
children.push(
  spawn(process.execPath, ["scripts/e2e/supabase-stub.mjs", String(SUPABASE_PORT)], {
    stdio: "inherit",
    detached: true,
  }),
);
await waitForPort(`${SUPABASE_URL}/auth/v1/settings`, "the Supabase stub");

console.log("=== served production build ===");
children.push(
  spawn(
    process.execPath,
    [
      path.join("node_modules", "wrangler", "bin", "wrangler.js"),
      "dev",
      "--config",
      "wrangler.json",
      ...STUB_VARS,
      "--ip",
      "127.0.0.1",
      "--port",
      String(WEB_PORT),
    ],
    { stdio: ["ignore", "inherit", "inherit"], detached: true },
  ),
);
await waitForPort(BASE, "the served build");

// `--serve`: stand the product up and keep it running for MCP/manual testing.
if (process.argv.includes("--serve")) {
  console.log(`
Serving ${BASE} against the stub at ${SUPABASE_URL}. Ctrl+C to stop.`);
  // An unresolved promise does not keep Node alive; a timer does.
  setInterval(() => {}, 1 << 30);
  await new Promise(() => {});
}

let failed = 0;
for (const journey of journeys) {
  console.log(`\n=== ${journey} ===`);
  const result = spawnSync(
    process.execPath,
    [`scripts/e2e/${journey}-journey.mjs`, `--base=${BASE}`, `--supabase=${SUPABASE_URL}`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) failed += 1;
}

stopEverything();
console.log(
  failed === 0
    ? `\nAll ${journeys.length} browser journeys passed.`
    : `\n${failed} of ${journeys.length} browser journeys failed.`,
);
process.exit(failed === 0 ? 0 : 1);
