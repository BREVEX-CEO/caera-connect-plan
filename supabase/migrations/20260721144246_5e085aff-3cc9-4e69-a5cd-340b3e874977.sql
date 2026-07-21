
CREATE TABLE public.madee_resume_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  profession TEXT,
  experience_level TEXT CHECK (experience_level IN ('student','entry','mid','senior','executive','other')),
  storage_mode TEXT NOT NULL DEFAULT 'private_sync' CHECK (storage_mode IN ('browser_only','private_sync')),
  current_version_id UUID,
  attestation_accepted_at TIMESTAMPTZ,
  attestation_full_name TEXT,
  attestation_text TEXT,
  target_role TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX madee_projects_user_idx ON public.madee_resume_projects(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.madee_resume_projects TO authenticated;
GRANT ALL ON public.madee_resume_projects TO service_role;
ALTER TABLE public.madee_resume_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_resume_projects" ON public.madee_resume_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER madee_projects_touch
  BEFORE UPDATE ON public.madee_resume_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_resume_attestation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.attestation_accepted_at IS NULL
     OR NEW.attestation_full_name IS NULL
     OR length(trim(NEW.attestation_full_name)) < 2 THEN
    RAISE EXCEPTION 'Resume project requires owner attestation (full name + acceptance).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER madee_projects_require_attestation
  BEFORE INSERT ON public.madee_resume_projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_resume_attestation();

CREATE TABLE public.madee_resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.madee_resume_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  label TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_stored_locally BOOLEAN NOT NULL DEFAULT FALSE,
  ai_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);
CREATE INDEX madee_versions_project_idx ON public.madee_resume_versions(project_id, version_number DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.madee_resume_versions TO authenticated;
GRANT ALL ON public.madee_resume_versions TO service_role;
ALTER TABLE public.madee_resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_resume_versions" ON public.madee_resume_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_resume_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_n INT;
BEGIN
  IF NEW.version_number IS NULL OR NEW.version_number = 0 THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_n
      FROM public.madee_resume_versions WHERE project_id = NEW.project_id;
    NEW.version_number := next_n;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER madee_versions_autonumber
  BEFORE INSERT ON public.madee_resume_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_resume_version_number();

ALTER TABLE public.madee_resume_projects
  ADD CONSTRAINT madee_projects_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES public.madee_resume_versions(id) ON DELETE SET NULL;
