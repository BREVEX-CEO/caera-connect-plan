-- Plan 14B.1A / 14B.1B, threat register O-03 and O-14: a customer's own model connections (BYOK).
--
-- A connection names a provider protocol, its HTTPS API address, one model and the customer's key.
-- The key itself is kept only in Supabase Vault (encrypted at rest); this table holds the Vault
-- reference and nonsecret metadata, and a signed-in person can read only their own rows and never
-- the reference. Every change goes through OCADE's server (service role), which checks the address
-- and the provider before a connection can be chosen. A connection is chosen per surface (Chat,
-- JARVIS) and only once it has passed a test. The choice stays until the person changes it: a
-- connection that stops working, is turned off or is deleted is refused, never replaced by OCADE's
-- keys. A turn served by a customer's key is not charged to the OCADE model allowance.
BEGIN;

CREATE TABLE public.byok_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (char_length(btrim(alias)) BETWEEN 1 AND 60),
  protocol text NOT NULL CHECK (protocol IN ('gemini', 'openai')),
  endpoint text NOT NULL CHECK (endpoint ~ '^https://[^/?#@\s]+(/[^?#\s]*)?$' AND char_length(endpoint) <= 300),
  model text NOT NULL CHECK (model ~ '^[A-Za-z0-9@][A-Za-z0-9._:/@+-]{0,199}$'),
  secret_id uuid NOT NULL UNIQUE,
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 12),
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'untested' CHECK (status IN (
    'untested', 'connected', 'invalid', 'rate_limited', 'quota_exhausted', 'credits_unavailable',
    'incompatible', 'unreachable', 'blocked')),
  -- What the last test proved; null is unknown, never "yes".
  sees_images boolean,
  calls_tools boolean,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX byok_connections_user ON public.byok_connections (user_id);

-- Which source serves each surface. No row: OCADE's own models. A row whose connection was deleted
-- (null) is refused until the person chooses again: it is never quietly OCADE's keys instead.
CREATE TABLE public.byok_choices (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('chat', 'jarvis')),
  connection_id uuid REFERENCES public.byok_connections (id) ON DELETE SET NULL,
  chosen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surface)
);
ALTER TABLE public.byok_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.byok_choices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.byok_choices TO authenticated;
GRANT ALL ON public.byok_choices TO service_role;
CREATE POLICY byok_choices_own ON public.byok_choices
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.byok_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.byok_connections FROM PUBLIC, anon, authenticated;
-- The person sees their own connections, without the Vault reference; they change nothing directly.
GRANT SELECT (id, alias, protocol, endpoint, model, fingerprint, enabled, status, sees_images, calls_tools, checked_at, created_at, updated_at)
  ON public.byok_connections TO authenticated;
GRANT ALL ON public.byok_connections TO service_role;
CREATE POLICY byok_connections_own ON public.byok_connections
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- A connection's key leaves Vault with it: on delete, and when the account is deleted (cascade).
CREATE FUNCTION private.byok_forget_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = OLD.secret_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.byok_forget_secret() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER byok_connections_forget_secret AFTER DELETE ON public.byok_connections
  FOR EACH ROW EXECUTE FUNCTION private.byok_forget_secret();

/*
 * Save a new connection, or change one: a new key replaces the old one in Vault, and any change
 * of address, model or key needs a new test before the connection can be used.
 */
