/**
 * BUILD THE PRODUCT AND SERVE IT, ONCE, FOR ANY SUITE THAT NEEDS A REAL SERVER.
 *
 * WHY THIS IS SHARED RATHER THAN COPIED. `run-route-qa.mjs` grew a careful
 * build-and-serve sequence — the node preset because the shipping Cloudflare
 * preset's preview cannot run here, the output moved aside so it cannot clobber
 * `.output` and make the NEXT gate fail with "production output is missing",
 * a stub Supabase whose URL has to exist at BUILD time because VITE_* values
 * are inlined, and a watch on the server process so one dead server does not
 * read as sixty-seven broken routes.
 *
 * Every one of those is a lesson someone had to learn from a confusing failure.
 * `offline-transitions.mjs` had none of them: it simply expected something to
 * already be listening on 127.0.0.1:8080, and when nothing was, it died with
 * ERR_CONNECTION_REFUSED — which reads, in a launch proof, as "OCADE does not
 * survive going offline". It was never run as part of a full sweep, so nobody
 * saw it. Copying the sequence would have meant two places to keep right.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { cp, rename, rm } from "node:fs/promises";
import { startStubSupabase } from "../fixtures/stub-supabase.mjs";

/**
 * @param {object} [options]
 * @param {number} [options.port]        Port to serve on.
 * @param {string} [options.outDir]      Where to move the build to.
 * @param {number} [options.supabasePort]
 */
export async function startServedBuild({
  port = 8099,
  outDir = ".output-e2e",
  supabasePort = 54321,
} = {}) {
  const base = `http://127.0.0.1:${port}`;
  const children = [];
  let stopping = false;
  let serverDied = false;

  const spawnTracked = (command, args, extraEnv = {}) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });
    children.push(child);
    return child;
  };

  const supabase = await startStubSupabase({ port: supabasePort });
  console.log(`stub supabase: ${supabase.url}`);

  /*
   * VITE_* values are inlined AT BUILD TIME, so the fixture URL has to be
   * present for the build and not merely for the server. Building without it
   * produces a bundle pointed at nothing, and every authenticated route then
   * fails for a reason that has nothing to do with the route.
   */
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
        child.kill("SIGTERM");
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

  /*
   * NODE PRESET FOR THE HARNESS BUILD, DELIBERATELY. The shipping build targets
   * cloudflare-module and previews through `wrangler dev`, which this sandbox
   * cannot reach. The node preset produces the SAME application from the same
   * source with a server this machine can run. Deployment is unchanged.
   */
  console.log("\n===== BUILD THE PRODUCT =====");
  const npmExecPath = process.env.npm_execpath;
  const buildCommand = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const buildArgs = npmExecPath ? [npmExecPath, "run", "build"] : ["run", "build"];
  const buildCode = await new Promise((resolve, reject) => {
    const child = spawnTracked(buildCommand, buildArgs, {
      ...env,
      NITRO_PRESET: "node-server",
    });
    child.stdout.on("data", (d) => process.stdout.write(String(d)));
    child.stderr.on("data", (d) => process.stderr.write(String(d)));
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
  if (buildCode !== 0) {
    stopAll();
    await supabase.close?.();
    throw new Error("the build failed, so there is nothing to test");
  }

  /*
   * Move it aside rather than serve it from `.output`. The build writes there
   * and does not honour an override, so leaving it would leave the repository
   * holding a node-server bundle where the Cloudflare one belongs — and
   * `release:source-check`, which looks for .output/server/wrangler.json, then
   * fails with "production output is missing". A harness that breaks the gate
   * after it gets blamed for a defect it invented.
   */
  await rm(outDir, { recursive: true, force: true });
  try {
    await rename(".output", outDir);
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "EPERM") throw error;
    // Antivirus and file indexers can briefly hold the generated directory on
    // Windows, making an otherwise valid same-volume rename fail. Copying the
    // finished build and then removing only that generated source is reliable.
    await cp(".output", outDir, { recursive: true });
    await rm(".output", { recursive: true, force: true });
  }

  const server = spawnTracked(process.execPath, [`${outDir}/server/index.mjs`], {
    ...env,
    PORT: String(port),
    HOST: "127.0.0.1",
  });
  server.stderr.on("data", (d) => process.stderr.write(String(d)));
  server.on("exit", (code) => {
    if (stopping) return;
    serverDied = true;
    console.error(`\nTHE SERVER EXITED (code ${code}) — failures after this are not the product.`);
  });

  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    await sleep(1000);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(2000) });
      ready = response.ok;
    } catch {
      /* not up yet */
    }
  }
  if (!ready) {
    stopAll();
    await supabase.close?.();
    throw new Error(`the built app never answered on ${base}`);
  }
  console.log(`built app serving on ${base}\n`);

  return {
    base,
    env,
    spawnTracked,
    /** True if the server fell over on its own — one broken server, not N broken pages. */
    get serverDied() {
      return serverDied;
    },
    async stop() {
      stopAll();
      await supabase.close?.();
    },
    /** Run a script against the served build, returning its exit code. */
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
