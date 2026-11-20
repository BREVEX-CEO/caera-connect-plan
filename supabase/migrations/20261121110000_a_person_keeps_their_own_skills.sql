-- SKILLS ARE THE PERSON'S OWN RECIPES (plan 14E.6.6, REPO-57/67): a named, versioned procedure a
-- person writes once and names with `/name` in a JARVIS request. A skill is text the planner reads
-- as the person's preferred way of working; it grants nothing, runs nothing by itself, and is
-- limited to what the task is already allowed to do.
--
-- Customer-owned and protected: only the person writes their skills. Every change keeps the
-- previous text as a numbered version (a trigger, so no code path can skip it); restoring a
-- version writes that exact text back as a new version, byte for byte. Nothing automatic edits a
-- skill: JARVIS's own learning (`jarvis_experience`) is separate and read-only to skills.
BEGIN;

CREATE TABLE public.ocade_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_skills_name_check CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  CONSTRAINT ocade_skills_title_check CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT ocade_skills_body_check CHECK (length(btrim(body)) BETWEEN 1 AND 8000),
  CONSTRAINT ocade_skills_one_name UNIQUE (user_id, name)
);
CREATE TABLE public.ocade_skill_versions (
  skill_id uuid NOT NULL REFERENCES public.ocade_skills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, version)
);
CREATE INDEX ocade_skill_versions_user_idx ON public.ocade_skill_versions (user_id);

-- The version history is written here only, never by a caller.
CREATE FUNCTION public.ocade_skills_keep_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'skill_identity_fixed' USING ERRCODE = '42501';
  END IF;
  IF NEW.body IS NOT DISTINCT FROM OLD.body AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
    NEW.version := OLD.version;
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;
  INSERT INTO public.ocade_skill_versions (skill_id, user_id, version, title, body, created_at)
  VALUES (OLD.id, OLD.user_id, OLD.version, OLD.title, OLD.body, OLD.updated_at)
  ON CONFLICT DO NOTHING;
  NEW.version := OLD.version + 1;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_skills_keep_version() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ocade_skills_keep_version BEFORE UPDATE ON public.ocade_skills
FOR EACH ROW EXECUTE FUNCTION public.ocade_skills_keep_version();

CREATE FUNCTION public.ocade_skills_fresh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.version := 1;
  NEW.created_at := statement_timestamp();
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_skills_fresh() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ocade_skills_fresh BEFORE INSERT ON public.ocade_skills
FOR EACH ROW EXECUTE FUNCTION public.ocade_skills_fresh();

ALTER TABLE public.ocade_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_skill_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_skills, public.ocade_skill_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ocade_skills TO authenticated;
GRANT UPDATE (title, body) ON TABLE public.ocade_skills TO authenticated;
GRANT SELECT ON TABLE public.ocade_skill_versions TO authenticated;
GRANT SELECT ON TABLE public.ocade_skills, public.ocade_skill_versions TO service_role;
GRANT DELETE ON TABLE public.ocade_skills, public.ocade_skill_versions TO service_role;
CREATE POLICY ocade_skills_own_select ON public.ocade_skills FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY ocade_skills_own_insert ON public.ocade_skills FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY ocade_skills_own_update ON public.ocade_skills FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY ocade_skills_own_delete ON public.ocade_skills FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY ocade_skill_versions_own_select ON public.ocade_skill_versions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- The service role deletes them only for account-data deletion.
CREATE POLICY ocade_skills_service ON public.ocade_skills FOR ALL TO service_role USING (true);
CREATE POLICY ocade_skill_versions_service ON public.ocade_skill_versions FOR ALL TO service_role USING (true);

-- The skills a JARVIS request names with /name, for that person only (the planner's read).
CREATE FUNCTION public.ocade_skills_for_task(p_user uuid, p_names text[])
RETURNS TABLE (name text, title text, body text, version integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT s.name, s.title, s.body, s.version FROM public.ocade_skills AS s
   WHERE s.user_id = p_user AND s.name = ANY (p_names[1:5])
   ORDER BY s.name;
$$;
REVOKE ALL ON FUNCTION public.ocade_skills_for_task(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_skills_for_task(uuid, text[]) TO service_role;

COMMIT;
