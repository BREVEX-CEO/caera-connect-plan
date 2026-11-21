-- Plan 14D.4A.3-6: a customer key's model list, Auto/Manual choice, and Free-only / Custom /
-- Unlimited spending, reserved before a call under a lock and settled after. Disposable database.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.ok(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'byok budgets: %', p_what; END IF;
END;
$$;
INSERT INTO auth.users (id, email) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000001', 'alice@example.test'),
  ('b0b0b0b0-0000-4000-8000-000000000002', 'bob@example.test');
CREATE TEMP TABLE ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON ids TO service_role, authenticated;

SET LOCAL ROLE service_role;
INSERT INTO ids SELECT 'a', public.ocade_byok_save('a1a1a1a1-0000-4000-8000-000000000001', NULL,
  'OpenRouter', 'openai', 'https://openrouter.example/api/v1', 'vendor/paid', 'sk-alice-secret-1111');
INSERT INTO ids SELECT 'b', public.ocade_byok_save('b0b0b0b0-0000-4000-8000-000000000002', NULL,
  'Bob', 'openai', 'https://api.example/v1', 'vendor/paid', 'sk-bob-secret-3333');
SELECT public.ocade_byok_record('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'connected', false, true);

-- 120 models under one key: listed, refreshed, a vanished one marked; Bob cannot write Alice's list.
SELECT pg_temp.ok(public.ocade_byok_models_save('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  (SELECT jsonb_agg(jsonb_build_object('model', 'vendor/m' || n, 'label', 'Model ' || n)) FROM generate_series(1, 117) AS n)
  || '[{"model": "vendor/free", "free": true, "callsTools": true},
       {"model": "vendor/paid", "inputPrice": 2, "outputPrice": 10, "callsTools": true},
       {"model": "vendor/notools", "free": true, "callsTools": false}]'::jsonb) = 120, 'a list of 120 models is kept');
SELECT pg_temp.ok(public.ocade_byok_models_save('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  (SELECT jsonb_agg(jsonb_build_object('model', 'vendor/m' || n)) FROM generate_series(2, 117) AS n)
  || '[{"model": "vendor/free", "free": true}, {"model": "vendor/paid", "inputPrice": 2, "outputPrice": 10},
       {"model": "vendor/notools", "free": true}]'::jsonb) = 119, 'a refresh drops a vanished model from the list');
SELECT pg_temp.ok((SELECT NOT listed FROM public.byok_models WHERE model = 'vendor/m1'), 'the vanished model is kept, marked');
SELECT pg_temp.ok((SELECT calls_tools FROM public.byok_models WHERE model = 'vendor/free'), 'what was known is kept on refresh');
DO $$
BEGIN
  PERFORM public.ocade_byok_models_save('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a'), '[]');
  RAISE EXCEPTION 'byok budgets: Bob wrote Alice''s model list';
EXCEPTION WHEN no_data_found THEN NULL;
END;
$$;
SELECT pg_temp.ok(NOT public.ocade_byok_model_set('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/free', true, NULL, NULL, NULL), 'Bob cannot permit Alice''s models');

-- Auto picks only an expressly permitted model that can do the job; none permitted is none.
SELECT public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'auto', 'free_only', false, 'USD', 'Asia/Kolkata', NULL, NULL, NULL);
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'chat', (SELECT id FROM ids WHERE name = 'a'));
SELECT public.ocade_byok_choose('a1a1a1a1-0000-4000-8000-000000000001', 'jarvis', (SELECT id FROM ids WHERE name = 'a'));
SELECT pg_temp.ok((SELECT model IS NULL FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')),
  'Auto with nothing permitted serves no model, not the connection''s own');
SELECT public.ocade_byok_model_set('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', true, NULL, NULL, NULL);
SELECT public.ocade_byok_model_set('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'vendor/notools', true, NULL, NULL, NULL);
SELECT public.ocade_byok_model_set('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'vendor/free', true, NULL, NULL, NULL);
SELECT pg_temp.ok((SELECT model FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'chat')) = 'vendor/notools',
  'Free-only Auto skips the paid model for Chat');
SELECT pg_temp.ok((SELECT model FROM public.ocade_byok_route('a1a1a1a1-0000-4000-8000-000000000001', NULL, 'jarvis')) = 'vendor/free',
  'JARVIS Auto needs a model that calls tools');

-- A task keeps the exact model it started with.
RESET ROLE;
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
  VALUES ('c0c0c0c0-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'Task', 'jarvis');
INSERT INTO public.jarvis_tasks (id, user_id, conversation_id, title, status)
  VALUES ('c0c0c0c0-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'c0c0c0c0-0000-4000-8000-000000000003', 'A task', 'running');
SELECT pg_temp.ok((SELECT model_name FROM public.jarvis_tasks WHERE id = 'c0c0c0c0-0000-4000-8000-000000000003') = 'vendor/free',
  'the task records the model Auto chose');
SET LOCAL ROLE service_role;
SELECT public.ocade_acquire_generation_permit('a1a1a1a1-0000-4000-8000-000000000001', 'task-turn', 'gen-t', 'jarvis', 'free', 1000, NULL, 100);
RESET ROLE;
UPDATE public.ocade_generation_permits SET task_id = 'c0c0c0c0-0000-4000-8000-000000000003' WHERE idempotency_key = 'task-turn';
SET LOCAL ROLE service_role;
SELECT public.ocade_byok_model_set('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'vendor/free', false, NULL, NULL, NULL);
SELECT pg_temp.ok((SELECT model FROM public.ocade_byok_route_for_turn('a1a1a1a1-0000-4000-8000-000000000001', 'task-turn')) = 'vendor/free',
  'a running task keeps its model when the permitted set changes');

-- Free-only: a paid model is refused before any call; a free one, or a free-tier key, is not.
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'task-turn', 1000, 1000)) = 'free_only_paid', 'Free-only refuses a paid model');
SELECT pg_temp.ok((SELECT refusal IS NULL AND reservation IS NOT NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001',
  (SELECT id FROM ids WHERE name = 'a'), 'vendor/free', 'task-turn', 1000, 1000)), 'Free-only allows a free model');
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/m5', 'task-turn', 10, 10)) = 'free_only_paid', 'Free-only refuses a model whose price is unknown');
SELECT public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'manual', 'free_only', true, 'USD', 'UTC', NULL, NULL, NULL);
SELECT pg_temp.ok((SELECT refusal IS NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/m5', 'task-turn', 10, 10)), 'a key the person says has no billing is free');

-- Custom: amounts in the person's currency, per task, day and month; unknown prices are refused.
DELETE FROM public.byok_spend;
DO $$
BEGIN
  PERFORM public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
    'manual', 'custom', false, 'USD', 'Mars/Olympus', 1, NULL, NULL);
  RAISE EXCEPTION 'byok budgets: an unknown time zone was kept';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
    'manual', 'custom', false, 'USD', 'UTC', NULL, NULL, NULL);
  RAISE EXCEPTION 'byok budgets: a custom policy without an amount was kept';
EXCEPTION WHEN check_violation THEN NULL;
END;
$$;
-- vendor/paid: 2 and 10 USD per million; 100k in + 50k out = 0.2 + 0.5 = 0.7 USD a call.
SELECT public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'manual', 'custom', false, 'USD', 'Asia/Kolkata', 1.5, 2, 10);
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/m5', 'task-turn', 10, 10)) = 'price_unknown', 'Custom never guesses an unknown price');
INSERT INTO ids SELECT 'r1', reservation FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001',
  (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', 'task-turn', 100000, 50000);
INSERT INTO ids SELECT 'r2', reservation FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001',
  (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', 'task-turn', 100000, 50000);
SELECT pg_temp.ok((SELECT count(id) FROM ids WHERE name IN ('r1', 'r2')) = 2, 'two calls fit the task''s 1.5');
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'task-turn', 100000, 50000)) = 'budget_task', 'a third call would pass the task budget');
-- Settled at the provider-reported usage, the room comes back; a call never sent is released.
SELECT public.ocade_byok_settle('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'r1'), true, 1000, 1000);
SELECT pg_temp.ok((SELECT state = 'settled' AND actual = 0.012 FROM public.byok_spend WHERE id = (SELECT id FROM ids WHERE name = 'r1')),
  'the actual cost comes from the reported tokens');
SELECT public.ocade_byok_settle('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'r2'), true, NULL, NULL);
SELECT pg_temp.ok((SELECT state = 'estimated' AND actual = reserved FROM public.byok_spend WHERE id = (SELECT id FROM ids WHERE name = 'r2')),
  'without reported usage, the reservation stands as an estimate');
SELECT public.ocade_byok_settle('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'r2'), false, NULL, NULL);
SELECT pg_temp.ok((SELECT state = 'estimated' FROM public.byok_spend WHERE id = (SELECT id FROM ids WHERE name = 'r2')),
  'a settled call cannot be settled again');
INSERT INTO ids SELECT 'r3', reservation FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001',
  (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', 'task-turn', 100000, 50000);
SELECT public.ocade_byok_settle('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'r3'), false, NULL, NULL);
SELECT pg_temp.ok((SELECT state = 'released' AND actual = 0 FROM public.byok_spend WHERE id = (SELECT id FROM ids WHERE name = 'r3')),
  'a call that never reached the provider costs nothing');
SELECT pg_temp.ok((SELECT (s->'modelSource'->>'model') = 'vendor/free' AND (s->'modelSource'->>'alias') = 'OpenRouter'
  AND (s->'modelSource'->>'spent')::numeric = 0.712 AND (s->'modelSource'->>'estimated')::boolean
  FROM public.jarvis_task_state('c0c0c0c0-0000-4000-8000-000000000003') AS s),
  'the task shows its source, model and what it spent, marked as partly estimated');
-- The day's 2 USD: calls outside any task still count toward it.
SELECT public.ocade_acquire_generation_permit('a1a1a1a1-0000-4000-8000-000000000001', 'chat-turn', 'gen-c', 'chat', 'free', 1000, NULL, 100);
SELECT pg_temp.ok((SELECT refusal IS NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'chat-turn', 100000, 50000)), 'a Chat call fits the day');
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'chat-turn', 100000, 50000)) = 'budget_day', 'the day''s amount stops the next call');
-- Yesterday (in the person's time zone) no longer counts toward today.
RESET ROLE;
UPDATE public.byok_spend SET created_at = created_at - interval '1 day';
SET LOCAL ROLE service_role;
SELECT pg_temp.ok((SELECT refusal IS NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'chat-turn', 100000, 50000)), 'the day resets');
-- A price in another currency is not mixed with the budget's: the person's own price is used.
SELECT public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'manual', 'custom', false, 'INR', 'Asia/Kolkata', NULL, 100, NULL);
SELECT pg_temp.ok((SELECT refusal FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'chat-turn', 1000, 1000)) = 'price_unknown', 'a USD price is not a rupee price');
SELECT public.ocade_byok_model_set('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', true, 170, 850, 'INR');
SELECT pg_temp.ok((SELECT refusal IS NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/paid', 'chat-turn', 1000, 1000)), 'the person''s rupee price is used');

-- Unlimited: no voluntary ceiling, every call still recorded.
SELECT public.ocade_byok_policy('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'manual', 'unlimited', false, 'USD', 'UTC', 5, 5, 5);
SELECT pg_temp.ok((SELECT budget_task IS NULL AND budget_day IS NULL FROM public.byok_connections WHERE id = (SELECT id FROM ids WHERE name = 'a')),
  'Unlimited keeps no amounts');
SELECT pg_temp.ok((SELECT refusal IS NULL FROM public.ocade_byok_reserve('a1a1a1a1-0000-4000-8000-000000000001', (SELECT id FROM ids WHERE name = 'a'),
  'vendor/m5', 'chat-turn', 100000000, 100000)), 'Unlimited refuses nothing, even an unknown price');
DO $$
BEGIN
  PERFORM public.ocade_byok_reserve('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'a'), 'vendor/paid', 'chat-turn', 1, 1);
  RAISE EXCEPTION 'byok budgets: Bob reserved on Alice''s key';
EXCEPTION WHEN no_data_found THEN NULL;
END;
$$;
RESET ROLE;

-- A person reads their own models and spending, and calls none of these functions.
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "b0b0b0b0-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
SELECT pg_temp.ok((SELECT count(*) FROM public.byok_models) = 0 AND (SELECT count(*) FROM public.byok_spend) = 0,
  'Bob sees none of Alice''s models or spending');
DO $$
BEGIN
  PERFORM public.ocade_byok_reserve('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'b'), 'vendor/paid', 'x', 1, 1);
  RAISE EXCEPTION 'byok budgets: a person reserved directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
DO $$
BEGIN
  PERFORM public.ocade_byok_policy('b0b0b0b0-0000-4000-8000-000000000002', (SELECT id FROM ids WHERE name = 'b'),
    'manual', 'unlimited', false, 'USD', 'UTC', NULL, NULL, NULL);
  RAISE EXCEPTION 'byok budgets: a person changed a policy directly';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END;
$$;
RESET ROLE;
DELETE FROM auth.users WHERE id = 'a1a1a1a1-0000-4000-8000-000000000001';
SELECT pg_temp.ok((SELECT count(*) FROM public.byok_models) = 0 AND (SELECT count(*) FROM public.byok_spend) = 0,
  'a deleted account takes its models and spending with it');
ROLLBACK;
