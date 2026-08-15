-- Helper functions used by the RLS policies in the next migration.
--
-- A policy on `users` (or `user_roles`) cannot subquery that same table
-- directly in its USING clause — Postgres re-evaluates RLS on the inner
-- subquery too, which re-enters the same policy and recurses infinitely
-- ("infinite recursion detected in policy for relation ..."). The standard
-- fix (and the one Supabase itself documents) is a SECURITY DEFINER
-- function: it runs as its owner (the table owner, who — like Supabase's
-- `postgres`/`service_role` — is exempt from RLS), so the lookup inside it
-- never re-triggers policy evaluation. Every policy below (not just the
-- ones on `users`/`user_roles`) uses these for consistency.
create or replace function current_tenant_id() returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tenant_id from users where id = auth.uid()
$$;

create or replace function has_role(check_role text) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = check_role
  )
$$;
