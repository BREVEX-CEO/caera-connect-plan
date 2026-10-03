-- Prove every operator change asks for a recent proof, not only aal2.
DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['ocade_admin_remove_device', 'ocade_grant_entitlement',
                                'ocade_revoke_entitlement', 'ocade_set_service_control'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name
         AND pg_get_functiondef(p.oid) LIKE '%ocade_require_recent_strong_auth%'
    ) THEN
      RAISE EXCEPTION '% does not require a recent second factor', v_name;
    END IF;
  END LOOP;
END
$$;
