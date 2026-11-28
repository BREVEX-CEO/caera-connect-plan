-- SAAS-12 / ADMIN-08: the operator record is hash-chained and append-only; an erased account is still cleared
-- from it; the break-glass and export lines are accepted. Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE oc AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM oc;
INSERT INTO auth.users (id, email) SELECT b, b::text || '@example.test' FROM oc;
INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  SELECT a, b, 'break_glass_approved', 'second owner approved the pause' FROM oc;
INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  SELECT a, NULL, 'break_glass_used', 'jarvis_agent paused: emergency drill' FROM oc;
INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  SELECT a, NULL, 'audit_exported', 'quarterly review of the record' FROM oc;
DO $$
DECLARE refused boolean; v_b uuid := (SELECT b FROM oc); v_id uuid; v_count integer;
BEGIN
  IF private.ocade_verify_admin_chain() IS NOT NULL THEN RAISE EXCEPTION 'operator-record: a clean chain does not verify'; END IF;
  SELECT count(*) INTO v_count FROM public.ocade_admin_actions WHERE row_hash IS NOT NULL;
  IF v_count <> (SELECT count(*) FROM public.ocade_admin_actions) THEN RAISE EXCEPTION 'operator-record: a row has no hash'; END IF;
  -- a change to the text of a line is refused
  refused := false;
  BEGIN UPDATE public.ocade_admin_actions SET reason = 'rewritten history for the log' WHERE action = 'audit_exported';
  EXCEPTION WHEN insufficient_privilege THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'operator-record: a line was rewritten'; END IF;
  -- a line cannot be deleted or the table emptied
  refused := false;
  BEGIN DELETE FROM public.ocade_admin_actions WHERE action = 'break_glass_used';
  EXCEPTION WHEN insufficient_privilege THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'operator-record: a line was deleted'; END IF;
  refused := false;
  BEGIN TRUNCATE public.ocade_admin_actions;
  EXCEPTION WHEN insufficient_privilege THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'operator-record: the record was truncated'; END IF;
  -- erasing an account clears its id from the record without breaking the chain
  DELETE FROM auth.users WHERE id = v_b;
  IF EXISTS (SELECT 1 FROM public.ocade_admin_actions WHERE target_user = v_b) THEN
    RAISE EXCEPTION 'operator-record: an erased account is still named';
  END IF;
  IF private.ocade_verify_admin_chain() IS NOT NULL THEN RAISE EXCEPTION 'operator-record: erasing an account broke the chain'; END IF;
  -- tampering below the trigger (as a table owner would) is detected
  ALTER TABLE public.ocade_admin_actions DISABLE TRIGGER ocade_admin_append_only;
  UPDATE public.ocade_admin_actions SET reason = 'quietly edited by a database owner' WHERE action = 'break_glass_used' RETURNING id INTO v_id;
  ALTER TABLE public.ocade_admin_actions ENABLE TRIGGER ocade_admin_append_only;
  IF private.ocade_verify_admin_chain() IS NULL THEN RAISE EXCEPTION 'operator-record: an edit under the trigger was not detected'; END IF;
END $$;
ROLLBACK;
