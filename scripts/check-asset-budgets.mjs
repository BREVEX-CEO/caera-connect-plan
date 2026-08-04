import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDirectory = join(repoRoot, ".output", "public", "assets");

const budgets = Object.freeze({
  assetFiles: 250,
  totalBytes: 4_000_000,
  javascriptBytes: 3_850_000,
  cssBytes: 150_000,
  largestJavascriptBytes: 550_000,
});

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function loadAssets() {
  let names;
  try {
    names = await readdir(assetsDirectory);
  } catch {
    throw new Error(
      "No production assets were found. Run `npm run build` before the performance budget check.",
    );
  }

  return Promise.all(
    names.map(async (name) => {
      const path = join(assetsDirectory, name);
      const details = await stat(path);
      return { name, path, bytes: details.size };
    }),
  );
}

const assets = (await loadAssets()).filter((asset) => asset.bytes > 0);
const javascript = assets.filter((asset) => asset.name.endsWith(".js"));
const css = assets.filter((asset) => asset.name.endsWith(".css"));
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const javascriptBytes = javascript.reduce((sum, asset) => sum + asset.bytes, 0);
const cssBytes = css.reduce((sum, asset) => sum + asset.bytes, 0);
const largestJavascript = javascript.reduce(
  (largest, asset) => (asset.bytes > largest.bytes ? asset : largest),
  { name: "none", path: "", bytes: 0 },
);
const failures = [];

function check(label, actual, limit) {
  if (actual > limit) failures.push(`${label}: ${actual} exceeds ${limit}.`);
}

check("Asset file count", assets.length, budgets.assetFiles);
check("Total asset bytes", totalBytes, budgets.totalBytes);
check("JavaScript bytes", javascriptBytes, budgets.javascriptBytes);
check("CSS bytes", cssBytes, budgets.cssBytes);
check("Largest JavaScript asset bytes", largestJavascript.bytes, budgets.largestJavascriptBytes);

const pdfChunks = javascript.filter((asset) => /^pdf-[\w-]+\.js$/.test(asset.name));
if (pdfChunks.length !== 1) {
  failures.push(`Expected exactly one lazy PDF chunk, observed ${pdfChunks.length}.`);
}

const ocadeRouteCandidates = [];
for (const asset of javascript.filter((candidate) => candidate.name.startsWith("ocade-"))) {
  const source = await readFile(asset.path, "utf8");
  if (source.includes("__vite__mapDeps") && source.includes("pdf-")) {
    ocadeRouteCandidates.push(asset);
  }
}
if (ocadeRouteCandidates.length !== 1) {
  failures.push(
    `Expected one OCADE route with a lazy PDF dependency boundary, observed ${ocadeRouteCandidates.length}.`,
  );
}

console.log(
  [
    `Performance budget: ${assets.length}/${budgets.assetFiles} assets`,
    `${formatBytes(totalBytes)}/${formatBytes(budgets.totalBytes)} total`,
    `${formatBytes(javascriptBytes)}/${formatBytes(budgets.javascriptBytes)} JavaScript`,
    `${formatBytes(cssBytes)}/${formatBytes(budgets.cssBytes)} CSS`,
    `largest JS ${largestJavascript.name} ${formatBytes(largestJavascript.bytes)}/${formatBytes(budgets.largestJavascriptBytes)}`,
    `lazy PDF chunks ${pdfChunks.length}`,
  ].join("\n"),
);

if (failures.length > 0) {
  throw new Error(`Production asset budget failed:\n- ${failures.join("\n- ")}`);
}
