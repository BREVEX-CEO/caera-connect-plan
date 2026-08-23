-- The original helper was SECURITY DEFINER in the exposed public schema and
-- accepted any user UUID. An authenticated caller could therefore probe
-- another account's billing state. Run as the caller so subscriptions RLS is
-- the authority; service_role still sees all rows when server code needs it.
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
  );
$$;

revoke all on function public.has_active_subscription(uuid, text) from public, anon;
grant execute on function public.has_active_subscription(uuid, text) to authenticated, service_role;

comment on function public.has_active_subscription(uuid, text) is
  'Checks paid access under caller RLS. Authenticated callers can observe only their own subscription rows.';
