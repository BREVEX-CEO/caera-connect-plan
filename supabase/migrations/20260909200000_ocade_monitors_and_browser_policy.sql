-- Monitors, and which sites the browser may act on.
--
-- Both were in `localStorage`. A monitor is ordinary user content — the things
-- somebody asked OCADE to watch — and `PLAN.md` Phase 2 gives that one
-- persistent authority.
--
-- THE SITE POLICY IS THE SAFETY-CRITICAL HALF. It says which origins OCADE may
-- act on, read from and fill forms on. Kept in one browser, a REVOCATION only
-- applies where it was performed: somebody who removes a bank from the allow
-- list on a laptop leaves it allowed on every other browser they have signed in
-- on, and clearing that laptop's storage silently restores nothing — it simply
-- means the removal never existed anywhere else. A permission is exactly the
-- thing that has to be account-wide.
--
-- ONE ROW PER ACCOUNT, keyed by `user_id` rather than a generated id. The policy
-- is singular by nature: two rows would be two answers to "may OCADE act here",
-- and the code reading it would have to pick one.
--
-- `allow_private` IS NOT A COLUMN. Acting inside a private or incognito context
-- is always refused, and a column would be a place for that to become
-- configurable by accident — a stored `true` nobody intended, in the one place
-- where the answer must not depend on data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (topic IN (
    'local_incident', 'weather', 'transport', 'market', 'company_news',
    'regulation', 'outage', 'security_advisory', 'project'
  )),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 500),
  -- A monitor with no sources is a monitor that would have to invent its
  -- answers, so the array is required to be non-empty here as well as in code.
  sources TEXT[] NOT NULL CHECK (array_length(sources, 1) >= 1),
  -- Floored per topic in `world-scan.ts`; the column refuses anything under a
  -- minute outright, so no stored row can ask for a poll rate nothing intended.
  interval_ms BIGINT NOT NULL CHECK (interval_ms >= 60000),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused')),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ocade_monitors_user_created_idx
  ON public.ocade_monitors (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_monitors TO authenticated;
GRANT ALL ON public.ocade_monitors TO service_role;
ALTER TABLE public.ocade_monitors ENABLE ROW LEVEL SECURITY;

-- `(select auth.uid())` rather than `auth.uid()`: the bare call is re-evaluated
-- per row, the scalar subquery is an InitPlan run once per statement.
CREATE POLICY "own_monitors" ON public.ocade_monitors FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.ocade_browser_site_policy (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Origins OCADE may act on at all. Empty means nothing is allowed, which is
  -- also what a missing row means: the default is refusal.
  allow_origins TEXT[] NOT NULL DEFAULT '{}',
  -- Explicit blocks. These always win over the allow list, and that precedence
  -- is enforced in code — the point of storing them separately is that removing
  -- an allow is not the same act as forbidding a site.
  deny_origins TEXT[] NOT NULL DEFAULT '{}',
  read_origins TEXT[] NOT NULL DEFAULT '{}',
  fill_origins TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocade_browser_site_policy TO authenticated;
GRANT ALL ON public.ocade_browser_site_policy TO service_role;
ALTER TABLE public.ocade_browser_site_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_browser_site_policy" ON public.ocade_browser_site_policy FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
