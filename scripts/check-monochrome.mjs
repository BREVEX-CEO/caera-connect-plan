import { existsSync, globSync, readFileSync } from "node:fs";

const sourceFiles = [
  ...globSync("src/**/*.{ts,tsx,css,svg}"),
  ...globSync("public/**/*.svg"),
  ...globSync("public/**/*.{html,js,mjs,css}"),
  ...globSync("mobile/**/*.{html,js,css,svg}"),
  ...globSync("native/companion/ui/**/*.{html,js,css,svg}"),
].filter(
  (file) =>
    !file.includes("/__tests__/") &&
    !file.includes("\\__tests__\\") &&
    !file.includes("/primary-logic/") &&
    !file.includes("\\primary-logic\\"),
);

/*
 * Source-only scanning catches the most useful authoring mistake, but the
 * release contract is about the bytes a customer receives.  When a production
 * build is present, scan its emitted CSS, SVG, and JavaScript too.  This makes
 * a dependency, generated asset, or compiler transform unable to reintroduce
 * a hue after the source check has passed.  A clean checkout without a build
 * remains supported; verify:full runs this after build:stable.
 */
const builtFiles = existsSync(".output/public/assets")
  ? globSync(".output/public/assets/**/*.{css,js,svg}")
  : [];
/*
 * These chunks render user-supplied PDF and Markdown content.  Their colour
 * literals describe the document being viewed (for example a PDF annotation
 * or a Markdown language token), not an OCADE-owned interface.  They remain
 * deliberately narrow by stable chunk stem; a product chunk cannot join this
 * exception without changing the source audit's explicit allowlist.
 */
const userContentRendererAssets = builtFiles.filter((file) =>
  /[\\/](?:pdf|vendor-markdown)-/.test(file),
);
const productBuiltFiles = builtFiles.filter((file) => !userContentRendererAssets.includes(file));
const auditFiles = [...sourceFiles, ...productBuiltFiles];

const problems = [];

function report(file, offset, message) {
  const line = readFileSync(file, "utf8").slice(0, offset).split(/\r?\n/).length;
  problems.push(`${file}:${line} ${message}`);
}

for (const file of auditFiles) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(/#([\da-fA-F]{3,8})\b/g)) {
    const raw = match[1];
    const channels =
      raw.length === 3 || raw.length === 4
        ? [raw[0] + raw[0], raw[1] + raw[1], raw[2] + raw[2]]
        : raw.length === 6 || raw.length === 8
          ? [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)]
          : [];
    if (channels.length === 3 && !(channels[0] === channels[1] && channels[1] === channels[2])) {
      report(file, match.index, `non-neutral hex #${raw}`);
    }
  }

  for (const match of source.matchAll(
    /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/g,
  )) {
    if (!(match[1] === match[2] && match[2] === match[3])) {
      report(file, match.index, `non-neutral rgb(${match[1]}, ${match[2]}, ${match[3]})`);
    }
  }

  for (const match of source.matchAll(/oklch\(\s*[\d.]+\s+([\d.]+)/g)) {
    if (Number(match[1]) !== 0) {
      report(file, match.index, `non-neutral oklch chroma ${match[1]}`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    "OCADE customer-facing source and built assets must be monochrome:\n" + problems.join("\n"),
  );
  process.exit(1);
}

console.log(
  `Monochrome audit passed (${sourceFiles.length} source files; ${productBuiltFiles.length} product built assets; ${userContentRendererAssets.length} user-content renderers excluded).`,
);
