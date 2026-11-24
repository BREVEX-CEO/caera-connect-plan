#!/usr/bin/env node
/**
 * SUPPLY-02: a software bill of materials (CycloneDX 1.5 JSON) for what OCADE ships: every
 * production package of the website (package-lock.json) and every Python package of the
 * companion installer (device-agent/windows/requirements.lock), with exact versions, package
 * URLs, licences and the integrity hashes the locks pin. Deterministic (no timestamps), so it is
 * checked in and reviewed like code.
 *
 *   node scripts/sbom.mjs --write   regenerate release/sbom.cdx.json
 *   node scripts/sbom.mjs --check   fail when the checked-in SBOM no longer matches the locks
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "release/sbom.cdx.json";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const npmLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const pyLock = readFileSync("device-agent/windows/requirements.lock", "utf8");
const inventory = JSON.parse(readFileSync("release/third-party-licences.json", "utf8"));

const licences = (expression) => (expression ? [{ expression: String(expression) }] : undefined);

const web = Object.entries(npmLock.packages ?? {})
  .filter(([path, entry]) => path.startsWith("node_modules/") && !entry.dev && entry.version)
  .map(([path, entry]) => {
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    const [algorithm, digest] = String(entry.integrity ?? "").split("-");
    return {
      type: "library",
      "bom-ref": `pkg:npm/${name}@${entry.version}`,
      name,
      version: entry.version,
      purl: `pkg:npm/${name.replace("@", "%40")}@${entry.version}`,
      licenses: licences(entry.license),
      hashes:
        algorithm === "sha512" && digest
          ? [{ alg: "SHA-512", content: Buffer.from(digest, "base64").toString("hex") }]
          : undefined,
      properties: [{ name: "ocade:shipped-in", value: "website" }],
    };
  });

const python = [];
for (const block of pyLock.split(/\n(?=[A-Za-z0-9])/)) {
  const head = /^([A-Za-z0-9._-]+)==([^\s;\\]+)/.exec(block);
  if (!head) continue;
  const [, name, version] = head;
  const hashes = [...block.matchAll(/--hash=sha256:([0-9a-f]{64})/g)].map((m) => m[1]).sort();
  python.push({
    type: "library",
    "bom-ref": `pkg:pypi/${name.toLowerCase()}@${version}`,
    name,
    version,
    purl: `pkg:pypi/${name.toLowerCase()}@${version}`,
    licenses: licences(inventory.python?.[name]?.licence),
    // Every artifact the installer may fetch for this version (one per platform wheel).
    hashes: hashes.map((content) => ({ alg: "SHA-256", content })),
    properties: [{ name: "ocade:shipped-in", value: "companion" }],
  });
}

const components = [...web, ...python].sort((a, b) => (a["bom-ref"] < b["bom-ref"] ? -1 : 1));
const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    component: {
      type: "application",
      "bom-ref": `ocade@${pkg.version}`,
      name: "OCADE",
      version: pkg.version,
    },
  },
  components,
};
const text = JSON.stringify(bom, null, 2) + "\n";

if (process.argv.includes("--write")) {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}: ${web.length} website and ${python.length} companion packages`);
} else {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    // missing: reported below
  }
  if (current !== text) {
    console.error(`${OUT} does not match the locks; run: node scripts/sbom.mjs --write`);
    process.exitCode = 1;
  } else {
    console.log(`${OUT} matches the locks (${components.length} packages).`);
  }
}
