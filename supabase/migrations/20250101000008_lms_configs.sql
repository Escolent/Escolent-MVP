-- Task 3.1: LMS configuration per tenant, for LTI 1.3 launch verification.
-- Requirements: 1.1, 1.2, 1.4, 1.5, 1.6
--
-- An incoming LTI launch's id_token carries only `iss` (the Platform's
-- issuer URL) and a deployment_id claim — everything else needed to trust
-- it (which tenant it belongs to, the Platform's public-key JWKS URL to
-- verify its signature, the expected client_id/audience) has to already be
-- registered here, keyed by (issuer, deployment_id), before the launch
-- arrives.
create table lms_configs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lms_type text not null check (lms_type in ('canvas', 'moodle')),
  issuer text not null,          -- LTI 'iss' claim — the Platform's issuer URL
  client_id text not null,       -- LTI client_id, verified against the JWT's 'aud'
  deployment_id text not null,   -- LTI deployment_id claim
  auth_login_url text not null,  -- Platform's OIDC authorization endpoint (for /api/auth/lti/login)
  auth_token_url text,           -- Platform's OAuth2 token endpoint, for LTI Advantage services (not needed for launch verification itself)
  jwks_url text not null,        -- Platform's public JWKS endpoint, used to verify the launch id_token's signature
  created_at timestamptz default now()
);

create unique index idx_lms_configs_issuer_deployment on lms_configs(issuer, deployment_id);
create index idx_lms_configs_tenant on lms_configs(tenant_id);

alter table lms_configs enable row level security;

-- Only Admins manage their own school's LMS configuration (future settings
-- UI). The LTI login/launch route handlers themselves run pre-session —
-- before there's any auth.uid() for RLS to key off — so they read this
-- table with the service-role client, bypassing RLS entirely, same as
-- every other pre-auth lookup.
create policy "admins_tenant_access_lms_configs"
on lms_configs for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);
