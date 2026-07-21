REVOKE EXECUTE ON FUNCTION public.find_conflicting_legal_id(text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.find_similar_company_names(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_conflicting_legal_id(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_similar_company_names(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(jsonb) TO service_role;