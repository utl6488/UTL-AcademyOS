#!/usr/bin/env bash
# One-shot local dev bootstrap for UTL-AcademyOS.
#
# Boots Docker services, waits for Postgres, applies extensions, copies env
# templates on first run, syncs the Prisma schema, seeds the DB, then runs
# backend + frontend concurrently with prefixed logs.
# Ctrl+C shuts everything down cleanly; Docker containers keep running so the
# next boot is fast (use `make dev-down` or `--stop-docker` to stop them).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/docker-compose.dev.yml"
COMPOSE="docker compose -f $COMPOSE_FILE"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

# --- flags ------------------------------------------------------------------
SKIP_DOCKER=0
SKIP_MIGRATE=0
SKIP_SEED=0
STOP_DOCKER_ON_EXIT=0

for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-seed) SKIP_SEED=1 ;;
    --stop-docker) STOP_DOCKER_ON_EXIT=1 ;;
    -h|--help)
      cat <<EOF
Usage: scripts/dev.sh [flags]

  --skip-docker     Don't touch docker compose (assume services already up)
  --skip-migrate    Don't sync the prisma schema
  --skip-seed       Don't run the seed script
  --stop-docker     Stop docker containers on Ctrl+C (default: leave running)
  -h, --help        Show this help
EOF
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 1
      ;;
  esac
done

log() { printf "${BLUE}▸${RESET} %s\n" "$*"; }
ok()  { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn(){ printf "${YELLOW}!${RESET} %s\n" "$*"; }
die() { printf "${RED}✗${RESET} %s\n" "$*" >&2; exit 1; }

# --- preflight --------------------------------------------------------------
command -v node >/dev/null || die "node is not installed"
command -v npm >/dev/null || die "npm is not installed"
if [[ $SKIP_DOCKER -eq 0 ]]; then
  command -v docker >/dev/null || die "docker is not installed"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin required"
fi

# --- env templates ----------------------------------------------------------
copy_env() {
  local example="$1" target="$2"
  if [[ ! -f "$target" && -f "$example" ]]; then
    cp "$example" "$target"
    ok "created $target from template"
  fi
}
copy_env backend/.env.example  backend/.env
copy_env frontend/.env.example frontend/.env

# --- node_modules -----------------------------------------------------------
if [[ ! -d node_modules ]]; then
  log "installing workspace dependencies (first run)…"
  npm install
  ok "dependencies installed"
fi

# --- docker stack -----------------------------------------------------------
if [[ $SKIP_DOCKER -eq 0 ]]; then
  log "starting docker stack (postgres, redis, mailhog, minio)…"
  $COMPOSE up -d

  log "waiting for postgres to be healthy…"
  for i in {1..60}; do
    status="$($COMPOSE ps --format json postgres 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
    if [[ "$status" == "healthy" ]]; then
      ok "postgres is healthy"
      break
    fi
    if [[ $i -eq 60 ]]; then
      die "postgres did not become healthy in 60s"
    fi
    sleep 1
  done

  log "ensuring postgres extensions (vector, pgcrypto, citext)…"
  docker exec utl-postgres psql -U postgres -d utl_academyos -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
SQL
  ok "extensions ready"
else
  warn "skipping docker (--skip-docker)"
fi

# --- prisma -----------------------------------------------------------------
if [[ $SKIP_MIGRATE -eq 0 ]]; then
  if [[ -d backend/prisma/migrations ]]; then
    log "applying prisma migrations (migrate deploy)…"
    ( cd backend && npx prisma migrate deploy )
  else
    log "no migrations folder — syncing schema (prisma db push)…"
    ( cd backend && npx prisma db push --skip-generate --accept-data-loss )
    ( cd backend && npx prisma generate >/dev/null )
  fi
  ok "schema in sync"
fi

if [[ $SKIP_SEED -eq 0 ]]; then
  log "seeding database (idempotent upsert)…"
  npm run --workspace @utl/backend db:seed >/dev/null
  ok "database seeded"
fi

# --- launch backend + frontend ---------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  log "shutting down…"
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi
  for _ in {1..10}; do
    still_running=0
    [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null && still_running=1
    [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null && still_running=1
    [[ $still_running -eq 0 ]] && break
    sleep 0.2
  done
  if [[ $STOP_DOCKER_ON_EXIT -eq 1 ]]; then
    log "stopping docker stack (--stop-docker)…"
    $COMPOSE down
  fi
  ok "bye"
}
trap cleanup EXIT INT TERM

prefix() {
  local tag="$1" color="$2"
  while IFS= read -r line; do
    printf "${color}[%s]${RESET} %s\n" "$tag" "$line"
  done
}

log "starting backend (:4000) and frontend (:3000)…"
echo

( set -a; source backend/.env; set +a; npm run dev:backend 2>&1 | prefix "api" "$GREEN" ) &
BACKEND_PID=$!

sleep 2

( npm run dev 2>&1 | prefix "web" "$BLUE" ) &
FRONTEND_PID=$!

echo
ok "everything up. Open http://localhost:3000"
printf "${DIM}   API:      http://localhost:4000/api/v1${RESET}\n"
printf "${DIM}   Swagger:  http://localhost:4000/api/docs${RESET}\n"
printf "${DIM}   Mailhog:  http://localhost:8025${RESET}\n"
printf "${DIM}   MinIO:    http://localhost:9001${RESET}\n"
printf "${DIM}   Prisma:   npm run --workspace @utl/backend db:studio${RESET}\n"
echo
printf "${DIM}Press Ctrl+C to stop. Docker stays up unless you pass --stop-docker.${RESET}\n"
echo

wait -n "$BACKEND_PID" "$FRONTEND_PID" || true
