
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.msg_thread_kind AS ENUM (
  'company','department','role','project','private','dm','cross_company'
);
CREATE TYPE public.msg_member_role AS ENUM ('admin','member');
CREATE TYPE public.msg_message_kind AS ENUM ('text','voice','system');
CREATE TYPE public.msg_scope_badge AS ENUM ('company','private','cross_company','dm');
CREATE TYPE public.msg_grant_status AS ENUM ('pending_from','pending_to','active','revoked','rejected');
CREATE TYPE public.msg_link_kind AS ENUM ('task','approval','timesheet','evidence','invoice','expense','filing','signature');

CREATE TABLE public.msg_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.msg_thread_kind NOT NULL,
  name TEXT,
  topic TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.ficia_departments(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.ficia_teams(id) ON DELETE SET NULL,
  role_key TEXT,
  scope_badge public.msg_scope_badge NOT NULL DEFAULT 'company',
  retention_days INT NOT NULL DEFAULT 3650 CHECK (retention_days BETWEEN 1 AND 3650),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  dm_user_a UUID REFERENCES auth.users(id),
  dm_user_b UUID REFERENCES auth.users(id),
  CHECK (kind <> 'dm' OR (dm_user_a IS NOT NULL AND dm_user_b IS NOT NULL AND dm_user_a < dm_user_b)),
  CHECK (kind IN ('dm','private') OR tenant_id IS NOT NULL)
);
CREATE UNIQUE INDEX msg_threads_dm_unique ON public.msg_threads(dm_user_a, dm_user_b) WHERE kind = 'dm';
CREATE INDEX msg_threads_tenant_idx ON public.msg_threads(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX msg_threads_last_msg_idx ON public.msg_threads(last_message_at DESC NULLS LAST);

CREATE TABLE public.msg_thread_members (
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.msg_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX msg_thread_members_user_idx ON public.msg_thread_members(user_id);

CREATE TABLE public.msg_cross_company_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  from_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  to_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status public.msg_grant_status NOT NULL DEFAULT 'pending_to',
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by_from UUID REFERENCES auth.users(id),
  approved_by_to UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, from_tenant_id, to_tenant_id),
  CHECK (from_tenant_id <> to_tenant_id)
);
CREATE INDEX msg_grants_thread_idx ON public.msg_cross_company_grants(thread_id);

CREATE TABLE public.msg_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT,
  kind public.msg_message_kind NOT NULL DEFAULT 'text',
  reply_to UUID REFERENCES public.msg_messages(id) ON DELETE SET NULL,
  mentions_users UUID[] NOT NULL DEFAULT '{}',
  scope_badge public.msg_scope_badge NOT NULL DEFAULT 'company',
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMPTZ,
  edit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX msg_messages_thread_idx ON public.msg_messages(thread_id, created_at DESC);
CREATE INDEX msg_messages_author_idx ON public.msg_messages(author_id);
CREATE INDEX msg_messages_body_trgm ON public.msg_messages USING gin (body gin_trgm_ops)
  WHERE is_deleted = false;

CREATE TABLE public.msg_message_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES auth.users(id),
  previous_body TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX msg_edits_message_idx ON public.msg_message_edits(message_id, edited_at DESC);

CREATE TABLE public.msg_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_path TEXT NOT NULL,
  sha256 TEXT,
  is_voice_note BOOLEAN NOT NULL DEFAULT false,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX msg_attachments_thread_idx ON public.msg_attachments(thread_id);

CREATE TABLE public.msg_reactions (
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE public.msg_pins (
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES auth.users(id),
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, message_id)
);

