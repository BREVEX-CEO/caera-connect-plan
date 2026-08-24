import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { unzipSync, zipSync } from "fflate";

const SOURCE = resolve("extension");
const OUTPUT_DIR = resolve("release/packages");
const RECEIPT_PATH = resolve("release/OCADE_EXTENSION_STORE_PACKAGE.json");
const FIXED_MTIME = new Date("2000-01-01T00:00:00.000Z");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const manifest = JSON.parse(await readFile(resolve(SOURCE, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Only Manifest V3 may be packaged.");
if ((manifest.host_permissions ?? []).length !== 0) {
  throw new Error("Standing host permissions must remain empty.");
}

const required = [
  "manifest.json",
  "icons/ocade-16.png",
  "icons/ocade-32.png",
  "icons/ocade-48.png",
  "icons/ocade-128.png",
  "src/background.js",
  "src/content.js",
  "src/popup.html",
  "src/popup.js",
  "src/protocol.d.ts",
  "src/protocol.js",
];
const discoveredFiles = (await filesUnder(SOURCE)).filter((path) => {
  const name = relative(SOURCE, path).split(sep).join("/");
  return (
    name === "manifest.json" ||
    /^icons\/ocade-(16|32|48|128)\.png$/.test(name) ||
    /^src\/(background|content|popup|protocol)\.(js|html|d\.ts)$/.test(name)
  );
});
const discoveredByName = new Map(
  discoveredFiles.map((path) => [relative(SOURCE, path).split(sep).join("/"), path]),
);
const fileNames = [...discoveredByName.keys()].sort();
if (JSON.stringify(fileNames) !== JSON.stringify([...required].sort())) {
  throw new Error(`Extension package contents drifted: ${fileNames.join(", ")}`);
}
const sourceFiles = required.map((name) => discoveredByName.get(name));

const archiveInput = {};
for (let index = 0; index < sourceFiles.length; index += 1) {
  archiveInput[fileNames[index]] = [new Uint8Array(await readFile(sourceFiles[index])), { mtime: FIXED_MTIME }];
}

const zipBytes = zipSync(archiveInput, { level: 9 });
const packageName = `ocade-cowork-${manifest.version}.zip`;
const packagePath = resolve(OUTPUT_DIR, packageName);
await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(packagePath, zipBytes);

const unpacked = unzipSync(zipBytes);
const unpackedNames = Object.keys(unpacked).sort();
if (JSON.stringify(unpackedNames) !== JSON.stringify([...required].sort())) {
  throw new Error("The verified ZIP contents do not match the package allowlist.");
}
for (let index = 0; index < sourceFiles.length; index += 1) {
  const original = new Uint8Array(await readFile(sourceFiles[index]));
  const extracted = unpacked[fileNames[index]];
  if (!extracted || Buffer.compare(Buffer.from(original), Buffer.from(extracted)) !== 0) {
    throw new Error(`ZIP verification failed for ${fileNames[index]}.`);
  }
}

const sha256 = createHash("sha256").update(zipBytes).digest("hex");
const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: "PACKAGED_AND_VERIFIED_STORE_SUBMISSION_EXTERNAL",
  package: `release/packages/${packageName}`,
  bytes: zipBytes.length,
  sha256,
  manifestVersion: manifest.manifest_version,
  extensionVersion: manifest.version,
  permissions: manifest.permissions,
  standingHostPermissions: manifest.host_permissions ?? [],
  optionalHostPermissions: manifest.optional_host_permissions ?? [],
  files: required,
  verification: [
    "ZIP parsed after writing",
    "entry allowlist matched exactly",
    "every extracted entry matched source bytes",
    "standing host permissions remained empty",
  ],
  external: [
    "Chrome Web Store developer account and review",
    "Microsoft Edge Add-ons developer account and review",
    "store-issued installation identity and production install proof",
  ],
};
await writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log(`OCADE Cowork ${manifest.version}: ${zipBytes.length} bytes`);
console.log(`SHA-256 ${sha256}`);
console.log(`Package ${packagePath}`);
console.log(`Receipt ${RECEIPT_PATH}`);
