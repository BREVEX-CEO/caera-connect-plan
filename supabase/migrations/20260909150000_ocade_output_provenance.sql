-- Provenance on outputs, so artifacts stop being a second store.
--
-- OCADE kept artifacts — the things it produced, with the record of what made
-- them — in `localStorage` under `ocade.artifacts.v1`, while `ocade_outputs`
-- held the same class of thing in the account. Two stores for one idea is the
-- defect: an artifact made on a laptop was invisible on a phone, was outside
-- every export and deletion path the account offers, and disappeared when
-- somebody cleared their browser. `PLAN.md` Phase 2 asks for one persistent
-- authority for artifacts, versions AND provenance.
--
-- WHY PROVENANCE IS COLUMNS RATHER THAN A JSON BLOB. `verified` is the field
-- the whole idea rests on: an artifact produced by a step that could not
-- confirm its own result must be permanently distinguishable from one that was
-- checked, and the distinction is invisible in the content. A column can be
-- constrained, indexed and queried; a key inside a JSON document can be absent,
-- misspelled or the string "false" and nothing notices.
--
-- `context` IS json, deliberately: it is a snapshot of the conversation, the
-- message and the files an artifact was made from, it is read as a whole or not
-- at all, and it is never filtered on.
--
-- SAFE ON A POPULATED TABLE. `produced_by` is nullable because rows written
-- before provenance existed cannot have one, and inventing a producer for them
-- would be the exact lie this table exists to prevent. Every new row is
-- required to carry one by `createOutput`, and a row without one is rendered as
-- an unconfirmed artifact of unknown origin.

BEGIN;

ALTER TABLE public.ocade_outputs
  ADD COLUMN IF NOT EXISTS produced_by TEXT CHECK (length(produced_by) BETWEEN 1 AND 300),
  -- NOT NULL with a false default: an artifact whose verification state is
  -- unknown is treated as unverified, never as verified. Getting this backwards
  -- is how an unchecked result becomes indistinguishable from a checked one.
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence TEXT CHECK (length(evidence) <= 2000),
  ADD COLUMN IF NOT EXISTS context JSONB;

COMMENT ON COLUMN public.ocade_outputs.produced_by IS
  'The surface or pack that produced this output, e.g. "ocade.data:data.summarise". Null only on rows written before provenance was recorded.';
COMMENT ON COLUMN public.ocade_outputs.verified IS
  'Whether the producing step confirmed its own result. A permanent property of the output, rendered every time it is listed.';
COMMENT ON COLUMN public.ocade_outputs.evidence IS
  'The producer''s own evidence line, stored verbatim.';
COMMENT ON COLUMN public.ocade_outputs.context IS
  'Snapshot of the conversation, message, project and files this output was made from. Read whole; never filtered on.';

-- The Artifacts screen lists newest first and separates confirmed from
-- unconfirmed. Without this the filter is a sequential scan over every output
-- the account has ever produced.
CREATE INDEX IF NOT EXISTS ocade_outputs_user_verified_idx
  ON public.ocade_outputs (user_id, verified, created_at DESC);

COMMIT;
