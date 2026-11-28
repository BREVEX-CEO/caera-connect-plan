/**
 * KEY-06 / KEY-08 / KEY-12: secret scan of Git history and of binary artifacts.
 *
 *   node scripts/scan-repo-secrets.mjs history [rev-range=--all]
 *     Scans every added line of every commit (old revisions included).
 *   node scripts/scan-repo-secrets.mjs artifacts <dir...>
 *     Scans raw bytes of images, video, PDFs, archives and logs (PNG text
 *     chunks, EXIF, embedded strings) for secret-shaped strings.
 *
 * Values are never printed. Known harmless fixtures live in
 * scripts/lib/secret-allowlist.json as `{ "file": "...", "kind": "..." }`.
 * Exit 0 clean, 1 findings, 2 nothing scanned.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SECRET_SHAPES } from "./lib/secret-shapes.mjs";

const allowFile = fileURLToPath(new URL("./lib/secret-allowlist.json", import.meta.url));
const allow = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, "utf8")) : [];
const allowed = (file, kind) =>
  allow.some(
    (a) =>
      (a.file === file || (a.prefix && file.replace(/^[0-9a-f]+:/, "").startsWith(a.prefix))) &&
      (!a.kind || a.kind === kind),
  );

export function scanText(text, file) {
  const found = [];
  for (const shape of SECRET_SHAPES) {
    for (const match of text.matchAll(shape.test())) {
      if (shape.verify && !shape.verify(match[0])) continue;
      if (allowed(file, shape.name)) continue;
      found.push({
        file,
        kind: shape.name,
        hint: `${match[0].slice(0, 6)}… (${match[0].length} chars)`,
      });
    }
  }
  return found;
}

const mode = process.argv[2];
const findings = [];
let scanned = 0;

async function history(range) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      [
        "log",
        ...(range === "--all" ? ["--all"] : [range]),
        "-p",
        "--no-color",
        "--no-ext-diff",
        "--format=commit %H",
      ],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let commit = "";
    let file = "";
    let tail = "";
    child.stdout.setEncoding("latin1");
    child.stdout.on("data", (chunk) => {
      const lines = (tail + chunk).split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("commit ")) {
          commit = line.slice(7, 19);
          scanned += 1;
        } else if (line.startsWith("+++ b/")) file = line.slice(6);
        else if (line.startsWith("+") && !line.startsWith("+++")) {
          for (const f of scanText(line, file)) findings.push({ ...f, file: `${commit}:${file}` });
        }
      }
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`git log exit ${code}`)),
    );
  });
}

const ARTIFACT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".webm",
  ".mov",
  ".pdf",
  ".zip",
  ".log",
  ".txt",
  ".json",
  ".har",
  ".md",
]);
function artifacts(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) artifacts(full);
    else if (ARTIFACT.has(extname(entry).toLowerCase()) && info.size < 200 * 1024 * 1024) {
      scanned += 1;
      findings.push(...scanText(readFileSync(full).toString("latin1"), full.replaceAll("\\", "/")));
    }
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("scan-repo-secrets.mjs")
) {
  if (mode === "history") await history(process.argv[3] ?? "--all");
  else if (mode === "artifacts" && process.argv.length > 3)
    for (const d of process.argv.slice(3)) artifacts(d);
  else {
    console.error("usage: scan-repo-secrets.mjs history [range] | artifacts <dir...>");
    process.exit(2);
  }
  console.log(`scanned ${scanned} ${mode === "history" ? "commits" : "files"}`);
  if (scanned === 0) {
    console.error("nothing scanned; refusing to report a clean scan");
    process.exit(2);
  }
  if (findings.length === 0) {
    console.log("no secret-shaped strings found");
    process.exit(0);
  }
  console.error(`${findings.length} finding(s):`);
  for (const f of findings) console.error(`  ${f.kind}\n    ${f.file}\n    ${f.hint}`);
  process.exit(1);
}
