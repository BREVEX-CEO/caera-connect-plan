import { OCADE_77_READINESS as HISTORICAL_77 } from "./ocade-77-readiness.mjs";

/**
 * Current 77-item authority.
 *
 * The reconstructed historical ledger predated the local-only architecture and
 * contains four cloud-era descriptions. Preserve IDs/classifications/counts,
 * but supersede those descriptions/evidence with the current product contract.
 */
const OVERRIDES = new Map([
  [
    11,
    {
      requirement: "Public cloud-model inference is structurally removed; AI routing is local-only",
      evidence: [
        "scripts/check-local-only-ai.mjs",
        "src/lib/engine/resolve.ts",
        "src/lib/ocade-models.ts",
        "src/lib/engine/__tests__/resolve-local-only.test.ts",
      ],
    },
  ],
  [
    21,
    {
      requirement: "Authenticated OCADE Chat generates on-device and the old server AI route is retired fail-closed",
      evidence: [
        "src/routes/_authenticated/ocade.tsx",
        "src/components/ocade/LocalOnlyChatWorkspace.tsx",
        "src/routes/api/ocade.chat.ts",
      ],
    },
  ],
  [
    26,
    {
      requirement: "Chat local-engine failures are explicit and never trigger a remote-model fallback",
      evidence: [
        "src/lib/chat/use-local-chat-engine.ts",
        "src/lib/engine/resolve.ts",
        "src/lib/engine/__tests__/resolve-local-only.test.ts",
      ],
    },
  ],
  [
    51,
    {
      requirement: "Browser-local AI readiness is evidence-driven with WebGPU, measured promotion and WASM fallback",
      evidence: [
        "src/lib/brain/browser-catalogue.ts",
        "src/lib/brain/adapters/browser-webgpu.ts",
        "src/lib/brain/adapters/browser-wasm.ts",
        "src/lib/brain/adapters/shared-browser.ts",
      ],
    },
  ],
]);

export const OCADE_77_READINESS = HISTORICAL_77.map((item) => {
  const override = OVERRIDES.get(item.id);
  return override ? { ...item, ...override } : item;
});

if (OCADE_77_READINESS.length !== 77) {
  throw new Error(`Current OCADE readiness authority must remain exactly 77 rows; found ${OCADE_77_READINESS.length}.`);
}
