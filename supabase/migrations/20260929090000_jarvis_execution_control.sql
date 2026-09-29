-- The owner's emergency stop for JARVIS device work (docs/OWNER_ADMIN_BACKEND.md,
-- Security controls). One server-authoritative switch; every change needs a
-- support admin, a recent second factor and a written reason, and leaves an
-- append-only record. Chat and account access are never affected.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_service_controls (
  key text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_service_controls_key_check CHECK (key IN ('jarvis_execution')),
  CONSTRAINT ocade_service_controls_reason_check CHECK (reason IS NULL OR length(reason) <= 500)
);

CREATE TABLE IF NOT EXISTS public.ocade_service_control_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  paused boolean NOT NULL,
  reason text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ocade_service_control_events_reason_check
    CHECK (length(btrim(reason)) BETWEEN 10 AND 500)
);
CREATE INDEX IF NOT EXISTS ocade_service_control_events_recent
  ON public.ocade_service_control_events (changed_at DESC);

ALTER TABLE public.ocade_service_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocade_service_control_events ENABLE ROW LEVEL SECURITY;
-- No browser reads or writes either table; the functions below are the door.
REVOKE ALL ON TABLE public.ocade_service_controls FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_service_control_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_service_controls TO service_role;
GRANT SELECT ON TABLE public.ocade_service_control_events TO service_role;

INSERT INTO public.ocade_service_controls (key) VALUES ('jarvis_execution')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ocade_set_service_control(
  control_key text,
  pause boolean,
  change_reason text
)
RETURNS public.ocade_service_controls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  changed public.ocade_service_controls;
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may change a service control.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(current_setting('request.jwt.claim.aal', true),
              (current_setting('request.jwt.claims', true)::json ->> 'aal')) IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'Changing a service control needs a recent second factor.' USING ERRCODE = '42501';
  END IF;
  IF change_reason IS NULL OR length(btrim(change_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ocade_service_controls
     SET paused = pause, reason = btrim(change_reason),
         changed_by = (SELECT auth.uid()), changed_at = now()
   WHERE key = control_key
  RETURNING * INTO changed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown service control.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ocade_service_control_events (key, paused, reason, changed_by)
  VALUES (control_key, pause, btrim(change_reason), (SELECT auth.uid()));
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_set_service_control(text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_set_service_control(text, boolean, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ocade_read_service_controls()
RETURNS SETOF public.ocade_service_controls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.ocade_is_support_admin() THEN
    RAISE EXCEPTION 'Only support admins may read service controls.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.ocade_service_controls ORDER BY key;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_read_service_controls() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_read_service_controls() TO authenticated, service_role;

COMMIT;
