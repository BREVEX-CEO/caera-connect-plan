-- Puts the two organization authorization helpers back.
--
-- THEY CANNOT WORK AGAIN BY THEMSELVES, and saying so is the honest half of
-- this file. Both read `public.ocade_org_role`, which went with the
-- organizations product in the previous migration along with every table it
-- reads. Recreating them restores the SHAPE — the names, the signatures, the
-- grants — so that anything rolling back to a database that still has the
-- organizations schema finds them where it left them.
--
-- Rolling back this migration alone gives you two functions that raise as soon
-- as they are called. Roll back the previous migration too if you want them to
-- answer anything.

BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_org_is_owner(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.ocade_org_role(p_organization_id) = 'owner';
$function$;

CREATE OR REPLACE FUNCTION public.ocade_org_can_administer(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.ocade_org_role(p_organization_id) IN ('owner', 'admin');
$function$;

GRANT EXECUTE ON FUNCTION public.ocade_org_is_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_org_can_administer(uuid) TO authenticated;

COMMIT;
