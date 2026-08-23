import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("mobile dialog layout", () => {
  it("keeps every dialog inside the horizontal viewport", () => {
    const source = readFileSync(resolve("src/components/ui/dialog.tsx"), "utf8");
    expect(source).toContain("w-[calc(100%-2rem)]");
    expect(source).not.toContain("grid w-full max-w-lg");
  });

  it("keeps the mandatory consent gate scrollable inside short viewports", () => {
    const source = readFileSync(resolve("src/components/legal/LegalConsentGate.tsx"), "utf8");
    expect(source).toContain("max-h-[calc(100dvh-2rem)]");
    expect(source).toContain("overflow-y-auto");
  });

  it("does not apply the centring translation twice under Tailwind 4", () => {
    const source = readFileSync(resolve("src/styles.css"), "utf8");
    const rule = source.match(/\.ocade-depth-centered\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(rule).toContain("transform: translateZ(");
    expect(rule).not.toContain("translate(-50%, -50%)");
  });
});
