/**
 * OCADE Identity Contract (Plan §12).
 *
 * The assistant is always presented as "OCADE by CARCC CADANE" in conversation
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
  vendor: "CARCC CADANE",
  fullName: "OCADE by CARCC CADANE",
  tagline: "Your CARCC CADANE assistant",
} as const;

/**
 * Confirmed creator wording (decision #1). Truthful about the OCADE PRODUCT —
 * never implies CARCC CADANE trained a third-party foundation model.
 */
export function ocadeCreatorStatement(): string {
  return `I am OCADE, developed and created by ${OCADE_IDENTITY.vendor}.`;
}

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
  providerId?: string | null; // e.g. "openai", "ollama"
  modelId?: string | null; // e.g. "gpt-4o-mini", "llama3.1:8b"
  locality?: "local" | "cloud" | null;
}

export function ocadeHonestDisclosure(ctx: ProviderContext): string {
  const parts = [ocadeCreatorStatement()];
  if (ctx.providerId && ctx.modelId) {
    parts.push(
      `For this request I'm running on ${ctx.modelId} via ${ctx.providerId}${
        ctx.locality ? ` (${ctx.locality})` : ""
      }. You can change this in Model Settings.`,
    );
  } else if (ctx.providerId) {
    parts.push(
      `For this request I'm using ${ctx.providerId}. You can change this in Model Settings.`,
    );
  } else {
    parts.push("The active model is shown in Model Settings.");
  }
  return parts.join(" ");
}

/**
 * Ordinary-chat identity line (decisions #10, #18). Truthful but expressed in
 * OCADE capability terms — it never prints the raw runtime/provider/model name.
 * The exact model stays available in advanced/technical settings only.
 */
export function ocadeChatCapabilityDisclosure(capabilityLabel: string): string {
  return `${ocadeCreatorStatement()} For this request I'm using ${capabilityLabel}. Exact technical details are in advanced settings.`;
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
