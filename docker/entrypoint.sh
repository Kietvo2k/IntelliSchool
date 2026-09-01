#!/bin/sh
set -eu
mkdir -p /data/files /data/mail
if id smartpath >/dev/null 2>&1; then
  chown -R smartpath:smartpath /data || true
fi

wait_for_db() {
  i=0
  while [ "$i" -lt 60 ]; do
    if node -e "import('pg').then(async ({default: pg}) => { const c = new pg.Client({ connectionString: process.env.PLATFORM_CONTROL_DATABASE_URL }); await c.connect(); await c.end(); }).catch(() => process.exit(1))"; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "Postgres chưa sẵn sàng sau 120 giây."
  exit 1
}

run_as_app() {
  if command -v su-exec >/dev/null 2>&1 && id smartpath >/dev/null 2>&1; then
    exec su-exec smartpath "$@"
  fi
  exec "$@"
}

if [ "${DATABASE_BACKEND:-local}" != "supabase" ]; then
  wait_for_db
fi

if [ "${TEST_FORCE_SEED:-false}" = "true" ]; then
  if command -v su-exec >/dev/null 2>&1 && id smartpath >/dev/null 2>&1; then
    su-exec smartpath node apps/api/dist/seed-pilot.js
  else
    node apps/api/dist/seed-pilot.js
  fi
elif [ "${SEED_ON_EMPTY:-true}" = "true" ]; then
  if command -v su-exec >/dev/null 2>&1 && id smartpath >/dev/null 2>&1; then
    NODE_ENV=development su-exec smartpath node apps/api/dist/seed-pilot.js --if-empty
  else
    NODE_ENV=development node apps/api/dist/seed-pilot.js --if-empty
  fi
fi

run_as_app node apps/api/dist/server.js
