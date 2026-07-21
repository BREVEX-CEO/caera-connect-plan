/**
 * OCADE Identity Contract (Plan §12).
 *
 * The assistant is always presented as "OCADE by CAERA CADANE" in conversation
 * UI. Provider identity (OpenAI, Ollama, etc.) is NEVER falsified — it is
 * hidden from casual chat but visible in Model Settings, usage records, and
 * technical diagnostics, and OCADE truthfully names the selected model when
 * directly asked.
 *
 * This module is the single source of truth for identity strings. Every
 * assistant surface (chat header, voice intro, disclosure banner, model
 * picker) must import from here.
 */

export const OCADE_IDENTITY = {
  displayName: "OCADE",
  vendor: "CAERA CADANE",
  fullName: "OCADE by CAERA CADANE",
  tagline: "Your CAERA CADANE assistant",
} as const;

/**
 * Casual introduction — used in chat greetings, voice hellos, empty states.
 * Must never leak provider identity.
 */
export function ocadeIntro(): string {
  return `I'm ${OCADE_IDENTITY.fullName}.`;
}

/**
 * Honest disclosure — used when the user asks "what model are you?",
 * "who made you?", "are you ChatGPT?", or opens Model Settings.
 *
 * Never fabricate. If provider metadata is missing, say so.
 */
export interface ProviderContext {
  providerId?: string | null;   // e.g. "openai", "ollama"
  modelId?: string | null;      // e.g. "gpt-4o-mini", "llama3.1:8b"
  locality?: "local" | "cloud" | null;
}

export function ocadeHonestDisclosure(ctx: ProviderContext): string {
  const parts = [`I'm ${OCADE_IDENTITY.fullName}, the assistant built by ${OCADE_IDENTITY.vendor}.`];
  if (ctx.providerId && ctx.modelId) {
    parts.push(
      `For this request I'm running on ${ctx.modelId} via ${ctx.providerId}${
        ctx.locality ? ` (${ctx.locality})` : ""
      }. You can change this in Model Settings.`,
    );
  } else if (ctx.providerId) {
    parts.push(`For this request I'm using ${ctx.providerId}. You can change this in Model Settings.`);
  } else {
    parts.push("The active model is shown in Model Settings.");
  }
  return parts.join(" ");
}

/**
 * Trigger phrases that must route to honest disclosure instead of casual intro.
 * Match case-insensitively on the user's raw message.
 */
const IDENTITY_TRIGGERS = [
  "what model",
  "which model",
  "what llm",
  "are you chatgpt",
  "are you gpt",
  "are you claude",
  "are you gemini",
  "are you llama",
  "who made you",
  "who built you",
  "what are you built on",
  "what powers you",
  "what's your provider",
  "what is your provider",
];

export function isIdentityProbe(userMessage: string): boolean {
  const s = userMessage.toLowerCase();
  return IDENTITY_TRIGGERS.some((t) => s.includes(t));
}
