BEGIN;

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
  RETURN v_removed;
END;
$$;

DROP FUNCTION public.ocade_fence_library_uploads();
DROP TABLE public.ocade_library_epochs;

COMMIT;
