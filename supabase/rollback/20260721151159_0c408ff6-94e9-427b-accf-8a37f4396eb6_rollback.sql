-- Rollback for 20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6 (harden set_updated_at / ficia_sync_membership execute grants).
-- INTENTIONAL NO-OP. This migration is security hardening (REVOKE / privilege
-- tightening). Reversing it would re-open access that was deliberately closed,
-- which is never a safe automatic rollback. If a true revert is ever required it
-- must be a reviewed, explicit, manual decision — not this script.
-- (No statements; kept as a file so every migration has a paired rollback record.)
SELECT 1;
