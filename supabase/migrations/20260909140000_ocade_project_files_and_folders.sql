-- Project files and folders, in the account rather than in the browser.
--
-- Both lived in `localStorage` under `ocade.project-files.v1` and
-- `ocade.project-folders.v1`. That made a project's own material invisible from
-- a second device, unrecoverable when somebody cleared their browser, and
-- outside every deletion and export path the account offers — `PLAN.md`
-- Phase 2 makes Supabase the persistent authority for exactly this kind of
-- content.
--
-- WHAT A PROJECT FILE HOLDS, AND WHAT IT DOES NOT. `text` is the content
-- OCADE extracted on the device — the readable part of a PDF, a spreadsheet or
-- a document — which is what a project's instructions and a model's context
-- are actually built from. The original binary is deliberately NOT uploaded:
-- the product reads it in the browser and keeps only what it needs, and moving
-- to one storage authority is not a reason to start collecting more than
-- before. Durable artifact bodies belong in private Storage; an extracted note
-- is a row.

BEGIN;

CREATE TABLE public.ocade_project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.ocade_projects(id) ON DELETE CASCADE,
  -- Normalized on the way in: no leading or trailing slash, no empty segment.
  path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocade_project_folders_unique UNIQUE (project_id, path)
);

CREATE INDEX ocade_project_folders_project_idx
  ON public.ocade_project_folders (project_id, path);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_project_folders TO authenticated;
GRANT ALL ON public.ocade_project_folders TO service_role;
ALTER TABLE public.ocade_project_folders ENABLE ROW LEVEL SECURITY;
-- `(select auth.uid())` rather than `auth.uid()`: the bare call is re-evaluated
-- for every row the policy filters, while the scalar subquery is an InitPlan
-- run once per statement. `security-definer.test.ts` fails a policy that does
-- not do this, because on a table that grows the difference is the query.
CREATE POLICY "own_project_folders" ON public.ocade_project_folders FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE public.ocade_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.ocade_projects(id) ON DELETE CASCADE,
  -- The empty string is the project root, which is why this is not nullable:
  -- "at the root" and "we do not know where" must not be the same value.
  folder TEXT NOT NULL DEFAULT '' CHECK (length(folder) <= 400),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 500),
  mime TEXT NOT NULL DEFAULT 'text/plain' CHECK (length(mime) <= 200),
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  text TEXT NOT NULL,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ocade_project_files_project_idx
  ON public.ocade_project_files (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_project_files TO authenticated;
GRANT ALL ON public.ocade_project_files TO service_role;
ALTER TABLE public.ocade_project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_project_files" ON public.ocade_project_files FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
