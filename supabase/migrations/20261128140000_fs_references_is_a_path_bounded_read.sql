-- EFFECT-06: fs.references reads one workspace path (what mentions it), so it conflicts only
-- with changes to that path and its ancestors and descendants, like fs.read_text.
CREATE OR REPLACE FUNCTION public.jarvis_step_resources(p_action jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN op LIKE 'ui.%' OR op = 'apps.launch' THEN ARRAY['desktop']
    WHEN op LIKE 'web.%' THEN ARRAY['web']
    WHEN op IN ('system.inspect', 'apps.list', 'system.dependency', 'verify.dependency') THEN '{}'::text[]
    WHEN keys IS NULL THEN ARRAY['*']
    ELSE coalesce((SELECT array_agg(public.jarvis_workspace_key(p_action -> 'arguments' ->> k) ORDER BY k)
                     FROM unnest(keys) AS k
                    WHERE jsonb_typeof(p_action -> 'arguments' -> k) = 'string'), '{}'::text[])
  END
  FROM (SELECT p_action ->> 'operation' AS op,
               CASE p_action ->> 'operation'
                 WHEN 'fs.list' THEN ARRAY['path'] WHEN 'fs.read_text' THEN ARRAY['path'] WHEN 'fs.references' THEN ARRAY['path']
                 WHEN 'fs.write_text' THEN ARRAY['path'] WHEN 'fs.manage' THEN ARRAY['path', 'to']
                 WHEN 'office.inspect_workbook' THEN ARRAY['path'] WHEN 'office.write_workbook' THEN ARRAY['path']
                 WHEN 'office.write_presentation' THEN ARRAY['path']
                 WHEN 'office.write_document' THEN ARRAY['docx', 'pdf']
                 WHEN 'image.edit' THEN ARRAY['source', 'output'] WHEN 'media.inspect' THEN ARRAY['path']
                 WHEN 'media.preview' THEN ARRAY['path'] WHEN 'media.analyze' THEN ARRAY['path']
                 WHEN 'media.trim' THEN ARRAY['source', 'output']
               END AS keys) AS spec;
$$;
