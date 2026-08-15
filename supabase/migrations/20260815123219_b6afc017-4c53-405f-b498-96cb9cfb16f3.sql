BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  instructions TEXT CHECK (instructions IS NULL OR char_length(instructions) <= 20000),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.ocade_projects FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_projects TO authenticated;
GRANT ALL ON TABLE public.ocade_projects TO service_role;

ALTER TABLE public.ocade_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_projects" ON public.ocade_projects;
CREATE POLICY "own_projects" ON public.ocade_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ocade_projects_user_idx
  ON public.ocade_projects (user_id, archived, updated_at DESC);

DROP TRIGGER IF EXISTS ocade_projects_touch ON public.ocade_projects;
CREATE TRIGGER ocade_projects_touch
  BEFORE UPDATE ON public.ocade_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ocade_conversations
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.ocade_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ocade_conversations_project_idx
  ON public.ocade_conversations (project_id);

DROP POLICY IF EXISTS "own_conversations" ON public.ocade_conversations;
CREATE POLICY "own_conversations" ON public.ocade_conversations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.ocade_projects AS parent
        WHERE parent.id = project_id
          AND parent.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "own_messages" ON public.ocade_messages;
CREATE POLICY "own_messages" ON public.ocade_messages FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.ocade_conversations AS parent
      WHERE parent.id = conversation_id
        AND parent.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.ocade_conversations AS parent
      WHERE parent.id = conversation_id
        AND parent.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.ocade_project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.ocade_projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('conversation', 'file', 'output')),
  ref_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, kind, ref_id)
);

REVOKE ALL ON TABLE public.ocade_project_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_project_items TO authenticated;
GRANT ALL ON TABLE public.ocade_project_items TO service_role;

ALTER TABLE public.ocade_project_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_project_items" ON public.ocade_project_items;
CREATE POLICY "own_project_items" ON public.ocade_project_items FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_projects AS parent
      WHERE parent.id = project_id AND parent.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.ocade_projects AS parent
      WHERE parent.id = project_id AND parent.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ocade_project_items_project_idx
  ON public.ocade_project_items (project_id, kind);

CREATE TABLE IF NOT EXISTS public.ocade_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.ocade_projects(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.ocade_conversations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document', 'export', 'visual', 'transcript', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  content TEXT,
  mime TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  lineage_id UUID NOT NULL DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  parent_output_id UUID REFERENCES public.ocade_outputs(id) ON DELETE SET NULL,
  content_sha256 TEXT CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lineage_id, version)
);

REVOKE ALL ON TABLE public.ocade_outputs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_outputs TO authenticated;
GRANT ALL ON TABLE public.ocade_outputs TO service_role;

ALTER TABLE public.ocade_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_outputs" ON public.ocade_outputs;
CREATE POLICY "own_outputs" ON public.ocade_outputs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ocade_projects AS parent
        WHERE parent.id = project_id AND parent.user_id = auth.uid()
      )
    )
    AND (
      conversation_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ocade_conversations AS parent
        WHERE parent.id = conversation_id AND parent.user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS ocade_outputs_user_idx
  ON public.ocade_outputs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ocade_outputs_lineage_idx
  ON public.ocade_outputs (user_id, lineage_id, version DESC);
CREATE INDEX IF NOT EXISTS ocade_outputs_expiry_idx
  ON public.ocade_outputs (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ocade_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'user' CHECK (scope IN ('user', 'project')),
  project_id UUID REFERENCES public.ocade_projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'inferred', 'imported')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'user' AND project_id IS NULL)
    OR (scope = 'project' AND project_id IS NOT NULL)
  )
);

REVOKE ALL ON TABLE public.ocade_memory FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_memory TO authenticated;
GRANT ALL ON TABLE public.ocade_memory TO service_role;

ALTER TABLE public.ocade_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_memory" ON public.ocade_memory;
CREATE POLICY "own_memory" ON public.ocade_memory FOR ALL
  USING (
    auth.uid() = user_id
    AND (
      scope = 'user'
      OR EXISTS (
        SELECT 1 FROM public.ocade_projects AS parent
        WHERE parent.id = project_id AND parent.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      scope = 'user'
      OR EXISTS (
        SELECT 1 FROM public.ocade_projects AS parent
        WHERE parent.id = project_id AND parent.user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS ocade_memory_user_idx
  ON public.ocade_memory (user_id, scope, updated_at DESC);

DROP TRIGGER IF EXISTS ocade_memory_touch ON public.ocade_memory;
CREATE TRIGGER ocade_memory_touch
  BEFORE UPDATE ON public.ocade_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS ocade_memory_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE public.ocade_memory IS
  'Opt-in OCADE memory. Distinct from conversation history; user-reviewable, editable and deletable. Never stores protected credentials.';

COMMIT;