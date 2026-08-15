-- Test-only stand-in for Supabase's built-in `auth` schema.
--
-- On a real Supabase project, `auth.uid()` is provided by the platform and
-- reads the `sub` claim off the JWT that PostgREST attaches to each request
-- via `SET LOCAL request.jwt.claims`. This file recreates just enough of
-- that surface against a plain local Postgres instance so the RLS policies
-- in supabase/migrations/*_rls_policies.sql can be exercised by
-- tests/db/rls/**. It is never applied to a real Supabase database.
create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;
