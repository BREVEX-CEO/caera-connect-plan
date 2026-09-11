-- The one index Supabase's own advisor asked for.
--
-- `PLAN.md` Phase 18: "missing evidence-backed indexes" is one of the five
-- silent speed killers, and the evidence here is the live performance advisor
-- rather than a guess: `ocade_support_access_events_admin_id_fkey` had no
-- covering index.
--
-- WHY IT MATTERS ON THIS PARTICULAR TABLE. The rows are append-only access
-- records, so the table only grows, and the two reads that will actually run
-- against it are "what did this admin read" and "who read this ticket". The
-- second has an index; the first was a sequential scan over the whole audit
-- history, which is exactly the query somebody runs when they are already
-- investigating an incident.
--
-- The foreign key also makes a delete of an auth user scan this table, and an
-- account deletion that slows down as the audit log grows is the wrong thing
-- to make expensive.

BEGIN;

CREATE INDEX IF NOT EXISTS ocade_support_access_events_admin_idx
  ON public.ocade_support_access_events (admin_id, read_at DESC);

COMMIT;
