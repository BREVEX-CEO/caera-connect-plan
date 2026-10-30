-- Minimal stand-in for the Supabase platform objects the migrations reference.
-- Disposable local test databases only; never applied to a hosted project.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
                           'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;
ALTER ROLE service_role BYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET search_path = "$user", public, extensions', current_database()); END $$;
SET search_path = "$user", public, extensions;
GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, phone text, phone_confirmed_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}', raw_user_meta_data jsonb DEFAULT '{}',
  is_anonymous boolean DEFAULT false, is_sso_user boolean DEFAULT false, banned_until timestamptz,
  last_sign_in_at timestamptz, deleted_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE CASCADE, aal text DEFAULT 'aal1',
  factor_id uuid, not_after timestamptz, refreshed_at timestamp, user_agent text, ip inet, tag text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users ON DELETE CASCADE, friendly_name text,
  factor_type text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.mfa_amr_claims (
  id uuid PRIMARY KEY, session_id uuid REFERENCES auth.sessions ON DELETE CASCADE,
  authentication_method text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.refresh_tokens (
  id bigserial PRIMARY KEY, token text, user_id text, session_id uuid, revoked boolean,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  provider text, provider_id text, identity_data jsonb, email text
);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role' $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text UNIQUE, owner uuid, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets, name text,
  owner uuid, owner_id text, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;

CREATE PUBLICATION supabase_realtime;
