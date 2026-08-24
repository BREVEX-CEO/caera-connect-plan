-- OCADE-IRREVERSIBLE: Removing a private bucket or its policies can orphan or expose user objects.
-- Refuse destructive rollback; retire the feature with a reviewed forward
-- migration that first drains and reconciles stored objects.
DO $$
BEGIN
  RAISE NOTICE 'Messenger bucket retained; use a reviewed data-draining forward migration for retirement.';
END;
$$;
