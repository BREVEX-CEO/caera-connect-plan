-- Undo: nothing asks whether two-step was set up in this sign-in.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_two_step_set_up_in_this_sign_in();
COMMIT;
