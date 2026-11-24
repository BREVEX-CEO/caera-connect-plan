BEGIN;

CREATE OR REPLACE FUNCTION private.byok_model_sees(p_connection_id uuid, p_model text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(
    (SELECT m.sees_images FROM public.byok_models AS m
      WHERE m.connection_id = p_connection_id AND m.model = p_model),
    (SELECT c.sees_images FROM public.byok_connections AS c
      WHERE c.id = p_connection_id AND c.model = p_model));
$$;
REVOKE ALL ON FUNCTION private.byok_model_sees(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_byok_route(p_user_id uuid, p_connection_id uuid, p_surface text)
RETURNS TABLE (id uuid, enabled boolean, status text, protocol text, endpoint text, model text,
  sees_images boolean, calls_tools boolean, secret text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, c.model, c.sees_images, c.calls_tools,
         s.decrypted_secret
    FROM public.byok_connections AS c
    JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
   WHERE p_connection_id IS NOT NULL AND c.id = p_connection_id AND c.user_id = p_user_id
  UNION ALL
  SELECT c.id, c.enabled, c.status, c.protocol, c.endpoint, chosen.model,
         private.byok_model_sees(c.id, chosen.model), c.calls_tools, s.decrypted_secret
    FROM public.byok_choices AS ch
    LEFT JOIN public.byok_connections AS c ON c.id = ch.connection_id AND c.user_id = ch.user_id
    LEFT JOIN vault.decrypted_secrets AS s ON s.id = c.secret_id
    LEFT JOIN LATERAL (SELECT private.byok_model_for(c.id, p_surface) AS model) AS chosen ON true
   WHERE p_connection_id IS NULL AND ch.user_id = p_user_id AND ch.surface = p_surface;
$$;
REVOKE ALL ON FUNCTION public.ocade_byok_route(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_byok_route(uuid, uuid, text) TO service_role;

DROP POLICY IF EXISTS byok_connections_own_images ON public.byok_connections;
REVOKE UPDATE (send_images) ON public.byok_connections FROM authenticated;
ALTER TABLE public.byok_connections DROP COLUMN IF EXISTS send_images;

COMMIT;
