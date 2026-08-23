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
/*
 * THE EXTENSION IS BACK, DELIBERATELY, AND THIS GATE CHANGED WITH IT.
 *
 * These two checks used to assert that `extension/` did NOT exist: the managed
 * browser host above had superseded it, and the rule stopped a dead directory
 * drifting back in. The product decision has since changed — Cowork runs in the
 * user's own Chrome, with the website as the interface and the extension as the
 * executor — so asserting its absence now enforces the opposite of what is
 * wanted.
 *
 * It is replaced rather than deleted, because the reason the old rule existed
 * still applies: an extension in this tree must be held to something. The
 * managed host remains the desktop path and is still checked above; the
 * extension is checked on the invariants that make it safe to install, and
 * `npm run extension:check` covers the rest.
 */
const extensionRoot = resolve(root, "extension");
check(existsSync(extensionRoot), "Cowork browser extension is missing");
if (existsSync(extensionRoot)) {
  const manifest = JSON.parse(read("extension/manifest.json"));
  check(manifest.manifest_version === 3, "extension manifest must be version 3");
  check(
    Array.isArray(manifest.host_permissions) && manifest.host_permissions.length === 0,
    "extension must declare NO standing host permissions",
  );
  const background = read("extension/src/background.js");
  // MV3 recycles an idle worker; a latch held only in memory comes back running.
  check(
    background.includes("chrome.storage.session"),
    "extension control latch must survive a service-worker restart",
  );
  check(
    background.includes("fromExtensionPage"),
    "extension scope must be changeable only from the extension's own pages",
  );
  check(background.includes("isProtectedField"), "extension must refuse protected fields");
}

if (failures.length) {
  console.error(`OCADE Phase 28 managed-browser gate failed (${failures.length}/${checks}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`OCADE Phase 28 managed-browser gate: ${checks}/${checks} checks passed`);
