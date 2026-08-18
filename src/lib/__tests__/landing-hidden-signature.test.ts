import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/components/landing/HiddenSignature.tsx", "utf8");
const css = readFileSync("src/motion-upgrades.css", "utf8");

describe("landing hidden signature", () => {
  it("contains exactly the intended hidden values", () => {
    expect(component).toContain(">HAANS<");
    expect(component).toContain(">44<");
    expect(component).toContain(">28<");
    expect(component).not.toContain("44/8");
  });

  it("caps the official signature at five percent opacity", () => {
    expect(css).toMatch(/\.ocade-hidden-signature[\s\S]*?opacity:\s*0\.05\s*;/);
  });

  it("keeps the signature decorative", () => {
    expect(component).toContain('aria-hidden="true"');
    expect(component).toContain('data-hidden-signature="HAANS-44-28"');
  });
});
