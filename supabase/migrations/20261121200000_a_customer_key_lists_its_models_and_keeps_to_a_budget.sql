-- Plan 14D.4A.3-6: ALL THE MODELS UNDER ONE CUSTOMER KEY, AUTO OR MANUAL, AND A SPENDING POLICY
-- PER FUNDING SOURCE.
--
-- A customer's connection keeps the list of models its provider reported for that key (refreshed
-- on request), what each is known to be (free, its listed price, tools, images: null is unknown),
-- and which ones the person expressly permits. The connection serves either its one tested model
-- (Manual) or the first permitted model that can do the job (Auto), never a model outside that
-- set and never another source.
--
-- Each connection has a spending policy: Free-only (only a model known to be free, or a key the
-- person says has no billing attached), Custom (per-task, daily and monthly amounts in a currency
-- the person picks, reset in their time zone), or Unlimited (no voluntary OCADE ceiling; the
-- provider's own charges and limits still apply). Every model call on a connection reserves its
-- largest possible cost first, under a lock on the connection so concurrent agents cannot
-- overspend one budget, and settles the provider-reported usage afterwards. A cost OCADE cannot
-- estimate is refused under Custom, never guessed. All of this is the customer's key only:
-- OCADE-funded models are counted by the existing permits and never draw on it, nor it on them.
BEGIN;

ALTER TABLE public.byok_connections
  ADD COLUMN model_mode text NOT NULL DEFAULT 'manual' CHECK (model_mode IN ('manual', 'auto')),
  ADD COLUMN spend_mode text NOT NULL DEFAULT 'unlimited'
    CHECK (spend_mode IN ('free_only', 'custom', 'unlimited')),
  -- The person's own statement that the provider bills nothing for this key (a free-tier key).
  ADD COLUMN free_tier boolean NOT NULL DEFAULT false,
  ADD COLUMN budget_currency text NOT NULL DEFAULT 'USD' CHECK (budget_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN budget_time_zone text NOT NULL DEFAULT 'UTC' CHECK (char_length(budget_time_zone) <= 64),
  ADD COLUMN budget_task numeric(14, 4) CHECK (budget_task >= 0),
  ADD COLUMN budget_day numeric(14, 4) CHECK (budget_day >= 0),
  ADD COLUMN budget_month numeric(14, 4) CHECK (budget_month >= 0),
  ADD COLUMN models_listed_at timestamptz;
GRANT SELECT (model_mode, spend_mode, free_tier, budget_currency, budget_time_zone, budget_task,
  budget_day, budget_month, models_listed_at) ON public.byok_connections TO authenticated;

CREATE TABLE public.byok_models (
  connection_id uuid NOT NULL REFERENCES public.byok_connections (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  model text NOT NULL CHECK (model ~ '^[A-Za-z0-9@][A-Za-z0-9._:/@+-]{0,199}$'),
  label text CHECK (char_length(label) <= 200),
  -- Still in the provider's list at the last refresh; a vanished model is kept, marked, never used.
  listed boolean NOT NULL DEFAULT true,
  free boolean,
  -- Price per million tokens, in price_currency; from the provider's list, or the person's own.
  input_price numeric(14, 6) CHECK (input_price >= 0),
  output_price numeric(14, 6) CHECK (output_price >= 0),
  price_currency text CHECK (price_currency ~ '^[A-Z]{3}$'),
  calls_tools boolean,
  sees_images boolean,
  permitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, model)
);
CREATE INDEX byok_models_user ON public.byok_models (user_id);
ALTER TABLE public.byok_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.byok_models FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.byok_models TO authenticated;
GRANT ALL ON public.byok_models TO service_role;
CREATE POLICY byok_models_own ON public.byok_models
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- One row per model call on a customer's key: reserved before, settled after.
CREATE TABLE public.byok_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.byok_connections (id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.jarvis_tasks (id) ON DELETE SET NULL,
  model text NOT NULL,
  currency text NOT NULL,
  -- Null when OCADE cannot estimate the cost (Unlimited or Free-only); never a guessed zero.
  reserved numeric(20, 10),
  actual numeric(20, 10),
  -- 'estimated': settled without provider-reported usage, so the reservation stands as the cost.
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'settled', 'estimated', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX byok_spend_connection ON public.byok_spend (connection_id, created_at);
CREATE INDEX byok_spend_user ON public.byok_spend (user_id);
CREATE INDEX byok_spend_task ON public.byok_spend (task_id);
ALTER TABLE public.byok_spend ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.byok_spend FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.byok_spend TO authenticated;
GRANT ALL ON public.byok_spend TO service_role;
CREATE POLICY byok_spend_own ON public.byok_spend
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- A JARVIS task keeps the exact model it started with, as it keeps its connection.
ALTER TABLE public.jarvis_tasks ADD COLUMN model_name text;

/* The model a connection serves on a surface now: its own (Manual), or Auto's pick (null: none). */
CREATE FUNCTION private.byok_model_for(p_connection_id uuid, p_surface text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE WHEN c.model_mode = 'manual' THEN c.model ELSE (
    SELECT m.model FROM public.byok_models AS m
     WHERE m.connection_id = c.id AND m.permitted_at IS NOT NULL AND m.listed
       AND (p_surface <> 'jarvis' OR m.calls_tools IS TRUE OR (m.model = c.model AND c.calls_tools IS TRUE))
       AND (c.spend_mode <> 'free_only' OR c.free_tier OR m.free IS TRUE)
     ORDER BY m.permitted_at, m.model
     LIMIT 1) END
    FROM public.byok_connections AS c
   WHERE c.id = p_connection_id;
$$;
REVOKE ALL ON FUNCTION private.byok_model_for(uuid, text) FROM PUBLIC, anon, authenticated;

/* What a model on a connection can do, for the route: the model's own record, else the connection's test. */
CREATE FUNCTION private.byok_model_sees(p_connection_id uuid, p_model text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(
    (SELECT m.sees_images FROM public.byok_models AS m
      WHERE m.connection_id = p_connection_id AND m.model = p_model),
    (SELECT c.sees_images FROM public.byok_connections AS c
      WHERE c.id = p_connection_id AND c.model = p_model));
$$;
REVOKE ALL ON FUNCTION private.byok_model_sees(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.jarvis_task_keeps_its_source()
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
  NEW.model_name := CASE WHEN FOUND THEN private.byok_model_for(v_choice.connection_id, 'jarvis') END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_byok_route(p_user_id uuid, p_connection_id uuid, p_surface text)
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
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, chosen.model,
         private.byok_model_sees(c.id, chosen.model), c.calls_tools, s.decrypted_secret
    FROM public.byok_choices AS ch
    LEFT JOIN public.byok_connections AS c ON c.id = ch.connection_id AND c.user_id = ch.user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
    LEFT JOIN LATERAL (SELECT private.byok_model_for(c.id, p_surface) AS model) AS chosen ON true
   WHERE p_connection_id IS NULL AND ch.user_id = p_user_id AND ch.surface = p_surface;
$$;

CREATE OR REPLACE FUNCTION public.ocade_byok_route_for_turn(p_user_id uuid, p_idempotency_key text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH turn AS (
    SELECT t.model_customer_key, t.model_connection,
           coalesce(t.model_name, CASE WHEN t.model_customer_key THEN
             (SELECT c.model FROM public.byok_connections AS c
               WHERE c.id = t.model_connection AND c.model_mode = 'manual') END) AS model_name
      FROM public.ocade_generation_permits AS p
      JOIN public.jarvis_tasks AS t ON t.id = p.task_id AND t.user_id = p.user_id
     WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key))
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, turn.model_name,
         private.byok_model_sees(c.id, turn.model_name), c.calls_tools, s.decrypted_secret
    FROM turn
    LEFT JOIN public.byok_connections AS c ON c.id = turn.model_connection AND c.user_id = p_user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE turn.model_customer_key
  UNION ALL
  SELECT r.* FROM public.ocade_byok_route(p_user_id, NULL, 'jarvis') AS r
   WHERE NOT EXISTS (SELECT 1 FROM turn);
$$;

/*
 * The provider's list for this key, as OCADE's server read it: models are added or refreshed, the
 * person's permissions and own prices are kept, and a model no longer listed is marked, not used.
 */
CREATE FUNCTION public.ocade_byok_models_save(p_user_id uuid, p_connection_id uuid, p_models jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM 1 FROM public.byok_connections
   WHERE id = p_connection_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'byok: no such connection' USING ERRCODE = 'no_data_found';
  END IF;
  IF jsonb_typeof(p_models) <> 'array' OR jsonb_array_length(p_models) > 1000 THEN
    RAISE EXCEPTION 'byok: a model list of at most 1000' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.byok_models SET listed = false, updated_at = now()
   WHERE connection_id = p_connection_id;
  INSERT INTO public.byok_models AS m (connection_id, user_id, model, label, listed, free,
    input_price, output_price, price_currency, calls_tools, sees_images)
  SELECT p_connection_id, p_user_id, e->>'model', left(e->>'label', 200), true,
         (e->>'free')::boolean, (e->>'inputPrice')::numeric, (e->>'outputPrice')::numeric,
         CASE WHEN e ? 'inputPrice' THEN 'USD' END,
         (e->>'callsTools')::boolean, (e->>'seesImages')::boolean
    FROM jsonb_array_elements(p_models) AS e
  ON CONFLICT (connection_id, model) DO UPDATE SET
    label = EXCLUDED.label, listed = true,
    free = coalesce(EXCLUDED.free, m.free),
    -- A price the person entered stays theirs; the provider's list refreshes its own.
    input_price = CASE WHEN m.price_currency IS NULL OR m.price_currency = 'USD'
                       THEN coalesce(EXCLUDED.input_price, m.input_price) ELSE m.input_price END,
    output_price = CASE WHEN m.price_currency IS NULL OR m.price_currency = 'USD'
                        THEN coalesce(EXCLUDED.output_price, m.output_price) ELSE m.output_price END,
    price_currency = coalesce(m.price_currency, EXCLUDED.price_currency),
    calls_tools = coalesce(m.calls_tools, EXCLUDED.calls_tools),
    sees_images = coalesce(m.sees_images, EXCLUDED.sees_images),
    updated_at = now();
  UPDATE public.byok_connections SET models_listed_at = now(), updated_at = now()
   WHERE id = p_connection_id;
  SELECT count(*) INTO v_count FROM public.byok_models
   WHERE connection_id = p_connection_id AND listed;
  RETURN v_count;
END;
$$;

/* The person permits a model (or withdraws it), and may give its price in their budget currency. */
CREATE FUNCTION public.ocade_byok_model_set(
  p_user_id uuid, p_connection_id uuid, p_model text, p_permitted boolean,
  p_input_price numeric, p_output_price numeric, p_price_currency text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH changed AS (
    UPDATE public.byok_models SET
      permitted_at = CASE WHEN NOT p_permitted THEN NULL ELSE coalesce(permitted_at, clock_timestamp()) END,
      input_price = CASE WHEN p_input_price IS NULL THEN input_price ELSE p_input_price END,
      output_price = CASE WHEN p_output_price IS NULL THEN output_price ELSE p_output_price END,
      price_currency = CASE WHEN p_input_price IS NULL AND p_output_price IS NULL THEN price_currency
                            ELSE p_price_currency END,
      updated_at = now()
     WHERE connection_id = p_connection_id AND user_id = p_user_id AND model = p_model
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM changed);
$$;

/* What a probe proved about one model of the connection. */
CREATE FUNCTION public.ocade_byok_model_record(
  p_user_id uuid, p_connection_id uuid, p_model text, p_calls_tools boolean, p_sees_images boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.byok_models SET
    calls_tools = coalesce(p_calls_tools, calls_tools),
    sees_images = coalesce(p_sees_images, sees_images), updated_at = now()
   WHERE connection_id = p_connection_id AND user_id = p_user_id AND model = p_model;
$$;

/* The connection's model mode and spending policy, as the person sets them in Settings > BYOK. */
CREATE FUNCTION public.ocade_byok_policy(
  p_user_id uuid, p_connection_id uuid, p_model_mode text, p_spend_mode text, p_free_tier boolean,
  p_currency text, p_time_zone text, p_task numeric, p_day numeric, p_month numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'byok: unknown time zone' USING ERRCODE = 'check_violation';
  END IF;
  IF p_spend_mode = 'custom' AND p_task IS NULL AND p_day IS NULL AND p_month IS NULL THEN
    RAISE EXCEPTION 'byok: a custom policy needs at least one amount' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.byok_connections SET
    model_mode = p_model_mode, spend_mode = p_spend_mode, free_tier = p_free_tier,
    budget_currency = p_currency, budget_time_zone = p_time_zone,
    budget_task = CASE WHEN p_spend_mode = 'custom' THEN p_task END,
    budget_day = CASE WHEN p_spend_mode = 'custom' THEN p_day END,
    budget_month = CASE WHEN p_spend_mode = 'custom' THEN p_month END,
    updated_at = now()
   WHERE id = p_connection_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

/* The largest cost of a call, or null when its price is not known in the budget's currency. */
CREATE FUNCTION private.byok_cost(
  p_connection public.byok_connections, p_model text, p_input integer, p_output integer
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN m.free IS TRUE OR p_connection.free_tier THEN 0
    WHEN m.price_currency = p_connection.budget_currency AND m.input_price IS NOT NULL
         AND m.output_price IS NOT NULL
      THEN (greatest(p_input, 0) * m.input_price + greatest(p_output, 0) * m.output_price) / 1000000
    END
    FROM (SELECT 1) AS one
    LEFT JOIN public.byok_models AS m ON m.connection_id = p_connection.id AND m.model = p_model;
$$;
REVOKE ALL ON FUNCTION private.byok_cost(public.byok_connections, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

/*
 * Reserve one call on a customer's key before it is sent. Answers the reservation, or why the
 * person's policy refuses it: free_only_paid, price_unknown, budget_task, budget_day, budget_month.
 * The connection row is locked, so concurrent agents of one person reserve one after another.
 */
CREATE FUNCTION public.ocade_byok_reserve(
  p_user_id uuid, p_connection_id uuid, p_model text, p_idempotency_key text,
  p_input_tokens integer, p_output_tokens integer
)
RETURNS TABLE (reservation uuid, refusal text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_conn public.byok_connections;
  v_task uuid;
  v_cost numeric;
  v_free boolean;
  v_now timestamptz := statement_timestamp();
  v_id uuid;
BEGIN
  SELECT * INTO v_conn FROM public.byok_connections
   WHERE id = p_connection_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'byok: no such connection' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT p.task_id INTO v_task FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key);
  SELECT m.free INTO v_free FROM public.byok_models AS m
   WHERE m.connection_id = p_connection_id AND m.model = p_model;
  IF v_conn.spend_mode = 'free_only' AND NOT v_conn.free_tier AND v_free IS NOT TRUE THEN
    RETURN QUERY SELECT NULL::uuid, 'free_only_paid'::text;
    RETURN;
  END IF;
  v_cost := private.byok_cost(v_conn, p_model, p_input_tokens, p_output_tokens);
  IF v_conn.spend_mode = 'custom' THEN
    IF v_cost IS NULL THEN
      RETURN QUERY SELECT NULL::uuid, 'price_unknown'::text;
      RETURN;
    END IF;
    IF v_conn.budget_task IS NOT NULL AND v_task IS NOT NULL AND v_cost + (
         SELECT coalesce(sum(coalesce(s.actual, s.reserved)), 0) FROM public.byok_spend AS s
          WHERE s.connection_id = v_conn.id AND s.task_id = v_task AND s.state <> 'released')
         > v_conn.budget_task THEN
      RETURN QUERY SELECT NULL::uuid, 'budget_task'::text;
      RETURN;
    END IF;
    IF v_conn.budget_day IS NOT NULL AND v_cost + (
         SELECT coalesce(sum(coalesce(s.actual, s.reserved)), 0) FROM public.byok_spend AS s
          WHERE s.connection_id = v_conn.id AND s.state <> 'released'
            AND s.created_at >= (date_trunc('day', v_now AT TIME ZONE v_conn.budget_time_zone)
                                 AT TIME ZONE v_conn.budget_time_zone))
         > v_conn.budget_day THEN
      RETURN QUERY SELECT NULL::uuid, 'budget_day'::text;
      RETURN;
    END IF;
    IF v_conn.budget_month IS NOT NULL AND v_cost + (
         SELECT coalesce(sum(coalesce(s.actual, s.reserved)), 0) FROM public.byok_spend AS s
          WHERE s.connection_id = v_conn.id AND s.state <> 'released'
            AND s.created_at >= (date_trunc('month', v_now AT TIME ZONE v_conn.budget_time_zone)
                                 AT TIME ZONE v_conn.budget_time_zone))
         > v_conn.budget_month THEN
      RETURN QUERY SELECT NULL::uuid, 'budget_month'::text;
      RETURN;
    END IF;
  END IF;
  INSERT INTO public.byok_spend (user_id, connection_id, task_id, model, currency, reserved)
  VALUES (p_user_id, v_conn.id, v_task, p_model, v_conn.budget_currency, v_cost)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, NULL::text;
END;
$$;

/*
 * After the call: the provider-reported usage becomes the cost; without it, the reservation stands
 * as an estimate. A call that never reached the provider is released.
 */
CREATE FUNCTION public.ocade_byok_settle(
  p_user_id uuid, p_reservation uuid, p_sent boolean, p_input_tokens integer, p_output_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_spend public.byok_spend;
  v_conn public.byok_connections;
BEGIN
  SELECT * INTO v_spend FROM public.byok_spend
   WHERE id = p_reservation AND user_id = p_user_id AND state = 'reserved' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT * INTO v_conn FROM public.byok_connections WHERE id = v_spend.connection_id;
  UPDATE public.byok_spend SET
    state = CASE WHEN NOT p_sent THEN 'released'
                 WHEN p_input_tokens IS NULL OR p_output_tokens IS NULL THEN 'estimated'
                 ELSE 'settled' END,
    actual = CASE WHEN NOT p_sent THEN 0
                  WHEN p_input_tokens IS NULL OR p_output_tokens IS NULL THEN reserved
                  ELSE private.byok_cost(v_conn, v_spend.model, p_input_tokens, p_output_tokens) END,
    settled_at = now()
   WHERE id = v_spend.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.jarvis_task_state(p_task uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'id', t.id, 'userId', t.user_id, 'status', t.status, 'controller', t.controller, 'mode', t.mode,
    'title', t.title, 'outcome', t.outcome, 'blocker', t.blocker, 'result', t.result,
    -- The source the task started with, as it is shown in progress and receipts (14D.4A.4).
    'modelSource', CASE WHEN t.model_customer_key THEN (
      SELECT jsonb_build_object('alias', c.alias, 'model', t.model_name, 'currency', c.budget_currency,
        'spent', (SELECT sum(coalesce(s.actual, s.reserved)) FROM public.byok_spend AS s
                   WHERE s.task_id = t.id AND s.state <> 'released'),
        'estimated', EXISTS (SELECT 1 FROM public.byok_spend AS s WHERE s.task_id = t.id
                              AND s.state IN ('reserved', 'estimated')))
        FROM (SELECT 1) AS one
        LEFT JOIN public.byok_connections AS c ON c.id = t.model_connection) END,
    'plan', t.plan, 'checkpoint', t.checkpoint - 'authorizedSessionId', 'conversationId', t.conversation_id,
    'sessionLive', t.checkpoint ->> 'authorizedSessionId' IS NULL
      OR public.ocade_session_is_live(t.user_id, (t.checkpoint ->> 'authorizedSessionId')::uuid),
    'deviceName', (SELECT d.name FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'deviceSeenAt', (SELECT d.last_seen_at FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'apps', (SELECT d.installed_apps FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'mcp', (SELECT coalesce(d.capabilities -> 'mcp', '[]'::jsonb) FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'engines', (SELECT d.capabilities -> 'engines' FROM public.jarvis_devices AS d WHERE d.id = t.device_id),
    'grants', public.jarvis_grants(t.user_id, t.device_id),
    'timing', jsonb_build_object(
      'acceptedAt', t.created_at, 'finishedAt', t.finished_at, 'now', statement_timestamp(),
      'pausedMs', t.user_wait_ms
        + coalesce((extract(epoch FROM coalesce(t.finished_at, statement_timestamp()) - t.paused_at) * 1000)::bigint, 0),
      'modelCalls', t.model_calls, 'modelMs', t.model_ms,
      'plannerAutoRetries', t.planner_auto_retries,
      'providerUsage', jsonb_build_object(
        'inputTokens', CASE WHEN t.provider_input_calls > 0 THEN t.provider_input_tokens END,
        'outputTokens', CASE WHEN t.provider_output_calls > 0 THEN t.provider_output_tokens END,
        'inputMeasuredCalls', t.provider_input_calls, 'outputMeasuredCalls', t.provider_output_calls,
        'goalMs', t.planner_goal_ms, 'decisionMs', t.planner_decision_ms,
        'limitReached', cardinality(t.model_metric_ids) >= 512
      )),
    'steps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'summary', a.summary, 'intent', a.action,
                                          'status', a.status, 'receipt', a.result,
                                          'createdAt', a.created_at, 'completedAt', a.completed_at,
                                          'confirmedAt', a.confirmed_at, 'claimedAt', a.claimed_at, 'controller', a.controller,
                                          'resolution', a.resolution, 'resolvedAt', a.resolved_at,
                                          'lane', a.lane)
                       ORDER BY a.created_at, a.id)
        FROM public.jarvis_activity AS a WHERE a.task_id = t.id AND a.action IS NOT NULL), '[]'::jsonb))
  FROM public.jarvis_tasks AS t WHERE t.id = p_task;
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.ocade_byok_route(uuid, uuid, text)',
    'public.ocade_byok_route_for_turn(uuid, text)',
    'public.ocade_byok_models_save(uuid, uuid, jsonb)',
    'public.ocade_byok_model_set(uuid, uuid, text, boolean, numeric, numeric, text)',
    'public.ocade_byok_model_record(uuid, uuid, text, boolean, boolean)',
    'public.ocade_byok_policy(uuid, uuid, text, text, boolean, text, text, numeric, numeric, numeric)',
    'public.ocade_byok_reserve(uuid, uuid, text, text, integer, integer)',
    'public.ocade_byok_settle(uuid, uuid, boolean, integer, integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
