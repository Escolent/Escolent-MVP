-- Task 1.2: Multi-tenancy foundation tables.
-- Requirements: 21.1, 21.2, 21.3, 1.1, 1.2, 1A.1
--
-- RLS is switched ON for every tenant-scoped table as it is created; the
-- POLICY objects that give the switch teeth are defined together in
-- 20250101000005_rls_policies.sql (task 1.6) once every table they
-- reference exists.

create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,  -- URL-safe identifier
  billing_status text check (billing_status in ('trial', 'active', 'suspended')),
  created_at timestamptz default now()
);

-- Users (Students, Teachers, Admins, Pedagogical_Lead)
create table users (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,  -- NULL for Pedagogical_Lead
  email text unique not null,
  full_name text,
  lms_user_id text,  -- LTI user ID from Canvas/Moodle
  google_classroom_id text,
  created_at timestamptz default now()
);

create table user_roles (
  user_id uuid references users(id) on delete cascade,
  role text check (role in ('student', 'teacher', 'admin', 'pedagogical_lead')),
  tenant_id uuid references tenants(id) on delete cascade,  -- NULL for pedagogical_lead
  primary key (user_id, role)
);

-- Every tenant-scoped query (including every RLS policy below) filters by
-- tenant_id and/or role, so these are on the hot path from day one.
create index idx_users_tenant on users(tenant_id);
create index idx_user_roles_tenant on user_roles(tenant_id);

alter table tenants enable row level security;
alter table users enable row level security;
alter table user_roles enable row level security;
