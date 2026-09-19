-- Drop the two trigram indexes that make the admin account search indexed.
--
-- Searching still works afterwards; it becomes a sequential scan of every
-- profile, which is a performance regression rather than a broken feature.
BEGIN;

DROP INDEX IF EXISTS public.profiles_email_trgm_idx;
DROP INDEX IF EXISTS public.profiles_display_name_trgm_idx;

COMMIT;
