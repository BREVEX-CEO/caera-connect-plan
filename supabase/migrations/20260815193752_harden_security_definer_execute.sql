BEGIN;

-- The application invokes this atomic allowance function only through the
-- server-side service-role client. An explicit authenticated grant existed in
-- the live project, so signed-in users could otherwise choose another user id
-- or an arbitrary limit. Keep the RPC outside the browser-reachable surface.
REVOKE ALL PRIVILEGES ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER)
  TO service_role;

DO $$
DECLARE
  trigger_name TEXT;
BEGIN
  -- The older FICIA source set is incomplete in a clean database twin. Harden
  -- this predicate where it exists without making the OCADE migration order
  -- depend on an externally blocked FICIA schema definition.
  IF to_regprocedure('public.ficia_can_manage_worker(uuid,uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON FUNCTION public.ficia_can_manage_worker(UUID, UUID, UUID) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.ficia_can_manage_worker(UUID, UUID, UUID) TO authenticated, service_role';
  END IF;

  -- Trigger functions run through their installed triggers. They are not
  -- public RPC endpoints and need no direct browser-role EXECUTE privilege.
  FOREACH trigger_name IN ARRAY ARRAY[
    'public.ficia_guard_locked_entry()',
    'public.msg_add_creator_as_admin()',
    'public.msg_apply_scope()',
    'public.msg_bump_last_message()',
    'public.msg_record_edit()'
  ] LOOP
    IF to_regprocedure(trigger_name) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        trigger_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
