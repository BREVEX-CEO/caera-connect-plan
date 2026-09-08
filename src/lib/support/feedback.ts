/**
 * "WAS THIS HELPFUL?", ANSWERED HONESTLY.
 *
 * PLAN.md §L asks for helpful/not-helpful feedback with abuse controls, and
 * §L also forbids a second support system. Those two together decide the shape
 * of this, because the obvious implementation is the dishonest one.
 *
 * WHAT OCADE DOES NOT HAVE: a store for article feedback. There is no table
 * behind this, no counter, and no analytics pipeline. A pair of buttons that
 * shows "Thanks for your feedback!" and drops the answer on the floor is a fake
 * control — the person believes they have told somebody something, and nobody
 * has been told. That is precisely the failure this repository's standard calls
 * a fake success state.
 *
 * SO THE ANSWER GOES SOMEWHERE REAL, OR IT IS NOT COLLECTED:
 *
 *   NOT HELPFUL is the answer that matters and the one a person wants acted on,
 *   so it ESCALATES: it opens the existing support flow with the article and
 *   what they were looking for already filled in. That is the same escalation
 *   §L asks for under "support escalation with article context", built once.
 *
 *   HELPFUL is recorded on the device so the question is not asked again on an
 *   article somebody already answered. It is not sent anywhere and the page says
 *   so, rather than implying a vote was counted.
 *
 * THE ABUSE CONTROL is that neither answer reaches a shared surface at all. A
 * device-local note cannot be brigaded, and an escalation lands in the
 * authenticated ticket queue, which is already rate-limited and already
 * attached to an account. There is no anonymous write path here to abuse.
 */

export type ArticleVerdict = "helpful" | "not-helpful";

export interface FeedbackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "ocade.support.article-feedback";

function browserStorage(): FeedbackStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Which articles this device has already answered for. */
export function readAnsweredArticles(
  storage: FeedbackStorage | null = browserStorage(),
): Record<string, ArticleVerdict> {
  if (!storage) return {};
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, ArticleVerdict> = {};
    for (const [slug, verdict] of Object.entries(parsed as Record<string, unknown>)) {
      if (verdict === "helpful" || verdict === "not-helpful") out[slug] = verdict;
    }
    return out;
  } catch {
    return {};
  }
}

/** Remember that this device answered, so the article stops asking. */
export function rememberArticleVerdict(
  slug: string,
  verdict: ArticleVerdict,
  storage: FeedbackStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readAnsweredArticles(storage), [slug]: verdict }),
    );
  } catch {
    /* Nothing was promised to anyone; the article still reads correctly. */
  }
}

/**
 * The escalation text, carrying the article context §L asks for.
 *
 * Kept here rather than built in the component so the support form and the
 * article page cannot end up describing the same escalation differently, and so
 * it can be asserted in a test without rendering anything.
 *
 * IT CARRIES NO PERSONAL DATA. The slug, the title and whatever the person
 * chose to type — nothing is read out of their session and pasted in, because a
 * help form quietly attaching account details is a disclosure the person did
 * not ask for.
 */
export function escalationDraft(input: {
  slug: string;
  title: string;
  lookingFor?: string;
}): string {
  return [
    `Help article: ${input.title} (/support/${input.slug})`,
    "",
    "This article did not answer my question.",
    "",
    `What I was trying to do: ${input.lookingFor?.trim() || "[describe what you were trying to do]"}`,
    "",
    "Please do not include passwords, one-time codes, recovery codes or card numbers.",
  ].join("\n");
}
