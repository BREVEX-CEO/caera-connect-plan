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
/*
 * PAIRED BY NAME, NEVER BY POSITION.
 *
 * THE BUG THIS REPLACES, because it shipped: the archive was built by walking
 * two lists in parallel —
 *
 *   archiveInput[fileNames[index]] = readFile(sourceFiles[index])
 *
 * — where `fileNames` was sorted alphabetically and `sourceFiles` followed the
 * `required` order. Those two orders are NOT the same: `required` starts with
 * `manifest.json`, alphabetical starts with `icons/ocade-128.png`. So every
 * entry in the package was given another entry's bytes. The published
 * `ocade-cowork-1.0.0.zip` contained a PNG named `manifest.json`, which Chrome
 * cannot parse — the extension could not install at all.
 *
 * Two lists indexed in lockstep only work while their orders agree, and nothing
 * made them agree. Looking each file up BY ITS NAME removes the possibility.
 */
const archiveInput = {};
for (const name of fileNames) {
  archiveInput[name] = [
    new Uint8Array(await readFile(discoveredByName.get(name))),
    { mtime: FIXED_MTIME },
  ];
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
/*
 * VERIFIED BY NAME TOO — and this half is why the corruption above survived.
 *
 * The old check read `sourceFiles[index]` and compared it against
 * `unpacked[fileNames[index]]`: the SAME mismatched pairing the builder used.
 * It compared the manifest's bytes against the entry the builder had filled
 * with the manifest's bytes, found them equal, and reported the package
 * verified. A verifier that repeats the builder's mistake confirms it.
 *
 * Reading each entry back by the name it was stored under is what makes this
 * an independent check rather than an echo.
 */
for (const name of fileNames) {
  const original = new Uint8Array(await readFile(discoveredByName.get(name)));
  const extracted = unpacked[name];
  if (!extracted || Buffer.compare(Buffer.from(original), Buffer.from(extracted)) !== 0) {
    throw new Error(`ZIP verification failed for ${name}.`);
  }
}

/*
 * And a check the old script had no equivalent of: the manifest inside the
 * package must still BE a manifest. Every assertion above compares bytes to
 * bytes, so a future pairing bug that shuffled entries consistently would pass
 * all of them. This asks the one question a store will ask first.
 */
const packagedManifest = JSON.parse(new TextDecoder().decode(unpacked["manifest.json"]));
if (packagedManifest.manifest_version !== 3 || packagedManifest.version !== manifest.version) {
  throw new Error("The packaged manifest.json is not the extension's manifest.");
}

const sha256 = createHash("sha256").update(zipBytes).digest("hex");
const receipt = {
  schemaVersion: 2,
  reproducible: true,
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
