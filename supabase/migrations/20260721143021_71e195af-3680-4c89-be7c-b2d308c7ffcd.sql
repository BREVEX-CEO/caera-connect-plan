
CREATE TABLE public.ocade_provider_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  routing TEXT NOT NULL DEFAULT 'auto' CHECK (routing IN ('auto','lovable_gateway','openai_direct','ollama_local','caera_native')),
  privacy_pref TEXT NOT NULL DEFAULT 'balanced' CHECK (privacy_pref IN ('local_first','balanced','cloud_ok')),
  cost_pref TEXT NOT NULL DEFAULT 'balanced' CHECK (cost_pref IN ('cheapest','balanced','best_quality')),
  speed_pref TEXT NOT NULL DEFAULT 'balanced' CHECK (speed_pref IN ('fastest','balanced','best_quality')),
  vision_required BOOLEAN NOT NULL DEFAULT FALSE,
  session_override_model TEXT,
  ollama_bridge_url TEXT,
  openai_direct_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_provider_prefs TO authenticated;
GRANT ALL ON public.ocade_provider_prefs TO service_role;
ALTER TABLE public.ocade_provider_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_provider_prefs" ON public.ocade_provider_prefs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ocade_provider_prefs_touch
  BEFORE UPDATE ON public.ocade_provider_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ocade_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('connection_test','usage','error','provider_switch','bridge_url_set')),
  provider TEXT NOT NULL,
  model TEXT,
  ok BOOLEAN,
  latency_ms INT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ocade_provider_events_user_idx ON public.ocade_provider_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.ocade_provider_events TO authenticated;
GRANT ALL ON public.ocade_provider_events TO service_role;
ALTER TABLE public.ocade_provider_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_provider_events_read" ON public.ocade_provider_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "own_provider_events_insert" ON public.ocade_provider_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
