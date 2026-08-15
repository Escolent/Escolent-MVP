-- Task 1.6: Row Level Security (RLS) policies for every tenant-scoped table.
-- Requirements: 21.1, 21.2, 21.3, 21.4
--
-- Baseline shape, applied consistently across the tenant-scoped tables:
--   * Student:           full access to their own rows only.
--   * Teacher:           read access scoped to their own tenant.
--   * Admin:              full (read/write) access scoped to their own tenant.
--   * Pedagogical_Lead:  NOT tenant-scoped; explicit cross-tenant policies
--                        below, limited to the tables it actually curates
--                        (misconceptions, unmatched_errors) per design.md's
--                        RLS Policy Special Case.
--
-- `tenant_id` foreign keys inherited from design.md are nullable throughout
-- (platform-level rows use NULL); a row with an unexpected NULL tenant_id
-- simply matches no tenant-scoped policy rather than leaking across
-- tenants, since `tenant_id = <uuid>` is never true when tenant_id is NULL.

-- ─────────────────────────────────────────────────────────────────────────
-- tenants
-- ─────────────────────────────────────────────────────────────────────────
-- Every authenticated user may see their own school's tenant row (name,
-- billing status, etc.); nothing else. Billing/feature configuration
-- (Requirement 21.4) is a Platform-operator action performed with the
-- service role, not modeled as a client-facing RLS policy.
create policy "users_read_own_tenant"
on tenants for select
using (
  auth.uid() is not null
  and id = current_tenant_id()
);

-- ─────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────
create policy "users_read_own_profile"
on users for select
using (id = auth.uid());

create policy "users_update_own_profile"
on users for update
using (id = auth.uid());

create policy "teachers_read_tenant_users"
on users for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_users"
on users for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- user_roles
-- ─────────────────────────────────────────────────────────────────────────
create policy "users_read_own_roles"
on user_roles for select
using (user_id = auth.uid());

create policy "admins_tenant_access_user_roles"
on user_roles for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- skills — platform-level (tenant_id NULL) or tenant-specific; curated by
-- Pedagogical_Lead (see design.md Section 13 special case, mirrored here).
-- ─────────────────────────────────────────────────────────────────────────
create policy "authenticated_read_skills"
on skills for select
using (
  auth.uid() is not null
  and (tenant_id is null or tenant_id = current_tenant_id())
);

create policy "pedagogical_lead_write_skills"
on skills for insert
with check (
  has_role('pedagogical_lead')
);

create policy "pedagogical_lead_update_skills"
on skills for update
using (
  has_role('pedagogical_lead')
);

-- See the equivalent comment on misconceptions below: without cross-tenant
-- SELECT, INSERT/UPDATE ... RETURNING on a tenant-scoped skill would fail
-- RLS's implicit re-check of the row against SELECT policies.
create policy "pedagogical_lead_read_all_skills"
on skills for select
using (
  has_role('pedagogical_lead')
);

