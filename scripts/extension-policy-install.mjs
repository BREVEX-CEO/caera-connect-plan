/**
 * H1 — package the extension and prepare policy-based installation.
 *
 * WHY POLICY IS THE ONLY REMAINING MECHANISM
 * ------------------------------------------
 * Measured on this machine, not assumed:
 *
 *   Chrome 150.0.7871.187  --load-extension  → extension does NOT load
 *   Edge   151.0.4129.59   --load-extension  → extension does NOT load
 *
 * In both cases the browser started and CDP listed only the vendor's own
 * component extensions; the OCADE id was absent. Chrome removed developer
 * `--load-extension` support in 137 and Edge follows the same engine. So the
 * options that remain are: manual Developer Mode (which H1 explicitly forbids),
 * store publication (needs a developer account and review), or enterprise
 * policy. This script prepares the last one.
 *
 * WHAT THIS SCRIPT WILL NOT DO
 * ----------------------------
 * It does not write the registry. Force-installing a browser extension is a
 * change to the browser's SECURITY POLICY: it grants an extension host access
 * across sites, it persists, it applies to the owner's real browsing, and on
 * Chrome it cannot be removed by the user from the extensions page. That is the
 * owner's decision to make deliberately, not something to apply as a side
 * effect of a build step.
 *
 * So `--print` emits the exact commands, and `--apply` is deliberately absent.
 * Everything up to that line is automated.
 *
 * Usage: node scripts/extension-policy-install.mjs [--print] [--write-evidence]
 */
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = "extension";
const OUT = "release/OCADE_H1_EXTENSION_PACKAGE.json";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

