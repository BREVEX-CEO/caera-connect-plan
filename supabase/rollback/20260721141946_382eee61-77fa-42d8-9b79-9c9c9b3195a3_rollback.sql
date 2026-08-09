-- Rollback for 20260721141946 (launch gate items/history + GA-enforce trigger).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
-- Trigger + function added onto the base feature_flags table (dropped before the enums they may reference).
DROP TRIGGER IF EXISTS feature_flags_enforce_ga ON public.feature_flags;
DROP FUNCTION IF EXISTS public.enforce_ga_launch_gate();
DROP TABLE IF EXISTS public.launch_gate_history CASCADE;
DROP TABLE IF EXISTS public.launch_gate_items CASCADE;

/*
 * THE COLUMNS THIS MIGRATION ADDED, dropped before the type they use.
 *
 * DEFECT FOUND BY ACTUALLY RUNNING THIS. The migration does:
 *
 *   ALTER TABLE public.feature_flags
 *     ADD COLUMN stage public.feature_flag_stage ...,
 *     ADD COLUMN applicable_modules text[] ...;
 *
 * and this rollback never removed either. So `DROP TYPE feature_flag_stage`
 * failed with "cannot drop type because other objects depend on it" —
 * `feature_flags.stage` was still using it. Inside a transaction that abort
 * took every subsequent rollback with it: eleven of the thirty-four failed,
 * ten of them only because this one poisoned the transaction.
 *
 * It had never been executed. A rollback nobody has run is a plan, not a
 * safety net — and this one would have failed at the exact moment somebody
 * needed it, halfway through undoing a bad deploy.
 */
ALTER TABLE public.feature_flags
  DROP COLUMN IF EXISTS stage,
  DROP COLUMN IF EXISTS applicable_modules;

DROP TYPE IF EXISTS public.feature_flag_stage;
DROP TYPE IF EXISTS public.launch_gate_status;
COMMIT;
