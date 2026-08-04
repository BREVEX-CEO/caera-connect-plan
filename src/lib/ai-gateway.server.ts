/**
 * Lovable AI Gateway helper (server-only).
 * Do not import from client code. Callers read process.env inside the handler.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableGateway(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Direct OpenAI provider (server-only). Real alternate cloud path used when the
 * user selects OpenAI-direct routing AND the platform has an OPENAI_API_KEY.
 * The key is admin-managed infra and never reaches the client (decision #16).
 */
export function createOpenAIDirectGateway(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export const OCADE_DEFAULT_MODEL = "google/gemini-3.5-flash";
export const OCADE_MODEL_DISPLAY: Record<
  string,
  { display: string; provider: string; locality: "cloud" | "local"; vision: boolean }
> = {
  "google/gemini-3.5-flash": {
    display: "Gemini 3.5 Flash",
    provider: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
  },
  "google/gemini-3.1-pro-preview": {
    display: "Gemini 3.1 Pro (preview)",
    provider: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
  },
  "openai/gpt-5.4-mini": {
    display: "GPT-5.4 mini",
    provider: "OpenAI via Lovable AI",
    locality: "cloud",
    vision: true,
  },
};

export function describeModel(id: string) {
  return (
    OCADE_MODEL_DISPLAY[id] ?? {
      display: id,
      provider: "Lovable AI",
      locality: "cloud" as const,
      vision: false,
    }
  );
}
