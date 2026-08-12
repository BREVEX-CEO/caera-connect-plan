import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "release/OCADE_WORKTREE_OWNERSHIP.json");

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function names(args) {
  return git(args.concat("-z"))
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

const staged = new Set(names(["diff", "--cached", "--name-only"]));
const unstaged = new Set(names(["diff", "--name-only"]));
const untracked = new Set(names(["ls-files", "--others", "--exclude-standard"]));
const paths = [...new Set([...staged, ...unstaged, ...untracked])].sort();

const verifiedExact = new Set([
  "native/companion/tauri/src/browser_host.rs",
  "scripts/browser-cdp-parity.mjs",
  "scripts/build-browser-sidecar.mjs",
  "scripts/build-windows-installer.mjs",
  "scripts/check-browser-safety.mjs",
  "scripts/mutation-safety.mjs",
  "src/lib/native/browser-dom.ts",
  "src/lib/native/cdp-browser-bridge.ts",
]);

const unrelated = [
  /^src\/(components|lib|routes)\/.*(?:cania|ficia|madee)/i,
  /^src\/components\/landing\//,
  /^src\/components\/motion\//,
  /^src\/lib\/(?:landing|motion|payments)\//,
  /^src\/routes\/demo\.(?:cania|ficia|files|madee|tasks)\.tsx$/,
];

const generated = [/(?:^|\/)target\//, /^src\/routeTree\.gen\.ts$/, /^package-lock\.json$/];

const ocadeScoped = [
  /^extension\//,
  /^native\//,
  /^mobile\//,
  /^android\//,
  /^ios\//,
  /^release\/OCADE_/,
  /^docs\/.*(?:ocade|control|desktop|evidence)/i,
  /^supabase\//,
  /^src\/components\/ocade\//,
  /^src\/lib\/(?:attachments|brain|chat|control|edge|engine|local|mobile|native|offline|provenance|retrieval|skills|storage|voice|work)\//,
  /^src\/routes\/(?:api\/ocade|_authenticated\/ocade)/,
  /^scripts\/.*(?:browser|evidence|ocade|readiness|release|stage2|supabase|mutation|hardware|engine|licen|setup|control)/i,
];

function classification(path) {
  if (verifiedExact.has(path) || path.startsWith("native/browser-host/")) {
    return {
      owner: "verified-ocade-pass",
      disposition: "candidate-for-path-scoped-transplant",
      reason: "created by the verified extensionless browser and companion pass",
    };
  }
  if (generated.some((re) => re.test(path))) {
    return {
      owner: "generated-or-lockfile",
      disposition: "regenerate-or-review-separately",
      reason: "generated output or dependency lockfile can contain changes from multiple features",
    };
  }
  if (unrelated.some((re) => re.test(path))) {
    return {
      owner: "unrelated-product-area",
      disposition: "preserve-exclude-from-ocade-commit",
      reason: "belongs to Cania, Ficia, Madee, landing, motion, payments, or unrelated demo work",
    };
  }
  if (ocadeScoped.some((re) => re.test(path))) {
    return {
      owner: "ocade-related-overlap",
      disposition: "content-review-required-before-transplant",
      reason:
        "OCADE-related path contains verified work and/or pre-existing changes that cannot be separated by pathname alone",
    };
  }
  return {
    owner: "shared-or-unknown",
    disposition: "preserve-manual-review-required",
    reason:
      "shared configuration, UI, route, or documentation path with no reliable authorship boundary",
  };
}

function fileEvidence(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return { exists: false, bytes: 0, sha256: null };
  const stats = statSync(absolute);
  if (!stats.isFile()) return { exists: true, bytes: 0, sha256: null };
  const content = readFileSync(absolute);
  return {
    exists: true,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

const files = paths.map((path) => ({
  path,
  index: staged.has(path),
  worktree: unstaged.has(path),
  untracked: untracked.has(path),
  ...classification(path),
  ...fileEvidence(path),
}));

const counts = files.reduce((result, file) => {
  result[file.owner] = (result[file.owner] ?? 0) + 1;
  return result;
}, {});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  branch: git(["branch", "--show-current"]).trim(),
  head: git(["rev-parse", "HEAD"]).trim(),
  upstream: git(["rev-parse", "@{upstream}"]).trim(),
  totals: {
    paths: files.length,
    staged: files.filter((file) => file.index).length,
    unstaged: files.filter((file) => file.worktree).length,
    untracked: files.filter((file) => file.untracked).length,
  },
  countsByOwner: counts,
  safetyDecision: files.some(
    (file) => file.owner === "unrelated-product-area" || file.owner === "shared-or-unknown",
  )
    ? "DO_NOT_COMMIT_WHOLE_TREE"
    : "PATH_SCOPED_REVIEW_STILL_REQUIRED",
  files,
};

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    { outputPath, ...report.totals, counts, safetyDecision: report.safetyDecision },
    null,
    2,
  ),
);
