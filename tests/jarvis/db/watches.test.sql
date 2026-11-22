-- Watched folders (REPO-61/71): a watch belongs to the person's own JARVIS conversation and
-- computer; folders outside the JARVIS folder are refused; a new file becomes exactly one
-- one-time scheduled run; the same file again, an inactive watch, another computer or a removed
-- one start nothing; at most 20 runs a day; a person cannot call the server steps or read another
-- person's watches. Disposable database only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'watches: %', p_what; END IF;
END $$;
CREATE FUNCTION pg_temp.fails(p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || p_expected || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'expected "%", got "%" for: %', p_expected, SQLERRM, p_sql;
  END;
  RAISE EXCEPTION 'expected "%", but statement succeeded: %', p_expected, p_sql;
END $$;
INSERT INTO auth.users (id, email) VALUES
  ('d1d1d1d1-0000-4000-8000-000000000001', 'watch-a@example.test'),
  ('d2d2d2d2-0000-4000-8000-000000000002', 'watch-b@example.test');
INSERT INTO public.ocade_conversations (id, user_id, title, surface) VALUES
  ('d1d1d1d1-1111-4000-8000-000000000001', 'd1d1d1d1-0000-4000-8000-000000000001', 'J', 'jarvis');
CREATE TEMP TABLE w_ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON w_ids TO service_role, authenticated;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v record;
  a uuid := 'd1d1d1d1-0000-4000-8000-000000000001';
  conv uuid := 'd1d1d1d1-1111-4000-8000-000000000001';
  dev uuid; other uuid; w uuid;
  i integer;
BEGIN
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('W', 120), 'PC W', 'windows', '0.1.0', repeat('9', 64));
  dev := public.jarvis_approve_device(a, v.code);
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('X', 120), 'PC X', 'windows', '0.1.0', repeat('a', 64));
  other := public.jarvis_approve_device('d2d2d2d2-0000-4000-8000-000000000002', v.code);
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_watch(%L, %L, %L, %L, %L)', a, conv, other, 'In', 'x'), 'schedule_device_unavailable');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_watch(%L, %L, %L, %L, %L)', a, conv, dev, '../Desktop', 'x'), 'jarvis_watches_folder_check');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_add_watch(%L, %L, %L, %L, %L)', a, conv, dev, 'C:/Users', 'x'), 'jarvis_watches_folder_check');
  w := public.jarvis_add_watch(a, conv, dev, 'Invoices\', 'File each invoice in the ledger');
  INSERT INTO w_ids VALUES ('w', w);
  PERFORM pg_temp.check((SELECT folder FROM public.jarvis_watches WHERE id = w) = 'Invoices', 'the folder is normalised');
  PERFORM pg_temp.check(public.jarvis_device_watches(dev) -> 0 ->> 'folder' = 'Invoices', 'the companion sees its watch');
  PERFORM pg_temp.check(jsonb_array_length(public.jarvis_device_watches(other)) = 0, 'another computer sees nothing');

  PERFORM pg_temp.check(public.jarvis_watch_fired(dev, w, 'march.pdf', 'march.pdf:100:1') = 'scheduled', 'a new file schedules a run');
  PERFORM pg_temp.check(public.jarvis_watch_fired(dev, w, 'march.pdf', 'march.pdf:100:1') = 'duplicate', 'the same file never twice');
  PERFORM pg_temp.check(public.jarvis_watch_fired(other, w, 'x.pdf', 'x') = 'not_watched', 'another computer cannot fire it');
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_schedules WHERE watch_id = w AND active AND repeat = 'none'
                           AND what LIKE 'File each invoice%march.pdf)') = 1, 'exactly one one-time run');
  PERFORM pg_temp.fails(format('SELECT public.jarvis_watch_fired(%L, %L, %L, %L)', dev, w, 'a/b.pdf', 'k'), 'invalid_watch_event');
  FOR i IN 2..20 LOOP
    PERFORM public.jarvis_watch_fired(dev, w, 'f' || i, 'k' || i);
  END LOOP;
  PERFORM pg_temp.check(public.jarvis_watch_fired(dev, w, 'f21', 'k21') = 'limited', 'at most 20 a day');
  UPDATE public.jarvis_watches SET active = false WHERE id = w;
  PERFORM pg_temp.check(public.jarvis_watch_fired(dev, w, 'late', 'late') = 'not_watched', 'an inactive watch starts nothing');
  PERFORM pg_temp.check(jsonb_array_length(public.jarvis_device_watches(dev)) = 0, 'an inactive watch is not sent');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub": "d2d2d2d2-0000-4000-8000-000000000002", "role": "authenticated"}', true); END $$;
DO $$
DECLARE n integer;
BEGIN
  PERFORM pg_temp.check((SELECT count(*) FROM public.jarvis_watches) = 0, 'another person read a watch');
  UPDATE public.jarvis_watches SET active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.check(n = 0, 'another person turned a watch on');
  BEGIN
    PERFORM public.jarvis_watch_fired((SELECT id FROM public.jarvis_devices LIMIT 1), (SELECT id FROM w_ids), 'x', 'x');
    RAISE EXCEPTION 'watches: a person fired a watch';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
