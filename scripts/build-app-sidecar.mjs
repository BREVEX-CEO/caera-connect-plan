#!/usr/bin/env node
/**
 * Package the OCADE application server as a Tauri sidecar.
 *
 * WHY A SIDECAR AND NOT STATIC FILES
 * ----------------------------------
 * OCADE has fourteen server functions and every one of them runs behind
 * `requireSupabaseAuth`. Chat persistence, projects, files, automations and the
 * agent entry point all live there. Flattening the app into static assets so
 * Tauri could serve it from disk would mean deleting authentication, so the
 * shell ships the real server instead and points its window at loopback.
 *
 * This mirrors `build-browser-sidecar.mjs` deliberately: same staging
 * directory, same `@yao-pkg/pkg` step, same target-suffixed filename that
 * `externalBin` expects. A second packaging strategy would be a second set of
 * platform bugs.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".output");
const binaries = join(root, "native", "companion", "tauri", "binaries");
const extension = process.platform === "win32" ? ".exe" : "";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    ...(options.env ? { env: options.env } : {}),
  });
  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() : "";
    throw new Error(`${command} failed with exit ${result.status}.${detail ? `\n${detail}` : ""}`);
  }
  return options.capture ? String(result.stdout).trim() : "";
}

/**
 * The Rust triple Tauri appends to an `externalBin` name.
 *
 * Read from rustc rather than guessed: a mismatched suffix produces a bundle
 * that builds cleanly and then cannot find its own sidecar at runtime, which is
 * the least debuggable failure in this whole pipeline.
 */
function targetTriple() {
  return run("rustc", ["--print", "host-tuple"], { capture: true });
}

/** The pkg runtime target, matching the browser sidecar's own resolution. */
function pkgTarget() {
  const configured = process.env.OCADE_PKG_TARGET?.trim();
  if (configured) return configured;
  const os =
    process.platform === "win32" ? "win" : process.platform === "darwin" ? "macos" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `node22-${os}-${arch}`;
}

// 1. Build the application. Nitro emits `.output/server/index.mjs` plus its
//    chunk graph; pkg cannot follow that, so the whole tree is staged.
/*
 * BUILT WITH THE NODE-SERVER PRESET, not the project default.
 *
 * The web deployment targets Cloudflare, so an ordinary `vite build` emits a
 * Worker module: `.output/server/index.mjs` exports a fetch handler and starts
 * no listener. Packaged as-is it produced a sidecar that launched, loaded, and
 * exited silently with no error and no open port — the hardest possible failure
 * to read. The desktop shell needs a real HTTP server, so it asks for one.
 */
if (!process.argv.includes("--skip-build")) {
  run(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build"], {
    env: { ...process.env, NITRO_PRESET: "node-server", SERVER_PRESET: "node-server" },
  });
}
if (!existsSync(join(output, "server", "index.mjs"))) {
  throw new Error("No built application server was found at .output/server/index.mjs.");
}

/*
 * SHIPPED AS NODE PLUS A RESOURCE TREE, NOT AS A pkg SNAPSHOT.
 *
 * Two packaging attempts failed for the same underlying reason: Nitro's server
 * is genuinely ESM and depends on `import.meta`. pkg rewrote it to CommonJS and
 * the packaged server died instantly with a missing dynamic-import callback;
 * pre-flattening with esbuild to CommonJS then emptied `import.meta.url`, which
 * Nitro uses to locate its own runtime.
 *
 * So the runtime is shipped as itself. The "sidecar binary" is a copy of the
 * Node executable under the name `externalBin` expects, and the built server is
 * bundled beside it as a Tauri resource. ESM keeps working because nothing
 * transformed it, and the user still installs nothing — Node travels inside the
 * installer rather than being a prerequisite.
 */
const resources = join(root, "native", "companion", "tauri", "resources", "app-host");
rmSync(resources, { recursive: true, force: true });
mkdirSync(resources, { recursive: true });
cpSync(output, resources, { recursive: true });

mkdirSync(binaries, { recursive: true });
const triple = targetTriple();
const destination = join(binaries, `ocade-app-host-${triple}${extension}`);
copyFileSync(process.execPath, destination);

process.stdout.write(
  `${JSON.stringify({
    sidecar: destination,
    resources,
    entry: "app-host/server/index.mjs",
    triple,
    node: process.version,
  })}
`,
);
