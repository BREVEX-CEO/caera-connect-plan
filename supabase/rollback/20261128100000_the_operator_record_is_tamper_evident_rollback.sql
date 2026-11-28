BEGIN;
DROP TRIGGER IF EXISTS ocade_admin_no_truncate ON public.ocade_admin_actions;
DROP TRIGGER IF EXISTS ocade_admin_append_only ON public.ocade_admin_actions;
DROP TRIGGER IF EXISTS ocade_admin_chain_insert ON public.ocade_admin_actions;
DROP FUNCTION IF EXISTS private.ocade_verify_admin_chain();
DROP FUNCTION IF EXISTS private.ocade_admin_append_only();
DROP FUNCTION IF EXISTS private.ocade_admin_chain_insert();
DROP FUNCTION IF EXISTS private.ocade_admin_row_hash(text, uuid, text, uuid, text, timestamptz);
ALTER TABLE public.ocade_admin_actions DROP COLUMN IF EXISTS row_hash, DROP COLUMN IF EXISTS prev_hash, DROP COLUMN IF EXISTS seq;
ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (action IN (
  'remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
  'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
  'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read',
  'second_factor_reset', 'usage_adjusted', 'account_suspended', 'account_restored',
  'account_deletion_started', 'account_deleted', 'unlimited_granted', 'unlimited_revoked'));
COMMIT;
