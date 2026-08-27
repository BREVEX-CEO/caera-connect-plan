/**
 * BUILD THE ACTUAL CLOUDFLARE WORKER AND SERVE IT, FOR A DEPLOY-SHAPED PROOF.
 *
 * WHY THIS EXISTS ALONGSIDE `served-build.mjs`. That one builds with the node
 * preset, because a listening HTTP server is what the route harness needs and
 * the node preset is the same application from the same source. It is the right
 * tool for "does every route answer".
 *
 * It is the wrong tool for one question: does the thing we DEPLOY work? The
 * shipped artifact is a Cloudflare Worker with its own entry, its own asset
 * gate, its own runtime — none of which the node build exercises. A repository
 * comment here used to say `wrangler dev` could not run in this sandbox. It
 * can. It was never tried.
 *
 * So this builds with the Cloudflare preset and serves the real worker through
 * `wrangler dev --local`, which runs it in workerd exactly as the edge does.
 * What it does NOT prove is deployment itself — DNS, the account, the secrets.
 * That still needs credentials this environment does not have, and the deploy
 * controller says so precisely rather than guessing.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { cp, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { startStubSupabase } from "../fixtures/stub-supabase.mjs";

/**
 * @param {object} [options]
 * @param {number} [options.port]
 * @param {string} [options.outDir]
 * @param {number} [options.supabasePort]
 */
