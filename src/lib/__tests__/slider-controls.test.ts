import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const VOICE = readFileSync("src/routes/_authenticated/settings.voice.tsx", "utf8");
const APPEARANCE = readFileSync("src/routes/_authenticated/settings.appearance.tsx", "utf8");

describe("reachable OCADE slider controls", () => {
  it("provides labelled speed, pitch and cursor-size sliders", () => {
    expect(VOICE).toMatch(/Speed — \{prefs\.rate\.toFixed\(1\)\}×[\s\S]*?type="range"/);
    expect(VOICE).toMatch(/Pitch — \{prefs\.pitch\.toFixed\(1\)\}[\s\S]*?type="range"/);
    expect(APPEARANCE).toMatch(/aria-label="Cursor size"[\s\S]*?type="range"/);
  });

  it("defines finite intervals, handles and state-changing interactions", () => {
    for (const source of [VOICE, APPEARANCE]) {
      expect(source).toMatch(/type="range"/);
      expect(source).toMatch(/\bmin=\{/);
      expect(source).toMatch(/\bmax=\{/);
      expect(source).toMatch(/\bstep=\{/);
      expect(source).toMatch(/\bvalue=\{/);
      expect(source).toMatch(/\bonChange=\{/);
      expect(source).toMatch(/accent-/);
    }
  });
});
