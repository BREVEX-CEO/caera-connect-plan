-- OCADE-IRREVERSIBLE: reverting restores the concurrent signing refund defect.
DO $$ BEGIN
  RAISE NOTICE 'Recover offline signing retries with a forward migration.';
END $$;
