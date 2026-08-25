-- Expand OCADE's authenticated support queue for the public contact model.
-- Dedicated domain mailboxes are not claimed until they are actually activated.

BEGIN;

ALTER TABLE public.ocade_support_tickets
  DROP CONSTRAINT IF EXISTS ocade_support_tickets_category_check;

ALTER TABLE public.ocade_support_tickets
  ADD CONSTRAINT ocade_support_tickets_category_check
  CHECK (
    category IN (
      'account',
      'billing',
      'technical',
      'privacy',
      'security',
      'feedback',
      'legal',
      'investor',
      'partnership'
    )
  );

COMMENT ON COLUMN public.ocade_support_tickets.category IS
  'Support routing category, including privacy/legal requests and investor or strategic-partnership enquiries.';

COMMIT;
