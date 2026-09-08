-- Verification for 20260904190000_support_article_publishing.

DO $$
BEGIN
  IF to_regclass('public.ocade_support_articles') IS NULL
     OR to_regclass('public.ocade_support_article_revisions') IS NULL THEN
    RAISE EXCEPTION 'the help-publishing tables are missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
           WHERE oid = 'public.ocade_support_articles'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class
              WHERE oid = 'public.ocade_support_article_revisions'::regclass) THEN
    RAISE EXCEPTION 'row-level security is off on a help-publishing table';
  END IF;
END $$;

-- A DRAFT IS NOT PUBLIC. The public policy must be filtered by status, not by
-- `true` — a draft that leaked would be half-written guidance somebody follows.
DO $$
DECLARE
  expression text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO expression
    FROM pg_policy
   WHERE polrelid = 'public.ocade_support_articles'::regclass
     AND polname = 'ocade_support_articles_public_read';
  IF expression IS NULL THEN
    RAISE EXCEPTION 'nothing lets a visitor read a published help article';
  END IF;
  IF expression NOT LIKE '%published%' THEN
    RAISE EXCEPTION 'the public help policy does not filter by status: %', expression;
  END IF;
END $$;

-- Nobody who is not an administrator may read the editorial history, and
-- nobody at all may read it without an account.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.ocade_support_article_revisions', 'SELECT') THEN
    RAISE EXCEPTION 'a signed-out visitor can read the editorial history';
  END IF;
  IF NOT has_table_privilege('anon', 'public.ocade_support_articles', 'SELECT') THEN
    RAISE EXCEPTION 'a signed-out visitor cannot read published help articles';
  END IF;
END $$;

-- Both tables are read-only to a browser: every policy is SELECT, and neither
-- browser role holds a direct write grant. Asserted as "every policy is SELECT"
-- because `FOR ALL` is neither UPDATE nor DELETE and grants both.
DO $$
DECLARE
  offending text;
  relation text;
  who text;
BEGIN
  SELECT string_agg(format('%s.%s (%s)', polrelid::regclass, polname, polcmd), ', ')
    INTO offending
    FROM pg_policy
   WHERE polrelid IN (
           'public.ocade_support_articles'::regclass,
           'public.ocade_support_article_revisions'::regclass)
     AND polcmd <> 'r';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION 'a help-publishing policy admits more than reading: %', offending;
  END IF;

  FOREACH relation IN ARRAY ARRAY[
    'public.ocade_support_articles', 'public.ocade_support_article_revisions'
  ] LOOP
    FOREACH who IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(who, relation, 'INSERT')
         OR has_table_privilege(who, relation, 'UPDATE')
         OR has_table_privilege(who, relation, 'DELETE') THEN
        RAISE EXCEPTION '% holds a direct write grant on %', who, relation;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- The writer checks the role, the category and recent proof, and records a
-- revision alongside the current row.
DO $$
DECLARE
  body text;
  fn text := 'public.ocade_save_support_article(text, text, text, text, text[], text[], text, text)';
BEGIN
  IF to_regprocedure(fn) IS NULL THEN
    RAISE EXCEPTION 'the help-publishing writer is missing';
  END IF;
  SELECT prosrc INTO body FROM pg_proc WHERE oid = to_regprocedure(fn);
  IF body NOT LIKE '%has_role%' THEN
    RAISE EXCEPTION 'anybody can publish help content';
  END IF;
  IF body NOT LIKE '%ocade_require_recent_strong_auth%' THEN
    RAISE EXCEPTION 'publishing help content does not require recent proof of identity';
  END IF;
  IF body NOT LIKE '%ocade_support_article_revisions%' THEN
    RAISE EXCEPTION 'a published change leaves no editorial history';
  END IF;
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'an administrator cannot call the help-publishing writer';
  END IF;
  IF has_function_privilege('anon', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'a signed-out visitor can call the help-publishing writer';
  END IF;
END $$;

-- Nothing was seeded. The source catalogue is the fallback and stays the whole
-- of the Help Center until an editor changes something.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.ocade_support_articles) > 0 THEN
    RAISE EXCEPTION 'the migration seeded help overrides nobody wrote';
  END IF;
END $$;
