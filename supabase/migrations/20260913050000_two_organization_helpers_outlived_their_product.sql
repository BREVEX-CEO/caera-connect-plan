-- Two authorization helpers survived the product they authorized.
--
-- `ocade_org_can_administer` and `ocade_org_is_owner` answered "may this
-- person administer this organization?" for the organizations product. That
-- product's tables were dropped in the previous migration, and the table sweep
-- could not reach these two: they depend on `ocade_org_role`, a FUNCTION, so
-- nothing about dropping a table took them with it.
--
-- WHY THIS IS NOT COSMETIC. Both are `SECURITY DEFINER` and both are
-- executable by `authenticated`, so every signed-in browser could call them
-- from any page on the internet. They can only error now — the rows they read
-- are gone — but a function that runs as its owner, is reachable by anybody,
-- and nobody maintains is not something to leave lying in the API surface.
-- Supabase's own linter reports them, which is how they were found.
--
-- Nothing calls them. `src/lib/security/caller-scoped-functions.ts` mentions
-- them in a comment explaining why its reachability check follows a chain of
-- helpers rather than reading one function's text; that comment is history and
-- stays accurate as history.

BEGIN;

DROP FUNCTION IF EXISTS public.ocade_org_can_administer(p_organization_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ocade_org_is_owner(p_organization_id uuid) CASCADE;

COMMIT;
