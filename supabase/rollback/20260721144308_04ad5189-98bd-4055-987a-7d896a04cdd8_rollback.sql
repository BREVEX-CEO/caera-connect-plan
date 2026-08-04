-- Rollback for 20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8 (REVOKE resume attestation/versioning trigger fns from callers).
-- INTENTIONAL NO-OP. This migration is security hardening (REVOKE / privilege
-- tightening). Reversing it would re-open access that was deliberately closed,
-- which is never a safe automatic rollback. If a true revert is ever required it
-- must be a reviewed, explicit, manual decision — not this script.
-- (No statements; kept as a file so every migration has a paired rollback record.)
SELECT 1;
