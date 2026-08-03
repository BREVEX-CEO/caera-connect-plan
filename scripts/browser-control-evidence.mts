/**
 * H1 evidence: the extension is active in real Chrome and real Edge.
 *
 * "Active" means a service_worker target carrying the extension's own id is
 * running in the browser — observed over the DevTools protocol, not inferred
 * from the install call returning without error.
 *
 * Zero manual steps: no Developer Mode, no Load Unpacked, and no change to
 * browser security policy. The registry is not touched.
 *
 * Usage: node --experimental-strip-types scripts/browser-control-evidence.mts [--write]
 */
import { createHash, createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H1_BROWSER_ACTIVATION.json";

/** The id the manifest's pinned key produces — the value both loads must agree on. */
function expectedId(): string {
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as { key?: string };
  if (!manifest.key) throw new Error("manifest.json does not pin a key, so its id is not stable");
  const der = Buffer.from(manifest.key, "base64");
  const digest = createHash("sha256").update(der).digest();
  return [...digest.subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("");
}

const wantId = expectedId();
console.log(`expected extension id: ${wantId}\n`);

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9431],
  ["edge", 9432],
] as const) {
  const browser = browserFor(name, port);
  try {
    await browser.launch();
    const returnedId = await browser.installExtension(EXTENSION_DIR);
    const { active, target } = await browser.extensionActive(wantId);

    const entry = {
      browser: name,
      version: browser.versionString,
      installMechanism: "CDP Extensions.loadUnpacked",
      manualDeveloperModeSteps: 0,
      securityPolicyChanged: false,
      registryTouched: false,
      idReturnedByInstall: returnedId,
      idMatchesPinnedKey: returnedId === wantId,
      serviceWorkerTarget: target?.url ?? null,
      active,
    };
    results.push(entry);
    console.log(
      `${name.padEnd(7)} ${browser.versionString.padEnd(26)} active=${active} id=${returnedId}`,
    );
    if (!active || returnedId !== wantId) failed = true;
  } catch (error) {
    results.push({ browser: name, active: false, error: String(error) });
    console.error(`${name}: FAILED — ${error}`);
    failed = true;
  } finally {
    await browser.close();
  }
}

const document = {
  schemaVersion: 1,
  item: "H1 - extension packaged and active in real Chrome and Edge",
  generatedAt: new Date().toISOString(),
  expectedExtensionId: wantId,
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "Each browser was launched fresh, the extension installed over CDP Extensions.loadUnpacked, and activation confirmed by finding a service_worker target whose URL carries the extension id. The install call returning an id proves the request was accepted; the running service worker proves it is active.",
  zeroTouch: {
    developerModeClicks: 0,
    loadUnpackedClicks: 0,
    registryKeysWritten: 0,
    securityPolicyChanged: false,
    note: "An earlier pass concluded enterprise policy was the only route. That was wrong: CDP installs the extension with no policy change. It was also wrong that Edge refused the extension — that check compared against the CRX-signed id while an unpacked load derives its id from the path. manifest.json now pins its public key so both ids are the same value.",
  },
  browsers: results,
};

console.log(`\nH1: ${document.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
void join;
