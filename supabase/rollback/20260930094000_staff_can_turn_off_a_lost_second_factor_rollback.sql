-- Remove the operator's way to turn off a customer's two-step verification.
-- The audit record of any that were done is kept, and so is the action name.
BEGIN;
DROP FUNCTION IF EXISTS public.ocade_staff_reset_second_factor(uuid, text);
COMMIT;
