-- Rollback for 20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27 (REVOKE EXECUTE on core security-definer helpers from PUBLIC/anon/authenticated).
-- INTENTIONAL NO-OP. This migration is security hardening (REVOKE / privilege
-- tightening). Reversing it would re-open access that was deliberately closed,
-- which is never a safe automatic rollback. If a true revert is ever required it
-- must be a reviewed, explicit, manual decision — not this script.
-- (No statements; kept as a file so every migration has a paired rollback record.)
SELECT 1;
