#!/usr/bin/env bash
#
# Runs the RLS assertions in supabase/tests against a throwaway database.
#
# Default target is the local Supabase stack (`supabase start`), whose Postgres
# already provides auth, storage and the anon/authenticated roles:
#
#   ./scripts/run-rls-tests.sh
#
# Against a bare Postgres with no Supabase around it, pass --shim to install a
# minimal stand-in for those schemas first:
#
#   DATABASE_URL=postgresql://... ./scripts/run-rls-tests.sh --shim
#
# The suite writes test rows, so point it at a scratch database -- never at a
# database with real tours in it.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
USE_SHIM=false

for arg in "$@"; do
  case "$arg" in
    --shim) USE_SHIM=true ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

psql_run() {
  psql "$DATABASE_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"
}

if ! psql_run -c 'select 1' >/dev/null 2>&1; then
  echo "Cannot reach $DATABASE_URL." >&2
  echo "Start the local stack with \`npx supabase start\`, or set DATABASE_URL." >&2
  exit 1
fi

echo "Resetting public schema on $DATABASE_URL"
psql_run -c 'drop schema if exists public cascade; create schema public;' >/dev/null

if [ "$USE_SHIM" = true ]; then
  echo "Installing Supabase shim (auth, storage, roles)"
  psql_run -c 'drop schema if exists auth cascade; drop schema if exists storage cascade;' >/dev/null
  psql_run -f "$ROOT/supabase/tests/00_supabase_shim.sql" >/dev/null
else
  # The local stack keeps auth.users across resets; the suite seeds its own.
  psql_run -c "delete from auth.users where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444');" >/dev/null
  psql_run -c 'grant usage on schema public to anon, authenticated, service_role;' >/dev/null
fi

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  psql_run -f "$migration" >/dev/null
done

echo
psql_run -f "$ROOT/supabase/tests/10_rls_tests.sql" 2>&1 \
  | sed -E 's|^psql:[^ ]+ ||' \
  | grep -E 'PASS|FAIL|ERROR|ALL TESTS'
