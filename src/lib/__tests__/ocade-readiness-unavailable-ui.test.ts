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

  it("#45 still refuses the media it has no runtime for", () => {
    /*
     * THE FOUR REFUSALS SURVIVED, AS ONE SENTENCE RATHER THAN FOUR CARDS.
     *
     * Studio marked Images, Diagrams, Presentations and Spreadsheets
     * NOT_CONFIGURED — four cards that looked like features with the lights
     * off. §4 folded Studio into Artifacts and §17 calls that shape a wall of
     * buttons, so the refusal is now stated once, by name, in prose. What must
     * not happen is a control appearing for any of them.
     */
    const produced = expectAll("src/components/ocade/artifacts/WhatOcadeCanProduce.tsx", [
      /Image generation, diagram editing, presentation authoring and spreadsheet workbooks have/,
      /no runtime in this build/,
      /does not offer a control for a medium it cannot produce/,
    ]);
    expect(produced).not.toMatch(/status: "READY"/);
  });

  it("#46 keeps external sharing of an artifact unavailable, and says what IS shareable", () => {
    /*
     * §4 folded the Shared page into Artifacts, and the fold corrected it. The
     * old page said this build has no share-link service at all, which stopped
     * being true when Chat gained revocable, expiring conversation links. The
     * boundary that still holds is the one about artifacts.
     */
    expectAll("src/components/ocade/artifacts/SharingBoundary.tsx", [
      /CapabilityBadge status="NOT_CONFIGURED"/,
      /no share token, public URL or anonymous read path for an artifact/i,
      /is published merely because it exists/i,
    ]);
  });

  it("#48 keeps the global knowledge index unconfigured", () => {
    // §4: "knowledge into Projects", because project files ARE the knowledge a
    // person adds. The statement moved to where those files live.
    expectAll("src/routes/_authenticated/ocade.projects.tsx", [
      /keeps no always-on index across every file and conversation/i,
      /neither is a hidden retrieval service reading/i,
    ]);
  });
});
