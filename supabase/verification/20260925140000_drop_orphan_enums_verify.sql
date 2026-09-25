-- Prove the orphan enum types are gone and the ones in use still stand.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public'
                AND t.typname IN ('approval_decision', 'approval_status', 'approval_subject',
                                  'employment_status', 'feature_flag_stage', 'launch_gate_status',
                                  'msg_grant_status', 'msg_link_kind', 'msg_member_role',
                                  'msg_message_kind', 'msg_scope_badge', 'msg_thread_kind',
                                  'tenant_kind', 'tenant_role', 'worker_type')) THEN
    RAISE EXCEPTION 'an orphan enum type still exists';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND t.typname IN ('app_role', 'device_kind', 'privacy_mode', 'compliance_category',
                           'main_purpose_kind')) <> 5 THEN
    RAISE EXCEPTION 'an enum type still in use is missing';
  END IF;
END $$;
