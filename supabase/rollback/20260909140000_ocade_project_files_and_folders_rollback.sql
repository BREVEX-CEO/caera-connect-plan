-- Reverses 20260909140000_ocade_project_files_and_folders.sql.
--
-- DESTRUCTIVE. These tables hold the only copy of a project's files and
-- folders once the browser-local stores are gone. Export before running this.

BEGIN;

DROP TABLE IF EXISTS public.ocade_project_files;
DROP TABLE IF EXISTS public.ocade_project_folders;

COMMIT;
