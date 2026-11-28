-- BILLING-04: closing and reopening an account (or using an alias of the same mailbox) must not
-- open a fresh Free usage window. A salted one-way hash of the canonical mailbox keeps the FIRST
-- window anchor; a profile created later for the same mailbox inherits it. No address is stored.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_free_identity (
  identity_key text PRIMARY KEY,
  window_anchor timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ocade_free_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_free_identity FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ocade_free_identity_salt (
  only_row boolean PRIMARY KEY DEFAULT true CHECK (only_row),
  salt text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex')
);
ALTER TABLE public.ocade_free_identity_salt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_free_identity_salt FROM PUBLIC, anon, authenticated;
INSERT INTO public.ocade_free_identity_salt DEFAULT VALUES ON CONFLICT DO NOTHING;

-- lower-case; drop "+tag"; for Gmail drop dots in the local part and fold googlemail.com.
CREATE OR REPLACE FUNCTION public.ocade_canonical_mailbox(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN p_email IS NULL OR position('@' IN p_email) < 2 THEN NULL ELSE
    CASE WHEN d IN ('gmail.com', 'googlemail.com')
         THEN replace(split_part(l, '+', 1), '.', '') || '@gmail.com'
         ELSE split_part(l, '+', 1) || '@' || d END
  END
  FROM (SELECT lower(btrim(split_part(p_email, '@', 1))) AS l,
               lower(btrim(split_part(p_email, '@', 2))) AS d) s
$$;

REVOKE ALL ON FUNCTION public.ocade_canonical_mailbox(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_free_identity_key(p_email text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT encode(sha256(convert_to((SELECT salt FROM public.ocade_free_identity_salt) || ':' ||
                                  public.ocade_canonical_mailbox(p_email), 'UTF8')), 'hex')
   WHERE public.ocade_canonical_mailbox(p_email) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.ocade_free_identity_key(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ocade_profile_inherits_free_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_key text; v_anchor timestamptz;
BEGIN
  v_key := public.ocade_free_identity_key(NEW.email);
  IF v_key IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.ocade_free_identity (identity_key, window_anchor)
  VALUES (v_key, NEW.created_at) ON CONFLICT (identity_key) DO NOTHING;
  SELECT window_anchor INTO v_anchor FROM public.ocade_free_identity WHERE identity_key = v_key;
  IF v_anchor < NEW.created_at THEN NEW.created_at := v_anchor; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ocade_profile_inherits_free_window() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ocade_profile_inherits_free_window ON public.profiles;
CREATE TRIGGER ocade_profile_inherits_free_window
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ocade_profile_inherits_free_window();

-- Existing accounts keep their earliest window per mailbox.
INSERT INTO public.ocade_free_identity (identity_key, window_anchor)
SELECT public.ocade_free_identity_key(email), min(created_at)
  FROM public.profiles
 WHERE public.ocade_free_identity_key(email) IS NOT NULL
 GROUP BY 1
ON CONFLICT DO NOTHING;

COMMIT;
