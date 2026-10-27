#!/bin/bash
# Starts a throwaway Postgres + PostgREST + fake auth that behave like the parts
# of Supabase ApexPrep uses. Data lives in supabase/test/.data and is wiped on
# each start. Ports: Postgres 54329, PostgREST 54330, API (auth + rest) 54321.
set -euo pipefail
cd "$(dirname "$0")"
PG=/opt/homebrew/opt/postgresql@17/bin
export JWT_SECRET="apexprep-local-test-secret-0123456789abcdef"
./stop-local.sh >/dev/null 2>&1 || true
rm -rf .data && mkdir -p .data
"$PG/initdb" -D .data/pg -U postgres --auth=trust >/dev/null
"$PG/pg_ctl" -D .data/pg -o "-p 54329 -k /tmp" -l .data/pg.log start >/dev/null
for i in $(seq 1 50); do "$PG/pg_isready" -h localhost -p 54329 >/dev/null 2>&1 && break; sleep 0.2; done
"$PG/psql" -q -h localhost -p 54329 -U postgres -v ON_ERROR_STOP=1 -f supabase-stubs.sql
"$PG/psql" -q -h localhost -p 54329 -U postgres -v ON_ERROR_STOP=1 -f ../schema.sql
cat > .data/postgrest.conf <<CONF
db-uri = "postgres://authenticator:authenticator@localhost:54329/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 54330
CONF
nohup postgrest .data/postgrest.conf > .data/postgrest.log 2>&1 &
echo $! > .data/postgrest.pid
nohup node fake-auth.mjs > .data/auth.log 2>&1 &
echo $! > .data/auth.pid
for i in $(seq 1 50); do curl -s localhost:54321/health >/dev/null 2>&1 && curl -s localhost:54330/ >/dev/null 2>&1 && break; sleep 0.2; done
echo "local Supabase stand-in ready on http://localhost:54321"
