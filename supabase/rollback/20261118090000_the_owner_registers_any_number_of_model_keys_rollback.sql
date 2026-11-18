-- Rollback of 20261118090000: the owner's key registry is removed, with its keys in Vault.
BEGIN;
DELETE FROM vault.secrets WHERE id IN (SELECT secret_id FROM private.owner_model_keys);
DROP FUNCTION IF EXISTS public.ocade_owner_model_keys(text, text);
DROP FUNCTION IF EXISTS public.ocade_owner_set_model_key(text, boolean);
DROP FUNCTION IF EXISTS public.ocade_owner_add_model_key(text, text, text, text, integer, text[]);
DROP TABLE IF EXISTS private.owner_model_keys;
DROP FUNCTION IF EXISTS private.owner_model_key_forget_secret();
COMMIT;
