#!/usr/bin/env node
/** Build the managed Playwright host as a self-contained Tauri sidecar. */
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, ".browser-sidecar");
const stagedPackage = join(stage, "playwright-core");
const bundled = join(stagedPackage, "lib", "browser-host.cjs");
const pkgConfig = join(stage, "pkg.config.json");
const binaries = join(root, "native", "companion", "tauri", "binaries");
const extension = process.platform === "win32" ? ".exe" : "";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    throw new Error(`${command} failed with exit ${result.status}.${detail ? `\n${detail}` : ""}`);
  }
  return options.capture ? String(result.stdout).trim() : "";
}

function hostTriple() {
  const configured = process.env.OCADE_SIDECAR_TRIPLE?.trim();
  if (configured) return configured;
  return run("rustc", ["--print", "host-tuple"], { capture: true });
}

function pkgTarget() {
  const configured = process.env.OCADE_PKG_TARGET?.trim();
  if (configured) return configured;
  const os =
    process.platform === "win32" ? "win" : process.platform === "darwin" ? "macos" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `node22-${os}-${arch}`;
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
mkdirSync(binaries, { recursive: true });
mkdirSync(join(stagedPackage, "lib", "server", "chromium"), { recursive: true });

copyFileSync(
  join(root, "node_modules", "playwright-core", "package.json"),
  join(stagedPackage, "package.json"),
);
copyFileSync(
  join(root, "node_modules", "playwright-core", "browsers.json"),
  join(stagedPackage, "browsers.json"),
);
copyFileSync(
  join(root, "node_modules", "playwright-core", "lib", "webp_codec.wasm"),
  join(stagedPackage, "lib", "webp_codec.wasm"),
);
copyFileSync(
  join(root, "node_modules", "playwright-core", "lib", "server", "chromium", "appIcon.png"),
  join(stagedPackage, "lib", "server", "chromium", "appIcon.png"),
);
writeFileSync(
  pkgConfig,
  JSON.stringify({
    pkg: {
      assets: [
        "playwright-core/package.json",
        "playwright-core/browsers.json",
        "playwright-core/lib/webp_codec.wasm",
        "playwright-core/lib/server/chromium/appIcon.png",
      ],
    },
  }),
);

await build({
  entryPoints: [join(root, "native", "browser-host", "index.mjs")],
  outfile: bundled,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  plugins: [
    {
      name: "disable-unused-node-inspector",
      setup(context) {
        context.onResolve({ filter: /^(node:)?inspector$/ }, () => ({
          path: "ocade-inspector-shim",
          namespace: "ocade",
        }));
        context.onLoad({ filter: /.*/, namespace: "ocade" }, () => ({
          contents:
            "module.exports = { url: () => undefined, Session: class { constructor() { throw new Error('Inspector debugging is disabled in the OCADE browser host.'); } } };",
          loader: "js",
        }));
      },
    },
  ],
  sourcemap: false,
  legalComments: "none",
});

const triple = hostTriple();
if (!/^[a-z0-9_.-]+$/i.test(triple)) throw new Error("Rust returned an invalid host triple.");
const output = join(binaries, `ocade-browser-host-${triple}${extension}`);
const pkg = join(root, "node_modules", "@yao-pkg", "pkg", "lib-es5", "bin.js");
const pkgArgs = [
  pkg,
  "--config",
  pkgConfig,
  "--targets",
  pkgTarget(),
  "--output",
  output,
  "--fallback-to-source",
  bundled,
];
const compression = process.env.OCADE_SIDECAR_COMPRESSION?.trim();
if (compression) pkgArgs.splice(pkgArgs.length - 1, 0, "--compress", compression);
run(process.execPath, pkgArgs);
if (process.platform !== "win32") chmodSync(output, 0o755);

const selfTest = run(output, ["--self-test"], { capture: true });
const parsed = JSON.parse(selfTest);
if (parsed.protocolVersion !== 1 || parsed.playwright !== true) {
  throw new Error("The compiled browser sidecar failed its protocol self-test.");
}
process.stdout.write(
  `${JSON.stringify({ output, triple, target: pkgTarget(), selfTest: parsed })}\n`,
);
