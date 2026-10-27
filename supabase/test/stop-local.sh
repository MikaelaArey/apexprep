#!/bin/bash
cd "$(dirname "$0")"
for f in .data/postgrest.pid .data/auth.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null; rm -f "$f"; done
[ -d .data/pg ] && /opt/homebrew/opt/postgresql@17/bin/pg_ctl -D .data/pg stop -m fast >/dev/null 2>&1
echo stopped
