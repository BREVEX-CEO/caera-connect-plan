BEGIN;

-- Remove the signed offline-allocation API before its private storage so a
-- partial rollback can be rerun safely without leaving callable functions.

DROP FUNCTION IF EXISTS public.ocade_read_offline_usage(uuid);
DROP FUNCTION IF EXISTS public.ocade_return_offline_usage(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_reconcile_offline_usage(
  uuid, uuid, uuid, bigint, bigint, text, jsonb
);
DROP FUNCTION IF EXISTS public.ocade_activate_offline_usage_lease(
  uuid, uuid, text, jsonb, text
);
DROP FUNCTION IF EXISTS public.ocade_allocate_offline_usage(
  uuid, uuid, text, text, text, text, bigint, bigint, bigint, boolean
);
DROP FUNCTION IF EXISTS public.ocade_expire_offline_usage_leases(uuid, timestamptz);

DROP TABLE IF EXISTS public.ocade_offline_usage_events;
DROP TABLE IF EXISTS public.ocade_offline_usage_allocations;
DROP TABLE IF EXISTS public.ocade_device_usage_leases;
DROP TABLE IF EXISTS public.ocade_device_usage_keys;

COMMIT;
