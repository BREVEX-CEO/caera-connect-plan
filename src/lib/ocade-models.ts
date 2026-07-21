/**
 * Client-safe OCADE model catalog. Display names and capability flags only —
 * no gateway or secrets. Server code is in ai-gateway.server.ts.
 */

export type OcadeModelId =
  | "google/gemini-3.5-flash"
  | "google/gemini-3.1-pro-preview"
  | "openai/gpt-5.4-mini";

export interface OcadeModelInfo {
  id: OcadeModelId;
  display: string;
  provider: string;
  locality: "cloud" | "local";
  vision: boolean;
  description: string;
}

export const OCADE_MODELS: OcadeModelInfo[] = [
  {
    id: "google/gemini-3.5-flash",
    display: "Gemini 3.5 Flash",
    provider: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Balanced default. Fast, accepts images.",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    display: "Gemini 3.1 Pro (preview)",
    provider: "Google via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "Stronger reasoning for complex tasks.",
  },
  {
    id: "openai/gpt-5.4-mini",
    display: "GPT-5.4 mini",
    provider: "OpenAI via Lovable AI",
    locality: "cloud",
    vision: true,
    description: "OpenAI alternative for varied styles.",
  },
];

export const OCADE_DEFAULT_MODEL_ID: OcadeModelId = "google/gemini-3.5-flash";

export function getOcadeModel(id: string): OcadeModelInfo {
  return OCADE_MODELS.find((m) => m.id === id) ?? OCADE_MODELS[0];
}
