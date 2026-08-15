# Escolent MVP

Adaptive learning platform (Next.js 14 PWA + Supabase) that tracks mastery,
not completion. See `requirements.md`, `design.md`, and `tasks.md` for the
full spec; this README covers day-to-day project setup.

## Prerequisites

- Node.js 20+
- A Supabase project (for real development/deploys)
- PostgreSQL 16+ locally, **only** if you want to run the database test
  suite (`npm run test:db`) — the app itself talks to Supabase, not to this
  local database.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL/keys
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (also generates the service worker) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Jest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run db:test:setup` | One-time local Postgres role/database setup for `npm run test:db` |
| `npm run test:db` | Applies `supabase/migrations/**` to a local Postgres instance and runs the schema/RLS test suite in `tests/db/**` |

## Database

The schema lives in `supabase/migrations/` and is applied to your Supabase
project via the Supabase CLI (`supabase db push`) — see
`supabase/migrations/README.md` for the full migration list and two
deliberate corrections to `design.md`'s literal SQL.

To verify the schema and Row Level Security policies against a real
Postgres instance (not a mock) before pushing:

```bash
npm run db:test:setup   # once per machine
npm run test:db
```

This spins up a local-only Postgres role/database, applies every migration
in order, and runs `tests/db/schema/**` (table/column/constraint/index
assertions) and `tests/db/rls/**` (actual query enforcement, run as a
non-owner role subject to RLS — see `tests/db/helpers/testDb.ts`). It has no
relationship to your actual Supabase project.

## PWA

Service worker generation (Workbox, via `@ducanh2912/next-pwa`) is enabled
only in production builds (`npm run build && npm run start`) — it's
disabled in `npm run dev` to avoid caching interfering with hot reload.

## Project structure

```
src/
  app/                 Next.js App Router pages and API routes
  lib/supabase/        Supabase client factories (browser, server, service-role, middleware)
supabase/
  migrations/          Database schema (source of truth) + how to apply it
tests/
  unit/                Jest unit tests (no external services required)
  db/                  Schema + RLS tests against a real local Postgres (see above)
scripts/db/            One-time local test-database setup
```
