-- Remove the table and function privileges Supabase's default privileges hand
-- to `authenticated` behind a migration's back.
--
-- WHY THIS EXISTS AS ITS OWN MIGRATION.
--
-- A Supabase project carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT
-- ALL ON TABLES` and `... GRANT EXECUTE ON FUNCTIONS`, so every table a
-- migration creates is born with INSERT, UPDATE, DELETE and TRUNCATE granted
-- DIRECTLY to `authenticated`, and every function with EXECUTE. `REVOKE ...
-- FROM PUBLIC` does not remove a direct grant, which is the form most of this
-- repository's migrations used.
--
-- The local database twin had no default privileges, so it could not see any of
-- this: three migrations' own verification scripts asserted the correct
-- property, passed locally, and were false on the real project. The twin now
-- reproduces the default privileges, those migration files now name
-- `authenticated` in their revokes, and this migration applies the same
-- correction to a database where those migrations have already run.
--
-- NOTHING HERE WAS EXPLOITABLE. Every affected table has row-level security on
-- and no policy permitting the writes, so Postgres refused them at the row
-- layer throughout. This closes the privilege layer, which is the half that
-- silently becomes live the day somebody adds a policy for one legitimate case.
--
-- Idempotent: revoking a privilege that is already absent succeeds.

BEGIN;

-- Organizations: every mutation is a guarded SECURITY DEFINER function, so
-- `authenticated` reads and never writes.
REVOKE ALL ON TABLE public.ocade_organizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_group_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.ocade_organization_events FROM anon, authenticated;

GRANT SELECT ON TABLE public.ocade_organizations TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_members TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_invites TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_groups TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_group_members TO authenticated;
GRANT SELECT ON TABLE public.ocade_organization_events TO authenticated;

-- The audit writer is called only by the organization functions. A browser that
-- could call it directly could write any event about anybody.
REVOKE ALL ON FUNCTION public.ocade_record_organization_event(uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Notifications are written by the server and marked read through a function.
-- A browser that could UPDATE one could rewrite what it was told.
REVOKE ALL ON TABLE public.ocade_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_notification_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ocade_notification_preferences TO authenticated;

-- Consent receipts are append-only: a record the subject can edit is not
-- evidence, and one they can delete cannot answer a question asked next year.
REVOKE ALL ON TABLE public.legal_consent_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.legal_consent_receipts TO authenticated;

-- Billing and support evidence is written by the server, never by the account
-- it describes. Already corrected on the live project by an earlier hardening
-- migration; repeated here so a database built from these files alone agrees.
REVOKE ALL ON TABLE public.ocade_payment_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_support_tickets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ocade_support_messages FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.ocade_payment_events TO authenticated;
GRANT SELECT ON TABLE public.ocade_invoices TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ocade_support_tickets TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ocade_support_messages TO authenticated;

COMMIT;
