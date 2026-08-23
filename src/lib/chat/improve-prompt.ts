/**
 * Rewriting the user's draft, on the user's own machine.
 *
 * THIS WAS THE CLEAREST LEAK IN THE PRODUCT.
 *
 * "Improve prompt" was a server function. It read `LOVABLE_API_KEY`, called
 * `generateText` against google/gemini-3.5-flash, and returned the rewrite. It
 * did not consult `resolveEngine`, did not look at the privacy mode and did
 * not ask. So whatever was in the composer — in a Browser-Only conversation,
 * in a PC-Vault conversation, in any conversation — went to Google the moment
 * somebody pressed the wand, with no dialog and nothing on screen to say so.
 *
 * Improving a prompt is language-model work, and the constitution says
 * language-model work runs locally. So it runs through exactly the path an
 * ordinary message runs through: same engine, same constitution, same device.
 */
import { reason } from "@/lib/reasoning/engine";
import type { ReasonDeps } from "@/lib/reasoning/engine";
import { assembleSystemPrompt } from "@/lib/prompt/assemble";

export interface ImprovePromptResult {
  ok: boolean;
  improved?: string;
  reason?: string;
}

/**
 * The instruction is deliberately narrow.
 *
 * A rewriter that is allowed to "make it better" adds tasks the user did not
 * ask for, and the user then sends those tasks without noticing. Clarity only,
 * meaning preserved, nothing invented.
 */
const REWRITE_INSTRUCTION =
  "Rewrite the following prompt to be clearer, more specific and more complete, WITHOUT changing the " +
  "user's meaning, intent, task or constraints. Keep the same language. Preserve every fact the user " +
  "gave. Do not add new tasks, do not invent details and do not answer the prompt. Return ONLY the " +
  "improved prompt text, with no preamble, no explanation and no quotation marks.";

export async function improvePromptLocally(
  deps: ReasonDeps,
  text: string,
  options: { modelId?: string; signal?: AbortSignal; thinking?: boolean } = {},
): Promise<ImprovePromptResult> {
  const draft = text.trim();
  if (!draft) return { ok: false, reason: "There is nothing in the box to improve." };
  if (draft.length > 4000) {
    return { ok: false, reason: "That draft is too long to improve in one pass." };
  }

  const result = await reason(deps, {
    messages: [
      {
        role: "system",
        content: assembleSystemPrompt({
          now: new Date(),
          surface: "chat",
          // Rewriting is a short, bounded transformation. Deliberating over it
          // costs seconds on a laptop with no acceleration and changes nothing.
          mode: "fast",
          local: true,
        }),
      },
      { role: "user", content: `${REWRITE_INSTRUCTION}\n\n---\n${draft}\n---` },
    ],
    task: "general",
    ...(options.modelId ? { modelId: options.modelId } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason ?? "OCADE could not improve that prompt here." };
  }

  /*
   * Strip a wrapping quote pair if the model added one despite being told not
   * to, and refuse an empty rewrite rather than blanking the user's draft —
   * losing what somebody typed is worse than not improving it.
   */
  const improved = result.text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!improved)
    return { ok: false, reason: "OCADE returned an empty rewrite, so your draft is unchanged." };
  return { ok: true, improved };
}
