-- Skills (REPO-57/67): a person writes, edits and deletes only their own; every edit keeps the
-- previous text as a version written by the database itself; restoring writes the exact old
-- text back; a person cannot rename, move, or write history; the planner reads only the named
-- skills of that person. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'skills: %', p_what; END IF;
END $$;
INSERT INTO auth.users (id, email) VALUES
  ('c1c1c1c1-0000-4000-8000-000000000001', 'skill-a@example.test'),
  ('c2c2c2c2-0000-4000-8000-000000000002', 'skill-b@example.test');
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "c1c1c1c1-0000-4000-8000-000000000001", "role": "authenticated"}', true); END $$;
DO $$
DECLARE
  v_id uuid;
  v_original text := E'1. Use the house template.\n2. Title in Title Case — “quoted”.';
  n integer;
BEGIN
  INSERT INTO public.ocade_skills (user_id, name, title, body, version)
  VALUES ('c1c1c1c1-0000-4000-8000-000000000001', 'weekly-report', 'Weekly report', v_original, 99)
  RETURNING id INTO v_id;
  PERFORM pg_temp.check((SELECT version FROM public.ocade_skills WHERE id = v_id) = 1, 'a new skill starts at version 1');
  UPDATE public.ocade_skills SET body = 'Changed.' WHERE id = v_id;
  UPDATE public.ocade_skills SET body = 'Changed.' WHERE id = v_id;  -- no change: no version
  PERFORM pg_temp.check((SELECT version FROM public.ocade_skills WHERE id = v_id) = 2, 'an edit is version 2');
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_skill_versions WHERE skill_id = v_id) = 1, 'one earlier version kept');
  -- Restore: the exact old text, byte for byte.
  UPDATE public.ocade_skills SET body = (SELECT body FROM public.ocade_skill_versions WHERE skill_id = v_id AND version = 1) WHERE id = v_id;
  PERFORM pg_temp.check((SELECT body = v_original AND version = 3 FROM public.ocade_skills WHERE id = v_id), 'restore is exact');
  BEGIN
    UPDATE public.ocade_skills SET name = 'other' WHERE id = v_id;
    RAISE EXCEPTION 'skills: a skill was renamed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ocade_skill_versions (skill_id, user_id, version, title, body)
    VALUES (v_id, 'c1c1c1c1-0000-4000-8000-000000000001', 50, 'x', 'forged');
    RAISE EXCEPTION 'skills: a person wrote history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ocade_skills (user_id, name, title, body)
    VALUES ('c2c2c2c2-0000-4000-8000-000000000002', 'planted', 'x', 'x');
    RAISE EXCEPTION 'skills: a skill was planted in another account';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "c2c2c2c2-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
DO $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_skills) = 0, 'another person saw a skill');
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_skill_versions) = 0, 'another person saw history');
  UPDATE public.ocade_skills SET body = 'hijack';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.check(n = 0, 'another person edited a skill');
  DELETE FROM public.ocade_skills;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.check(n = 0, 'another person deleted a skill');
  BEGIN
    PERFORM public.ocade_skills_for_task('c1c1c1c1-0000-4000-8000-000000000001', ARRAY['weekly-report']);
    RAISE EXCEPTION 'skills: a person read skills through the planner step';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_skills_for_task('c1c1c1c1-0000-4000-8000-000000000001', ARRAY['weekly-report', 'none'])) = 1,
                        'the planner reads the named skill');
  PERFORM pg_temp.check((SELECT count(*) FROM public.ocade_skills_for_task('c2c2c2c2-0000-4000-8000-000000000002', ARRAY['weekly-report'])) = 0,
                        'the planner reads only that person''s skills');
END $$;
ROLLBACK;
