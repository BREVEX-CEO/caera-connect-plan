import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

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

for (const path of [
  "wrangler.json",
  "release/OCADE_RELEASE_BLOCKERS.json",
  "release/OCADE_RELEASE_CHECKLIST.md",
  "src/lib/release-health.ts",
  "extension/manifest.json",
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
const extension = json("extension/manifest.json");
const tauri = json("native/companion/tauri/tauri.conf.json");
const wrangler = json("wrangler.json");
const blockers = json("release/OCADE_RELEASE_BLOCKERS.json");
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
check(extension.version === version, "extension version differs from web");
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
check(wrangler.vars === undefined, "Cloudflare values must not be committed in source config");
check(
  Array.isArray(wrangler.compatibility_flags) &&
    wrangler.compatibility_flags.includes("nodejs_compat"),
  "Cloudflare node compatibility is missing",
);

check(tauri.plugins?.updater?.active === false, "unsigned desktop updater is active");
check(
  tauri.plugins?.updater?.pubkey === "REPLACE_WITH_SIGNING_PUBLIC_KEY",
  "desktop updater placeholder boundary changed unexpectedly",
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

const secretShape =
  /AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/;
check(!secretShape.test(JSON.stringify(wrangler)), "secret-shaped value in wrangler config");
check(!secretShape.test(JSON.stringify(blockers)), "secret-shaped value in blocker ledger");

const generatedPath = resolve(root, ".output/server/wrangler.json");
check(existsSync(generatedPath), "production output is missing; run npm run build first");
if (existsSync(generatedPath)) {
  const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
  check(generated.name === wrangler.name, "generated worker name differs from source config");
  check(generated.main === "index.mjs", "generated worker entry is unexpected");
  check(generated.assets?.binding === "ASSETS", "generated static-asset binding is missing");
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
