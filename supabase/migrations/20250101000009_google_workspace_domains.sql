-- Task 3.3: Google Classroom API authentication flow — tenant resolution.
-- Requirements: 1.3, 1.4, 1.5
--
-- A Google Classroom launch's ID token carries an `hd` (hosted domain)
-- claim for Google Workspace accounts (e.g. "teneo.school"). This maps
-- that domain to a tenant — the Google-side analogue of lms_configs'
-- (issuer, deployment_id) mapping for LTI.
create table google_workspace_domains (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain text not null unique,
  created_at timestamptz default now()
);

create index idx_google_workspace_domains_tenant on google_workspace_domains(tenant_id);

alter table google_workspace_domains enable row level security;

-- Same reasoning as lms_configs: only Admins manage their own school's
-- mapping; the pre-session Google launch/callback handlers read this with
-- the service-role client, bypassing RLS.
create policy "admins_tenant_access_google_workspace_domains"
on google_workspace_domains for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);
