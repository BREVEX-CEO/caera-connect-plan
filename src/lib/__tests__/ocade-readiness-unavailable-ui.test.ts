import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const expectAll = (path: string, patterns: RegExp[]) => {
  const text = source(path);
  for (const pattern of patterns) expect(text, `${path} should match ${pattern}`).toMatch(pattern);
  return text;
};

describe("OCADE 77 — unavailable UI boundaries", () => {
  it("#18 disables desktop installer/download", () => {
    expectAll("src/lib/capabilities/use-capabilities.ts", [
      /report\.id === "desktopInstaller"/,
      /status: "UNAVAILABLE" as const/,
      /Desktop downloads are disabled for the current free launch/,
    ]);
    expectAll("src/routes/download.tsx", [
      /createFileRoute\("\/download"\)/,
      /Signing and clean-device test required/,
    ]);
    expect(source("src/routes/download.tsx")).not.toMatch(/beforeLoad/);
  });

  it("#20 gates updater/signing/notarization claims", () => {
    expectAll("README.md", [
      /public desktop downloads\/releases are intentionally disabled/i,
      /notarization/i,
      /signing/i,
    ]);
    expectAll(".github/workflows/release.yml", [/if: \$\{\{ false \}\}/]);
  });

  it("does not let a cold browser engine be sealed before its first completed answer", () => {
    /*
     * The seal stops the model download too, so sealing before the engine
     * exists leaves a conversation that can neither answer nor fetch what it
     * would take to answer. Unsealing stays available unconditionally.
     */
    expectAll("src/routes/_authenticated/ocade.index.tsx", [
      /const canStartSeal =\s*\n?\s*localEngineReady \|\|/,
      /disabled=\{!sealed && !canStartSeal\}/,
      /if \(!sealed && !canStartSeal\) return;/,
      /Send one message first so OCADE can finish preparing its local engine/,
    ]);
  });

  it("states the FREE LAUNCH payment boundary in the consent gate", () => {
    const gate = expectAll("src/components/legal/LegalConsentGate.tsx", [
      /Purchases and payment collection are/,
      /disabled during FREE LAUNCH/,
    ]);
    expect(gate).not.toMatch(/Payment credentials are entered/);
  });

  it("#45 marks unwired Studio generators NOT_CONFIGURED", () => {
    expectAll("src/routes/_authenticated/ocade.studio.tsx", [
      /label: "Images"[\s\S]*?status: "NOT_CONFIGURED"/,
      /label: "Diagrams"[\s\S]*?status: "NOT_CONFIGURED"/,
      /label: "Presentations"[\s\S]*?status: "NOT_CONFIGURED"/,
      /label: "Spreadsheets"[\s\S]*?status: "NOT_CONFIGURED"/,
    ]);
  });

  it("#46 keeps external sharing unavailable", () => {
    expectAll("src/routes/_authenticated/ocade.shared.tsx", [
      /CapabilityBadge status="NOT_CONFIGURED"/,
      /No share token, public URL, recipient grant, or anonymous read path is configured/,
      /will not imply that an item was shared/i,
    ]);
  });

  it("#48 keeps the global knowledge index unconfigured", () => {
    expectAll("src/routes/_authenticated/ocade.knowledge.tsx", [
      /Global knowledge index/,
      /CapabilityBadge status="NOT_CONFIGURED"/,
      /does not currently maintain a separate always-on vector index/i,
    ]);
  });
});
