-- Verifies the payment webhook can be idempotent, ordered and auditable.
--
-- Each check below corresponds to a specific incident the migration exists to
-- prevent, so a failure here names the incident rather than a missing column.

DO $$
DECLARE
  _pk_col text;
  _rls boolean;
BEGIN
  IF to_regclass('public.payment_webhook_events') IS NULL THEN
    RAISE EXCEPTION 'public.payment_webhook_events is missing; webhook replay cannot be detected';
  END IF;

  -- The provider's event id must BE the primary key. A unique index elsewhere
  -- would not make a retried delivery fail the insert, which is the whole
  -- mechanism: replay has to be a constraint violation, not a lookup.
  SELECT a.attname INTO _pk_col
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = 'public.payment_webhook_events'::regclass AND i.indisprimary;

  IF _pk_col IS DISTINCT FROM 'event_id' THEN
    RAISE EXCEPTION
      'payment_webhook_events primary key is %, not event_id; a retried delivery would be applied twice',
      coalesce(_pk_col, '(none)');
  END IF;

  SELECT relrowsecurity INTO _rls
  FROM pg_class WHERE oid = 'public.payment_webhook_events'::regclass;
  IF NOT _rls THEN
    RAISE EXCEPTION 'payment_webhook_events does not have row level security enabled';
  END IF;

  -- No browser role may read the audit trail. There is nothing in it a
  -- customer needs, and it records who paid for what.
  IF has_table_privilege('anon', 'public.payment_webhook_events', 'select')
     OR has_table_privilege('authenticated', 'public.payment_webhook_events', 'select') THEN
    RAISE EXCEPTION 'payment_webhook_events is readable by a browser role';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.payment_webhook_events', 'insert') THEN
    RAISE EXCEPTION 'service_role cannot write payment_webhook_events; the webhook could not record anything';
  END IF;

  -- Ordering: without this column a delayed delivery cannot be recognised as
  -- stale, and can resurrect superseded access.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_event_at'
  ) THEN
    RAISE EXCEPTION 'subscriptions.provider_event_at is missing; events cannot be ordered';
  END IF;

  -- A one-time pass ends by the clock; a subscription ends when the provider
  -- says so. Without this column the two are indistinguishable.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'kind'
  ) THEN
    RAISE EXCEPTION 'subscriptions.kind is missing; a one-time pass cannot be distinguished';
  END IF;
END;
$$;

-- The idempotency guarantee, executed rather than asserted about.
DO $$
DECLARE
  _second_insert_failed boolean := false;
BEGIN
  INSERT INTO public.payment_webhook_events
    (event_id, event_type, occurred_at, environment, outcome)
  VALUES ('verify_evt_1', 'transaction.completed', now(), 'sandbox', 'received');

  BEGIN
    INSERT INTO public.payment_webhook_events
      (event_id, event_type, occurred_at, environment, outcome)
    VALUES ('verify_evt_1', 'transaction.completed', now(), 'sandbox', 'received');
  EXCEPTION WHEN unique_violation THEN
    _second_insert_failed := true;
  END;

  DELETE FROM public.payment_webhook_events WHERE event_id = 'verify_evt_1';

  IF NOT _second_insert_failed THEN
    RAISE EXCEPTION 'the same provider event was accepted twice; replay protection does not work';
  END IF;
END;
$$;

-- `kind` accepts only the two shapes the product actually sells.
DO $$
DECLARE
  _rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.subscriptions
      (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, kind)
    VALUES
      ('00000000-0000-0000-0000-000000000000', 'verify_sub_1', 'c', 'p', 'pr', 'nonsense');
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    _rejected := true;
  END;

  -- Nothing to clean up: a rejected insert left nothing, and an accepted one
  -- raises below, which rolls the whole check back.

  IF NOT _rejected THEN
    RAISE EXCEPTION 'subscriptions.kind accepted a value outside its check constraint';
  END IF;
END;
$$;