CREATE FUNCTION public.ocade_byok_save(
  p_user_id uuid, p_connection_id uuid, p_alias text, p_protocol text, p_endpoint text,
  p_model text, p_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.byok_connections;
  v_id uuid;
BEGIN
  IF p_key IS NOT NULL AND (char_length(p_key) NOT BETWEEN 8 AND 4096 OR p_key ~ '[\s[:cntrl:]]') THEN
    RAISE EXCEPTION 'byok: unusable key' USING ERRCODE = 'check_violation';
  END IF;
  IF p_connection_id IS NULL THEN
    IF p_key IS NULL THEN
      RAISE EXCEPTION 'byok: a new connection needs a key' USING ERRCODE = 'check_violation';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user_id FOR KEY SHARE;
    IF (SELECT count(*) FROM public.byok_connections WHERE user_id = p_user_id) >= 20 THEN
      RAISE EXCEPTION 'byok: at most 20 connections' USING ERRCODE = 'check_violation';
    END IF;
    v_id := gen_random_uuid();
    INSERT INTO public.byok_connections
      (id, user_id, alias, protocol, endpoint, model, secret_id, fingerprint)
    VALUES (v_id, p_user_id, btrim(p_alias), p_protocol, p_endpoint, p_model,
      vault.create_secret(p_key, 'byok:' || v_id::text, 'Customer model key'),
      '…' || right(p_key, 4));
    RETURN v_id;
  END IF;
  SELECT * INTO v_row FROM public.byok_connections
   WHERE id = p_connection_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'byok: no such connection' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_key IS NOT NULL THEN
    PERFORM vault.update_secret(v_row.secret_id, p_key);
  END IF;
  UPDATE public.byok_connections SET
    alias = btrim(p_alias), protocol = p_protocol, endpoint = p_endpoint, model = p_model,
    fingerprint = CASE WHEN p_key IS NULL THEN fingerprint ELSE '…' || right(p_key, 4) END,
    status = 'untested', sees_images = NULL,
    calls_tools = NULL, checked_at = NULL, updated_at = now()
   WHERE id = v_row.id;
  RETURN v_row.id;
END;
$$;

/*
 * The connection a model call is made with, key included: the one named (a test), or the one the
 * person chose for a surface. No row: OCADE's own models serve that surface. A row with a null id:
 * the chosen connection was deleted, and the call is refused. Only OCADE's server reads this.
 */
CREATE FUNCTION public.ocade_byok_route(p_user_id uuid, p_connection_id uuid, p_surface text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM public.byok_connections AS c
    JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE p_connection_id IS NOT NULL AND c.id = p_connection_id AND c.user_id = p_user_id
  UNION ALL
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM public.byok_choices AS ch
    LEFT JOIN public.byok_connections AS c ON c.id = ch.connection_id AND c.user_id = ch.user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE p_connection_id IS NULL AND ch.user_id = p_user_id AND ch.surface = p_surface;
$$;

/* What a test or a model call found out about a connection. The person's choice is unchanged. */
CREATE FUNCTION public.ocade_byok_record(
  p_user_id uuid, p_connection_id uuid, p_status text, p_sees_images boolean, p_calls_tools boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.byok_connections SET
    status = p_status,
    sees_images = coalesce(p_sees_images, sees_images),
    calls_tools = coalesce(p_calls_tools, calls_tools),
    checked_at = now(), updated_at = now()
   WHERE id = p_connection_id AND user_id = p_user_id;
$$;

/* Turn a connection on or off. Off, it is refused wherever it is chosen. */
CREATE FUNCTION public.ocade_byok_enable(p_user_id uuid, p_connection_id uuid, p_enabled boolean)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH changed AS (
    UPDATE public.byok_connections SET enabled = p_enabled, updated_at = now()
     WHERE id = p_connection_id AND user_id = p_user_id
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM changed);
$$;

/*
 * Choose what serves Chat or JARVIS: one of the person's connections that passed its test (JARVIS
 * also needs tool calls), or OCADE's own models (null).
 */
CREATE FUNCTION public.ocade_byok_choose(p_user_id uuid, p_surface text, p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.byok_connections;
BEGIN
  IF p_surface NOT IN ('chat', 'jarvis') THEN
    RAISE EXCEPTION 'byok: unknown surface' USING ERRCODE = 'check_violation';
  END IF;
  IF p_connection_id IS NULL THEN
    DELETE FROM public.byok_choices WHERE user_id = p_user_id AND surface = p_surface;
    RETURN;
  END IF;
  SELECT * INTO v_row FROM public.byok_connections
   WHERE id = p_connection_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'byok: no such connection' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_row.enabled OR v_row.status <> 'connected'
     OR (p_surface = 'jarvis' AND v_row.calls_tools IS NOT TRUE) THEN
    RAISE EXCEPTION 'byok: only a tested connection can be chosen' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.byok_choices (user_id, surface, connection_id)
  VALUES (p_user_id, p_surface, p_connection_id)
  ON CONFLICT (user_id, surface) DO UPDATE SET connection_id = EXCLUDED.connection_id, chosen_at = now();
END;
$$;

CREATE FUNCTION public.ocade_byok_delete(p_user_id uuid, p_connection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH gone AS (
    DELETE FROM public.byok_connections WHERE id = p_connection_id AND user_id = p_user_id
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM gone);
$$;

/*
 * A JARVIS TASK KEEPS THE SOURCE IT STARTED WITH (plan 14B.1B.1). The person's choice at the moment
 * the task is created is written on the task; a later change of choice applies to new tasks, and
 * a task whose connection is deleted is refused rather than moved to another source.
 */
ALTER TABLE public.jarvis_tasks
  ADD COLUMN model_customer_key boolean NOT NULL DEFAULT false,
  ADD COLUMN model_connection uuid REFERENCES public.byok_connections (id) ON DELETE SET NULL;

CREATE FUNCTION private.jarvis_task_keeps_its_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_choice public.byok_choices;
BEGIN
  SELECT * INTO v_choice FROM public.byok_choices
   WHERE user_id = NEW.user_id AND surface = 'jarvis';
  NEW.model_customer_key := FOUND;
  NEW.model_connection := CASE WHEN FOUND THEN v_choice.connection_id END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.jarvis_task_keeps_its_source() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jarvis_tasks_keep_their_source BEFORE INSERT ON public.jarvis_tasks
  FOR EACH ROW EXECUTE FUNCTION private.jarvis_task_keeps_its_source();

/*
 * The source of one JARVIS turn: the task's own when the permit belongs to a task, else the
 * person's current choice. Same shape as ocade_byok_route; no row means OCADE's own models.
 */
CREATE FUNCTION public.ocade_byok_route_for_turn(p_user_id uuid, p_idempotency_key text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH turn AS (
    SELECT t.model_customer_key, t.model_connection
      FROM public.ocade_generation_permits AS p
      JOIN public.jarvis_tasks AS t ON t.id = p.task_id AND t.user_id = p.user_id
     WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key))
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM turn
    LEFT JOIN public.byok_connections AS c ON c.id = turn.model_connection AND c.user_id = p_user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE turn.model_customer_key
  UNION ALL
  SELECT r.* FROM public.ocade_byok_route(p_user_id, NULL, 'jarvis') AS r
   WHERE NOT EXISTS (SELECT 1 FROM turn);
$$;

-- A turn answered with the customer's key is recorded on its permit, and is not charged.
ALTER TABLE public.ocade_generation_permits
  ADD COLUMN customer_connection uuid REFERENCES public.byok_connections (id) ON DELETE SET NULL,
  ADD COLUMN customer_key boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.ocade_bind_permit_to_customer_key(
  p_user_id uuid, p_idempotency_key text, p_connection_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH bound AS (
    UPDATE public.ocade_generation_permits AS p
       SET customer_key = true, customer_connection = p_connection_id, updated_at = now()
     WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
       AND p.status = 'reserved' AND p.transport_claimed_at IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.byok_connections AS c
                    WHERE c.id = p_connection_id AND c.user_id = p_user_id)
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM bound);
$$;

CREATE OR REPLACE FUNCTION public.ocade_finalize_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_cost_hundredths bigint
)
RETURNS TABLE (charged_hundredths bigint, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_total bigint;
  v_difference bigint;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF p_cost_hundredths IS NULL OR p_cost_hundredths < 0 OR p_cost_hundredths > 1000000000 THEN
    RAISE EXCEPTION 'invalid commercial usage cost' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::bigint, 'missing'::text;
    RETURN;
  END IF;
  IF v_permit.status = 'succeeded' THEN
    RETURN QUERY SELECT v_permit.charged_hundredths, 'succeeded'::text;
    RETURN;
  END IF;
  IF v_permit.status <> 'reserved' THEN
    RETURN QUERY SELECT 0::bigint, v_permit.status::text;
    RETURN;
  END IF;

  v_total := CASE WHEN v_permit.tier = 'free' THEN 100
                  ELSE GREATEST(25, p_cost_hundredths) END;

  -- A turn of a task is part of that task's one use, charged when it completes: a turn
  -- bound to its task, and the reply that starts one (the boundary settles it at 0).
  IF v_permit.surface = 'jarvis' AND (p_cost_hundredths = 0 OR v_permit.task_id IS NOT NULL) THEN
    v_total := 0;
  END IF;
  -- Answered with the customer's own key: OCADE's model allowance is not drawn (plan 14B.1B.2).
  IF v_permit.customer_key THEN
    v_total := 0;
  END IF;

  v_difference := v_total - v_permit.reserved_hundredths;

  IF v_difference > 0 THEN
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, v_difference, NULL
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, v_difference, NULL
      );
    END IF;
  ELSIF v_difference < 0 THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, -v_difference
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, -v_difference
      );
    END IF;
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'succeeded', charged_hundredths = v_total,
         finalized_at = v_now, updated_at = v_now
   WHERE p.id = v_permit.id;

  RETURN QUERY SELECT v_total, 'succeeded'::text;
END;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.ocade_byok_save(uuid, uuid, text, text, text, text, text)',
    'public.ocade_byok_route(uuid, uuid, text)',
    'public.ocade_byok_route_for_turn(uuid, text)',
    'public.ocade_byok_record(uuid, uuid, text, boolean, boolean)',
    'public.ocade_byok_choose(uuid, text, uuid)',
    'public.ocade_byok_enable(uuid, uuid, boolean)',
    'public.ocade_byok_delete(uuid, uuid)',
    'public.ocade_bind_permit_to_customer_key(uuid, text, uuid)',
    'public.ocade_finalize_generation_permit(uuid, text, bigint)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
