import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SETTINGS = readFileSync("src/components/settings/BrowserStoragePanel.tsx", "utf8");
const RENDERED_SETTINGS = SETTINGS.replace(/\/\*[\s\S]*?\*\//g, "");
const SETUP = readFileSync("src/components/ocade/setup/SetupExperience.tsx", "utf8");
const FIRST_INSTALL_GATE = readFileSync(
  "src/components/ocade/setup/FirstInstallationGate.tsx",
  "utf8",
);
const AUTHENTICATED_LAYOUT = readFileSync("src/routes/_authenticated/route.tsx", "utf8");

describe("ordinary OCADE Intelligence presentation", () => {
  it("uses the canonical ModelVault view instead of raw engine files", () => {
    expect(SETTINGS).toContain("modelVault.installationView()");
    expect(SETTINGS).not.toContain("storage.models");
    expect(SETTINGS).not.toContain("model.key");
    expect(SETTINGS).not.toContain("model.verified");
  });

  it("shows only product language, never model implementation details", () => {
    expect(RENDERED_SETTINGS).toContain("OCADE Intelligence");
    expect(RENDERED_SETTINGS).toContain("Stored securely on this device");
    expect(RENDERED_SETTINGS).toContain("Remove OCADE Intelligence");
    expect(RENDERED_SETTINGS).not.toMatch(
      /Qwen|GGUF|quantisation|fingerprint verified|not verified/i,
    );
    expect(RENDERED_SETTINGS).not.toMatch(/\b(?:KB|MB|GB)\b/);
  });

  it("blocks the first signed-in installation with one stable setup experience", () => {
    expect(AUTHENTICATED_LAYOUT).toContain("<FirstInstallationGate enabled={signedIn}>");
    expect(FIRST_INSTALL_GATE).toContain('role="dialog"');
    expect(FIRST_INSTALL_GATE).toContain('aria-modal="true"');
    expect(FIRST_INSTALL_GATE).toContain('import("./SetupExperience")');
    expect(FIRST_INSTALL_GATE).toContain("const concealed = checking || locked");
    expect(FIRST_INSTALL_GATE).toContain('"invisible pointer-events-none select-none"');
    expect(SETUP).toMatch(
      /s === "verifying" \|\| s === "loading" \|\| s === "warming"[\s\S]*line: "Almost ready"/,
    );
  });
});
