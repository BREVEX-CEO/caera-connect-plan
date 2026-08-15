-- Prove that browser roles cannot call privileged RPC/trigger functions while
-- the service role and authenticated RLS predicate retain required access.
DO $$
DECLARE
  trigger_name TEXT;
BEGIN
  IF has_function_privilege(
    'authenticated',
    'public.ocade_consume_cloud_use(uuid,timestamp with time zone,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can still execute ocade_consume_cloud_use';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.ocade_consume_cloud_use(uuid,timestamp with time zone,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can still execute ocade_consume_cloud_use';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.ocade_consume_cloud_use(uuid,timestamp with time zone,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role lost ocade_consume_cloud_use access';
  END IF;

  IF to_regprocedure('public.ficia_can_manage_worker(uuid,uuid,uuid)') IS NOT NULL THEN
    IF has_function_privilege(
      'anon',
      'public.ficia_can_manage_worker(uuid,uuid,uuid)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'anon can still execute ficia_can_manage_worker';
    END IF;

    IF NOT has_function_privilege(
      'authenticated',
      'public.ficia_can_manage_worker(uuid,uuid,uuid)',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'authenticated RLS lost ficia_can_manage_worker access';
    END IF;
  END IF;

  FOREACH trigger_name IN ARRAY ARRAY[
    'public.ficia_guard_locked_entry()',
    'public.msg_add_creator_as_admin()',
    'public.msg_apply_scope()',
    'public.msg_bump_last_message()',
    'public.msg_record_edit()'
  ] LOOP
    IF to_regprocedure(trigger_name) IS NOT NULL THEN
      IF has_function_privilege('anon', trigger_name, 'EXECUTE')
         OR has_function_privilege('authenticated', trigger_name, 'EXECUTE') THEN
        RAISE EXCEPTION 'browser role can execute trigger function %', trigger_name;
      END IF;
    END IF;
  END LOOP;
END;
$$;
