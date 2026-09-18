BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_activate_offline_usage_lease(
  p_user_id uuid,
  p_lease_id uuid,
  p_key_id text,
  p_signed_payload jsonb,
  p_server_signature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE v_now timestamptz := statement_timestamp();
BEGIN
  UPDATE public.ocade_device_usage_leases AS l
     SET key_id = btrim(p_key_id), signed_payload = p_signed_payload,
         server_signature = btrim(p_server_signature),
         status = CASE WHEN l.preissued THEN 'preissued' ELSE 'active' END,
         updated_at = v_now
   WHERE l.id = p_lease_id AND l.user_id = p_user_id
     AND (l.status = 'pending_signature' OR (
       l.status IN ('active', 'preissued') AND l.key_id = btrim(p_key_id)
       AND l.signed_payload = p_signed_payload
       AND l.server_signature = btrim(p_server_signature)))
     AND (p_signed_payload ->> 'leaseId') = l.id::text
     AND (p_signed_payload ->> 'accountId') = l.user_id::text
     AND (p_signed_payload ->> 'deviceId') = l.device_id::text
     AND (p_signed_payload ->> 'tier') = l.tier
     AND (p_signed_payload ->> 'allocatedHundredths')::bigint = l.allocated_hundredths
     AND (p_signed_payload ->> 'sequenceStart')::bigint = l.sequence_start
     AND (p_signed_payload ->> 'sequenceEnd')::bigint = l.sequence_end
     AND (p_signed_payload ->> 'sessionWindowStart')::timestamptz = l.session_window_start
     AND (p_signed_payload ->> 'sessionResetAt')::timestamptz = l.session_reset_at
     AND (p_signed_payload ->> 'weekWindowStart')::timestamptz = l.week_window_start
     AND (p_signed_payload ->> 'weekResetAt')::timestamptz = l.week_reset_at
     AND (p_signed_payload ->> 'issuedAt')::timestamptz = l.issued_at
     AND (p_signed_payload ->> 'notBefore')::timestamptz = l.not_before
     AND (p_signed_payload ->> 'expiresAt')::timestamptz = l.expires_at
     AND (p_signed_payload ->> 'preissued')::boolean = l.preissued
     AND length(btrim(p_key_id)) BETWEEN 1 AND 120
     AND length(btrim(p_server_signature)) BETWEEN 80 AND 100;
  RETURN FOUND;
END;
$$;

-- Failed signing must never refund a lease another request already activated.
CREATE OR REPLACE FUNCTION public.ocade_cancel_unsigned_offline_usage(
  p_user_id uuid, p_device_id uuid, p_lease_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  PERFORM p.id FROM public.profiles AS p WHERE p.id = p_user_id FOR UPDATE;
  PERFORM l.id FROM public.ocade_device_usage_leases AS l
    WHERE l.id = p_lease_id AND l.user_id = p_user_id AND l.device_id = p_device_id
      AND l.status = 'pending_signature' FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  RETURN public.ocade_return_offline_usage(p_user_id, p_device_id, p_lease_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_cancel_unsigned_offline_usage(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_cancel_unsigned_offline_usage(uuid, uuid, uuid) TO service_role;

COMMIT;
