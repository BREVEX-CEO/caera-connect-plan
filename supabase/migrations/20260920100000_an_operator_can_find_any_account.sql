-- FINDING A CUSTOMER MUST NOT DEPEND ON WHEN THEY SIGNED UP.
--
-- The admin screen read the 200 newest profiles and filtered them in the
-- browser, so the two hundred and first account was unfindable: an operator
-- searching for a real customer's email was told "No matching accounts". The
-- search is `ilike` against the database now, which needs an index or it is a
-- sequential scan of every profile on every keystroke.
--
-- TRIGRAM, BECAUSE THE PATTERN IS `%term%`. A btree index cannot serve a
-- leading wildcard; a GIN trigram index can, and it is the same tool this
-- schema already uses for message-body search. `pg_trgm` lives in `extensions`
-- (20260824112227 relocated it), so the operator classes are named from there.
--
-- Service-role reads only: `profiles_self_select` still restricts every browser
-- token to its own row, and nothing here widens that.
BEGIN;

CREATE INDEX IF NOT EXISTS profiles_email_trgm_idx
  ON public.profiles USING gin (email extensions.gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING gin (display_name extensions.gin_trgm_ops)
  WHERE display_name IS NOT NULL;

COMMIT;
