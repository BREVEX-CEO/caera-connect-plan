-- Rollback for 20260904180000_status_incidents_and_maintenance.
--
-- THIS DESTROYS PUBLISHED HISTORY. Every incident, every maintenance window and
-- every update posted about them goes with the tables. That history is the
-- record of what OCADE told its users during an outage, so export both tables
-- before running this if anything has been published.
--
-- After it, /status returns to carrying the sentence this migration retired:
-- that OCADE publishes no incident history, and an empty list is not a claim
-- that there have been no incidents.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_post_status_incident_update(uuid, text, text);
DROP FUNCTION IF EXISTS public.ocade_open_status_incident(
  text, text, text, text[], text, timestamptz, timestamptz);
DROP TABLE IF EXISTS public.ocade_status_incident_updates;
DROP TABLE IF EXISTS public.ocade_status_incidents;

COMMIT;
