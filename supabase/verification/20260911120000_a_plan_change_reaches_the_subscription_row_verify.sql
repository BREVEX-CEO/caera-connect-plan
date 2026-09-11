-- Proves an upgrade reaches the row, and that an ordinary update does not
-- blank the plan on it.
DO $$
DECLARE
  account UUID := '00000000-0000-4000-8000-0000000009a1';
  landed TEXT;
  body TEXT;
BEGIN
  -- The function is there, and its update branch carries the plan. Checked in
  -- the catalogue as well as by behaviour: the behavioural half below proves
  -- what happens, and this half names what has to be present for it to keep
  -- happening after somebody edits the function.
  IF to_regprocedure('public.apply_payment_webhook_event(text, text, timestamptz, text, text, text, text, uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, boolean)') IS NULL THEN
    RAISE EXCEPTION 'the payment webhook function is missing';
  END IF;
  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = to_regprocedure('public.apply_payment_webhook_event(text, text, timestamptz, text, text, text, text, uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, boolean)');
  IF body NOT LIKE '%price_id = coalesce(p_price_id%' THEN
    RAISE EXCEPTION 'an upgrade cannot reach the row: the update branch ignores the price';
  END IF;

  INSERT INTO auth.users (id, email)
  VALUES (account, 'upgrade@verification.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (
    user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id,
    status, current_period_start, current_period_end, cancel_at_period_end,
    environment, provider_event_at, kind
  ) VALUES (
    account, 'sub_verify_upgrade', 'ctm_verify', 'pro_product', 'pri_pro_monthly',
    'active', now() - INTERVAL '1 day', now() + INTERVAL '29 days', false,
    'sandbox', now() - INTERVAL '1 day', 'subscription'
  )
  ON CONFLICT (paddle_subscription_id) DO NOTHING;

  -- An upgrade: the event names a different plan.
  PERFORM public.apply_payment_webhook_event(
    'evt_verify_upgrade', 'subscription.updated', now(), 'sandbox',
    'sub_verify_upgrade', 'update', NULL, NULL, 'sub_verify_upgrade', NULL,
    'max_product', 'pri_max_monthly', 'active',
    now(), now() + INTERVAL '30 days', false, NULL, false
  );

  SELECT price_id INTO landed
    FROM public.subscriptions WHERE paddle_subscription_id = 'sub_verify_upgrade';
  IF landed IS DISTINCT FROM 'pri_max_monthly' THEN
    RAISE EXCEPTION 'an upgrade did not reach the subscription row: price is %', landed;
  END IF;

  /*
   * AND AN ORDINARY UPDATE LEAVES IT ALONE. Most `subscription.updated` events
   * report a period change and carry no items; assigning rather than coalescing
   * would blank the plan and resolve a paying account to Free on its next read.
   */
  PERFORM public.apply_payment_webhook_event(
    'evt_verify_period', 'subscription.updated', now() + INTERVAL '1 second', 'sandbox',
    'sub_verify_upgrade', 'update', NULL, NULL, 'sub_verify_upgrade', NULL,
    NULL, NULL, 'active',
    now(), now() + INTERVAL '60 days', false, NULL, false
  );

  SELECT price_id INTO landed
    FROM public.subscriptions WHERE paddle_subscription_id = 'sub_verify_upgrade';
  IF landed IS DISTINCT FROM 'pri_max_monthly' THEN
    RAISE EXCEPTION 'a period-only update blanked the plan: price is %', landed;
  END IF;

  DELETE FROM public.payment_webhook_events
   WHERE event_id IN ('evt_verify_upgrade', 'evt_verify_period');
  DELETE FROM public.subscriptions WHERE paddle_subscription_id = 'sub_verify_upgrade';
  DELETE FROM auth.users WHERE id = account;

  RAISE NOTICE 'a plan change reaches the row; a period change leaves the plan alone';
END $$;
