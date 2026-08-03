-- Rollback for 20260721151224_c158c078-599f-4d26-8144-6221fddac054 (scope ficia permission helpers to authenticated/service_role only).
-- INTENTIONAL NO-OP. This migration is security hardening (REVOKE / privilege
-- tightening). Reversing it would re-open access that was deliberately closed,
-- which is never a safe automatic rollback. If a true revert is ever required it
-- must be a reviewed, explicit, manual decision — not this script.
-- (No statements; kept as a file so every migration has a paired rollback record.)
SELECT 1;
