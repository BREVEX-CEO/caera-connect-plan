-- Atomic browser/device registration for OCADE.
--
-- The old browser path inserted `devices`, then inserted `browser_grants`, then
-- attempted a best-effort DELETE rollback if the second write failed. A lost
-- connection or rollback failure could leave a ghost device, and two tabs could
-- race to create two devices for the same browser install.
--
-- This RPC owns both writes in one PostgreSQL transaction and serializes one
-- (user, browser_install_id) registration with a transaction advisory lock.

create or replace function public.register_browser_device_for_current_user(
  _browser_install_id text,
  _kind public.device_kind,
  _name text,
  _user_agent text default null,
  _origin text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_device_id uuid;
  v_grant_id uuid;
  v_revoked_at timestamptz;
  v_device_revoked_at timestamptz;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if _browser_install_id is null or length(trim(_browser_install_id)) < 8 or length(_browser_install_id) > 200 then
    raise exception 'invalid browser install id' using errcode = '22023';
  end if;
  if _name is null or length(trim(_name)) = 0 or length(_name) > 160 then
    raise exception 'invalid device name' using errcode = '22023';
  end if;
  if _origin is not null and length(_origin) > 500 then
    raise exception 'origin is too long' using errcode = '22023';
  end if;
  if _user_agent is not null and length(_user_agent) > 2000 then
    raise exception 'user agent is too long' using errcode = '22023';
  end if;

  -- Same user + same browser install can have only one registration transaction
  -- executing at a time, even when several tabs open simultaneously.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || _browser_install_id, 0)
  );

  -- Any revoked grant is authoritative. Never resurrect this browser because a
  -- stale active duplicate also happens to exist.
  if exists (
    select 1
    from public.browser_grants
    where user_id = v_user
      and browser_install_id = _browser_install_id
      and revoked_at is not null
  ) then
    return null;
  end if;

  select bg.id, bg.device_id, bg.revoked_at
    into v_grant_id, v_device_id, v_revoked_at
  from public.browser_grants bg
  where bg.user_id = v_user
    and bg.browser_install_id = _browser_install_id
  order by bg.created_at desc
  limit 1
  for update;

  if v_grant_id is not null then
    select d.revoked_at into v_device_revoked_at
    from public.devices d
    where d.id = v_device_id and d.user_id = v_user
    for update;

    if not found then
      raise exception 'browser grant references a missing device';
    end if;
    if v_device_revoked_at is not null then
      update public.browser_grants
      set revoked_at = coalesce(revoked_at, v_device_revoked_at),
          last_seen_at = v_now
      where id = v_grant_id and user_id = v_user;
      return null;
    end if;

    update public.devices
    set last_active_at = v_now,
        user_agent = coalesce(_user_agent, user_agent)
    where id = v_device_id and user_id = v_user;

    update public.browser_grants
    set last_seen_at = v_now,
        user_agent = _user_agent,
        origin = _origin
    where id = v_grant_id and user_id = v_user;

    return v_device_id;
  end if;

  -- Migrate the old generated-name identity once, inside this same transaction.
  select d.id, d.revoked_at
    into v_device_id, v_device_revoked_at
  from public.devices d
  where d.user_id = v_user and d.name = _name
  order by d.created_at desc
  limit 1
  for update;

  if v_device_id is not null then
    insert into public.browser_grants (
      user_id, browser_install_id, device_id, user_agent, origin,
      last_seen_at, revoked_at
    ) values (
      v_user, _browser_install_id, v_device_id, _user_agent, _origin,
      v_now, v_device_revoked_at
    );

    if v_device_revoked_at is not null then
      return null;
    end if;

    update public.devices
    set last_active_at = v_now,
        user_agent = coalesce(_user_agent, user_agent)
    where id = v_device_id and user_id = v_user;
    return v_device_id;
  end if;

  insert into public.devices (
    user_id, kind, name, user_agent, last_active_at
  ) values (
    v_user, _kind, trim(_name), _user_agent, v_now
  )
  returning id into v_device_id;

  insert into public.browser_grants (
    user_id, browser_install_id, device_id, user_agent, origin, last_seen_at
  ) values (
    v_user, _browser_install_id, v_device_id, _user_agent, _origin, v_now
  );

  return v_device_id;
end;
$$;

revoke all on function public.register_browser_device_for_current_user(text, public.device_kind, text, text, text) from public;
grant execute on function public.register_browser_device_for_current_user(text, public.device_kind, text, text, text) to authenticated;
