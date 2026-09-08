/**
 * Publishing a help article. The one write path — PLAN.md §L, §G.
 *
 * WHY THIS IS NOT IN `support/catalogue.ts`, WHICH IS WHERE IT STARTED. The
 * catalogue is read by `/support`, `/support/$slug`, `/faq` and site search —
 * public pages, all of them lazy. Putting the writer there meant the support
 * modules imported `security/reauthentication` (to turn the database's refusal
 * into a password prompt), and Vite's chunk groups pull dependencies
 * recursively: the help chunk adopted the whole of `src/lib/security/`, the
 * entry needs the assurance rule for its authenticated route gate, and the
 * entry therefore imported twenty-four kilobytes of help prose on first paint.
 * The budget gate caught it.
 *
 * Splitting the module fixes it at the cause rather than with a chunk group:
 * reading help content and publishing it are different jobs with different
 * readers, and only one of them belongs to an administrator.
 */
import type { AssuranceRefusal } from "@/lib/security/assurance";
import { assuranceRefusalOf } from "@/lib/security/reauthentication";
import type { SupportCategoryId } from "@/lib/support/articles";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

/**
 * The result of a publish, with the same two-kinds-of-no shape the organization
 * and status authorities use: `reason` is present only when the database
 * declined on assurance grounds, so the screen can offer a password rather than
 * an apology.
 */
export type PublishOutcome =
  { ok: true } | { ok: false; message: string; reason?: AssuranceRefusal };

function failed(cause: unknown): PublishOutcome {
  const reason = assuranceRefusalOf(cause);
  const message =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : "That did not save.";
  return reason ? { ok: false, message, reason } : { ok: false, message };
}

/** Save an article as a draft or publish it. Administrators only. */
export async function saveSupportArticle(input: {
  slug: string;
  title: string;
  summary: string;
  category: SupportCategoryId;
  body: readonly string[];
  keywords: readonly string[];
  status: "draft" | "published";
  note?: string;
}): Promise<PublishOutcome> {
  try {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.rpc("ocade_save_support_article", {
      p_slug: input.slug,
      p_title: input.title,
      p_summary: input.summary,
      p_category: input.category,
      p_body: [...input.body],
      p_keywords: [...input.keywords],
      p_status: input.status,
      p_note: input.note ?? "",
    });
    if (error) return failed(error);
    return { ok: true };
  } catch (cause) {
    return failed(cause);
  }
}
