-- Plan v8 10.3: each milestone may name the operation families its work needs, chosen once
-- at goal time, so a planning turn sends full argument schemas only for those families. The
-- names are bounded identifiers only; which operations exist is still decided by the server.
BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_milestone_plan(p_outcome jsonb, p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_plan jsonb := p_plan;
  v_milestone jsonb;
BEGIN
  IF jsonb_typeof(p_outcome) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_outcome) NOT BETWEEN 1 AND 10
     OR jsonb_typeof(v_plan) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  -- Older callers supplied descriptions only; preserve them as one bounded phase.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_plan) AS m WHERE jsonb_typeof(m) <> 'string') THEN
    v_plan := jsonb_build_array(jsonb_build_object(
      'description', coalesce(nullif(left(p_outcome -> 0 ->> 'description', 300), ''), 'Complete the requested result'),
      'checks', (SELECT jsonb_agg(c ->> 'id') FROM jsonb_array_elements(p_outcome) AS c),
      'stepBudget', 30));
  END IF;
  IF jsonb_array_length(v_plan) NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  FOR v_milestone IN SELECT value FROM jsonb_array_elements(v_plan) LOOP
    IF jsonb_typeof(v_milestone) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_milestone -> 'description') IS DISTINCT FROM 'string'
       OR length(btrim(v_milestone ->> 'description')) NOT BETWEEN 1 AND 300
       OR jsonb_typeof(v_milestone -> 'checks') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_milestone -> 'stepBudget') IS DISTINCT FROM 'number'
       OR (v_milestone ->> 'stepBudget') !~ '^[0-9]{1,2}$' THEN
      RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
    END IF;
    IF (v_milestone ->> 'stepBudget')::integer NOT BETWEEN 1 AND 30
       OR jsonb_array_length(v_milestone -> 'checks') NOT BETWEEN 1 AND 10
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_milestone) AS k
                   WHERE k NOT IN ('description', 'checks', 'stepBudget', 'families'))
       OR (v_milestone ? 'families' AND (
             jsonb_typeof(v_milestone -> 'families') IS DISTINCT FROM 'array'
             OR jsonb_array_length(v_milestone -> 'families') NOT BETWEEN 1 AND 12
             OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_milestone -> 'families') AS f
                         WHERE jsonb_typeof(f) <> 'string' OR (f #>> '{}') !~ '^[a-z]{2,10}$')))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_milestone -> 'checks') AS c WHERE jsonb_typeof(c) <> 'string')
       OR (SELECT count(*) <> count(DISTINCT c) FROM jsonb_array_elements_text(v_milestone -> 'checks') AS c)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_milestone -> 'checks') AS id
                   WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_outcome) AS c WHERE c ->> 'id' = id)) THEN
      RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_outcome) AS c
              WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_plan) AS m
                                 WHERE (m -> 'checks') ? (c ->> 'id'))) THEN
    RAISE EXCEPTION 'invalid_milestone_plan' USING ERRCODE = '22023';
  END IF;
  RETURN v_plan;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_milestone_plan(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_milestone_plan(jsonb, jsonb) TO service_role;

COMMIT;
