-- Task 1.4: Misconception taxonomy and spaced repetition database tables.
-- Requirements: 4.1, 4.2, 4.7, 4.8, 5.1

create table misconceptions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  skill_id uuid references skills(id) on delete cascade,
  error_pattern jsonb not null,  -- {type: 'symbolic'|'regex'|'semantic', pattern: string, threshold?: number}
  classification text check (classification in ('repetition_confirmed', 'first_occurrence_actionable')),
  remediation_strategy text,
  example_errors text[],
  tenant_id uuid references tenants(id) on delete cascade,  -- NULL = platform-level
  created_by text,
  content_status text check (content_status in ('draft', 'pending_approval', 'validated')) default 'draft',
  created_at timestamptz default now()
);

create table student_misconceptions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references users(id) on delete cascade,
  misconception_id uuid references misconceptions(id) on delete cascade,
  occurrence_count int default 1,
  first_detected timestamptz default now(),
  last_detected timestamptz default now(),
  tenant_id uuid references tenants(id) on delete cascade
);

create table unmatched_errors (
  id uuid primary key default uuid_generate_v4(),
  student_id_anonymized text not null,  -- Hashed student ID for privacy
  skill_id uuid references skills(id) on delete cascade,
  problem_text text,
  student_response text,
  correct_answer text,
  timestamp timestamptz default now(),
  tenant_id uuid references tenants(id) on delete cascade,
  reviewed boolean default false,
  reviewed_by uuid references users(id)  -- Pedagogical_Lead
);

create table spaced_repetition_schedules (
  student_id uuid references users(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  next_review_date timestamptz not null,
  interval_days int not null,
  ease_factor numeric(3, 2) check (ease_factor >= 1.3 and ease_factor <= 2.5),
  consecutive_correct int default 0,
  tenant_id uuid references tenants(id) on delete cascade,
  primary key (student_id, skill_id)
);

create index idx_misconceptions_skill on misconceptions(skill_id);
create index idx_misconceptions_tenant on misconceptions(tenant_id);
create index idx_student_misconceptions_student on student_misconceptions(student_id, tenant_id);
create index idx_unmatched_errors_tenant on unmatched_errors(tenant_id, reviewed);

-- design.md specifies `WHERE next_review_date <= NOW()` here, but Postgres
-- requires partial-index predicates to be IMMUTABLE and NOW() is only
-- STABLE, so that literal DDL fails on both plain Postgres and Supabase.
-- A plain index on next_review_date serves the same "due reviews" query
-- pattern (`WHERE next_review_date <= $1 ORDER BY next_review_date`)
-- without the illegal predicate.
create index idx_spaced_rep_due on spaced_repetition_schedules(next_review_date);

alter table misconceptions enable row level security;
alter table student_misconceptions enable row level security;
alter table unmatched_errors enable row level security;
alter table spaced_repetition_schedules enable row level security;
