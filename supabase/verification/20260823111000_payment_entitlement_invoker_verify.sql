do $$
declare
  _security_definer boolean;
  _config text[];
begin
  select p.prosecdef, p.proconfig
  into _security_definer, _config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'has_active_subscription'
    and pg_get_function_identity_arguments(p.oid) = 'user_uuid uuid, check_env text';

  if _security_definer is null then
    raise exception 'has_active_subscription(uuid,text) is missing';
  end if;
  if _security_definer then
    raise exception 'has_active_subscription still bypasses caller RLS';
  end if;
  -- PostgreSQL renders the empty identifier as search_path="" in pg_proc;
  -- some clients expose the equivalent search_path= form.
  if coalesce(array_to_string(_config, ','), '') not in ('search_path=', 'search_path=""') then
    raise exception 'has_active_subscription search_path is not empty';
  end if;
  if has_function_privilege('anon', 'public.has_active_subscription(uuid,text)', 'execute') then
    raise exception 'anonymous callers can probe entitlement state';
  end if;
end;
$$;
