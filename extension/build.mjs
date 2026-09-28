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
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const here = path.dirname(fileURLToPath(import.meta.url));
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
  writeFileSync(zip, zipOf(out));
  process.stdout.write(`${zip}\n`);
}
process.stdout.write(`Built the OCADE JARVIS extension for ${server} in ${out}\n`);

/** A deterministic ZIP of a folder: sorted entries, fixed timestamps, no platform tool. */
function zipOf(dir) {
  const files = (function walk(at) {
    return readdirSync(at, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((e) => (e.isDirectory() ? walk(path.join(at, e.name)) : [path.join(at, e.name)]));
  })(dir);
  const locals = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(path.relative(dir, file).split(path.sep).join("/"));
    const data = readFileSync(file);
    const packed = deflateRawSync(data, { level: 9 });
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(0x0021, 12); // 1980-01-01, a fixed date
    head.writeUInt32LE(crc32(data), 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    head.copy(entry, 8, 6, 30);
    entry.writeUInt32LE(offset, 42);
    locals.push(head, name, packed);
    central.push(entry, name);
    offset += head.length + name.length + packed.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}
