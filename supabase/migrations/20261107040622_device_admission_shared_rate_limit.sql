-- One shared admission decision per signed device request (165).
-- The server's per-process request buckets only brake one instance; many server instances
-- (Cloudflare isolates) would each grant the full budget. Freshness, revocation and a per-device
-- request budget are now decided together in the database, in the round trip each request
-- already makes. The window uses the database clock, never the device's own timestamps.
-- `jarvis_device_seen` stays for compatibility; the server no longer calls it.

ALTER TABLE public.jarvis_devices ADD COLUMN IF NOT EXISTS request_window_started_ms bigint NOT NULL DEFAULT 0;
ALTER TABLE public.jarvis_devices ADD COLUMN IF NOT EXISTS request_window_count integer NOT NULL DEFAULT 0;

-- 'admitted'; 'rate_limited' (fresh, but over the shared budget: the timestamp is still consumed,
-- so the same signed request can never be replayed later); 'refused' (replayed, older, revoked or
-- unknown: the caller distinguishes replay from revocation by the device key, as before).
-- A NULL budget admits every fresh request (receipts must always be recorded).
CREATE OR REPLACE FUNCTION public.jarvis_device_admit(
  p_device uuid, p_timestamp_ms bigint, p_limit integer, p_window_ms integer
)
RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH clock AS (
    SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS now_ms
  ), seen AS (
    UPDATE public.jarvis_devices AS d
       SET last_request_ms = p_timestamp_ms,
           last_seen_at = statement_timestamp(),
           request_window_started_ms = CASE
             WHEN clock.now_ms - d.request_window_started_ms >= greatest(p_window_ms, 1) THEN clock.now_ms
             ELSE d.request_window_started_ms END,
           request_window_count = CASE
             WHEN clock.now_ms - d.request_window_started_ms >= greatest(p_window_ms, 1) THEN 1
             ELSE least(d.request_window_count, 2147483646) + 1 END
      FROM clock
     WHERE d.id = p_device AND d.revoked_at IS NULL AND d.last_request_ms < p_timestamp_ms
    RETURNING d.request_window_count AS used
  )
  SELECT CASE
           WHEN NOT EXISTS (SELECT 1 FROM seen) THEN 'refused'
           WHEN p_limit IS NOT NULL AND (SELECT used FROM seen) > p_limit THEN 'rate_limited'
           ELSE 'admitted'
         END;
$$;

REVOKE ALL ON FUNCTION public.jarvis_device_admit(uuid, bigint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_device_admit(uuid, bigint, integer, integer) TO service_role;
