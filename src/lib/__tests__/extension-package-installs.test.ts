import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";

/**
 * THE PACKAGED EXTENSION MUST BE INSTALLABLE, NOT MERELY PRESENT.
 *
 * WHAT SHIPPED, AND WHY NOTHING NOTICED. `package-extension.mjs` built the
 * archive by walking two lists in lockstep — an alphabetically sorted list of
 * names and a list of paths in a different order — so every entry received
 * another entry's bytes. The published `ocade-cowork-1.0.0.zip` contained a PNG
 * named `manifest.json`. Chrome cannot parse that, so the extension could not
 * install at all.
 *
 * The script's own verification pass repeated the identical pairing mistake:
 * it compared the manifest's bytes against the entry the builder had filled
 * with the manifest's bytes, found them equal, and declared the package
 * verified. A verifier that echoes the builder's error confirms it.
 *
 * So this reads the SHIPPED ARTIFACT and asks the questions a store asks, with
 * no reference to how it was made. That independence is the point: any check
 * written inside the packager can be fooled by the packager.
 */

const PACKAGE = "release/packages/ocade-cowork-1.0.0.zip";
const SOURCE = "extension";

const archive = unzipSync(new Uint8Array(readFileSync(PACKAGE)));
const names = Object.keys(archive).sort();

/** What Chrome requires to load an unpacked or packed MV3 extension. */
const REQUIRED = [
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
].sort();

describe("the shipped package is a loadable extension", () => {
  it("contains exactly the files the extension needs", () => {
    expect(names).toEqual(REQUIRED);
  });

  it("has a manifest.json that is actually a manifest", () => {
    /*
     * THE ASSERTION THAT WOULD HAVE CAUGHT IT. Every byte-for-byte check passes
     * against a consistently shuffled archive; parsing the manifest does not.
     */
    const manifest = JSON.parse(new TextDecoder().decode(archive["manifest.json"]!));
    expect(manifest.manifest_version).toBe(3);
    expect(typeof manifest.version).toBe("string");
    expect(manifest.name).toContain("OCADE");
  });

  it("has icons that are actually PNGs", () => {
    // Same defect from the other side: an icon entry holding JSON.
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (const name of names.filter((entry) => entry.endsWith(".png"))) {
      expect([...archive[name]!.slice(0, 8)], name).toEqual(png);
    }
  });

  it("has scripts that are actually scripts", () => {
    for (const name of names.filter((entry) => entry.endsWith(".js"))) {
      const text = new TextDecoder().decode(archive[name]!.slice(0, 400));
      expect(text, name).toMatch(/\/\*|\/\/|function|const |import |export /);
    }
  });
});

describe("the package matches the source it claims to be built from", () => {
  it("carries the current bytes of every file, not a stale copy", () => {
    /*
     * A package that installs but is a version behind is its own defect: the
     * fix somebody shipped is not the code anybody runs.
     */
    const stale: string[] = [];
    for (const name of names) {
      const packaged = createHash("sha256").update(Buffer.from(archive[name]!)).digest("hex");
      const source = createHash("sha256")
        .update(readFileSync(join(SOURCE, name)))
        .digest("hex");
      if (packaged !== source) stale.push(name);
    }
    expect(stale, "entries that differ from extension/").toEqual([]);
  });

  it("declares the same version as the source manifest", () => {
    const packaged = JSON.parse(new TextDecoder().decode(archive["manifest.json"]!));
    const source = JSON.parse(readFileSync(join(SOURCE, "manifest.json"), "utf8"));
    expect(packaged.version).toBe(source.version);
    expect(PACKAGE).toContain(source.version);
  });

  it("still requests no standing host permissions", () => {
    // The packaging script refuses to build with any, and the shipped artifact
    // is where that promise has to hold.
    const manifest = JSON.parse(new TextDecoder().decode(archive["manifest.json"]!));
    expect(manifest.host_permissions ?? []).toEqual([]);
  });
});

describe("the release receipt describes the artifact that exists", () => {
  it("records the package's real size and digest", () => {
    /*
     * A receipt is a claim about a file. Regenerating one without the other is
     * how a receipt comes to vouch for bytes nobody has.
     */
    const receipt = JSON.parse(readFileSync("release/OCADE_EXTENSION_STORE_PACKAGE.json", "utf8"));
    const bytes = readFileSync(PACKAGE);
    expect(receipt.bytes).toBe(bytes.length);
    expect(receipt.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(receipt.package).toBe(PACKAGE);
  });
});
