-- Rollback for 20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272 (lock down direct compliance_audit_log writes).
-- INTENTIONAL NO-OP. This migration is security hardening (REVOKE / privilege
-- tightening). Reversing it would re-open access that was deliberately closed,
-- which is never a safe automatic rollback. If a true revert is ever required it
-- must be a reviewed, explicit, manual decision — not this script.
-- (No statements; kept as a file so every migration has a paired rollback record.)
SELECT 1;
