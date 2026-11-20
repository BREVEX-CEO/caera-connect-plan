-- Rollback of 20261121110000: skills and their history are removed.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_skills_for_task(uuid, text[]);
DROP TABLE IF EXISTS public.ocade_skill_versions;
DROP TABLE IF EXISTS public.ocade_skills;
DROP FUNCTION IF EXISTS public.ocade_skills_keep_version();
DROP FUNCTION IF EXISTS public.ocade_skills_fresh();
COMMIT;
