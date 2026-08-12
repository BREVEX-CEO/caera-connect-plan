import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
let checks = 0;
const check = (condition, label) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const includesAll = (source, values, label) => {
  for (const value of values) check(source.includes(value), `${label}: ${value}`);
};

const hostPath = "native/browser-host/index.mjs";
const bridgePath = "src/lib/native/cdp-browser-bridge.ts";
const policyPath = "src/lib/native/browser-bridge.ts";
const parityPath = "scripts/browser-cdp-parity.mjs";
for (const path of [hostPath, bridgePath, policyPath, parityPath]) {
  check(existsSync(resolve(root, path)), `managed-browser source missing: ${path}`);
}

const host = read(hostPath);
const bridge = read(bridgePath);
const policy = read(policyPath);
const parity = read(parityPath);

includesAll(
  host,
  [
    "playwright-core",
    "chromium.launchPersistentContext",
    "chromium.connectOverCDP",
    "127.0.0.1",
    'case "page.read"',
    'case "navigate"',
    'case "click"',
    'case "type"',
    'case "upload"',
    'case "download"',
    'command === "cancel"',
    'command === "emergency_stop"',
    "PROTECTED_FIELD",
    "approvedOrigins",
    "approvedFileRoots",
  ],
  "managed browser host",
);
includesAll(
  bridge,
  [
    "ManagedCdpBrowserBridge",
    "MANAGED_BROWSER_PROTOCOL_VERSION",
    "wrapUntrustedContent",
    "installManagedCdpBrowserBridge",
    'host: "ocade-managed-browser"',
  ],
  "application bridge",
);
includesAll(
  policy,
  [
    "DEFAULT_SITE_POLICY",
    "allowOrigins",
    "denyOrigins",
    "readOrigins",
    "fillOrigins",
    "allowPrivate: false",
    "isProtectedField",
    "runBrowserAction",
    "cancelBrowserRun",
    "emergencyStopBrowserControl",
  ],
  "browser policy",
);
includesAll(
  parity,
  [
    'for (const browser of ["chrome", "edge"])',
    "protectedAttempt",
    'action: { kind: "upload"',
    'action: { kind: "download"',
    'command: "emergency_stop"',
  ],
  "real Chrome and Edge parity harness",
);
check(
  !existsSync(resolve(root, "extension")),
  "superseded browser extension directory still exists",
);
check(
  !read("package.json").includes("extension:package"),
  "extension packaging command still exists",
);

if (failures.length) {
  console.error(`OCADE Phase 28 managed-browser gate failed (${failures.length}/${checks}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`OCADE Phase 28 managed-browser gate: ${checks}/${checks} checks passed`);
