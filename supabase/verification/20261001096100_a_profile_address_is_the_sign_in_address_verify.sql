-- The profile address is the sign-in address and nobody writes it directly.
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE') THEN
    RAISE EXCEPTION 'an account can still write its own profile address';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ocade_profile_follows_sign_in'
                   AND tgrelid = 'auth.users'::regclass) THEN
    RAISE EXCEPTION 'the profile address does not follow the sign-in address';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles AS p JOIN auth.users AS u ON u.id = p.id
              WHERE p.email IS DISTINCT FROM u.email) THEN
    RAISE EXCEPTION 'a profile address differs from its sign-in address';
  END IF;
END
$$;
