-- Undo the atomic browser-device registration function.
--
-- It adds a function and nothing else: no table, no column, no row is touched,
-- so dropping it restores the previous schema exactly. The client falls back to
-- nothing after this — registration simply stops working until the migration is
-- reapplied, which is the intended meaning of rolling it back.
BEGIN;

DROP FUNCTION IF EXISTS public.register_browser_device_for_current_user(
  TEXT, public.device_kind, TEXT, TEXT, TEXT
);

COMMIT;
