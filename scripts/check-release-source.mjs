import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

const root = process.cwd();
const failures = [];
let checks = 0;

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

const UPDATER_KEY_PLACEHOLDER = "REPLACE_WITH_SIGNING_PUBLIC_KEY";

/**
 * A minisign public key, as Tauri stores it, is base64 of two lines: an
 * "untrusted comment" and a key line beginning `RW`. Anything else — blank, a
 * truncated paste, or the SECRET key (whose comment says "minisign secret
 * key") — must fail.
 */
function isPlaceholderOrMinisignPublicKey(value) {
  if (value === UPDATER_KEY_PLACEHOLDER) return true;
  if (typeof value !== "string" || value.length === 0) return false;
  let decoded;
  try {
    decoded = Buffer.from(value, "base64").toString("utf8");
  } catch {
    return false;
  }
  if (/minisign secret key/i.test(decoded)) return false;
  return /minisign public key/i.test(decoded) && /^RW\S{20,}$/m.test(decoded);
}

/**
 * The public half being well-formed only matters if the private half is not
 * sitting next to it. Scans TRACKED files, so an untracked local key the
 * developer keeps outside git is correctly ignored.
 *
 * Matches the minisign key-file HEADER rather than the phrase naming it, so
 * that source and tests which merely DISCUSS signing keys are not reported as
 * leaked ones. This file is excluded from its own scan for the same reason —
 * it necessarily contains the pattern it looks for.
 *
 * Limit, stated rather than glossed: a secret key pasted in some other
 * encoding would evade this. The tauri `pubkey` field is separately decoded
 * and rejected if it turns out to be a secret key, which is the one field a
 * key is realistically pasted into by mistake.
 */
function committedMinisignSecretKey() {
  const header = ["untrusted", "comment:.*secret", "key"].join(" ");
  try {
    const hits = execFileSync(
      "git",
      ["grep", "-lIE", header, "--", ".", ":!scripts/check-release-source.mjs"],
      { cwd: root, encoding: "utf8" },
    );
    return hits.trim().length > 0;
  } catch (error) {
    // git grep exits 1 with no output when nothing matches — that is the clean
    // case. Any other failure means the check did not run, and an unrun check
    // is never reported as a passing one.
    if (error && error.status === 1 && !String(error.stdout ?? "").trim()) return false;
    failures.push("minisign secret-key scan could not run, so it is not counted as passed");
    return false;
  }
}

for (const path of [
  "wrangler.json",
  "release/OCADE_RELEASE_BLOCKERS.json",
  "release/OCADE_RELEASE_CHECKLIST.md",
  "release/OCADE_PRODUCTION_OPERATIONS.json",
  "release/OCADE_INCIDENT_RESPONSE_RUNBOOK.md",
  "src/lib/release-health.ts",
  "native/browser-host/index.mjs",
  "native/companion/tauri/tauri.conf.json",
  "native/companion/tauri/tauri.windows.conf.json",
  "native/companion/tauri/tauri.macos.conf.json",
  "native/companion/tauri/tauri.linux.conf.json",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "ios/App/App/Info.plist",
  "ios/App/App.xcodeproj/project.pbxproj",
  "mobile/www/index.html",
]) {
  check(existsSync(resolve(root, path)), `required source is missing: ${path}`);
}

const pkg = json("package.json");
const lock = json("package-lock.json");
const tauri = json("native/companion/tauri/tauri.conf.json");
const wrangler = json("wrangler.json");
/**
 * The blocker ledger, overridable for the enforcement tests.
 *
 * WHY THE OVERRIDE EXISTS. The tests that prove this gate REJECTS an overstated
 * ledger used to corrupt the real file and restore it afterwards. Vitest runs
 * files in parallel, so `release-package.test.ts` — which reads the same
 * ledger — could observe a deliberately corrupted version mid-flight and fail
 * for reasons that had nothing to do with it. That presented as an
 * intermittent Windows flake for a long time; it was a shared-mutable-state
 * race between test files.
 *
 * Pointing the gate at a temporary copy removes the race entirely, and also
 * removes the hazard the old approach carried: the ledger is untracked, so a
 * crash between corrupt and restore had no git recovery path.
 *
 * An override is normally an ABSOLUTE temp path, so it is used as given rather
 * than resolved against the repository root.
 */
const blockersPath = process.env.OCADE_RELEASE_BLOCKERS ?? "release/OCADE_RELEASE_BLOCKERS.json";
const blockers = JSON.parse(
  readFileSync(isAbsolute(blockersPath) ? blockersPath : resolve(root, blockersPath), "utf8"),
);
const operations = json("release/OCADE_PRODUCTION_OPERATIONS.json");
const android = read("android/app/build.gradle");
const androidManifest = read("android/app/src/main/AndroidManifest.xml");
const iosProject = read("ios/App/App.xcodeproj/project.pbxproj");
const health = read("src/lib/release-health.ts");
const capability = json("native/companion/tauri/capabilities/default.json");

