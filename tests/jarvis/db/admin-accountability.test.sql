-- ADMIN-03, ADMIN-06, ADMIN-07: staff authority is read from the table on every call and needs a live session and
-- a second factor; every admin action names its actor, its subject and a reason; there is no impersonation and no
-- bulk tool. Disposable DB only.
\set ON_ERROR_STOP on
DO $$
DECLARE
  v_def text;
  v_found text;
BEGIN
  -- ADMIN-03: no cache between the table and the decision
  v_def := pg_get_functiondef('private.ocade_staff_has'::regproc);
  IF v_def NOT LIKE '%FROM public.ocade_staff%' THEN RAISE EXCEPTION 'admin: staff authority is not read from the staff table'; END IF;
  IF v_def NOT LIKE '%ocade_caller_session_live()%' THEN RAISE EXCEPTION 'admin: staff authority ignores session standing'; END IF;
  IF v_def NOT LIKE '%ocade_factor_added_since_sign_in%' THEN RAISE EXCEPTION 'admin: staff authority ignores a new second factor'; END IF;
  v_def := pg_get_functiondef('public.ocade_staff_can'::regproc);
  IF v_def NOT LIKE '%aal2%' THEN RAISE EXCEPTION 'admin: staff authority does not demand the second factor'; END IF;
  IF has_table_privilege('authenticated', 'public.ocade_staff', 'INSERT') OR has_table_privilege('authenticated', 'public.ocade_staff', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_staff', 'DELETE') THEN
    RAISE EXCEPTION 'admin: a signed-in user can write the staff table';
  END IF;
  -- ADMIN-06 / ADMIN-07: actor and subject are separate; a reason of 10 to 500 characters is required
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ocade_admin_actions'
        AND column_name IN ('actor', 'subject', 'target_user', 'reason', 'action')) <> 5 THEN
    RAISE EXCEPTION 'admin: the action record lacks actor, subject, target, reason or action';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ocade_admin_actions'::regclass
                    AND pg_get_constraintdef(oid) LIKE '%length(btrim(reason)) >= 10%') THEN
    RAISE EXCEPTION 'admin: an action may be recorded without a real reason';
  END IF;
  IF has_table_privilege('authenticated', 'public.ocade_admin_actions', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ocade_admin_actions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ocade_admin_actions', 'DELETE') THEN
    RAISE EXCEPTION 'admin: a signed-in user can write or alter the action record';
  END IF;
  SELECT string_agg(p.proname, ', ') INTO v_found
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private') AND p.proname ~* '(impersonat|act_as|login_as|bulk|mass_)';
  IF v_found IS NOT NULL THEN RAISE EXCEPTION 'admin: impersonation or bulk tools exist: %', v_found; END IF;
END $$;
