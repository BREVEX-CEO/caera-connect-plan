-- Payment webhook: idempotency, ordering, and a record that it happened.
--
-- WHY THIS MIGRATION EXISTS.
--
-- The webhook was the only writer of subscription state and kept no record of
-- what it had processed. Three consequences, each a real incident:
--
--   * a retried delivery -- which providers send as a matter of course -- was
--     indistinguishable from a second purchase;
--   * an event held up in a retry queue could be applied after the event that
--     superseded it, handing access back to somebody who had cancelled or
--     been refunded;
--   * a dispute could not be reconstructed, because nothing recorded that the
--     event had ever arrived.
--
-- NO PAYMENT CREDENTIALS ARE STORED HERE. Not a card, not a token, not a
-- billing address, not an email. The provider's own event id, its timestamp,
-- the event type, which entity it concerned and what OCADE decided to do.
-- That is enough to prove what happened and not enough to be worth stealing.

create table if not exists public.payment_webhook_events (
  -- The provider's id IS the primary key. That is what makes replay a
  -- constraint violation rather than a second charge's worth of access.
  event_id text primary key,
  event_type text not null,
  -- The provider's timestamp, not ours. Ours records only when we heard.
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  environment text not null check (environment in ('sandbox', 'live')),
  -- The subscription or transaction the event concerned, where known.
  entity_id text,
  user_id uuid references auth.users(id) on delete set null,
  -- What the decision layer did: 'upsert', 'update' or 'ignore'.
  outcome text not null,
  -- Why, when it was ignored. A short machine reason, never customer-facing.
  reason text
);

create index if not exists idx_payment_webhook_events_entity
  on public.payment_webhook_events(entity_id, occurred_at desc);
create index if not exists idx_payment_webhook_events_user
  on public.payment_webhook_events(user_id, occurred_at desc);

-- Service role only. These rows are OCADE's own audit trail; there is nothing
-- in them a customer needs and no reason for a browser to read them.
revoke all on table public.payment_webhook_events from public, anon, authenticated;
grant all on table public.payment_webhook_events to service_role;

alter table public.payment_webhook_events enable row level security;

-- RLS with no permissive policy: even a leaked anon key reads nothing. The
-- service role bypasses RLS, which is the only access this table has.
drop policy if exists "No client access to payment webhook events"
  on public.payment_webhook_events;

-- Subscriptions gain the two columns the ordering rule needs.
alter table public.subscriptions
  add column if not exists provider_event_at timestamptz;

-- A one-time pass and a recurring subscription live in the same table because
-- they answer the same question -- "what has this account paid for?" -- and
-- /checkout/success already polls it. The column says which is which, so a
-- pass that ends by the clock is never mistaken for a subscription that ends
-- when the provider says so.
alter table public.subscriptions
  add column if not exists kind text not null default 'subscription'
  check (kind in ('subscription', 'one_time'));

comment on column public.subscriptions.provider_event_at is
  'occurred_at of the last provider event applied to this row. An event older than this is refused, so a delayed delivery cannot resurrect superseded state.';
comment on column public.subscriptions.kind is
  'subscription = recurring, ends when the provider says so. one_time = a fixed-length pass that ends by the clock.';
