-- SAAS-12 / ADMIN-08: the operator record is append-only and hash-chained, and the two-person
-- controls (ADMIN-04/05) may write their lines. A changed or removed row breaks the chain.
-- The only allowed UPDATE is the foreign-key clearing of actor/target when an account is erased;
-- the hash does not cover those two columns.
BEGIN;

ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (action IN (
  'remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
  'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
  'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read',
  'second_factor_reset', 'usage_adjusted', 'account_suspended', 'account_restored',
  'account_deletion_started', 'account_deleted', 'unlimited_granted', 'unlimited_revoked',
  'audit_export_approved', 'audit_exported', 'break_glass_approved', 'break_glass_used'));

ALTER TABLE public.ocade_admin_actions
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS row_hash text;

CREATE OR REPLACE FUNCTION private.ocade_admin_row_hash(
  p_prev text, p_id uuid, p_action text, p_subject uuid, p_reason text, p_at timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT encode(sha256(convert_to(coalesce(p_prev, '') || '|' || p_id::text || '|' || p_action || '|' ||
         coalesce(p_subject::text, '') || '|' || p_reason || '|' ||
         to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), 'UTF8')), 'hex')
$$;
REVOKE ALL ON FUNCTION private.ocade_admin_row_hash(text, uuid, text, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Existing rows are chained once, oldest first.
DO $$
DECLARE r record; v_prev text := NULL; v_hash text;
BEGIN
  FOR r IN SELECT id, action, subject, reason, created_at FROM public.ocade_admin_actions ORDER BY seq LOOP
    v_hash := private.ocade_admin_row_hash(v_prev, r.id, r.action, r.subject, r.reason, r.created_at);
    UPDATE public.ocade_admin_actions SET prev_hash = v_prev, row_hash = v_hash WHERE id = r.id;
    v_prev := v_hash;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.ocade_admin_chain_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE v_prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ocade_admin_actions_chain'));
  SELECT a.row_hash INTO v_prev FROM public.ocade_admin_actions a ORDER BY a.seq DESC LIMIT 1;
  NEW.prev_hash := v_prev;
  NEW.row_hash := private.ocade_admin_row_hash(v_prev, NEW.id, NEW.action, NEW.subject, NEW.reason, NEW.created_at);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION private.ocade_admin_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.id, NEW.action, NEW.subject, NEW.reason, NEW.created_at, NEW.seq, NEW.prev_hash, NEW.row_hash)
         IS NOT DISTINCT FROM (OLD.id, OLD.action, OLD.subject, OLD.reason, OLD.created_at, OLD.seq, OLD.prev_hash, OLD.row_hash)
     AND (NEW.actor IS NULL OR NEW.actor IS NOT DISTINCT FROM OLD.actor)
     AND (NEW.target_user IS NULL OR NEW.target_user IS NOT DISTINCT FROM OLD.target_user) THEN
    RETURN NEW; -- an erased account is cleared from the record; nothing else may change
  END IF;
  RAISE EXCEPTION 'The operator record is append-only.' USING ERRCODE = '42501';
END $$;

REVOKE ALL ON FUNCTION private.ocade_admin_chain_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ocade_admin_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_admin_chain_insert ON public.ocade_admin_actions;
CREATE TRIGGER ocade_admin_chain_insert BEFORE INSERT ON public.ocade_admin_actions
  FOR EACH ROW EXECUTE FUNCTION private.ocade_admin_chain_insert();
DROP TRIGGER IF EXISTS ocade_admin_append_only ON public.ocade_admin_actions;
CREATE TRIGGER ocade_admin_append_only BEFORE UPDATE OR DELETE ON public.ocade_admin_actions
  FOR EACH ROW EXECUTE FUNCTION private.ocade_admin_append_only();
DROP TRIGGER IF EXISTS ocade_admin_no_truncate ON public.ocade_admin_actions;
CREATE TRIGGER ocade_admin_no_truncate BEFORE TRUNCATE ON public.ocade_admin_actions
  FOR EACH STATEMENT EXECUTE FUNCTION private.ocade_admin_append_only();

-- The sequence number of the first row whose stored hash or link does not match, or NULL when the chain holds.
CREATE OR REPLACE FUNCTION private.ocade_verify_admin_chain()
RETURNS bigint LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE r record; v_prev text := NULL;
BEGIN
  FOR r IN SELECT seq, id, action, subject, reason, created_at, prev_hash, row_hash
             FROM public.ocade_admin_actions ORDER BY seq LOOP
    IF r.prev_hash IS DISTINCT FROM v_prev
       OR r.row_hash IS DISTINCT FROM private.ocade_admin_row_hash(v_prev, r.id, r.action, r.subject, r.reason, r.created_at)
    THEN RETURN r.seq; END IF;
    v_prev := r.row_hash;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.ocade_verify_admin_chain() FROM PUBLIC, anon, authenticated;

COMMIT;