/** Chrome maps the first 16 bytes of the SPKI digest to the a-p alphabet. */
function extensionIdFromPem(pem) {
  const der = createPublicKey({ key: pem, format: "pem" }).export({ type: "spki", format: "der" });
  const digest = createHash("sha256").update(der).digest();
  return [...digest.subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("");
}

function pack(stageDir, keyPath) {
  const args = [`--pack-extension=${stageDir}`, "--no-message-box"];
  if (keyPath && existsSync(keyPath)) args.push(`--pack-extension-key=${keyPath}`);
  execFileSync(CHROME, args, { timeout: 60_000, stdio: "ignore" });
}

/*
 * The signing key must PERSIST, or the extension id changes on every build.
 *
 * A first version let Chrome mint a fresh key each run and produced a different
 * id every time — which would silently invalidate any policy referencing the
 * old one, and is exactly the kind of drift that makes a force-install policy
 * point at nothing.
 *
 * The key lives outside the repository on purpose: it is a private signing key,
 * and a private key in version control is a private key that has leaked. A real
 * release would use a store-issued identity instead of this self-signed one.
 */
const KEY_DIR = join(process.env.LOCALAPPDATA ?? tmpdir(), "OCADE");
const KEY_PATH = join(KEY_DIR, "extension-signing.pem");
mkdirSync(KEY_DIR, { recursive: true });
const reusedKey = existsSync(KEY_PATH);

const stage = join(tmpdir(), "ocade-ext-stage");
rmSync(stage, { recursive: true, force: true });
rmSync(`${stage}.crx`, { force: true });
rmSync(`${stage}.pem`, { force: true });
mkdirSync(stage, { recursive: true });
for (const file of ["manifest.json", "background.js", "popup.html", "popup.js"]) {
  copyFileSync(join(SOURCE, file), join(stage, file));
}
mkdirSync(join(stage, "icons"), { recursive: true });
copyFileSync(join(SOURCE, "icons/icon128.png"), join(stage, "icons/icon128.png"));

pack(stage, reusedKey ? KEY_PATH : undefined);
// Keep the key Chrome minted, so the next build produces the same id.
if (!reusedKey && existsSync(`${stage}.pem`)) copyFileSync(`${stage}.pem`, KEY_PATH);
// Chrome writes <stage>.crx and <stage>.pem beside the directory.
const crxPath = `${stage}.crx`;
const pemPath = `${stage}.pem`;
if (!existsSync(crxPath)) {
  console.error("Packing produced no .crx — is Chrome installed at the expected path?");
  process.exit(1);
}

const pem = readFileSync(reusedKey ? KEY_PATH : pemPath, "utf8");
const id = extensionIdFromPem(pem);
const crx = readFileSync(crxPath);
const manifest = JSON.parse(readFileSync(join(SOURCE, "manifest.json"), "utf8"));

console.log(`packaged   : ${crx.length} bytes`);
console.log(`extension  : ${id}`);
console.log(`crx sha256 : ${createHash("sha256").update(crx).digest("hex")}`);

/**
 * ExtensionSettings is preferred over ExtensionInstallForcelist: it pins the
 * exact key, so a different extension cannot claim the same id, and it can be
 * scoped to `force_installed` for one id rather than opening a general channel.
 */
const policy = {
  [id]: {
    installation_mode: "force_installed",
    update_url: "file:///<path-to>/ocade-updates.xml",
    toolbar_pin: "force_pinned",
  },
};

const commands = {
  chromeHKCU: `reg add "HKCU\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionSettings\\${id}" /v installation_mode /t REG_SZ /d force_installed /f`,
  edgeHKCU: `reg add "HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionSettings\\${id}" /v installation_mode /t REG_SZ /d force_installed /f`,
  note: "Both also need an update_url value pointing at a local update manifest, and Chrome requires the .crx to be reachable from it. Run from an elevated prompt for HKLM (machine-wide) instead of HKCU (this user only).",
};

const document = {
  schemaVersion: 1,
  item: "H1 - package and install the browser extension",
  generatedAt: new Date().toISOString(),
  status: "PACKAGED - INSTALL BLOCKED ON OWNER APPROVAL",
  package: {
    crxBytes: crx.length,
    crxSha256: createHash("sha256").update(crx).digest("hex"),
    extensionId: id,
    manifestVersion: manifest.manifest_version,
    declaredPermissions: manifest.permissions,
    optionalPermissions: manifest.optional_permissions,
    hostPermissions: manifest.host_permissions,
    optionalHostPermissions: manifest.optional_host_permissions,
    signedBy: "Chrome --pack-extension, self-signed test key",
    keyPersistedOutsideRepo: true,
    idStableAcrossBuilds: true,
  },
  measuredBrowsers: {
    chrome: { version: "150.0.7871.187", loadExtensionFlag: "IGNORED - extension did not load" },
    edge: { version: "151.0.4129.59", loadExtensionFlag: "IGNORED - extension did not load" },
    method:
      "Each browser was launched with --load-extension against a throwaway profile and queried over CDP /json/list. Only the vendor's own component extensions appeared; the OCADE id was absent in both.",
  },
  whyBlocked:
    "Force-installing a browser extension is a change to the browser's security policy. It grants host access across sites, it persists, it applies to the owner's real browsing, and under Chrome policy the user cannot remove it from the extensions page. Applying that as a side effect of a build step is not appropriate, so the registry write is left to the owner.",
  ownerAction: commands,
  policyDocument: policy,
  whatIsProven:
    "The extension packages into a real signed CRX with a stable id derived from its key, and neither Chrome nor Edge will load it via the developer flag.",
  whatIsNotProven:
    "That the extension activates, pairs, or controls any page in a real browser. H2 through H5 all depend on it being installed and cannot be attempted until then.",
};

if (process.argv.includes("--print")) {
  console.log("\n--- owner action: Chrome (this user) ---\n" + commands.chromeHKCU);
  console.log("\n--- owner action: Edge (this user) ---\n" + commands.edgeHKCU);
  console.log("\n" + commands.note);
}

if (process.argv.includes("--write-evidence")) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
}

console.log(`\nEdge present: ${existsSync(EDGE)}`);
