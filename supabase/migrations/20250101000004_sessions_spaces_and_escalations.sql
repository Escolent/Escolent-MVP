-- Task 1.5: Session, space, and escalation database tables.
-- Requirements: 7.7, 9.1, 9.2, 11.1, 11.2, 18.5, 29.1
--
-- design.md documents `sessions` before `spaces`, but sessions.space_id
-- references spaces(id), so `spaces` (and space_enrollments, which is
-- purely additive) is created first here. Column-for-column content is
-- otherwise unchanged from design.md.

create table spaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  teacher_id uuid references users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  included_skill_ids uuid[] not null,
  difficulty_range int[] check (array_length(difficulty_range, 1) = 2),  -- [min, max]
  classroom_pacing_mode boolean default false,
  content_summary_generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table space_enrollments (
  space_id uuid references spaces(id) on delete cascade,
  student_id uuid references users(id) on delete cascade,
  enrolled_at timestamptz default now(),
  tenant_id uuid references tenants(id) on delete cascade,
  primary key (space_id, student_id)
);

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references users(id) on delete cascade,
  space_id uuid references spaces(id) on delete cascade,
  start_time timestamptz default now(),
  last_activity timestamptz default now(),
  status text check (status in ('active', 'paused', 'completed', 'interrupted', 'expired')),
  problems_completed int default 0,
  problems jsonb default '[]',  -- Array of ProblemInstance
  tenant_id uuid references tenants(id) on delete cascade
);

create index idx_sessions_student_active on sessions(student_id, status, tenant_id)
  where status in ('active', 'interrupted');

create table mastery_overrides (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references users(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  teacher_id uuid references users(id) on delete cascade,
  reason text not null check (length(reason) >= 20 and length(reason) <= 200),
  override_type text check (override_type in ('mark_mastered', 'reset_mastery')),
  applied_at timestamptz default now(),
  tenant_id uuid references tenants(id) on delete cascade
);

create table distress_escalations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  response_text text not null,
  detection_method text check (detection_method in ('pattern', 'llm')),
  confidence numeric(3, 2),
  created_at timestamptz default now(),
  acknowledged_by uuid references users(id),
  acknowledged_at timestamptz,
  backup_notified boolean default false,
  tenant_id uuid references tenants(id) on delete cascade
);

create index idx_escalations_unacknowledged on distress_escalations(tenant_id, created_at)
  where acknowledged_at is null;

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  action text not null,  -- 'read', 'update', 'delete', 'export'
  table_name text,
  record_id uuid,
  changed_fields jsonb,
  timestamp timestamptz default now(),
  tenant_id uuid references tenants(id) on delete cascade
);

create index idx_audit_logs_user on audit_logs(user_id, timestamp);
create index idx_audit_logs_tenant on audit_logs(tenant_id, timestamp);

alter table spaces enable row level security;
alter table space_enrollments enable row level security;
alter table sessions enable row level security;
alter table mastery_overrides enable row level security;
alter table distress_escalations enable row level security;
alter table audit_logs enable row level security;
