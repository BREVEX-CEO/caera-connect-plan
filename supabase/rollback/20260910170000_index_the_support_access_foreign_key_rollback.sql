-- Drops the covering index for the support-access admin foreign key.
--
-- Nothing is lost: an index holds no data of its own, and the rows it points at
-- are untouched. Dropping it restores the sequential scan the advisor flagged.

BEGIN;

DROP INDEX IF EXISTS public.ocade_support_access_events_admin_idx;

COMMIT;
