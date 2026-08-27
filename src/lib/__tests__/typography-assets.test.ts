import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRELAUNCH_PUBLIC_ASSET_PATHS } from "@/lib/launch/prelaunch-response";

/*
 * TYPEFACES ARE PAYLOAD, AND PAYLOAD HAS TO EARN ITS PLACE.
 *
 * Every self-hosted font is bytes downloaded by every visitor on their first
 * page, including the ones who came only to read the privacy notice. That is
 * fine when the face is rendered. It is not fine when it is not.
 *
 * This caught a real one: Instrument Serif shipped in two subsets, 43 KB, was
 * declared in `@font-face`, was exposed as `--font-serif` — and `font-serif`
 * appeared zero times in the entire codebase. Every visitor paid for a typeface
 * the product never drew a glyph in. The design reference is explicit about
 * where it belongs (one emphasised phrase inside a heading, nothing else), so
 * the fix was to use it, not to drop it.
 *
 * The rules below are the ones that would have failed then:
 *   1. a font file on disk is declared in the stylesheet,
 *   2. a declared family is reachable through a token,
 *   3. a token is actually referenced by something that renders,
 *   4. the pre-launch page, which is its own hand-written HTML document and
 *      does not go through the stylesheet at all, declares the same faces and
 *      allows the same paths — otherwise the fonts 404 for the only visitors
 *      who see the product before it opens.
 */

const root = process.cwd();
const fontsDir = join(root, "public", "fonts");
const css = readFileSync(join(root, "src", "styles.css"), "utf8");
const prelaunch = readFileSync(join(root, "src", "lib", "launch", "prelaunch-response.ts"), "utf8");

const fontFiles = readdirSync(fontsDir).filter((name) => name.endsWith(".woff2"));

/** Every `src: url("/fonts/…")` the stylesheet asks the browser to fetch. */
const declaredPaths = new Set(
  [...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((match) => match[1]),
);

/** Which Tailwind font tokens exist, and what family each one leads with. */
const tokens = new Map(
  [...css.matchAll(/^\s{2}--font-(sans|serif|mono):\s*([\s\S]*?);$/gm)].map((match) => [
    match[1],
    match[2],
  ]),
);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = sourceFiles(join(root, "src"));

describe("self-hosted typefaces", () => {
  it("ships at least one face", () => {
    expect(fontFiles.length).toBeGreaterThan(0);
  });

  it.each(fontFiles)("%s is declared in the stylesheet", (name) => {
    expect(declaredPaths.has(`/fonts/${name}`)).toBe(true);
  });

  it.each([...declaredPaths])("%s exists on disk", (path) => {
    expect(fontFiles).toContain(path.replace("/fonts/", ""));
  });

  it.each([...declaredPaths])("%s is servable before launch", (path) => {
    expect(PRELAUNCH_PUBLIC_ASSET_PATHS.has(path)).toBe(true);
  });

  it.each([...declaredPaths])("%s is declared on the pre-launch page too", (path) => {
    expect(prelaunch).toContain(path);
  });

  it("declares a token for every family it downloads", () => {
    const families = new Set(
      [...css.matchAll(/font-family:\s*"([^"]+)"/g)].map((match) => match[1]),
    );
    const tokenText = [...tokens.values()].join(" ");
    for (const family of families) {
      expect(tokenText, `${family} has no --font-* token`).toContain(`"${family}"`);
    }
  });

  /*
   * The one that failed. `font-serif` is Tailwind's class for `--font-serif`,
   * `ocade-accent` is the utility that sets `font-family: var(--font-serif)`
   * directly; either counts as the face being rendered somewhere.
   */
  it.each([...tokens.keys()])("--font-%s reaches something that renders", (name) => {
    /*
     * The stylesheet does not count as a user of its own token. Defining a
     * utility that sets `font-family: var(--font-serif)` and then never putting
     * that class on an element is the same dead weight in a different file, and
     * checking the stylesheet would hide exactly that.
     */
    const renderers = sources.filter((file) => !file.endsWith("styles.css"));
    const utilities = [...css.matchAll(/@utility\s+([\w-]+)\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => body.includes(`var(--font-${name})`))
      .map(([, utility]) => utility);
    const used = renderers.some((file) => {
      const text = readFileSync(file, "utf8");
      return (
        new RegExp(`\\bfont-${name}\\b`).test(text) ||
        new RegExp(`var\\(--font-${name}\\)`).test(text) ||
        utilities.some((utility) => new RegExp(`\\b${utility}\\b`).test(text)) ||
        // The sans is the document default rather than a class anybody writes.
        (name === "sans" && css.includes("--default-font-family: var(--font-sans)"))
      );
    });
    expect(used, `--font-${name} is downloaded but never used`).toBe(true);
  });

  it("keeps the whole set inside a first-paint budget", () => {
    const total = fontFiles.reduce((sum, name) => sum + statSync(join(fontsDir, name)).size, 0);
    // 160 KB. Four latin subsets fit; a fifth family, or an unsubset file,
    // does not — which is the point at which somebody has to justify it.
    expect(total).toBeLessThan(160 * 1024);
  });

  it("ships the licence beside every family", () => {
    const licences = readdirSync(fontsDir).filter((name) => name.startsWith("OFL-"));
    expect(licences.length).toBeGreaterThanOrEqual(3);
    for (const licence of licences) {
      expect(readFileSync(join(fontsDir, licence), "utf8")).toContain("SIL Open Font License");
    }
  });
});
