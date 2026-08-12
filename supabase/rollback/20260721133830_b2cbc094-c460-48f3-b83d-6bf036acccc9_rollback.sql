-- Rollback for 20260721133830 (activity_log, browser_grants, device uniqueness,
-- purpose/compliance enums). Idempotent, reverse order. Not applied automatically.
--
-- NOTE: enforce_device_cap() is CREATE OR REPLACE here but was first created by
-- the foundational migration (20260720120222), so it is intentionally NOT dropped
-- — its own lifecycle belongs to the base migration's rollback.
BEGIN;
DROP TABLE IF EXISTS public.browser_grants CASCADE;
DROP TABLE IF EXISTS public.activity_log CASCADE;
DROP INDEX IF EXISTS public.devices_user_physical_pc_uniq;

/*
 * THE REST OF WHAT THE MIGRATION DID, found by running this for the first time.
 *
 * `DROP TYPE compliance_category` failed with "other objects depend on it",
 * because the migration had also done three things this script never undid:
 *
 *   ALTER TABLE public.audit_log RENAME TO compliance_audit_log;
 *   ALTER TABLE ... ADD COLUMN category public.compliance_category ...,
 *                   ADD COLUMN prev_hash TEXT, ADD COLUMN row_hash TEXT;
 *   ALTER TABLE public.devices ADD COLUMN physical_pc_id UUID;
 *
 * So this was not merely failing — it was leaving the schema in a HALF-REVERSED
 * state: the audit table still renamed, still carrying columns whose type the
 * script was trying to delete. Anyone rolling back a bad deploy would have been
 * left worse off than before they started, and the transaction abort took the
 * two remaining rollbacks with it.
 *
 * Reversed in the opposite order to the migration: columns before the type they
 * use, rename last so the table is back under its original name.
 */
ALTER TABLE IF EXISTS public.devices
  DROP COLUMN IF EXISTS physical_pc_id;

ALTER TABLE IF EXISTS public.compliance_audit_log
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS prev_hash,
  DROP COLUMN IF EXISTS row_hash;

DO $$
BEGIN
  -- Guarded: a partial earlier rollback may already have renamed it back, and
  -- an unconditional RENAME would abort the transaction on the second run.
  IF to_regclass('public.compliance_audit_log') IS NOT NULL
     AND to_regclass('public.audit_log') IS NULL THEN
    ALTER TABLE public.compliance_audit_log RENAME TO audit_log;
  END IF;
END $$;

DROP TYPE IF EXISTS public.compliance_category;

/*
 * `user_settings.main_purpose` is CONVERTED back, not dropped.
 *
 * The migration did not add this column — it changed an existing `TEXT` column
 * to the enum:
 *
 *   ALTER COLUMN main_purpose TYPE public.main_purpose_kind USING ...
 *
 * so dropping it would destroy data the migration never created, and leaving it
 * alone made `DROP TYPE main_purpose_kind` fail. Casting back to TEXT preserves
 * every stored value and frees the type.
 *
 * The migration's own USING clause mapped anything outside the three allowed
 * values to NULL. That is not recoverable here and is not pretended to be: this
 * restores the column's TYPE, not values a forward migration discarded.
 */
ALTER TABLE IF EXISTS public.user_settings
  ALTER COLUMN main_purpose TYPE TEXT USING main_purpose::TEXT;

DROP TYPE IF EXISTS public.main_purpose_kind;
COMMIT;
