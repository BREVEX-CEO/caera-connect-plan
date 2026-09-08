/*
 * PUBLISHING HELP ARTICLES WITHOUT A DEPLOY — PLAN.md §L, and §G's help-content
 * management.
 *
 * §L asks for an admin publishing workflow and a draft/published state. The
 * article model already HAS draft and published — `publishedOnly` has been
 * filtering on it since the Help Center was built — but the only way to change
 * one was to edit a TypeScript file and ship it. That is a publishing workflow
 * for engineers, which is not what §L is asking for: the person who knows the
 * answer to a support question is usually not the person who can deploy.
 *
 * THE SOURCE CATALOGUE STAYS, AND STAYS THE FALLBACK. This does not move the
 * articles into a table. `/support` is a public page that must render on a
 * deployment with no Supabase binding at all, and twenty-one answers that
 * vanish when a database is unreachable are worse than answers that cannot be
 * edited. So an override SUPPLEMENTS the catalogue: a row here replaces the
 * editable fields of an article that exists in source, or adds one that does
 * not, and everything with no row keeps exactly the behaviour it has today.
 *
 * TWO TABLES, CURRENT AND HISTORY, for the same reason the incident authority
 * has them: the page needs one row per article and the audit needs every
 * version. The history is append-only, so "what did the Help Center say about
 * refunds in September" has an answer, and an editor who publishes something
 * wrong cannot make it look as though they never did.
 *
 * PUBLIC READ IS FILTERED BY STATUS, IN THE POLICY. A draft that leaked would
 * be worse than no drafts at all: somebody would find half-written guidance
 * through search and follow it. `anon` and `authenticated` see published rows
 * only; administrators see everything, which is what makes the draft state
 * usable at all.
 */

CREATE TABLE IF NOT EXISTS public.ocade_support_articles (
  /*
   * The slug is the key, and it is the same key the source catalogue uses.
   *
   * That is what makes an override an override rather than a second article:
   * there is exactly one row per slug, and the merge in `support/catalogue.ts`
   * matches on it. A slug is permanent in the source catalogue for the reason
   * §L gives — a help URL ends up in a support reply, a bookmark and somebody's
   * runbook — and it is permanent here for the same one.
   */
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 500),
  category text NOT NULL,
  /* Paragraphs. Plain text by design: no markup to sanitise, no injection. */
  body text[] NOT NULL CHECK (cardinality(body) BETWEEN 1 AND 60),
  keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

/*
 * Every version ever published, in order.
 *
 * Append-only: there is no update or delete path for anybody. An editorial
 * history that can be rewritten is a record of what somebody currently wishes
 * they had said, which is exactly what a support answer must not be.
 */
CREATE TABLE IF NOT EXISTS public.ocade_support_article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL,
  body text[] NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  /* Why this version exists. Shown to the next editor, never to a reader. */
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ocade_support_article_revisions_slug_idx
  ON public.ocade_support_article_revisions (slug, created_at DESC);

ALTER TABLE public.ocade_support_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_support_article_revisions ENABLE ROW LEVEL SECURITY;

/*
 * A DRAFT IS NOT PUBLIC, AND THAT IS THE WHOLE POINT OF THE STATE.
 *
 * Two policies rather than one with an OR, so the public rule is legible on its
 * own line: everybody reads published rows, and administrators additionally
 * read the rest. A single `status = 'published' OR has_role(...)` would say the
 * same thing and would be one edit away from saying something else.
 */
DROP POLICY IF EXISTS ocade_support_articles_public_read ON public.ocade_support_articles;
CREATE POLICY ocade_support_articles_public_read
  ON public.ocade_support_articles FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS ocade_support_articles_admin_read ON public.ocade_support_articles;
CREATE POLICY ocade_support_articles_admin_read
  ON public.ocade_support_articles FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

/* The editorial history is for editors. A reader has the article itself. */
DROP POLICY IF EXISTS ocade_support_article_revisions_admin_read
  ON public.ocade_support_article_revisions;
CREATE POLICY ocade_support_article_revisions_admin_read
  ON public.ocade_support_article_revisions FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

REVOKE ALL ON TABLE public.ocade_support_articles FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_support_article_revisions FROM anon, authenticated;
GRANT SELECT ON TABLE public.ocade_support_articles TO anon, authenticated;
GRANT SELECT ON TABLE public.ocade_support_article_revisions TO authenticated;

/**
 * Save an article, as a draft or published, and record the version.
 *
 * BOTH WRITES IN ONE TRANSACTION. A current row without its revision is a
 * published change with no record of who made it; a revision without the
 * current row is a history of something nobody can read. Splitting them into
 * two calls would make both states reachable by a crash.
 *
 * The category is checked against the catalogue's own eight ids rather than
 * left free text: an article filed under a category that does not exist would
 * be published, unreachable from any page, and findable only by search.
 */
CREATE OR REPLACE FUNCTION public.ocade_save_support_article(
  p_slug text,
  p_title text,
  p_summary text,
  p_category text,
  p_body text[],
  p_keywords text[],
  p_status text,
  p_note text DEFAULT ''
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may publish help content.';
  END IF;
  IF p_category NOT IN (
    'getting-started', 'account-and-sign-in', 'sync-and-devices', 'offline-intelligence',
    'privacy-and-data', 'billing-and-plans', 'security', 'computer-control'
  ) THEN
    RAISE EXCEPTION 'That is not a Help Center category.';
  END IF;
  PERFORM public.ocade_require_recent_strong_auth('changing what the Help Center says');

  INSERT INTO public.ocade_support_articles AS current (
    slug, title, summary, category, body, keywords, status, updated_at, updated_by
  )
  VALUES (
    p_slug, btrim(p_title), btrim(p_summary), p_category,
    p_body, COALESCE(p_keywords, '{}'), p_status, now(), auth.uid()
  )
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        category = EXCLUDED.category,
        body = EXCLUDED.body,
        keywords = EXCLUDED.keywords,
        status = EXCLUDED.status,
        updated_at = now(),
        updated_by = auth.uid();

  INSERT INTO public.ocade_support_article_revisions (
    slug, title, summary, category, body, keywords, status, note, created_by
  )
  VALUES (
    p_slug, btrim(p_title), btrim(p_summary), p_category,
    p_body, COALESCE(p_keywords, '{}'), p_status, COALESCE(btrim(p_note), ''), auth.uid()
  );

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_save_support_article(
  text, text, text, text, text[], text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_save_support_article(
  text, text, text, text, text[], text[], text, text) TO authenticated;
