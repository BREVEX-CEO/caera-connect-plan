-- Server-side consent receipts.
--
-- WHY LOCALSTORAGE IS NOT ENOUGH, and what it costs the person.
--
-- Acceptance was recorded only in `localStorage`. That is a reasonable place
-- for it before there is an account -- a demo visitor has nowhere else -- and a
-- poor one afterwards, in both directions:
--
--   The person is asked again on every device, and again after clearing site
--   data, having already agreed. A gate that reappears teaches people to click
--   through it.
--
--   And OCADE cannot show which version of which document an account accepted,
--   or when. The evidence lives on the person's own machine, where they can
--   erase it and where nobody else can read it, which is the opposite of what
--   a consent record is for.
--
-- APPEND-ONLY BY CONSTRUCTION. There is no UPDATE or DELETE policy, for anyone
-- except the service role. A new acceptance is a NEW ROW: what somebody agreed
-- to in March is not amended by what they agree to in June, and a bug that
-- overwrote the March row would destroy the only evidence of it. History is
-- the point of the table.
--
-- WHAT IS NOT STORED. No IP address, no user agent, no location. Which
-- documents, which versions, when, and whose account. Enough to prove the
-- acceptance; not a behavioural record of the person who made it.

create table if not exists public.legal_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  -- Versions are recorded SEPARATELY because the documents change separately.
  -- One combined string could not answer "did they accept THIS privacy
  -- notice?" after a terms-only revision.
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  -- Which surface collected it: the mandatory gate, or a re-acceptance prompt.
  source text not null default 'gate' check (source in ('gate', 'reacceptance')),
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_consent_receipts_user
  on public.legal_consent_receipts(user_id, accepted_at desc);

revoke all on table public.legal_consent_receipts from public, anon;
grant select, insert on table public.legal_consent_receipts to authenticated;
grant all on table public.legal_consent_receipts to service_role;

alter table public.legal_consent_receipts enable row level security;

drop policy if exists "Users read their own consent receipts"
  on public.legal_consent_receipts;
create policy "Users read their own consent receipts"
  on public.legal_consent_receipts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users record their own consent" on public.legal_consent_receipts;
create policy "Users record their own consent"
  on public.legal_consent_receipts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- NO UPDATE POLICY AND NO DELETE POLICY. Deliberately. Consent evidence that
-- can be edited by the party it protects is not evidence, and one that can be
-- deleted cannot answer a question asked next year. Erasure requests are
-- handled by the account-deletion path, which drops the row with the account.

comment on table public.legal_consent_receipts is
  'Append-only record of which document versions an account accepted, and when. No update or delete policy exists: a later acceptance is a new row, never an amendment to an earlier one.';
