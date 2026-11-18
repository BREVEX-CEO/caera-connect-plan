-- Plan 14B.1A.1-2: OCADE's own provider keys, any number of them, registered by the owner in the
-- Supabase Dashboard (SQL editor, as the database owner) without a source change or a redeploy.
-- Each key lives in Supabase Vault; this table keeps only its Vault reference and nonsecret
-- metadata: a label, the provider host it is for, the provider project (quota group) it belongs
-- to, an optional model list, whether it is enabled, and its order. Keys in one project share that
-- project's quota: the server never moves to another key because a quota is spent. Service role
-- and database owner only; no signed-in person can read or change it.
BEGIN;

CREATE TABLE private.owner_model_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE CHECK (label ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  provider_host text NOT NULL CHECK (provider_host ~ '^[a-z0-9.-]{1,253}$'),
  quota_group text NOT NULL CHECK (char_length(quota_group) BETWEEN 1 AND 120),
  models text[] CHECK (models IS NULL OR cardinality(models) BETWEEN 1 AND 50),
  secret_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.owner_model_keys FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.owner_model_key_forget_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = OLD.secret_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.owner_model_key_forget_secret() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER owner_model_keys_forget_secret AFTER DELETE ON private.owner_model_keys
  FOR EACH ROW EXECUTE FUNCTION private.owner_model_key_forget_secret();

/* Register a key (or replace the key under an existing label). Returns its id. */
CREATE FUNCTION public.ocade_owner_add_model_key(
  p_label text, p_provider_host text, p_quota_group text, p_key text,
  p_priority integer DEFAULT 100, p_models text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row private.owner_model_keys;
BEGIN
  IF p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 4096 OR p_key ~ '[\s[:cntrl:]]' THEN
    RAISE EXCEPTION 'owner key: unusable key' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_row FROM private.owner_model_keys WHERE label = p_label FOR UPDATE;
  IF FOUND THEN
    PERFORM vault.update_secret(v_row.secret_id, p_key);
    UPDATE private.owner_model_keys SET provider_host = lower(p_provider_host),
      quota_group = p_quota_group, priority = p_priority, models = p_models, updated_at = now()
     WHERE id = v_row.id;
    RETURN v_row.id;
  END IF;
  INSERT INTO private.owner_model_keys (label, provider_host, quota_group, models, priority, secret_id)
  VALUES (p_label, lower(p_provider_host), p_quota_group, p_models, p_priority,
          vault.create_secret(p_key, 'owner-model-key:' || p_label, 'OCADE provider key'))
  RETURNING id INTO v_row.id;
  RETURN v_row.id;
END;
$$;

/* Suspend or resume a key; deleting the row deletes its key from Vault. */
CREATE FUNCTION public.ocade_owner_set_model_key(p_label text, p_enabled boolean)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH changed AS (
    UPDATE private.owner_model_keys SET enabled = p_enabled, updated_at = now()
     WHERE label = p_label RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM changed);
$$;

/* The enabled keys for one provider host and model, in order: for OCADE's server only. */
CREATE FUNCTION public.ocade_owner_model_keys(p_provider_host text, p_model text)
RETURNS TABLE (label text, quota_group text, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT k.label, k.quota_group, s.decrypted_secret
    FROM private.owner_model_keys AS k
    JOIN vault.decrypted_secrets AS s ON s.id = k.secret_id
   WHERE k.enabled AND k.provider_host = lower(p_provider_host)
     AND (k.models IS NULL OR p_model = ANY (k.models))
   ORDER BY k.priority, k.created_at;
$$;

REVOKE ALL ON FUNCTION public.ocade_owner_add_model_key(text, text, text, text, integer, text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ocade_owner_set_model_key(text, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ocade_owner_model_keys(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_owner_model_keys(text, text) TO service_role;

COMMIT;
