-- Restores the update branch that left the plan alone.
--
-- ROLLING THIS BACK REOPENS THE DEFECT: an upgrade or a downgrade will again
-- change status and period while leaving `price_id`, so the tier the customer
-- is charged for and the tier they receive will disagree. It is here because a
-- migration without a rollback is a plan, not a safety net.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_payment_webhook_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_environment text,
  p_entity_id text,
  p_action text,
  p_reason text,
  p_user_id uuid,
  p_paddle_subscription_id text,
  p_paddle_customer_id text,
  p_product_id text,
  p_price_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_kind text,
  p_allow_terminal_reversal boolean
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _claimed bigint;
  _affected bigint;
  _target_user uuid;
  _terminal text[] := array['canceled', 'cancelled', 'refunded', 'charged_back', 'disputed'];
begin
  if p_environment not in ('sandbox', 'live') then
    raise exception 'invalid payment environment';
  end if;
  if p_action not in ('upsert', 'update', 'ignore') then
    raise exception 'invalid payment action';
  end if;

  insert into public.payment_webhook_events
    (event_id, event_type, occurred_at, environment, entity_id, user_id, outcome, reason)
  values
    (p_event_id, p_event_type, p_occurred_at, p_environment, p_entity_id,
     p_user_id, p_action, case when p_action = 'ignore' then p_reason else null end)
  on conflict (event_id) do nothing;
  get diagnostics _claimed = row_count;
  if _claimed = 0 then
    return 'duplicate';
  end if;

  if p_action = 'ignore' then
    return 'ignore';
  end if;

  if p_action = 'upsert' then
    if p_user_id is null or p_paddle_subscription_id is null or p_paddle_customer_id is null
       or p_product_id is null or p_price_id is null or p_status is null or p_kind is null then
      raise exception 'payment upsert is missing required state';
    end if;

    insert into public.subscriptions (
      user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id,
      status, current_period_start, current_period_end, cancel_at_period_end,
      environment, provider_event_at, kind
    ) values (
      p_user_id, p_paddle_subscription_id, p_paddle_customer_id, p_product_id, p_price_id,
      p_status, p_current_period_start, p_current_period_end,
      coalesce(p_cancel_at_period_end, false), p_environment, p_occurred_at, p_kind
    )
    on conflict (paddle_subscription_id) do update
    set user_id = excluded.user_id,
        paddle_customer_id = excluded.paddle_customer_id,
        product_id = excluded.product_id,
        price_id = excluded.price_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        provider_event_at = excluded.provider_event_at,
        kind = excluded.kind,
        updated_at = now()
    where public.subscriptions.environment = excluded.environment
      and (public.subscriptions.provider_event_at is null
        or public.subscriptions.provider_event_at <= excluded.provider_event_at)
      and (
        not (public.subscriptions.status = any(_terminal))
        or excluded.status = any(_terminal)
        or p_allow_terminal_reversal
      )
    returning user_id into _target_user;
  else
    update public.subscriptions
    set status = coalesce(p_status, status),
        current_period_start = coalesce(p_current_period_start, current_period_start),
        current_period_end = coalesce(p_current_period_end, current_period_end),
        cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
        provider_event_at = p_occurred_at,
        updated_at = now()
    where paddle_subscription_id = p_paddle_subscription_id
      and environment = p_environment
      and (provider_event_at is null or provider_event_at <= p_occurred_at)
      and (
        not (status = any(_terminal))
        or p_status = any(_terminal)
        or p_allow_terminal_reversal
      )
    returning user_id into _target_user;
  end if;

  get diagnostics _affected = row_count;
  if _affected = 0 then
    update public.payment_webhook_events
    set outcome = 'ignore', reason = 'target_missing_stale_or_terminal'
    where event_id = p_event_id;
    return 'ignore';
  end if;

  update public.payment_webhook_events
  set user_id = _target_user, outcome = p_action, reason = null
  where event_id = p_event_id;
  return p_action;
end;
$$;

COMMIT;
