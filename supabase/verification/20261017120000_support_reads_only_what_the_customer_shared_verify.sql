-- Support reads only what the customer shared: the share table exists and every read checks it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE tablename = 'ocade_support_shares' AND policyname = 'ocade_support_shares_own') THEN
    RAISE EXCEPTION 'public.ocade_support_shares or its owner-only policy is missing';
  END IF;
  IF position('ocade_support_shared_until' IN pg_get_functiondef('public.ocade_case_messages(uuid, uuid)'::regprocedure)) = 0
     OR position('ocade_support_shared_until' IN pg_get_functiondef('public.ocade_case_conversations(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'a support read does not check the customer''s share';
  END IF;
END
$$;
