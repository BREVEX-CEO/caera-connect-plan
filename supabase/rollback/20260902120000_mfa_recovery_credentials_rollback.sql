-- Rollback for 20260902120000_mfa_recovery_credentials.
--
-- Drops the recovery credentials and their guess counter.
--
-- WHAT THIS COSTS, SAID PLAINLY: every recovery code an account holds stops
-- working the moment this runs, because the hashes they are checked against are
-- gone. Anybody whose second factor is already lost loses their self-service
-- route back in and needs an operator. Printed sheets become worthless paper.
--
-- That is the correct behaviour for a rollback rather than a defect in it —
-- leaving the table behind while the functions that validate it are gone would
-- be worse: credentials that exist, appear valid, and are checked by nothing.
-- Roll forward instead wherever that is an option.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_count_mfa_recovery_codes(UUID);
DROP FUNCTION IF EXISTS public.ocade_consume_mfa_recovery_code(UUID, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.ocade_replace_mfa_recovery_codes(UUID, text[]);

DROP TABLE IF EXISTS public.ocade_mfa_recovery_attempts;
DROP TABLE IF EXISTS public.ocade_mfa_recovery_codes;

COMMIT;
