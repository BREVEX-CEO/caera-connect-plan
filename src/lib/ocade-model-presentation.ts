export type OcadeEnginePresentation = {
  label: string;
  description: string;
};

/**
 * Customer-facing names for local engine implementations.
 *
 * Runtime identifiers are implementation/provenance details. They are needed
 * by the local bridge, verification receipts and Advanced diagnostics, but they
 * are not product choices a normal OCADE user should have to understand.
 *
 * This deliberately does NOT mutate or disguise the actual runtime id. The id
 * continues to flow to the bridge unchanged; only presentation is mapped here.
 */
const PRESENTATION_BY_RUNTIME_ID: Readonly<Record<string, OcadeEnginePresentation>> = {
  "smollm2:135m": {
    label: "OCADE Compact",
    description: "Smallest download for lightweight local tasks.",
  },
  "qwen2.5:0.5b": {
    label: "OCADE Standard",
    description: "Balanced local intelligence for everyday work.",
  },
  "qwen2.5-coder:1.5b": {
    label: "OCADE Code",
    description: "Local engine tuned for code and technical work.",
  },
};

export function presentOcadeEngine(runtimeId: string): OcadeEnginePresentation {
  return (
    PRESENTATION_BY_RUNTIME_ID[runtimeId] ?? {
      label: "OCADE Local Intelligence",
      description: "On-device intelligence managed by OCADE.",
    }
  );
}

/**
 * Advanced diagnostics may show the factual runtime id. Normal product UI
 * should call `presentOcadeEngine()` instead.
 */
export function runtimeEngineIdForDiagnostics(runtimeId: string): string {
  return runtimeId;
}
