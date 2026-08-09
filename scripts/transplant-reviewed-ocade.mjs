import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = process.argv[2] ? resolve(process.argv[2]) : null;
if (!destination)
  throw new Error("Usage: node scripts/transplant-reviewed-ocade.mjs <clean-worktree>");

const report = JSON.parse(
  readFileSync(resolve(source, "release/OCADE_WORKTREE_OWNERSHIP.json"), "utf8"),
);

const sharedExact = new Set([
  ".github/workflows/ci.yml",
  ".gitignore",
  "eslint.config.js",
  "native/companion/tauri/Cargo.toml",
  "native/companion/tauri/src/main.rs",
  "native/companion/tauri/tauri.conf.json",
  "package-lock.json",
  "package.json",
  "src/lib/features.ts",
  "src/lib/settings-sections.ts",
  "src/lib/shell-nav.ts",
  "src/lib/use-chat-prefs.ts",
  "src/routes/_authenticated/ocade.tsx",
  "src/routes/_authenticated/ocade.work.tsx",
  "src/routes/api/ocade.chat.ts",
  "vite.config.ts",
]);

const sharedPrefixes = [
  "src/components/ocade/",
  "src/components/settings/",
  "src/lib/__tests__/",
  "src/lib/ocade",
  "src/routes/_authenticated/settings.",
];

const selected = report.files.filter(
  (file) =>
    file.owner === "verified-ocade-pass" ||
    file.owner === "ocade-related-overlap" ||
    sharedExact.has(file.path) ||
    sharedPrefixes.some((prefix) => file.path.startsWith(prefix)),
);

const tracked = selected.filter((file) => !file.untracked).map((file) => file.path);
const untracked = selected.filter((file) => file.untracked && file.exists).map((file) => file.path);

if (tracked.length > 0) {
  const patch = execFileSync("git", ["diff", "--binary", "HEAD", "--", ...tracked], {
    cwd: source,
    maxBuffer: 128 * 1024 * 1024,
  });
  const applied = spawnSync("git", ["apply", "--whitespace=nowarn", "-"], {
    cwd: destination,
    input: patch,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (applied.status !== 0) {
    throw new Error(`git apply failed: ${applied.stderr || applied.stdout}`);
  }
}

for (const path of untracked) {
  const target = resolve(destination, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(source, path), target);
}

console.log(
  JSON.stringify(
    {
      destination,
      selected: selected.length,
      tracked: tracked.length,
      untracked: untracked.length,
      excluded: report.files.length - selected.length,
    },
    null,
    2,
  ),
);
