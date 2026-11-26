BEGIN;

/**
 * OFFLINE-03: a second device must not silently overwrite a newer saved setting.
 *
 * The caller says which revision it last read. If the account has moved on since,
 * nothing is written and the call fails with serialization_failure, so the screen
 * can show the newer choice instead of discarding it. A first save (no row yet)
 * expects revision 0.
 */
CREATE OR REPLACE FUNCTION public.ocade_save_notification_preferences_checked(
  p_expected_revision bigint,
  p_mute_optional boolean,
  p_quiet_hours jsonb,
  p_categories jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_revision bigint;
  next_revision bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'A notification preference belongs to an account.';
  END IF;

  INSERT INTO public.ocade_notification_preferences
    (user_id, mute_optional, quiet_hours, categories, updated_at, revision)
  VALUES (auth.uid(), p_mute_optional, p_quiet_hours, p_categories, now(), 1)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING revision INTO next_revision;
  IF next_revision IS NOT NULL THEN
    IF coalesce(p_expected_revision, 0) <> 0 THEN
      RAISE EXCEPTION 'preferences_changed_elsewhere' USING ERRCODE = '40001';
    END IF;
    RETURN next_revision;
  END IF;

  SELECT revision INTO current_revision
    FROM public.ocade_notification_preferences
   WHERE user_id = auth.uid()
     FOR UPDATE;
  IF current_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'preferences_changed_elsewhere' USING ERRCODE = '40001';
  END IF;

  UPDATE public.ocade_notification_preferences
     SET mute_optional = p_mute_optional,
         quiet_hours = p_quiet_hours,
         categories = p_categories,
         updated_at = now(),
         revision = revision + 1
   WHERE user_id = auth.uid()
  RETURNING revision INTO next_revision;
  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_save_notification_preferences_checked(bigint, boolean, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_save_notification_preferences_checked(bigint, boolean, jsonb, jsonb)
  TO authenticated;

COMMIT;
