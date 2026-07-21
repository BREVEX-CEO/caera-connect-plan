
CREATE TABLE public.ocade_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  model_id TEXT,
  provider_id TEXT,
  privacy_mode TEXT NOT NULL DEFAULT 'private_sync',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_conversations TO authenticated;
GRANT ALL ON public.ocade_conversations TO service_role;
ALTER TABLE public.ocade_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_conversations" ON public.ocade_conversations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ocade_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ocade_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_id TEXT,
  provider_id TEXT,
  token_usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ocade_messages_conv_idx ON public.ocade_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_messages TO authenticated;
GRANT ALL ON public.ocade_messages TO service_role;
ALTER TABLE public.ocade_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_messages" ON public.ocade_messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ocade_conversations_touch
  BEFORE UPDATE ON public.ocade_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