export async function startServedWorker({
  port = 8791,
  outDir = ".output-worker",
  supabasePort = 54323,
} = {}) {
  const base = `http://127.0.0.1:${port}`;
  const children = [];
  let stopping = false;
  let serverDied = false;

  /*
   * Every child gets its own process GROUP, and the group is what gets killed.
   *
   * `wrangler dev` is four processes deep — npm, a shell, the CLI, and workerd
   * itself — and signalling only the one we spawned left workerd holding the
   * port. The next run then died with EADDRINUSE and blamed the harness for
   * something the previous harness had leaked. Killing the group ends all of
   * them, which is what "stop the server" has to mean.
   */
  const spawnTracked = (command, args, extraEnv = {}) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
      detached: process.platform !== "win32",
    });
    children.push(child);
    return child;
  };

  const supabase = await startStubSupabase({ port: supabasePort });
  console.log(`stub supabase: ${supabase.url}`);

  // VITE_* values are inlined AT BUILD TIME, so the fixture has to be present
  // for the build and not merely for the server. Same lesson as the node
  // harness, and the same failure if it is skipped: every authenticated route
  // fails for a reason that has nothing to do with the route.
  const env = {
    VITE_SUPABASE_URL: supabase.url,
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
    SUPABASE_URL: supabase.url,
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ocade_local_audit_key",
  };

  const stopAll = () => {
    stopping = true;
    for (const child of children) {
      try {
        if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  };
  process.on("exit", stopAll);
  process.on("SIGINT", () => {
    stopAll();
    process.exit(130);
  });

  console.log("\n===== BUILD THE WORKER =====");
  const npmExecPath = process.env.npm_execpath;
  const buildCommand = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const buildArgs = npmExecPath ? [npmExecPath, "run", "build"] : ["run", "build"];
  // No NITRO_PRESET override: the default IS the shipping Cloudflare preset,
  // and overriding it here would defeat the entire point of this harness.
  const buildCode = await new Promise((resolve, reject) => {
    const child = spawnTracked(buildCommand, buildArgs, env);
    child.stdout.on("data", (d) => process.stdout.write(String(d)));
    child.stderr.on("data", (d) => process.stderr.write(String(d)));
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (buildCode !== 0) {
    stopAll();
    await supabase.close?.();
    throw new Error("the worker build failed, so there is nothing to test");
  }

  const config = ".output/server/wrangler.json";
  if (!existsSync(config)) {
    stopAll();
    await supabase.close?.();
    throw new Error(`${config} is missing — this is not a Cloudflare build`);
  }

  /*
   * Moved aside, like the node harness does, so the repository is not left
   * holding a fixture-built worker where the real one belongs. `wrangler dev`
   * is pointed at the moved copy.
   */
  await rm(outDir, { recursive: true, force: true });
  try {
    await rename(".output", outDir);
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "EPERM") throw error;
    await cp(".output", outDir, { recursive: true });
    await rm(".output", { recursive: true, force: true });
  }

  const server = spawnTracked(
    npmExecPath ? process.execPath : "npx",
    npmExecPath
      ? [
          npmExecPath,
          "exec",
          "--",
          "wrangler",
          "dev",
          "--config",
          `${outDir}/server/wrangler.json`,
          "--ip",
          "127.0.0.1",
          "--port",
          String(port),
          "--local",
          // THE LAUNCH GATE IS REAL, AND IT IS WHY THIS FLAG IS HERE.
          //
          // The first run of this harness came back with every public path
          // serving the pre-launch holding page, because launch is still in the
          // future and the worker gate does exactly what it was built to do.
          // That is the product being correct, not the harness being broken --
          // and `OCADE_LAUNCH_PREVIEW` is the switch the gate already provides
          // for looking at the app before the window opens. Wrangler does not
          // pass the shell environment through to the worker, so it is given
          // here, explicitly, for this harness only.
          "--var",
          "OCADE_LAUNCH_PREVIEW:true",
          // The worker reads Supabase from its own bindings, not from the
          // shell. The VITE_* pair is inlined at build time and the server pair
          // is not, which is why the first run of this harness came back with
          // "Missing Supabase environment variable(s)" from inside workerd.
          "--var",
          `SUPABASE_URL:${supabase.url}`,
          "--var",
          "SUPABASE_PUBLISHABLE_KEY:sb_publishable_ocade_local_audit_key",
        ]
      : [
          "wrangler",
          "dev",
          "--config",
          `${outDir}/server/wrangler.json`,
          "--ip",
          "127.0.0.1",
          "--port",
          String(port),
          "--local",
          "--var",
          "OCADE_LAUNCH_PREVIEW:true",
          // The worker reads Supabase from its own bindings, not from the
          // shell. The VITE_* pair is inlined at build time and the server pair
          // is not, which is why the first run of this harness came back with
          // "Missing Supabase environment variable(s)" from inside workerd.
          "--var",
          `SUPABASE_URL:${supabase.url}`,
          "--var",
          "SUPABASE_PUBLISHABLE_KEY:sb_publishable_ocade_local_audit_key",
        ],
    env,
  );
  server.stderr.on("data", (d) => process.stderr.write(String(d)));
  server.on("exit", (code) => {
    if (stopping) return;
    serverDied = true;
    console.error(`\nTHE WORKER EXITED (code ${code}) — failures after this are not the product.`);
  });

  let ready = false;
  for (let i = 0; i < 90 && !ready; i += 1) {
    await sleep(1000);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(3000) });
      ready = response.ok;
    } catch {
      /* not up yet */
    }
  }
  if (!ready) {
    stopAll();
    await supabase.close?.();
    throw new Error(`the worker never answered on ${base}`);
  }
  console.log(`worker serving on ${base}\n`);

  return {
    base,
    env,
    get serverDied() {
      return serverDied;
    },
    async stop() {
      stopAll();
      await supabase.close?.();
    },
    run(label, args, extraEnv = {}) {
      return new Promise((resolve) => {
        console.log(`\n===== ${label} =====`);
        const child = spawnTracked(process.execPath, args, {
          ...env,
          OCADE_BASE_URL: base,
          ...extraEnv,
        });
        child.stdout.on("data", (d) => process.stdout.write(String(d)));
        child.stderr.on("data", (d) => process.stderr.write(String(d)));
        child.on("exit", (code) => resolve(code ?? 1));
      });
    },
  };
}
