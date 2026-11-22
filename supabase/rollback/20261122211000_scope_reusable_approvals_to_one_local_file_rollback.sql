-- Remove exact-file grants before restoring the earlier function definitions.
BEGIN;
DELETE FROM public.jarvis_step_approvals WHERE target LIKE 'path:%';
CREATE OR REPLACE FUNCTION public.jarvis_approval_scope(p_action jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_action ->> 'operation' IN ('ui.invoke', 'ui.set_value', 'ui.send_keys', 'ui.click_point', 'apps.launch',
                                      'office.edit_document', 'office.edit_workbook')
         AND p_action -> 'target' ->> 'app' IS NOT NULL THEN 'app:' || (p_action -> 'target' ->> 'app')
    WHEN p_action ->> 'operation' IN ('web.fill', 'web.select', 'web.click')
         AND p_action -> 'target' ->> 'site' IS NOT NULL THEN 'site:' || (p_action -> 'target' ->> 'site')
    WHEN p_action ->> 'operation' IN ('office.edit_document', 'office.edit_workbook', 'fs.replace_text', 'fs.edit_text')
         THEN 'files'
  END;
$$;
CREATE OR REPLACE FUNCTION public.jarvis_clear_approvals(p_user uuid, p_task uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH gone AS (DELETE FROM public.jarvis_step_approvals AS s
                 WHERE s.task_id = p_task AND s.user_id = p_user RETURNING 1)
  SELECT count(*)::integer FROM gone;
$$;
COMMIT;
