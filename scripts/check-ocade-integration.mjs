import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

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

/**
 * The ledger path is overridable so the gate's own enforcement tests can point
 * it at a throwaway copy. They previously corrupted the real tracked ledger and
 * restored it afterwards, which raced with any other test running this gate in
 * parallel — and would have left the repository file damaged had a run died
 * mid-test.
 */
const audit = json(process.env.OCADE_AUDIT_LEDGER ?? "release/OCADE_INTEGRATION_AUDIT.json");
const routeTree = read("src/routeTree.gen.ts");
const navigation = read("src/lib/shell-nav.ts");
const companionMain = read("native/companion/tauri/src/main.rs");
const companionUi = read("native/companion/ui/overlay.js");
const companionAdapter = read("src/lib/native/tauri-companion.ts");
const extensionProtocol = read("src/lib/native/extension-protocol.ts");
const extensionBackground = read("extension/background.js");
const mobileShell = read("mobile/www/index.html");
const applyOrder = read("supabase/APPLY_ORDER.md");

check(audit.schemaVersion === 1 && audit.phase === 19, "integration audit schema/phase");
check(
  audit.status === "partial_stage_2_pending",
  "integration audit must not claim full runtime completion",
);
for (const surface of [
  "routes",
  "controls",
  "server_functions",
  "native_commands",
  "mobile_intents",
  "extension_messages",
  "migrations",
  "adapters",
  "artifacts",
  "permissions",
  "receipts",
  "tests",
  "recovery",
  "assets",
  "secrets",
]) {
  check(audit.auditedSurfaces.includes(surface), `audit surface omitted: ${surface}`);
}

const routeTargets = audit.activeOcadeRoutes;
check(new Set(routeTargets).size === routeTargets.length, "duplicate active OCADE route");
for (const route of routeTargets) {
  check(routeTree.includes(`'${route}'`), `active route is missing from route tree: ${route}`);
  check(navigation.includes(`to: "${route}"`), `active route is missing from navigation: ${route}`);
}

