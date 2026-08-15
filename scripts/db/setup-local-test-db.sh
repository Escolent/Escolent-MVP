#!/usr/bin/env bash
# One-time (idempotent) local setup for the DB-level test suite
# (tests/db/**). Creates a Postgres role + database used ONLY for running
# migrations against a real local Postgres so schema/RLS tests can exercise
# real DDL and real row-level security - it has no relationship to the
# actual Supabase project used for staging/production (see
# supabase/migrations/README.md for that).
#
# Requires a local PostgreSQL 16+ server. Safe to re-run.
set -euo pipefail

PSQL_SUPERUSER_CMD=(psql -v ON_ERROR_STOP=1)
if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
  RUN_AS_POSTGRES=(sudo -u postgres "${PSQL_SUPERUSER_CMD[@]}")
elif [ "$(id -un)" = "postgres" ]; then
  RUN_AS_POSTGRES=("${PSQL_SUPERUSER_CMD[@]}")
else
  RUN_AS_POSTGRES=(su postgres -c "$(printf '%q ' "${PSQL_SUPERUSER_CMD[@]}")")
fi

"${RUN_AS_POSTGRES[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'escolent') THEN
    CREATE ROLE escolent LOGIN PASSWORD 'escolent_dev_pw';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'escolent_app_user') THEN
    CREATE ROLE escolent_app_user LOGIN PASSWORD 'escolent_app_pw';
  END IF;
END $$;

ALTER ROLE escolent NOSUPERUSER CREATEDB;
SQL

if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
  DBEXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'escolent_test'")
else
  DBEXISTS=$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname = 'escolent_test'\"")
fi

if [ "$DBEXISTS" != "1" ]; then
  if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
    sudo -u postgres createdb -O escolent escolent_test
  else
    su postgres -c "createdb -O escolent escolent_test"
  fi
fi

if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then
  sudo -u postgres psql -d escolent_test -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE escolent_test TO escolent_app_user;"
else
  su postgres -c "psql -d escolent_test -v ON_ERROR_STOP=1 -c \"GRANT CONNECT ON DATABASE escolent_test TO escolent_app_user;\""
fi

echo "Local test DB ready: escolent_test (owner: escolent, app role: escolent_app_user)"