CREATE TABLE public.msg_read_receipts (
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE public.msg_message_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.msg_messages(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.msg_threads(id) ON DELETE CASCADE,
  link_kind public.msg_link_kind NOT NULL,
  target_id UUID,
  target_ref TEXT,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX msg_links_message_idx ON public.msg_message_links(message_id);
CREATE INDEX msg_links_target_idx ON public.msg_message_links(target_id) WHERE target_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_thread_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_cross_company_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg_messages TO authenticated;
GRANT SELECT, INSERT ON public.msg_message_edits TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.msg_attachments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.msg_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.msg_pins TO authenticated;
GRANT SELECT, INSERT ON public.msg_read_receipts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.msg_message_links TO authenticated;
GRANT ALL ON public.msg_threads, public.msg_thread_members, public.msg_cross_company_grants,
  public.msg_messages, public.msg_message_edits, public.msg_attachments,
  public.msg_reactions, public.msg_pins, public.msg_read_receipts, public.msg_message_links TO service_role;

CREATE OR REPLACE FUNCTION public.msg_is_thread_member(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.msg_thread_members WHERE thread_id = _thread_id AND user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.msg_is_thread_admin(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.msg_thread_members WHERE thread_id = _thread_id AND user_id = _user_id AND role = 'admin');
$$;
CREATE OR REPLACE FUNCTION public.msg_thread_writable(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.msg_threads%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.msg_threads WHERE id = _thread_id;
  IF NOT FOUND OR t.is_archived THEN RETURN false; END IF;
  IF NOT public.msg_is_thread_member(_thread_id, _user_id) THEN RETURN false; END IF;
  IF t.kind = 'cross_company' THEN
    RETURN EXISTS (SELECT 1 FROM public.msg_cross_company_grants g WHERE g.thread_id = _thread_id AND g.status = 'active');
  END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.msg_is_thread_member(UUID,UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msg_is_thread_admin(UUID,UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.msg_thread_writable(UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msg_is_thread_member(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.msg_is_thread_admin(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.msg_thread_writable(UUID,UUID) TO authenticated;

ALTER TABLE public.msg_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_cross_company_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg_message_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY threads_read ON public.msg_threads FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(id, auth.uid()));
CREATE POLICY threads_insert ON public.msg_threads FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY threads_update_admin ON public.msg_threads FOR UPDATE TO authenticated
  USING (public.msg_is_thread_admin(id, auth.uid()))
  WITH CHECK (public.msg_is_thread_admin(id, auth.uid()));
CREATE POLICY threads_delete_admin ON public.msg_threads FOR DELETE TO authenticated
  USING (public.msg_is_thread_admin(id, auth.uid()));

CREATE POLICY tm_read ON public.msg_thread_members FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY tm_admin_write ON public.msg_thread_members FOR INSERT TO authenticated
  WITH CHECK (public.msg_is_thread_admin(thread_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY tm_admin_update ON public.msg_thread_members FOR UPDATE TO authenticated
  USING (public.msg_is_thread_admin(thread_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.msg_is_thread_admin(thread_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY tm_admin_delete ON public.msg_thread_members FOR DELETE TO authenticated
  USING (public.msg_is_thread_admin(thread_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY grants_read ON public.msg_cross_company_grants FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(from_tenant_id, auth.uid(), 'owner') OR
    public.has_tenant_role(from_tenant_id, auth.uid(), 'manager') OR
    public.has_tenant_role(to_tenant_id, auth.uid(), 'owner') OR
    public.has_tenant_role(to_tenant_id, auth.uid(), 'manager') OR
    public.msg_is_thread_member(thread_id, auth.uid())
  );
CREATE POLICY grants_insert ON public.msg_cross_company_grants FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid() AND
    (public.has_tenant_role(from_tenant_id, auth.uid(), 'owner') OR
     public.has_tenant_role(from_tenant_id, auth.uid(), 'manager'))
  );
CREATE POLICY grants_update ON public.msg_cross_company_grants FOR UPDATE TO authenticated
  USING (
    public.has_tenant_role(from_tenant_id, auth.uid(), 'owner') OR
    public.has_tenant_role(from_tenant_id, auth.uid(), 'manager') OR
    public.has_tenant_role(to_tenant_id, auth.uid(), 'owner') OR
    public.has_tenant_role(to_tenant_id, auth.uid(), 'manager')
  )
  WITH CHECK (true);

CREATE POLICY messages_read ON public.msg_messages FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY messages_insert ON public.msg_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.msg_thread_writable(thread_id, auth.uid()));
CREATE POLICY messages_update_own ON public.msg_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
CREATE POLICY messages_delete_own_or_admin ON public.msg_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.msg_is_thread_admin(thread_id, auth.uid()));

CREATE POLICY edits_read ON public.msg_message_edits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_member(m.thread_id, auth.uid())));
CREATE POLICY edits_insert ON public.msg_message_edits FOR INSERT TO authenticated
  WITH CHECK (edited_by = auth.uid() AND EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND m.author_id = auth.uid()));

CREATE POLICY att_read ON public.msg_attachments FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY att_insert ON public.msg_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.msg_thread_writable(thread_id, auth.uid()));
CREATE POLICY att_delete ON public.msg_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_admin(m.thread_id, auth.uid())));

CREATE POLICY rx_read ON public.msg_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_member(m.thread_id, auth.uid())));
CREATE POLICY rx_insert ON public.msg_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_member(m.thread_id, auth.uid())));
CREATE POLICY rx_delete ON public.msg_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY pin_read ON public.msg_pins FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY pin_insert ON public.msg_pins FOR INSERT TO authenticated
  WITH CHECK (pinned_by = auth.uid() AND public.msg_is_thread_admin(thread_id, auth.uid()));
CREATE POLICY pin_delete ON public.msg_pins FOR DELETE TO authenticated
  USING (public.msg_is_thread_admin(thread_id, auth.uid()));

CREATE POLICY rr_read ON public.msg_read_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_member(m.thread_id, auth.uid())));
CREATE POLICY rr_insert ON public.msg_read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.msg_messages m WHERE m.id = message_id AND public.msg_is_thread_member(m.thread_id, auth.uid())));