const version = pkg.version;
check(pkg.name === "caera-cadane-ocade", "package name is not release-stable");
check(version === "0.1.0", "unexpected release version");
check(
  pkg.dependencies?.["@capacitor/cli"] === undefined &&
    pkg.devDependencies?.["@capacitor/cli"] === "^8.4.2",
  "Capacitor CLI must remain build-only",
);
check(
  lock.packages?.[""]?.dependencies?.["@capacitor/cli"] === undefined &&
    lock.packages?.[""]?.devDependencies?.["@capacitor/cli"] === "^8.4.2" &&
    lock.packages?.["node_modules/@capacitor/cli"]?.dev === true &&
    lock.packages?.["node_modules/glob/node_modules/brace-expansion"]?.dev === true,
  "lockfile classifies the Capacitor CLI toolchain as production",
);
check(tauri.version === version, "desktop version differs from web");
check(android.includes(`versionName "${version}"`), "Android version differs from web");
check(
  [...iosProject.matchAll(/MARKETING_VERSION = ([^;]+);/g)].every((match) => match[1] === version),
  "iOS version differs from web",
);
check(health.includes(`OCADE_RELEASE_VERSION = "${version}"`), "health version differs from web");

check(wrangler.name === "ocade-web", "Cloudflare worker name is not stable");
check(wrangler.keep_vars === true, "Cloudflare deploy could erase dashboard-managed values");
check(wrangler.observability?.enabled === true, "Cloudflare observability is not enabled");
check(
  wrangler.assets?.run_worker_first === true,
  "Cloudflare assets can bypass the production launch gate",
);
check(wrangler.vars === undefined, "Cloudflare values must not be committed in source config");
check(
  Array.isArray(wrangler.compatibility_flags) &&
    wrangler.compatibility_flags.includes("nodejs_compat"),
  "Cloudflare node compatibility is missing",
);

check(tauri.plugins?.updater?.active === false, "unsigned desktop updater is active");
/*
 * The updater key used to be asserted as the literal placeholder string. That
 * proxy broke the moment a real signing key was generated (N1/N2), even though
 * the property it stands for — no unsigned updater can ship — was never
 * violated. The subject is the key's SHAPE and the fact that only the PUBLIC
 * half is ever in the tree, so that is what is checked now:
 *   - still the placeholder, or a well-formed minisign public key; never blank,
 *     never a truncated paste;
 *   - the secret half is absent from the whole repository (checked below).
 * Combined with `active === false` and `createUpdaterArtifacts === false`, this
 * is a stronger boundary than string equality, not a relaxed one.
 */
check(
  isPlaceholderOrMinisignPublicKey(tauri.plugins?.updater?.pubkey),
  "desktop updater key is neither the placeholder nor a well-formed minisign public key",
);
check(
  !committedMinisignSecretKey(),
  "a minisign SECRET signing key is committed to the repository",
);
check(tauri.bundle?.createUpdaterArtifacts === false, "unsigned updater artifacts are enabled");
check(
  !capability.permissions.includes("updater:default"),
  "inactive updater remains callable by the overlay",
);
check(tauri.bundle?.windows?.certificateThumbprint === null, "placeholder Windows signer");
check(tauri.bundle?.macOS?.signingIdentity === null, "placeholder macOS signer");

check(android.includes("minifyEnabled true"), "Android release minification is disabled");
check(android.includes("shrinkResources true"), "Android release resource shrinking is disabled");
check(android.includes("debuggable false"), "Android release debugging is not explicitly disabled");
check(
  androidManifest.includes('android:usesCleartextTraffic="false"'),
  "Android cleartext traffic is enabled",
);
check(androidManifest.includes('android:allowBackup="false"'), "Android backup is enabled");

check(blockers.releaseVersion === version, "external-blocker ledger version differs");
check(blockers.status === "externally_blocked", "blocker ledger overstates release readiness");
check(
  Array.isArray(blockers.blockers) &&
    blockers.blockers.length >= 6 &&
    blockers.blockers.every(
      (item) =>
        item.status === "externally_blocked" &&
        Array.isArray(item.requiredEvidence) &&
        item.requiredEvidence.length > 0,
    ),
  "external-blocker ledger is incomplete",
);
check(
  operations.releaseVersion === version &&
    operations.classification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "production operations ledger overstates readiness or differs from the release version",
);
check(
  Object.values(operations.liveClaims ?? {}).every((claim) => claim === false),
  "production operations ledger contains an unverified live claim",
);
check(
  operations.releaseControls?.databaseApplyAuthorized === false &&
    operations.releaseControls?.separateDeployApprovalRequired === true &&
    operations.releaseControls?.separateRollbackApprovalRequired === true,
  "production operations approval boundaries are incomplete",
);

const secretShape =
  /AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/;
check(!secretShape.test(JSON.stringify(wrangler)), "secret-shaped value in wrangler config");
check(!secretShape.test(JSON.stringify(blockers)), "secret-shaped value in blocker ledger");
check(!secretShape.test(JSON.stringify(operations)), "secret-shaped value in operations ledger");

const generatedPath = resolve(root, ".output/server/wrangler.json");
check(existsSync(generatedPath), "production output is missing; run npm run build first");
if (existsSync(generatedPath)) {
  const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
  check(generated.name === wrangler.name, "generated worker name differs from source config");
  check(generated.main === "index.mjs", "generated worker entry is unexpected");
  check(generated.assets?.binding === "ASSETS", "generated static-asset binding is missing");
  check(
    generated.assets?.run_worker_first === true,
    "generated assets can bypass the production launch gate",
  );
  check(statSync(resolve(root, ".output/server/index.mjs")).size > 0, "worker entry is empty");
}

if (failures.length > 0) {
  console.error(`OCADE release source gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE release source gate: ${checks}/${checks} checks passed`);
console.log(
  `STATUS: SOURCE READY; PRODUCTION RELEASE EXTERNALLY BLOCKED (${blockers.blockers.length} areas)`,
);
console.log("No deployment, signing, publication, migration, or device install was performed.");
