-- Rollback for 20260721141946 (launch gate items/history + GA-enforce trigger).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
-- Trigger + function added onto the base feature_flags table (dropped before the enums they may reference).
DROP TRIGGER IF EXISTS feature_flags_enforce_ga ON public.feature_flags;
DROP FUNCTION IF EXISTS public.enforce_ga_launch_gate();
DROP TABLE IF EXISTS public.launch_gate_history CASCADE;
DROP TABLE IF EXISTS public.launch_gate_items CASCADE;
DROP TYPE IF EXISTS public.feature_flag_stage;
DROP TYPE IF EXISTS public.launch_gate_status;
COMMIT;
