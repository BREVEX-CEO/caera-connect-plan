BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ocade_library_items TO anon;
GRANT UPDATE ON TABLE public.activity_log TO authenticated;
COMMIT;
