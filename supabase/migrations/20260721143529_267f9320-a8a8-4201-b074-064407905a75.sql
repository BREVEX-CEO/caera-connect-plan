
CREATE TABLE public.cania_saved_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cania_saved_topics_user_idx ON public.cania_saved_topics(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cania_saved_topics TO authenticated;
GRANT ALL ON public.cania_saved_topics TO service_role;
ALTER TABLE public.cania_saved_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_saved_topics" ON public.cania_saved_topics FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.cania_alert_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','push')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cania_alerts_user_idx ON public.cania_alert_prefs(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cania_alert_prefs TO authenticated;
GRANT ALL ON public.cania_alert_prefs TO service_role;
ALTER TABLE public.cania_alert_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_alert_prefs" ON public.cania_alert_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.cania_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT,
  region TEXT,
  timezone TEXT,
  primary_currency TEXT,
  secondary_currency TEXT,
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric','imperial')),
  location_permission TEXT NOT NULL DEFAULT 'unknown' CHECK (location_permission IN ('unknown','granted','denied','prompt_pending')),
  approx_lat NUMERIC,
  approx_lon NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cania_settings TO authenticated;
GRANT ALL ON public.cania_settings TO service_role;
ALTER TABLE public.cania_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cania_settings" ON public.cania_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cania_settings_touch
  BEFORE UPDATE ON public.cania_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
