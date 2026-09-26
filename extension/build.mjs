#!/usr/bin/env node
/**
 * Build the OCADE JARVIS extension for one OCADE server.
 *
 *   node extension/build.mjs                         # https://ocade.in -> dist/extension
 *   node extension/build.mjs --server http://127.0.0.1:8788 --out /tmp/ext
 *   node extension/build.mjs --zip                   # also dist/ocade-jarvis-extension.zip (store upload)
 *
 * The page semantics (ocade_page.js) and the protocol (ocade_protocol.json) are
 * copied from jarvis-runtime, so the extension and the Device Agent can never
 * drift apart. The only host permission is the one OCADE server.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..");
const server = new URL(arg("server", "https://ocade.in")).origin;
const out = path.resolve(arg("out", path.join(root, "dist", "extension")));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of ["background.js", "popup.html", "popup.js", "icons"]) {
  cpSync(path.join(here, file), path.join(out, file), { recursive: true });
}
cpSync(path.join(root, "jarvis-runtime/actions/ocade_page.js"), path.join(out, "ocade_page.js"));
const contract = readFileSync(path.join(root, "jarvis-runtime/ocade_protocol.json"), "utf8");
writeFileSync(path.join(out, "ocade_protocol.js"), `export default ${contract.trim()};\n`);
writeFileSync(path.join(out, "config.js"), `export const SERVER = ${JSON.stringify(server)};\n`);
const manifest = JSON.parse(readFileSync(path.join(here, "manifest.json"), "utf8"));
manifest.host_permissions = [`${server}/*`];
writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
if (process.argv.includes("--zip")) {
  const zip = path.join(path.dirname(out), "ocade-jarvis-extension.zip");
  rmSync(zip, { force: true });
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  process.stdout.write(`${zip}\n`);
}
process.stdout.write(`Built the OCADE JARVIS extension for ${server} in ${out}\n`);