for (const sourcePath of [
  "src/routes/_authenticated/ocade.tsx",
  "src/routes/_authenticated/ocade.work.tsx",
  "src/routes/_authenticated/ocade.code.tsx",
  "src/routes/_authenticated/ocade.projects.tsx",
  "src/routes/_authenticated/ocade.artifacts.tsx",
  "src/routes/_authenticated/ocade.monitors.tsx",
  "src/routes/_authenticated/ocade.automations.tsx",
  "src/routes/_authenticated/ocade.studio.tsx",
  "src/components/ocade/CopilotPanel.tsx",
  "src/components/ocade/CodeWorkspacePanel.tsx",
]) {
  const source = read(sourcePath);
  check(!/href\s*=\s*["']#["']/.test(source), `dead # link: ${sourcePath}`);
  check(
    !/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(source),
    `empty click handler: ${sourcePath}`,
  );
}

const nativeCommands = [
  "open_session",
  "close_session",
  "status",
  "get_allowlist",
  "set_allowlist",
  "execute",
  "observe",
  "cancel",
  "emergency_stop",
  "reset_emergency_stop",
  "audit_log",
];
for (const command of nativeCommands) {
  check(
    new RegExp(`#\\[tauri::command\\][\\s\\S]{0,240}?fn\\s+${command}\\b`).test(companionMain),
    `Tauri command is not declared: ${command}`,
  );
  check(
    new RegExp(`generate_handler!\\[[\\s\\S]*?\\b${command}\\b[\\s\\S]*?\\]`).test(companionMain),
    `Tauri command is not registered: ${command}`,
  );
}
for (const command of [
  "open_session",
  "status",
  "audit_log",
  "emergency_stop",
  "reset_emergency_stop",
  "cancel",
]) {
  check(companionUi.includes(`invoke("${command}"`), `overlay command is not callable: ${command}`);
}
for (const command of [
  "open_session",
  "close_session",
  "status",
  "get_allowlist",
  "set_allowlist",
  "execute",
  "observe",
  "cancel",
  "emergency_stop",
  "reset_emergency_stop",
  "audit_log",
]) {
  check(
    companionAdapter.includes(`"${command}"`),
    `web companion adapter does not reference host command: ${command}`,
  );
}

const extensionMessages = [
  "connect",
  "tabs.list",
  "tab.activate",
  "page.summary",
  "page.a11y",
  "page.screenshot",
  "page.navigate",
  "page.verify",
  "form.fill",
  "form.submit",
  "file.download",
  "file.upload",
  "run.cancel",
  "emergency.stop",
];
for (const kind of extensionMessages) {
  check(extensionProtocol.includes(`"${kind}"`), `extension protocol omits: ${kind}`);
  check(extensionBackground.includes(`"${kind}"`), `extension worker omits: ${kind}`);
}

let migrationIndex = -1;
for (const migration of audit.unappliedMigrations) {
  const nextIndex = applyOrder.indexOf(`${migration}.sql`);
  check(nextIndex > migrationIndex, `migration is absent or out of order: ${migration}`);
  migrationIndex = nextIndex;
  check(
    existsSync(resolve(root, `supabase/migrations/${migration}.sql`)),
    `migration missing: ${migration}`,
  );
  check(
    existsSync(resolve(root, `supabase/rollback/${migration}_rollback.sql`)),
    `rollback missing: ${migration}`,
  );
  check(
    existsSync(resolve(root, `supabase/verification/${migration}_verify.sql`)),
    `verification missing: ${migration}`,
  );
}

const manifest = json("extension/manifest.json");
for (const asset of [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.icons?.["128"],
]) {
  check(
    typeof asset === "string" && existsSync(resolve(root, "extension", asset)),
    `extension asset missing: ${String(asset)}`,
  );
}
for (const asset of [
  "native/companion/tauri/icons/icon.ico",
  "native/companion/tauri/icons/icon.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
]) {
  check(existsSync(resolve(root, asset)), `native asset missing: ${asset}`);
}

const mobileBoundary = audit.knownRuntimeBoundaries.find(
  (boundary) => boundary.id === "mobile-native-plugin",
);
check(
  mobileBoundary?.classification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "mobile native plugin source is misclassified",
);
check(mobileBoundary?.nextPhase === 34, "mobile relay runtime is not assigned to Phase 34");
check(mobileShell.includes("OcadeMobile"), "mobile shell does not use the declared native seam");
check(
  mobileShell.includes("native secure-pairing bridge is unavailable") &&
    mobileShell.includes("Nothing was reported as stopped"),
  "mobile shell lacks an honest missing-bridge boundary",
);
check(
  existsSync(
    resolve(root, "android/app/src/main/java/com/caeracadane/ocade/OcadeMobilePlugin.java"),
  ) && existsSync(resolve(root, "ios/App/App/OcadeMobilePlugin.swift")),
  "mobile native plug-in source is missing",
);
const androidMobilePlugin = read(
  "android/app/src/main/java/com/caeracadane/ocade/OcadeMobilePlugin.java",
);
const iosMobilePlugin = read("ios/App/App/OcadeMobilePlugin.swift");
check(
  androidMobilePlugin.includes('result.put("acknowledged", false)') &&
    iosMobilePlugin.includes('"acknowledged": false'),
  "mobile native source can report success without a relay acknowledgement",
);

const productionFiles = collectProductionSource();
const incoming = buildIncomingImportCounts(productionFiles);
const focusedOrphans = productionFiles
  // Every file under lib, not a named subset. The scan previously required one
  // of seven subdirectories, so top-level modules — the chat, memory and
  // citation stores among them — were never checked for reachability at all.
  .filter((path) => /[\\/]lib[\\/]/.test(path))
  .filter((path) => incoming.get(path) === 0)
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .sort();
const declaredOrphans = audit.nonRuntimeModules.map((entry) => entry.path).sort();
check(
  JSON.stringify(focusedOrphans) === JSON.stringify(declaredOrphans),
  `non-runtime module ledger drifted: observed ${focusedOrphans.join(", ")}`,
);
for (const entry of audit.nonRuntimeModules) {
  check(existsSync(resolve(root, entry.path)), `non-runtime module is missing: ${entry.path}`);
  check(
    ["SCAFFOLD-ONLY", "SOURCE-COMPLETE BUT RUNTIME-BLOCKED"].includes(entry.classification),
    `non-runtime module is overclaimed: ${entry.path}`,
  );
  check(entry.reason.length >= 20, `non-runtime module lacks a useful reason: ${entry.path}`);
}

for (const [claim, value] of Object.entries(audit.claims)) {
  check(value === false, `runtime claim must remain false without evidence: ${claim}`);
}

const secretShape =
  /AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,}/;
for (const sourcePath of [
  "src/lib/native/companion-bridge.ts",
  "src/lib/native/extension-protocol.ts",
  "src/lib/mobile/secure-channel.ts",
  "native/companion/tauri/tauri.conf.json",
  "extension/manifest.json",
  "capacitor.config.json",
  "wrangler.json",
]) {
  check(!secretShape.test(read(sourcePath)), `secret-shaped value found: ${sourcePath}`);
}

if (failures.length > 0) {
  console.error(`OCADE integration honesty gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE integration honesty gate: ${checks}/${checks} checks passed`);
console.log(
  `STATUS: PHASE 19 AUDITED; ${audit.nonRuntimeModules.length} NON-RUNTIME MODULES AND ${audit.knownRuntimeBoundaries.length} RUNTIME BOUNDARIES DECLARED`,
);
console.log(
  "No migration, native install, signing, deployment, or live-application claim was made.",
);

function collectProductionSource() {
  const files = [];
  walk(resolve(root, "src"), files);
  return files
    .filter((path) => [".ts", ".tsx"].includes(extname(path)))
    .filter((path) => !path.includes(`${join("", "__tests__")}`))
    .filter((path) => !path.includes(".test."));
}

function walk(directory, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else files.push(normalize(path));
  }
}

function buildIncomingImportCounts(files) {
  const known = new Set(files);
  const incoming = new Map(files.map((path) => [path, 0]));
  for (const sourcePath of files) {
    const source = readFileSync(sourcePath, "utf8");
    const specifiers = [...source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    /*
     * A worker entry is referenced as `new Worker(new URL("./x.ts", import.meta.url))`,
     * which is a real dependency the bundler resolves but contains no `import`
     * or `from`. Without this the scan reported `webllm.worker.ts` as an
     * unreachable module while the WebGPU adapter was actively spawning it —
     * a false orphan, which is exactly as damaging as a missed one because it
     * pushes people to silence the gate.
     */
    specifiers.push(
      ...[...source.matchAll(/new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)].map(
        (match) => match[1],
      ),
    );
    for (const specifier of specifiers) {
      const resolved = resolveImport(sourcePath, specifier, known);
      if (resolved) incoming.set(resolved, (incoming.get(resolved) ?? 0) + 1);
    }
  }
  return incoming;
}

function resolveImport(sourcePath, specifier, known) {
  let base;
  if (specifier.startsWith("@/")) base = resolve(root, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(sourcePath), specifier);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    const path = normalize(candidate);
    if (known.has(path)) return path;
  }
  return null;
}
