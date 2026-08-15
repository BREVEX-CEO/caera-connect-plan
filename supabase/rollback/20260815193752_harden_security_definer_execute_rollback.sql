-- SECURITY WARNING: this recreates the privilege state observed before
-- 20260815193752. Use only as a separately approved incident rollback.
BEGIN;

GRANT EXECUTE ON FUNCTION public.ocade_consume_cloud_use(UUID, TIMESTAMPTZ, INTEGER)
  TO authenticated, service_role;
DO $$
DECLARE
  function_name TEXT;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.ficia_can_manage_worker(UUID, UUID, UUID)',
    'public.ficia_guard_locked_entry()',
    'public.msg_add_creator_as_admin()',
    'public.msg_apply_scope()',
    'public.msg_bump_last_message()',
    'public.msg_record_edit()'
  ] LOOP
    IF to_regprocedure(function_name) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', function_name);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
