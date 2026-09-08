/**
 * OCADE Identity Contract (Plan §12).
 *
 * The assistant is always presented as OCADE in normal product UI and in its
 * own replies. A backend is an implementation detail, never OCADE's identity.
 * Engineering diagnostics may disclose an implementation only when a person
 * explicitly asks for technical detail; ordinary identity questions must not
 * vary with whichever backend happened to answer the turn.
 *
 * This module is the single source of truth for identity strings. Every
 * assistant surface (chat header, voice intro, disclosure banner, model
 * picker) must import from here.
 */

export const OCADE_IDENTITY = {
  displayName: "OCADE",
  vendor: "CARCC CADANE",
  fullName: "OCADE by CARCC CADANE",
  tagline: "AI workspace for Chat, Cowork and Code",
  statement:
    "I am OCADE, an AI workspace built for Chat, Cowork and Code. I was created by the founder of CARCC CADANE.",
} as const;

/**
 * Confirmed creator wording (decision #1). Truthful about the OCADE PRODUCT —
 * never implies CARCC CADANE trained a third-party foundation model.
 */
export function ocadeCreatorStatement(): string {
  return OCADE_IDENTITY.statement;
}

/**
 * Casual introduction — used in chat greetings, voice hellos, empty states.
 * Must never leak provider identity.
 */
export function ocadeIntro(): string {
  return ocadeCreatorStatement();
}

/**
 * A deterministic product answer for direct identity questions.
 *
 * This is deliberately independent of a provider, model, runtime, or device.
 * It is safe to return before inference starts, so an unavailable backend can
 * never make OCADE forget who it is. Technical implementation questions use
 * the separate disclosure path below and are not treated as product identity.
 */
export function ocadeIdentityAnswer(userMessage: string): string | null {
  const text = userMessage.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  if (/\b(how does|how do) ocade work\b/.test(text)) {
    return `${ocadeCreatorStatement()} OCADE brings Chat, Cowork and Code into one workspace. It selects an available intelligence path, keeps tools behind permissions, and connects conversations with projects, tasks and artifacts. When a supported local or paired capability is available, OCADE can work with it; every action remains subject to the current permission and availability checks.`;
  }

  if (/\b(what is|tell me about|explain) ocade\b/.test(text)) {
    return `${ocadeCreatorStatement()} OCADE is an AI workspace where you can talk through work in Chat, plan and carry out approved tasks in Cowork, and work with code in Code. Projects, tasks and artifacts keep that work connected.`;
  }

  if (
    /\b(who are you|what are you|who created (?:you|ocade)|who made (?:you|ocade)|who built (?:you|ocade)|who is behind ocade)\b/.test(
      text,
    )
  ) {
    return ocadeCreatorStatement();
  }

  return null;
}

/** True only for the direct, backend-independent product questions above. */
export function isDirectOcadeIdentityQuestion(userMessage: string): boolean {
  return ocadeIdentityAnswer(userMessage) !== null;
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
