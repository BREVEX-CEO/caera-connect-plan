-- Rollback for 20260904130000_revoke_default_privilege_writes.
--
-- DELIBERATELY A NO-OP, and that is the whole content of this file.
--
-- The migration only REMOVES privileges, and it removes ones nothing uses: every
-- affected table has row-level security on with no policy permitting the writes,
-- so no code path anywhere in the product exercised them. There is therefore
-- nothing for a rollback to restore.
--
-- Writing the "undo" literally — re-granting INSERT, UPDATE and DELETE on
-- billing evidence, consent receipts and organization membership to every
-- signed-in browser — would reopen the exact gap the migration closed, and it
-- would do so during an incident, which is when rollbacks run and when nobody
-- is reading the file. A rollback that makes things less safe than before the
-- deploy is not a safety net.
--
-- If this migration must genuinely be undone, the privileges are re-granted by
-- hand with the reason recorded, not by running a script that does it silently.

DO $$
BEGIN
  RAISE NOTICE
    'Nothing to undo: 20260904130000 only revoked unused privileges. See this file.';
END $$;
