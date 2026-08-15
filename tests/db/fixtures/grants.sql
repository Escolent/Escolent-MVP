-- Test-only grants for the role that stands in for Supabase's built-in
-- `authenticated` role. On a real Supabase project these grants are
-- managed by the platform; here we replicate the effect (schema USAGE +
-- table-level DML, with actual row access still gated by RLS policies)
-- so tests/db/rls/** can prove policies work under a non-owner role that
-- cannot bypass RLS the way the migration-owner role does.
grant usage on schema public to escolent_app_user;
grant usage on schema auth to escolent_app_user;
grant execute on function auth.uid() to escolent_app_user;
grant select, insert, update, delete on all tables in schema public to escolent_app_user;
