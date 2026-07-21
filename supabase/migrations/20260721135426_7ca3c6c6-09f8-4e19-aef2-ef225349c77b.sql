
CREATE TABLE public.user_private_records (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_class text NOT NULL,
  id text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, data_class, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_private_records TO authenticated;
GRANT ALL ON public.user_private_records TO service_role;
ALTER TABLE public.user_private_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upr_self_all" ON public.user_private_records FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_private_records_set_updated_at
  BEFORE UPDATE ON public.user_private_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
