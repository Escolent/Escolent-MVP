# Database migrations

These SQL files are the source of truth for the Escolent schema (task 1 of
`tasks.md`: project and database setup). They're written to be applied with
the [Supabase CLI](https://supabase.com/docs/guides/cli) against a real
Supabase project, in filename order:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or, for local development against the Supabase CLI's local stack:

```bash
supabase start
supabase db reset   # applies every migration in this directory, in order
```

## What's in here

| File | Task | Contents |
| --- | --- | --- |
| `20250101000000_extensions.sql` | 1.2 | `uuid-ossp`, `pgcrypto` |
| `20250101000001_multi_tenancy_foundation.sql` | 1.2 | `tenants`, `users`, `user_roles` |
| `20250101000002_skill_graph_and_mastery.sql` | 1.3 | `skills`, `mastery_states` |
| `20250101000003_misconceptions_and_spaced_repetition.sql` | 1.4 | `misconceptions`, `student_misconceptions`, `unmatched_errors`, `spaced_repetition_schedules` |
| `20250101000004_sessions_spaces_and_escalations.sql` | 1.5 | `spaces`, `space_enrollments`, `sessions`, `mastery_overrides`, `distress_escalations`, `audit_logs` |
| `20250101000005_rls_helper_functions.sql` | 1.6 | `current_tenant_id()`, `has_role()` |
| `20250101000006_rls_policies.sql` | 1.6 | RLS policies for every table above |

Every tenant-scoped table has Row Level Security **enabled** in the
migration that creates it; the actual `POLICY` objects live together in
`20250101000006_rls_policies.sql` since several of them (the
Pedagogical_Lead cross-tenant policies in particular) reference tables
created across multiple earlier migrations.

## Two deliberate departures from design.md

1. **`spaces` is created before `sessions`.** design.md documents `sessions`
   first, but `sessions.space_id` references `spaces(id)` — Postgres can't
   create that foreign key before the referenced table exists, so the
   creation order here is flipped. The column definitions themselves are
   unchanged.
2. **`idx_spaced_rep_due` drops the `WHERE next_review_date <= NOW()`
   predicate.** Postgres requires partial-index predicates to be
   `IMMUTABLE`, and `NOW()` is only `STABLE` — that literal DDL from
   design.md fails on both plain Postgres and a real Supabase project. A
   plain index on `next_review_date` supports the same
   `WHERE next_review_date <= $1 ORDER BY next_review_date` query pattern
   without the illegal predicate.

## `current_tenant_id()` / `has_role()`

A policy on `users` (or `user_roles`) can't subquery that same table in its
own `USING` clause — Postgres re-evaluates RLS on the inner subquery too,
which re-enters the same policy and recurses infinitely ("infinite
recursion detected in policy for relation ..."). `20250101000005` defines
two `SECURITY DEFINER` helper functions that every policy uses (not just
the ones on `users`/`user_roles`, for consistency) to sidestep this.

## Testing these migrations

`tests/db/**` applies this exact migration set to a real local Postgres
database (not a mock) and asserts on the actual schema and actual RLS
enforcement. See `../../scripts/db/setup-local-test-db.sh` and the root
`README.md` for how to run it. That harness is local-only tooling — it has
no relationship to the Supabase project these migrations are meant to ship
to.
