/**
 * OCADE engine router (Plan §13, decisions #13, #16).
 *
 * Pure resolution of "which engine serves this request" from the user's routing
 * preference and the platform's available capabilities. This replaces the
 * previous hardcoded provider in the chat endpoint. It is provider-neutral: the
 * chat route builds the actual model from `provider` so a provider can be added
 * or removed without rewriting chat logic.
 *
 * Local (Ollama) and native execution have no server-side path — they run on the
 * device via the Native Companion. Until that is connected, this resolver returns
 * an honest `unavailable` result rather than silently substituting cloud. The
 * ask-before-cloud fallback chain is added in P4.
 *
 * This module is pure and carries NO secrets — callers pass booleans for key
 * presence so it stays unit-testable without env or network.
 */
import { capabilityLabelFor, type OcadeCapabilityLabel } from "./ocade-capability-labels";

export type ProviderRouting =
  | "auto"
  | "lovable_gateway"
  | "openai_direct"
  | "ollama_local"
  | "caera_native";

export interface EngineResolveInput {
  routing: ProviderRouting;
  hasLovableKey: boolean;
  hasOpenAIKey: boolean;
  openaiDirectEnabled: boolean;
  /** Model id already chosen (session override or default). */
  requestedModel: string;
}

export type EngineUnavailableCode =
  | "local_requires_companion"
  | "native_not_released"
  | "openai_not_configured"
  | "cloud_not_configured";

export type EngineResolution =
  | { kind: "cloud"; provider: "lovable" | "openai"; model: string; label: OcadeCapabilityLabel }
  | { kind: "unavailable"; code: EngineUnavailableCode; reason: string };

export function resolveOcadeEngine(input: EngineResolveInput): EngineResolution {
  switch (input.routing) {
    case "ollama_local":
      return {
        kind: "unavailable",
        code: "local_requires_companion",
        reason:
          "OCADE Local runs on your device through the CAERA Native Companion, which isn't connected yet. Connect it, or switch to OCADE Cloud.",
      };
    case "caera_native":
      return {
        kind: "unavailable",
        code: "native_not_released",
        reason: "This OCADE engine isn't available yet.",
      };
    case "openai_direct": {
      if (input.openaiDirectEnabled && input.hasOpenAIKey) {
        return {
          kind: "cloud",
          provider: "openai",
          // Direct OpenAI expects the bare model id, not the gateway-prefixed one.
          model: input.requestedModel.replace(/^openai\//, ""),
          label: capabilityLabelFor({ locality: "cloud" }),
        };
      }
      return {
        kind: "unavailable",
        code: "openai_not_configured",
        reason: "This OCADE Cloud engine isn't configured. Choose OCADE Cloud or OCADE Automatic.",
      };
    }
    case "auto":
    case "lovable_gateway":
    default: {
      if (input.hasLovableKey) {
        return {
          kind: "cloud",
          provider: "lovable",
          model: input.requestedModel,
          label: capabilityLabelFor({ locality: "cloud", automatic: input.routing === "auto" }),
        };
      }
      return {
        kind: "unavailable",
        code: "cloud_not_configured",
        reason: "OCADE Cloud isn't available right now. Please try again shortly.",
      };
    }
  }
}
