-- UPLOAD-06: an upload begun before the person emptied their Library must not appear in it
-- afterwards. "Delete everything" records when it ran; finishing a large upload compares that
-- time with when the upload began (the time-ordered id the server issued) and refuses an older
-- one. The time is always the database's own clock, never a value a client sends.
BEGIN;

CREATE TABLE public.ocade_library_epochs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cleared_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ocade_library_epochs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ocade_library_epochs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ocade_library_epochs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ocade_library_epochs TO service_role;
CREATE POLICY ocade_library_epochs_own_read ON public.ocade_library_epochs FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.ocade_delete_all_library_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  -- SECURITY INVOKER on purpose: the caller's own RLS decides what this can
  -- reach, so it cannot become a way to empty somebody else's library. The
  -- trigger above still writes the tombstones.
  WITH deleted AS (
    DELETE FROM public.ocade_library_items
    WHERE user_id = auth.uid()
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_removed FROM deleted;
  PERFORM public.ocade_fence_library_uploads();
  RETURN v_removed;
END;
$$;

-- Records "now" as the caller's Library epoch. SECURITY DEFINER only to write that one row: the
-- account is the caller's own and the time is the database clock, so it cannot fence anyone else.
CREATE FUNCTION public.ocade_fence_library_uploads()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.ocade_library_epochs (user_id, cleared_at)
  SELECT auth.uid(), now() WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET cleared_at = excluded.cleared_at;
$$;
REVOKE ALL ON FUNCTION public.ocade_fence_library_uploads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_fence_library_uploads() TO authenticated;

COMMIT;
