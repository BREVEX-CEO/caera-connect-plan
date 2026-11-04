-- Rollback of 20261101201849_preserve_complete_jarvis_objectives.sql: restores what it replaced and removes what it added.
-- Data in removed columns is lost; nothing else changes.
BEGIN;


ALTER TABLE public.jarvis_tasks DROP CONSTRAINT jarvis_tasks_title_check;
-- NOT VALID: titles longer than 200 characters written meanwhile are kept.
ALTER TABLE public.jarvis_tasks ADD CONSTRAINT jarvis_tasks_title_check
  CHECK (length(btrim(title)) BETWEEN 1 AND 200) NOT VALID;

COMMIT;
