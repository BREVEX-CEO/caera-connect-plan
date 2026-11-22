BEGIN;
CREATE TABLE public.ocade_lifeos_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  source text NOT NULL DEFAULT '' CHECK (length(source) <= 300),
  due_on date,
  snoozed_until date,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ocade_lifeos_obligations_owner_id_idx
  ON public.ocade_lifeos_obligations (user_id, id);
ALTER TABLE public.ocade_lifeos_obligations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocade_lifeos_obligations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.ocade_lifeos_obligations TO authenticated;
-- The account export and data deletion use the existing account-bound service.
GRANT SELECT, DELETE ON public.ocade_lifeos_obligations TO service_role;
GRANT INSERT (user_id, title, source, due_on, snoozed_until, completed)
  ON public.ocade_lifeos_obligations TO authenticated;
GRANT UPDATE (title, source, due_on, snoozed_until, completed)
  ON public.ocade_lifeos_obligations TO authenticated;
CREATE POLICY ocade_lifeos_owner ON public.ocade_lifeos_obligations FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
COMMIT;
