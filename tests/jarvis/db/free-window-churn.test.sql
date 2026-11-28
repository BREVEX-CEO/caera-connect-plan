-- BILLING-04: a closed-and-reopened account, or an alias of the same mailbox, inherits the first Free window anchor.
-- Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE fw AS SELECT gen_random_uuid() AS a, gen_random_uuid() AS b, gen_random_uuid() AS c,
  'q' || substr(md5(random()::text), 1, 8) AS tag;
DO $$
DECLARE
  v_tag text := (SELECT tag FROM fw);
  v_a uuid := (SELECT a FROM fw);
  v_b uuid := (SELECT b FROM fw);
  v_c uuid := (SELECT c FROM fw);
  v_first timestamptz; v_second timestamptz; v_other timestamptz; v_key text;
BEGIN
  IF public.ocade_canonical_mailbox('Jo.Lee+x@GoogleMail.com') <> 'jolee@gmail.com' THEN
    RAISE EXCEPTION 'free-window: gmail alias not folded';
  END IF;
  IF public.ocade_canonical_mailbox('A.B+c@Example.com') <> 'a.b@example.com' THEN
    RAISE EXCEPTION 'free-window: other providers keep dots';
  END IF;
  INSERT INTO auth.users (id, email) VALUES (v_a, 'a.' || v_tag || '+one@gmail.com');
  SELECT created_at INTO v_first FROM public.profiles WHERE id = v_a;
  IF v_first IS NULL THEN RAISE EXCEPTION 'free-window: no profile created for the first account'; END IF;
  -- make the first window old, then the person deletes the account
  v_key := public.ocade_free_identity_key('a.' || v_tag || '@gmail.com');
  UPDATE public.ocade_free_identity SET window_anchor = now() - interval '10 days' WHERE identity_key = v_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'free-window: the first account recorded no identity'; END IF;
  DELETE FROM auth.users WHERE id = v_a;
  -- they sign up again with an alias of the same mailbox
  INSERT INTO auth.users (id, email) VALUES (v_b, 'A' || v_tag || '@googlemail.com');
  UPDATE public.profiles SET email = 'a.' || v_tag || '+two@gmail.com' WHERE id = v_b;
  DELETE FROM public.profiles WHERE id = v_b;
  INSERT INTO public.profiles (id, email) VALUES (v_b, 'a.' || v_tag || '+two@gmail.com');
  SELECT created_at INTO v_second FROM public.profiles WHERE id = v_b;
  IF v_second > now() - interval '9 days' THEN
    RAISE EXCEPTION 'free-window: a returning mailbox opened a fresh window (%)', v_second;
  END IF;
  -- a different mailbox is unaffected
  INSERT INTO auth.users (id, email) VALUES (v_c, 'z' || v_tag || '@example.com');
  SELECT created_at INTO v_other FROM public.profiles WHERE id = v_c;
  IF v_other < now() - interval '1 hour' THEN RAISE EXCEPTION 'free-window: a new mailbox inherited an old window'; END IF;
  -- clients cannot read the identity table
  IF has_table_privilege('authenticated', 'public.ocade_free_identity', 'SELECT') THEN
    RAISE EXCEPTION 'free-window: identity hashes are readable by clients';
  END IF;
END $$;
ROLLBACK;
