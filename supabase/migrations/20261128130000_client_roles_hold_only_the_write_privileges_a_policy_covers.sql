-- DB-01: a client role keeps a write privilege only where a row-level policy covers that verb.
-- Row-level security already refused these writes; the privileges are removed as well.
BEGIN;
REVOKE ALL ON TABLE public.ocade_library_items FROM anon;
REVOKE UPDATE ON TABLE public.activity_log FROM authenticated;
COMMIT;
