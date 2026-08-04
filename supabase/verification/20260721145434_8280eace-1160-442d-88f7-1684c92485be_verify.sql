-- Verification for 20260721145434_8280eace-1160-442d-88f7-1684c92485be.
--
-- This migration is NOT empty: it is a SECURITY HARDENING step that revokes
-- EXECUTE on public.enforce_pack_ga_gate() from PUBLIC, anon and authenticated.
--
-- An earlier version of this file described the migration as empty and passed
-- trivially. That was wrong and unsafe: if the REVOKE had failed to apply, an
-- anonymous or logged-in caller could still execute the gate function and the
-- verification would have reported success. This file now asserts the hardened
-- state actually HOLDS.
--
-- Run AFTER applying the migration. Raises (non-zero exit) on any gap.
DO $verify$
BEGIN
  IF to_regprocedure('public.enforce_pack_ga_gate()') IS NULL THEN
    RAISE EXCEPTION
      'Cannot verify hardening: public.enforce_pack_ga_gate() does not exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND has_function_privilege('anon', 'public.enforce_pack_ga_gate()', 'EXECUTE') THEN
    RAISE EXCEPTION
      'SECURITY: role anon can still EXECUTE public.enforce_pack_ga_gate(). The REVOKE did not hold.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND has_function_privilege('authenticated', 'public.enforce_pack_ga_gate()', 'EXECUTE') THEN
    RAISE EXCEPTION
      'SECURITY: role authenticated can still EXECUTE public.enforce_pack_ga_gate(). The REVOKE did not hold.';
  END IF;

  IF has_function_privilege('public', 'public.enforce_pack_ga_gate()', 'EXECUTE') THEN
    RAISE EXCEPTION
      'SECURITY: PUBLIC can still EXECUTE public.enforce_pack_ga_gate(). The REVOKE did not hold.';
  END IF;

  RAISE NOTICE
    'VERIFIED: EXECUTE on public.enforce_pack_ga_gate() is revoked from PUBLIC, anon and authenticated.';
END
$verify$;
