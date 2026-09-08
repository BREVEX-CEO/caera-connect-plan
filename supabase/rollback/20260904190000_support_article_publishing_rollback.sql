-- Rollback for 20260904190000_support_article_publishing.
--
-- THIS DESTROYS EDITED HELP CONTENT. Every article an editor changed or added
-- through the admin screen goes with these tables, along with the editorial
-- history of who changed what. Export both before running it if anything has
-- been published.
--
-- The Help Center itself survives intact: the source catalogue in
-- `src/lib/support/articles.ts` is the fallback and has been the whole of it
-- for every deployment that never used this. After the rollback that is true
-- again, which is why the rollback is safe to run in an incident even though it
-- is not safe to run casually.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_save_support_article(
  text, text, text, text, text[], text[], text, text);
DROP TABLE IF EXISTS public.ocade_support_article_revisions;
DROP TABLE IF EXISTS public.ocade_support_articles;

COMMIT;
