-- OCADE-IRREVERSIBLE: restoring auth.users runtime access restores the production defect.
-- Recover with a reviewed forward migration; preserve anchors and usage rows.
DO $$ BEGIN
  RAISE NOTICE 'Use a forward migration to recover profiles usage authority; do not restore auth.users runtime reads.';
END $$;