CREATE POLICY links_read ON public.msg_message_links FOR SELECT TO authenticated
  USING (public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY links_insert ON public.msg_message_links FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.msg_is_thread_member(thread_id, auth.uid()));
CREATE POLICY links_delete ON public.msg_message_links FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.msg_is_thread_admin(thread_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.msg_add_creator_as_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.msg_thread_members(thread_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT DO NOTHING;
  IF NEW.kind = 'dm' THEN
    INSERT INTO public.msg_thread_members(thread_id, user_id, role)
      VALUES (NEW.id, NEW.dm_user_a, 'member'),
             (NEW.id, NEW.dm_user_b, 'member')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msg_threads_bootstrap_members
  AFTER INSERT ON public.msg_threads
  FOR EACH ROW EXECUTE FUNCTION public.msg_add_creator_as_admin();

CREATE OR REPLACE FUNCTION public.msg_bump_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.msg_threads SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msg_messages_bump_last AFTER INSERT ON public.msg_messages
  FOR EACH ROW EXECUTE FUNCTION public.msg_bump_last_message();

CREATE OR REPLACE FUNCTION public.msg_record_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.body IS DISTINCT FROM NEW.body AND OLD.is_deleted = false THEN
    INSERT INTO public.msg_message_edits(message_id, edited_by, previous_body)
      VALUES (OLD.id, auth.uid(), OLD.body);
    NEW.edit_count := OLD.edit_count + 1;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msg_messages_record_edit BEFORE UPDATE ON public.msg_messages
  FOR EACH ROW EXECUTE FUNCTION public.msg_record_edit();

CREATE OR REPLACE FUNCTION public.msg_apply_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.msg_threads%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.msg_threads WHERE id = NEW.thread_id;
  NEW.scope_badge := t.scope_badge;
  NEW.tenant_id := t.tenant_id;
  IF NEW.mentions_users IS NULL THEN NEW.mentions_users := '{}'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msg_messages_apply_scope BEFORE INSERT ON public.msg_messages
  FOR EACH ROW EXECUTE FUNCTION public.msg_apply_scope();

CREATE TRIGGER msg_threads_set_updated BEFORE UPDATE ON public.msg_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER msg_grants_set_updated BEFORE UPDATE ON public.msg_cross_company_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
