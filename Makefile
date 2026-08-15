# UTL-AcademyOS root Makefile
# Convenience wrappers around npm + docker compose.

COMPOSE = docker compose -f docker-compose.dev.yml

.PHONY: help install start dev dev-up dev-down dev-logs dev-reset build lint typecheck test format \
        db-migrate db-seed db-reset clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install workspace dependencies
	npm install

# --- Dev servers ------------------------------------------------------------

start: ## Boot everything (docker + migrate + seed + backend + frontend)
	./scripts/dev.sh

dev: ## Run frontend dev server (assumes docker stack is up)
	npm run dev

# --- Docker stack -----------------------------------------------------------

dev-up: ## Start local Postgres, Redis, Mailhog, MinIO
	$(COMPOSE) up -d

dev-down: ## Stop the local stack (keep volumes)
	$(COMPOSE) down

dev-logs: ## Tail local stack logs
	$(COMPOSE) logs -f

dev-reset: ## Stop and remove volumes (destroys local data)
	$(COMPOSE) down -v

# --- Quality gates ----------------------------------------------------------

build: ## Build all workspaces
	npm run build

lint: ## Lint all workspaces
	npm run lint

typecheck: ## Typecheck all workspaces
	npm run typecheck

test: ## Run tests across all workspaces
	npm run test

format: ## Prettier-write the repo
	npm run format

# --- Database (backend workspace) -------------------------------------------

db-migrate: ## Apply Prisma migrations (Phase 1+)
	npm run --workspace backend db:migrate --if-present

db-seed: ## Seed the database
	npm run --workspace backend db:seed --if-present

db-reset: ## Reset dev database (drops + re-applies migrations)
	npm run --workspace backend db:reset --if-present

# --- Housekeeping -----------------------------------------------------------

clean: ## Remove build output + caches (keeps node_modules)
	rm -rf */dist */build */.turbo */coverage packages/*/dist
