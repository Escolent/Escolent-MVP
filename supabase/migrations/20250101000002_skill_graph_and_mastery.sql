-- Task 1.3: Skill graph and mastery state database tables.
-- Requirements: 2.1, 2.2, 2.5, 3.2, 3.3

create table skills (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  skill_type text check (skill_type in ('procedural', 'conceptual')),
  prerequisite_ids uuid[] default '{}',  -- Array of prerequisite skill IDs
  tenant_id uuid references tenants(id) on delete cascade,  -- NULL = platform-level
  created_by text,  -- 'platform' | 'pedagogical_lead' | teacher user_id
  evaluation_strategy text check (evaluation_strategy in ('exact_match', 'symbolic_equivalence', 'rubric_llm')) default 'exact_match',
  rubric jsonb,  -- [{criterion, weight}], required when evaluation_strategy = 'rubric_llm'
  content_status text check (content_status in ('draft', 'pending_approval', 'validated')) default 'draft',
  coverage_status text check (coverage_status in ('rich', 'thin', 'gap', 'not_assessed')) default 'not_assessed',
  created_at timestamptz default now()
);

create index idx_skills_tenant on skills(tenant_id);
create index idx_skills_prerequisites on skills using gin(prerequisite_ids);

create table mastery_states (
  student_id uuid references users(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  probability numeric(4, 3) check (probability >= 0 and probability <= 1),  -- 0.000 to 1.000
  last_updated timestamptz default now(),
  response_history jsonb default '[]',  -- Last 10 responses [{is_correct, timestamp, difficulty, response_time_ms}]
  is_tentatively_mastered boolean default false,
  is_durably_mastered boolean default false,
  mastered_session_count int default 0,
  tenant_id uuid references tenants(id) on delete cascade,
  primary key (student_id, skill_id)
);

create index idx_mastery_student on mastery_states(student_id, tenant_id);
create index idx_mastery_skill on mastery_states(skill_id, tenant_id);

alter table skills enable row level security;
alter table mastery_states enable row level security;
