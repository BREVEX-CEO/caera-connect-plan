-- A case names its reader and conversation; nobody below an owner gives back a denied
-- permission; recovery sheets are replaced one at a time; Library paths stay in their folder.
DO $$
BEGIN
  IF to_regprocedure('public.ocade_case_open(uuid,text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'a case can still be opened without naming its conversation';
  END IF;
  IF pg_get_functiondef('public.ocade_case_messages(uuid,uuid)'::regprocedure) !~ 'c\.assignee = auth\.uid\(\)'
     OR pg_get_functiondef('public.ocade_case_messages(uuid,uuid)'::regprocedure) !~ 'c\.conversation = p_conversation' THEN
    RAISE EXCEPTION 'a case is still readable beyond its reader and conversation';
  END IF;
  IF pg_get_functiondef('public.ocade_staff_set_permissions(uuid,text[],text[],text)'::regprocedure) !~ 'v_before'
     OR pg_get_functiondef('public.ocade_staff_set_permissions(uuid,text[],text[],text)'::regprocedure) !~ 'hold yourself' THEN
    RAISE EXCEPTION 'a cleared denial can still give access beyond the giver';
  END IF;
  IF pg_get_functiondef('public.ocade_replace_mfa_recovery_codes(uuid,text[])'::regprocedure) !~ 'pg_advisory_xact_lock' THEN
    RAISE EXCEPTION 'two recovery sheets can still be made at once';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ocade_library_items_own_folder') THEN
    RAISE EXCEPTION 'a Library row can still name another folder';
  END IF;
  IF has_function_privilege('anon', 'public.ocade_case_open(uuid,text,integer,uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.ocade_staff_user_has(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'a case function is reachable by the wrong role';
  END IF;
END
$$;
