import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { COMPANY_FACTS } from "@/config/company-facts";

const root = process.cwd();

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");
}

function pngDimensions(path: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(root, path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function activeTextFiles(start: string): string[] {
  const absolute = resolve(root, start);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [absolute];

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (["__snapshots__", "audit", "release"].includes(entry.name)) continue;
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...activeTextFiles(path));
    else if (
      [
        ".css",
        ".html",
        ".js",
        ".json",
        ".md",
        ".mjs",
        ".mts",
        ".rs",
        ".toml",
        ".ts",
        ".tsx",
        ".xml",
      ].includes(extname(entry.name))
    ) {
      files.push(path);
    }
  }
  return files;
}

describe("CARCC CADANE release brand authority", () => {
  it("pins the exact official identity and launch instant", () => {
    expect(COMPANY_FACTS).toMatchObject({
      companyName: "CARCC CADANE",
      productFormalName: "OCADE BY CARCC CADANE",
      tagline: "Command the Next Era.",
      founderLeadershipStatement: "HAANS ANTONI — CEO, Chairman and Founder",
      foundingDateLabel: "28 August 2026",
      launchAtIso: "2026-08-28T02:58:00Z",
    });
  });

  it("keeps the supplied canonical artwork byte-for-byte exact", () => {
    expect(sha256("public/brand/ocade-carcc-wordmark.png")).toBe(
      "d81194bd1ba0fe290a403d576543c7f4fb310dd423d2d727281149786f8ddb34",
    );
    expect(sha256("public/brand/ocade-carcc-mark.png")).toBe(
      "27f4c417e929d00e52f0ec83d79475a439521b9fe1a029f564642e4dbd0d9111",
    );
    expect(pngDimensions("public/brand/ocade-carcc-wordmark.png")).toEqual({
      width: 2172,
      height: 724,
    });
    expect(pngDimensions("public/brand/ocade-carcc-mark.png")).toEqual({
      width: 1254,
      height: 1254,
    });
  });

  it("ships correctly sized web, PWA, extension, mobile and desktop derivatives", () => {
    const expected: Record<string, [number, number]> = {
      "public/apple-touch-icon.png": [180, 180],
      "public/icons/ocade-32.png": [32, 32],
      "public/icons/ocade-192.png": [192, 192],
      "public/icons/ocade-512.png": [512, 512],
      "extension/icons/ocade-16.png": [16, 16],
      "extension/icons/ocade-32.png": [32, 32],
      "extension/icons/ocade-48.png": [48, 48],
      "extension/icons/ocade-128.png": [128, 128],
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png": [1024, 1024],
      "native/companion/tauri/icons/32x32.png": [32, 32],
      "native/companion/tauri/icons/128x128.png": [128, 128],
      "native/companion/tauri/icons/128x128@2x.png": [256, 256],
    };

    for (const [path, [width, height]] of Object.entries(expected)) {
      expect(pngDimensions(path), path).toEqual({ width, height });
    }
    expect(readFileSync(resolve(root, "public/favicon.ico")).readUInt16LE(2)).toBe(1);
    expect(
      readFileSync(resolve(root, "native/companion/tauri/icons/icon.ico")).readUInt16LE(2),
    ).toBe(1);
  });

  it("does not leak the retired public brand through active product surfaces", () => {
    const roots = [
      "src",
      "public",
      "extension",
      "native/companion/ui",
      "native/companion/safety",
      "native/companion/tauri",
      "README.md",
      "LICENSE",
      "docs/legal",
    ];
    const retired = [
      new RegExp(["CAERA", "CADANE"].join(" "), "i"),
      new RegExp(["CAERA", "Native", "Companion"].join(" "), "i"),
      new RegExp(["CAERA", "Companion"].join(" "), "i"),
    ];
    const failures: string[] = [];

    for (const path of roots.flatMap(activeTextFiles)) {
      const content = readFileSync(path, "utf8");
      for (const pattern of retired) {
        if (pattern.test(content)) {
          failures.push(`${relative(root, path)} contains ${pattern.source}`);
        }
      }
    }

    expect(failures).toEqual([]);
    expect(existsSync(resolve(root, "public/brand/ocade-wordmark.png"))).toBe(false);
    expect(existsSync(resolve(root, "public/brand/ocade-mark.png"))).toBe(false);
  });
});
