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
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { printTimings } from "./timings.mjs";

// The full Chromium build, never Playwright's separate headless shell: the shell
// build shipped with this Playwright crashes on pages real Chrome renders.
process.env.PLAYWRIGHT_CHROMIUM ||= chromium.executablePath();

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
  "bubble",
  "mfa",
  "carry-on",
  "office",
  "push",
  "controls",
  "live",
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
/*
 * A VAPID key pair for browser notifications, made once on this machine and
 * kept beside Wrangler's own local state (never committed): the public half
 * goes into the build, the private half to the served Worker, and a build
 * reused with --no-build still matches the key the Worker signs with.
 */
const VAPID_FILE = path.join(".wrangler", "e2e-vapid.json");
const VAPID = (() => {
  try {
    return JSON.parse(readFileSync(VAPID_FILE, "utf8"));
  } catch {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = privateKey.export({ format: "jwk" });
    const point = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, "base64url"),
      Buffer.from(jwk.y, "base64url"),
    ]);
    const made = { publicKey: point.toString("base64url"), privateKey: jwk.d };
    mkdirSync(".wrangler", { recursive: true });
    writeFileSync(VAPID_FILE, JSON.stringify(made));
    return made;
  }
})();

const BUILD_ENVIRONMENT = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_loopback_stub",
  VITE_WEB_PUSH_PUBLIC_KEY: VAPID.publicKey,
};

const children = [];
let stopping = false;

/** A server that dies mid-run says so, with how it ended, instead of vanishing. */
function watched(name, child) {
  child.on("exit", (code, signal) => {
    if (!stopping)
      console.log(`\n!!! ${name} stopped unexpectedly (code ${code}, signal ${signal})`);
  });
  children.push(child);
  return child;
}

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
  stopping = true;
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
  `WEB_PUSH_PRIVATE_KEY:${VAPID.privateKey}`,
].flatMap((pair) => ["--var", pair]);

console.log("=== supabase stub ===");
watched(
  "the Supabase stub",
  spawn(process.execPath, ["scripts/e2e/supabase-stub.mjs", String(SUPABASE_PORT)], {
    stdio: "inherit",
    detached: true,
    // Detached on Windows means a console window of its own; hidden, nobody can
    // close it or Ctrl+C it mid-run (exit 0xC000013A / 129 before this).
    windowsHide: true,
  }),
);
await waitForPort(`${SUPABASE_URL}/auth/v1/settings`, "the Supabase stub");

/*
 * THE PRODUCTION CONFIG WITHOUT ITS ROUTES. `wrangler dev` rewrites every
 * request to the first route's host, so the local proof would be answered as
 * if it were ocade.in itself. Beside the real config, so its relative paths
 * still hold.
 */
const LOCAL_CONFIG = "wrangler.e2e.json";
{
  const production = JSON.parse(readFileSync("wrangler.json", "utf8"));
  delete production.routes;
  writeFileSync(LOCAL_CONFIG, JSON.stringify(production, null, 2));
}

console.log("=== served production build ===");
const serve = () =>
  watched(
    "the served build",
    spawn(
      process.execPath,
      [
        path.join("node_modules", "wrangler", "bin", "wrangler.js"),
        "dev",
        "--config",
        LOCAL_CONFIG,
        ...STUB_VARS,
        "--ip",
        "127.0.0.1",
        "--port",
        String(WEB_PORT),
        // `/cdn-cgi/handler/scheduled` runs the cron handler on demand (JARVIS reminders and schedules).
        "--test-scheduled",
      ],
      { stdio: ["ignore", "inherit", "inherit"], detached: true, windowsHide: true },
    ),
  );
let served = serve();
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
let blocked = 0;
for (const journey of journeys) {
  console.log(`\n=== ${journey} ===`);
  // A server that EXITED during the last journey is started again, loudly, so
  // one failure does not become every later journey's failure. Only an exit
  // counts: a probe that misses once would start a second server that cannot
  // bind the port.
  if (served.exitCode !== null) {
    console.log("!!! the served build had stopped; starting it again");
    served = serve();
    await waitForPort(BASE, "the served build");
  }
  const run = () =>
    spawnSync(
      process.execPath,
      [`scripts/e2e/${journey}-journey.mjs`, `--base=${BASE}`, `--supabase=${SUPABASE_URL}`],
      { stdio: "inherit" },
    );
  let result = run();
  /*
   * A SERVER THAT STOPPED ANSWERING IS NOT A PRODUCT FAILURE, AND MUST NOT LOOK
   * LIKE ONE. `wrangler` can stay alive while its `workerd` is gone, so the exit
   * check above sees nothing and every later check fails with "connection
   * refused" as if the product were broken. Said out loud, the server is
   * replaced (whole tree), and the journey it interrupted runs once more.
   */
  if (
    result.status !== 0 &&
    !(await fetch(BASE).then(
      () => true,
      () => false,
    ))
  ) {
    console.log(
      `!!! the served build stopped answering during ${journey}; restarting it and running ${journey} again`,
    );
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(served.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-served.pid, "SIGKILL");
      } catch {
        /* Already gone. */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    served = serve();
    await waitForPort(BASE, "the served build");
    result = run();
  }
  if (result.status === 3) blocked += 1;
  else if (result.status !== 0) failed += 1;
}

await printTimings(SUPABASE_URL).catch((error) =>
  console.log(`TIMING  unavailable: ${error.message}`),
);
stopEverything();
// A blocked journey is reported as blocked, never folded into "passed" (F-132).
const blockedNote = blocked ? `, ${blocked} BLOCKED` : "";
console.log(
  failed === 0
    ? `\n${journeys.length - blocked} of ${journeys.length} browser journeys passed${blockedNote}.`
    : `\n${failed} of ${journeys.length} browser journeys failed${blockedNote}.`,
);
// A required journey that could not run is not a pass (C23): BLOCKED exits 3, only when the
// caller lets BLOCKED stand as a known gap (OCADE_ALLOW_BLOCKED=1) does it exit 0.
process.exit(failed > 0 ? 1 : blocked > 0 && process.env.OCADE_ALLOW_BLOCKED !== "1" ? 3 : 0);
