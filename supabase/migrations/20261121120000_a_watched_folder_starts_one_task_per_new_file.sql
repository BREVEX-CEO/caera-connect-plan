-- WATCHED FOLDERS (plan REPO-61/71, owner rejected the deferral): the person asks JARVIS to do
-- something whenever a new file arrives in one folder of a computer's JARVIS folder. The companion
-- notices new files itself, locally and without any model call, and reports each new file once;
-- the server turns it into ONE one-time scheduled run of the same scheduled-work path (so the
-- task starts with fresh permission checks, a refusal is recorded and notified, and nothing is
-- started twice). Irrelevant files cost nothing; turning a watch off or removing the computer
-- stops it at once; at most 20 runs a day per watch.
BEGIN;

CREATE TABLE public.jarvis_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.jarvis_devices(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  folder text NOT NULL,
  what text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jarvis_watches_folder_check CHECK (
    length(folder) BETWEEN 1 AND 200 AND folder !~ '(^|[\\/])\.\.([\\/]|$)' AND folder !~ '^([\\/]|[A-Za-z]:)'
    AND folder !~ '[[:cntrl:]]'),
  CONSTRAINT jarvis_watches_what_check CHECK (length(btrim(what)) BETWEEN 1 AND 400)
);
CREATE INDEX jarvis_watches_device_idx ON public.jarvis_watches (device_id) WHERE active;
CREATE INDEX jarvis_watches_user_idx ON public.jarvis_watches (user_id);

CREATE TABLE public.jarvis_watch_events (
  watch_id uuid NOT NULL REFERENCES public.jarvis_watches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  file text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watch_id, key),
  CONSTRAINT jarvis_watch_events_key_check CHECK (length(key) BETWEEN 1 AND 400 AND length(file) BETWEEN 1 AND 255)
);
CREATE INDEX jarvis_watch_events_user_idx ON public.jarvis_watch_events (user_id);

ALTER TABLE public.jarvis_schedules
  ADD COLUMN IF NOT EXISTS watch_id uuid REFERENCES public.jarvis_watches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jarvis_schedules_watch_idx ON public.jarvis_schedules (watch_id) WHERE watch_id IS NOT NULL;

ALTER TABLE public.jarvis_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_watch_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_watches, public.jarvis_watch_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.jarvis_watches TO authenticated;
GRANT UPDATE (active) ON TABLE public.jarvis_watches TO authenticated;
GRANT SELECT ON TABLE public.jarvis_watch_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jarvis_watches, public.jarvis_watch_events TO service_role;
CREATE POLICY jarvis_watches_own_select ON public.jarvis_watches FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY jarvis_watches_own_update ON public.jarvis_watches FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY jarvis_watches_own_delete ON public.jarvis_watches FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY jarvis_watch_events_own_select ON public.jarvis_watch_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY jarvis_watches_service ON public.jarvis_watches FOR ALL TO service_role USING (true);
CREATE POLICY jarvis_watch_events_service ON public.jarvis_watch_events FOR ALL TO service_role USING (true);

-- Create a watch for the person's own JARVIS conversation and their own unrevoked computer.
CREATE FUNCTION public.jarvis_add_watch(p_user uuid, p_conversation uuid, p_device uuid, p_folder text, p_what text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ocade_conversations
                  WHERE id = p_conversation AND user_id = p_user AND surface = 'jarvis') THEN
    RAISE EXCEPTION 'schedule_conversation_unavailable' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jarvis_devices
                  WHERE id = p_device AND user_id = p_user AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'schedule_device_unavailable' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.jarvis_watches WHERE device_id = p_device) >= 10 THEN
    RAISE EXCEPTION 'watch_limit' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.jarvis_watches (user_id, device_id, conversation_id, folder, what)
  VALUES (p_user, p_device, p_conversation, btrim(replace(p_folder, E'\\', '/'), '/ '), btrim(p_what))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The active watches of one computer, for its companion.
CREATE FUNCTION public.jarvis_device_watches(p_device uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'folder', w.folder) ORDER BY w.created_at), '[]'::jsonb)
    FROM public.jarvis_watches AS w
    JOIN public.jarvis_devices AS d ON d.id = w.device_id AND d.user_id = w.user_id AND d.revoked_at IS NULL
   WHERE w.device_id = p_device AND w.active;
$$;

-- One new file in a watched folder: one one-time scheduled run, never two for the same file.
CREATE FUNCTION public.jarvis_watch_fired(p_device uuid, p_watch uuid, p_file text, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_watch record;
  v_today integer;
  v_schedule uuid;
BEGIN
  SELECT w.* INTO v_watch FROM public.jarvis_watches AS w
    JOIN public.jarvis_devices AS d ON d.id = w.device_id AND d.user_id = w.user_id AND d.revoked_at IS NULL
   WHERE w.id = p_watch AND w.device_id = p_device AND w.active
   FOR UPDATE OF w;
  IF NOT FOUND THEN
    RETURN 'not_watched';
  END IF;
  IF p_file IS NULL OR p_file ~ '[/\\[:cntrl:]]' OR length(p_file) NOT BETWEEN 1 AND 255
     OR p_key IS NULL OR length(p_key) NOT BETWEEN 1 AND 400 THEN
    RAISE EXCEPTION 'invalid_watch_event' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jarvis_watch_events WHERE watch_id = p_watch AND key = p_key) THEN
    RETURN 'duplicate';
  END IF;
  SELECT count(*) INTO v_today FROM public.jarvis_watch_events
   WHERE watch_id = p_watch AND created_at > now() - interval '1 day';
  IF v_today >= 20 THEN
    RETURN 'limited';
  END IF;
  INSERT INTO public.jarvis_watch_events (watch_id, user_id, key, file) VALUES (p_watch, v_watch.user_id, p_key, p_file);
  -- Finished runs a watch made are not kept as schedules (the events are the record).
  DELETE FROM public.jarvis_schedules AS s
   WHERE s.watch_id = p_watch AND NOT s.active AND s.repeat = 'none';
  v_schedule := public.jarvis_save_schedule(
    v_watch.user_id, NULL, v_watch.conversation_id, p_device,
    left(v_watch.what || ' (new file in ' || v_watch.folder || ': ' || p_file || ')', 500),
    now(), 'none', 'UTC');
  UPDATE public.jarvis_schedules SET watch_id = p_watch WHERE id = v_schedule;
  RETURN 'scheduled';
END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_add_watch(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_device_watches(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jarvis_watch_fired(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_add_watch(uuid, uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_device_watches(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.jarvis_watch_fired(uuid, uuid, text, text) TO service_role;

COMMIT;
