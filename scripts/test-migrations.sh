#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/bootstrap_supabase.sql
for migration in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/rls_cross_user.sql