-- ─────────────────────────────────────────────────────────────────────────
-- mastery_states — reproduced verbatim from design.md's worked example.
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_own_mastery"
on mastery_states for all
using (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_read_tenant_mastery"
on mastery_states for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_mastery"
on mastery_states for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- misconceptions — platform-level or tenant-specific; curated by
-- Pedagogical_Lead cross-tenant (design.md RLS Policy Special Case,
-- reproduced verbatim).
-- ─────────────────────────────────────────────────────────────────────────
create policy "authenticated_read_misconceptions"
on misconceptions for select
using (
  auth.uid() is not null
  and (tenant_id is null or tenant_id = current_tenant_id())
);

-- Pedagogical_Lead can INSERT/UPDATE misconceptions across all tenants
create policy "pedagogical_lead_write_misconceptions"
on misconceptions for insert
with check (
  has_role('pedagogical_lead')
);

create policy "pedagogical_lead_update_misconceptions"
on misconceptions for update
using (
  has_role('pedagogical_lead')
);

-- Cross-tenant SELECT for Pedagogical_Lead is not shown in design.md's
-- special-case excerpt, but is required in practice: curating the taxonomy
-- means browsing it across every school, and Postgres additionally
-- re-checks SELECT policies for the row produced by INSERT/UPDATE ...
-- RETURNING, so without this the write policies above would raise
-- "new row violates row-level security policy" on any tenant-scoped row.
create policy "pedagogical_lead_read_all_misconceptions"
on misconceptions for select
using (
  has_role('pedagogical_lead')
);

-- ─────────────────────────────────────────────────────────────────────────
-- student_misconceptions
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_own_misconceptions"
on student_misconceptions for all
using (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_read_tenant_misconceptions"
on student_misconceptions for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_student_misconceptions"
on student_misconceptions for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- unmatched_errors — no direct student FK (student identity is hashed);
-- Pedagogical_Lead cross-tenant READ is design.md's explicit special case,
-- reproduced verbatim below. The cross-tenant UPDATE policy is this
-- migration's own addition (not shown in design.md's excerpt) so the
-- Pedagogical_Lead "mark reviewed" / curation workflow (task 7.6) has
-- somewhere to actually write; scoped to the same role check as the READ
-- policy right above it, so it grants no broader access than that intent.
-- ─────────────────────────────────────────────────────────────────────────
-- Pedagogical_Lead can read unmatched_errors across ALL tenants
create policy "pedagogical_lead_read_errors"
on unmatched_errors for select
using (
  has_role('pedagogical_lead')
);

create policy "pedagogical_lead_update_errors"
on unmatched_errors for update
using (
  has_role('pedagogical_lead')
);

create policy "admins_read_tenant_unmatched_errors"
on unmatched_errors for select
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- spaced_repetition_schedules
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_own_spaced_repetition"
on spaced_repetition_schedules for all
using (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_read_tenant_spaced_repetition"
on spaced_repetition_schedules for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_spaced_repetition"
on spaced_repetition_schedules for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- spaces — owned and managed by the Teacher who created them
-- (POST/PUT /api/teacher/spaces), so Teacher gets full access to their own
-- Spaces rather than just tenant-scoped read.
-- ─────────────────────────────────────────────────────────────────────────
create policy "teachers_manage_own_spaces"
on spaces for all
using (
  teacher_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "students_read_enrolled_spaces"
on spaces for select
using (
  id in (select space_id from space_enrollments where student_id = auth.uid())
);

create policy "admins_tenant_access_spaces"
on spaces for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- space_enrollments
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_read_own_enrollments"
on space_enrollments for select
using (student_id = auth.uid());

create policy "teachers_manage_tenant_enrollments"
on space_enrollments for all
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_enrollments"
on space_enrollments for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- sessions
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_own_sessions"
on sessions for all
using (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_read_tenant_sessions"
on sessions for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_sessions"
on sessions for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- mastery_overrides — written by the Teacher performing the override
-- (POST /api/teacher/override); Students are not given direct access since
-- the effect is surfaced to them via mastery_states, not this audit table.
-- ─────────────────────────────────────────────────────────────────────────
create policy "teachers_create_own_overrides"
on mastery_overrides for insert
with check (
  teacher_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_read_tenant_overrides"
on mastery_overrides for select
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_overrides"
on mastery_overrides for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- distress_escalations
-- ─────────────────────────────────────────────────────────────────────────
create policy "students_own_escalations"
on distress_escalations for select
using (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "students_create_own_escalations"
on distress_escalations for insert
with check (
  student_id = auth.uid()
  and tenant_id = current_tenant_id()
);

create policy "teachers_manage_tenant_escalations"
on distress_escalations for all
using (
  tenant_id = current_tenant_id()
  and has_role('teacher')
);

create policy "admins_tenant_access_escalations"
on distress_escalations for all
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);

-- ─────────────────────────────────────────────────────────────────────────
-- audit_logs — POPIA compliance trail (Requirement 29). Deliberately
-- write-only from the system's perspective: no role gets an INSERT/UPDATE/
-- DELETE policy here, so entries can only be written with the service-role
-- key (bypassing RLS) from trusted server code, never forged by a client.
-- Admin gets read access for the compliance export endpoint.
-- ─────────────────────────────────────────────────────────────────────────
create policy "admins_read_tenant_audit_logs"
on audit_logs for select
using (
  tenant_id = current_tenant_id()
  and has_role('admin')
);
