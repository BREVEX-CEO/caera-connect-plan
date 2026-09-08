-- OCADE billing evidence + customer support workflow.
-- Full card, UPI, PayPal credentials and raw provider payloads are deliberately
-- excluded. Provider webhooks are verified server-side before these tables are
-- written. Customers may read only their own records; writes that affect
-- entitlement or money remain service-role only.

BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_is_support_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'::public.app_role
  );
$$;
REVOKE ALL ON FUNCTION public.ocade_is_support_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_is_support_admin() TO authenticated, service_role;

CREATE TABLE public.ocade_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'paypal', 'app_store', 'play_store', 'test')),
  provider_event_id TEXT NOT NULL,
  provider_payment_ref TEXT,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y')),
  kind TEXT NOT NULL CHECK (kind IN ('checkout', 'payment', 'renewal', 'failure', 'refund', 'dispute')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'disputed', 'cancelled')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX ocade_payment_events_user_time_idx
  ON public.ocade_payment_events (user_id, occurred_at DESC);
/*
 * `authenticated` IS NAMED HERE, AND LEAVING IT OUT WAS THE WHOLE BUG.
 *
 * A Supabase project grants ALL on every new table directly to `authenticated`
 * through ALTER DEFAULT PRIVILEGES, and `REVOKE ... FROM PUBLIC, anon` does not
 * touch a direct grant. So these four tables were created with INSERT, UPDATE,
 * DELETE and TRUNCATE already held by every signed-in browser, and the GRANT
 * lines below — written to say exactly what each role may do — added nothing
 * and took nothing away. This migration's own verification script says
 * "authenticated users can write server-owned billing evidence", and it was
 * right; it only passed because the local twin had no default privileges to
 * reproduce. The twin now does.
 *
 * Row-level security refused those writes throughout, so no evidence was ever
 * writable in practice. This closes the other half of the lock.
 */
REVOKE ALL ON public.ocade_payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_payment_events TO authenticated;
GRANT ALL ON public.ocade_payment_events TO service_role;
ALTER TABLE public.ocade_payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_events_own_read" ON public.ocade_payment_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.ocade_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_event_id UUID REFERENCES public.ocade_payment_events(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('trial_2d', 'std_8d', 'month_1m', 'year_1y')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL CHECK (status IN ('issued', 'paid', 'void', 'refunded')),
  issued_at TIMESTAMPTZ NOT NULL,
  receipt_url TEXT CHECK (receipt_url IS NULL OR receipt_url ~ '^https://'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ocade_invoices_user_time_idx ON public.ocade_invoices (user_id, issued_at DESC);
REVOKE ALL ON public.ocade_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ocade_invoices TO authenticated;
GRANT ALL ON public.ocade_invoices TO service_role;
ALTER TABLE public.ocade_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_own_read" ON public.ocade_invoices
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.ocade_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 120),
  category TEXT NOT NULL CHECK (category IN ('account', 'billing', 'technical', 'privacy', 'security', 'feedback')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'priority', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'needs_customer', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ocade_support_tickets_user_time_idx
  ON public.ocade_support_tickets (user_id, last_message_at DESC);
CREATE INDEX ocade_support_tickets_queue_idx
  ON public.ocade_support_tickets (status, priority, last_message_at);
REVOKE ALL ON public.ocade_support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ocade_support_tickets TO authenticated;
GRANT ALL ON public.ocade_support_tickets TO service_role;
ALTER TABLE public.ocade_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_tickets_own_read" ON public.ocade_support_tickets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "support_tickets_own_create" ON public.ocade_support_tickets
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id AND status = 'open' AND assigned_to IS NULL
  );
CREATE POLICY "support_tickets_admin_all" ON public.ocade_support_tickets
  FOR ALL TO authenticated
  USING (public.ocade_is_support_admin())
  WITH CHECK (public.ocade_is_support_admin());

CREATE TABLE public.ocade_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.ocade_support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  author_role TEXT NOT NULL CHECK (author_role IN ('customer', 'support')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ocade_support_messages_ticket_time_idx
  ON public.ocade_support_messages (ticket_id, created_at);
REVOKE ALL ON public.ocade_support_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ocade_support_messages TO authenticated;
GRANT ALL ON public.ocade_support_messages TO service_role;
ALTER TABLE public.ocade_support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_messages_ticket_read" ON public.ocade_support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ocade_support_tickets ticket
      WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
    )
    OR public.ocade_is_support_admin()
  );
CREATE POLICY "support_messages_customer_create" ON public.ocade_support_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = (SELECT auth.uid()) AND author_role = 'customer' AND EXISTS (
      SELECT 1 FROM public.ocade_support_tickets ticket
      WHERE ticket.id = ticket_id AND ticket.user_id = (SELECT auth.uid())
        AND ticket.status NOT IN ('closed')
    )
  );
CREATE POLICY "support_messages_admin_create" ON public.ocade_support_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = (SELECT auth.uid()) AND author_role = 'support'
    AND public.ocade_is_support_admin()
  );

CREATE OR REPLACE FUNCTION public.ocade_support_touch_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ocade_support_tickets
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      status = CASE
        WHEN NEW.author_role = 'support' THEN 'needs_customer'
        WHEN status IN ('resolved', 'closed') THEN status
        ELSE 'in_progress'
      END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_support_touch_ticket() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_support_touch_ticket() TO service_role;
CREATE TRIGGER ocade_support_messages_touch
  AFTER INSERT ON public.ocade_support_messages
  FOR EACH ROW EXECUTE FUNCTION public.ocade_support_touch_ticket();

CREATE OR REPLACE FUNCTION public.ocade_create_support_ticket(
  p_subject TEXT,
  p_category TEXT,
  p_body TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_ticket_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF char_length(trim(p_subject)) NOT BETWEEN 5 AND 120
    OR char_length(trim(p_body)) NOT BETWEEN 2 AND 5000 THEN
    RAISE EXCEPTION 'invalid_support_request';
  END IF;

  INSERT INTO public.ocade_support_tickets (user_id, subject, category)
  VALUES (v_user_id, trim(p_subject), p_category)
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.ocade_support_messages (ticket_id, author_id, author_role, body)
  VALUES (v_ticket_id, v_user_id, 'customer', trim(p_body));
  RETURN v_ticket_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_create_support_ticket(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_create_support_ticket(TEXT, TEXT, TEXT)
  TO authenticated, service_role;

COMMENT ON TABLE public.ocade_payment_events IS
  'Sanitized OCADE payment lifecycle evidence. Never stores full payment credentials or raw webhook payloads.';
COMMENT ON TABLE public.ocade_invoices IS
  'Customer-visible invoice and receipt index. Provider-hosted documents may be linked by HTTPS URL.';
COMMENT ON TABLE public.ocade_support_tickets IS
  'Customer support queue with owner isolation and admin-only queue management.';

COMMIT;
