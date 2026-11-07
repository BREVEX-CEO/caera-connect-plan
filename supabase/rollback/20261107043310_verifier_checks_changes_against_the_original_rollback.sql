BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_action_allowed(p_user uuid, p_device uuid, p_action jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_checks jsonb;
  v_check jsonb;
  v_site text;
  v_app text;
BEGIN
  -- Preserve the capability, exact top-level target and master-switch checks for every action.
  IF NOT coalesce(
    public.jarvis_allowed(p_user, p_device, p_action ->> 'capability')
    AND (p_action -> 'target' ->> 'app' IS NULL
         OR public.jarvis_allowed(p_user, p_device, 'app:' || (p_action -> 'target' ->> 'app')))
    AND (p_action -> 'target' ->> 'site' IS NULL
         OR public.jarvis_allowed(p_user, p_device, 'site:' || (p_action -> 'target' ->> 'site')))
    AND (p_action -> 'target' ->> 'mcp' IS NULL
         OR public.jarvis_allowed(p_user, p_device, 'mcp:' || (p_action -> 'target' ->> 'mcp'))),
    false
  ) THEN
    RETURN false;
  END IF;
  IF p_action ->> 'operation' = 'ui.click_point'
     AND NOT coalesce(public.jarvis_allowed(p_user, p_device, 'screen'), false) THEN
    RETURN false;
  END IF;
  IF p_action ->> 'operation' IS DISTINCT FROM 'verify.checks' THEN
    RETURN true;
  END IF;
  IF p_action ->> 'capability' IS DISTINCT FROM 'files'
     OR p_action ->> 'risk' IS DISTINCT FROM 'read' THEN
    RETURN false;
  END IF;

  v_checks := p_action #> '{arguments,checks}';
  IF jsonb_typeof(v_checks) IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(v_checks) NOT BETWEEN 1 AND 10 THEN
    RETURN false;
  END IF;
  FOR v_check IN SELECT value FROM jsonb_array_elements(v_checks) LOOP
    IF jsonb_typeof(v_check) IS DISTINCT FROM 'object' THEN
      RETURN false;
    END IF;
    CASE v_check ->> 'kind'
      WHEN 'web_text_contains' THEN
        -- Match the full HTTPS authority, never a prefix before credentials or a different host.
        -- DNS/address and redirect safety remain the verifier transport's independent guard.
        v_site := substring(lower(v_check #>> '{params,url}')
          FROM '^https://([a-z0-9][a-z0-9.-]{0,251}[a-z0-9]|[a-z0-9])(:0*443)?([/?#]|$)');
        IF v_site IS NULL OR v_site ~ '^[0-9.]+$'
           OR v_site = 'localhost' OR v_site LIKE '%.localhost' THEN
          RETURN false;
        END IF;
        IF NOT coalesce(public.jarvis_allowed(p_user, p_device, 'browser')
                        AND public.jarvis_allowed(p_user, p_device, 'site:' || v_site), false) THEN
          RETURN false;
        END IF;
      WHEN 'window_exists' THEN
        v_app := lower(v_check #>> '{params,exe}');
        IF v_app IS NULL OR v_app !~ '^[a-z0-9 ._()+-]{1,80}$' THEN
          RETURN false;
        END IF;
        IF NOT coalesce(public.jarvis_allowed(p_user, p_device, 'apps')
                        AND public.jarvis_allowed(p_user, p_device, 'app:' || v_app), false) THEN
          RETURN false;
        END IF;
      WHEN 'command_succeeds' THEN
        -- A re-run of a command the person confirmed earlier in the task (the planner refuses
        -- any other), in a throwaway copy of the folder: the same grant as running commands.
        IF NOT coalesce(public.jarvis_allowed(p_user, p_device, 'computer_control'), false)
           OR length(coalesce(v_check #>> '{params,command}', '')) NOT BETWEEN 1 AND 4000 THEN
          RETURN false;
        END IF;
      WHEN 'local_service_answers' THEN
        -- One loopback GET to a program the task started: the same grant as running commands.
        IF NOT coalesce(public.jarvis_allowed(p_user, p_device, 'computer_control'), false)
           OR (v_check #>> '{params,port}') !~ '^[0-9]{4,5}$' THEN
          RETURN false;
        END IF;
      WHEN 'file_exists', 'file_contains', 'file_parses', 'workbook_cell_equals',
           'media_duration', 'media_quality', 'image_size', 'scene_render',
           'script_runnable', 'workbook_formula', 'document_headings' THEN
        NULL;  -- These predicates stay inside the already authorized workspace.
      ELSE
        RETURN false;
    END CASE;
  END LOOP;
  RETURN true;
END;
$$;

COMMIT;
