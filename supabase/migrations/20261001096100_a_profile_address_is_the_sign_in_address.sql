-- A PROFILE'S ADDRESS IS THE ACCOUNT'S SIGN-IN ADDRESS, NOTHING ELSE.
--
-- profiles.email and profiles.phone were writable by their own account, and the
-- operator console searches and shows people by that address: an Admin could
-- appear in the audit record under the owner's address, a customer under a
-- victim's. They now follow auth.users (where a change of address is confirmed
-- by its new owner) and nobody writes them directly; any copy already changed
-- is put back.
BEGIN;

REVOKE UPDATE (email, phone) ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION private.ocade_profile_follows_sign_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.profiles
     SET email = NEW.email, phone = NEW.phone
   WHERE id = NEW.id
     AND (email IS DISTINCT FROM NEW.email OR phone IS DISTINCT FROM NEW.phone);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.ocade_profile_follows_sign_in() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_profile_follows_sign_in ON auth.users;
CREATE TRIGGER ocade_profile_follows_sign_in
  AFTER UPDATE OF email, phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.ocade_profile_follows_sign_in();

UPDATE public.profiles AS p
   SET email = u.email, phone = u.phone
  FROM auth.users AS u
 WHERE p.id = u.id
   AND (p.email IS DISTINCT FROM u.email OR p.phone IS DISTINCT FROM u.phone);

COMMIT;
