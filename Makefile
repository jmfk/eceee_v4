# Help for eceee_v4

# Load environment variables from .env if it exists
-include .env
export

DOCKER_COMPOSE ?= docker compose
COMPOSE_DEV_FILES ?= -f docker-compose.dev.yml
COMPOSE_INFRA_FILES ?= -f docker-compose.infra.yml
COMPOSE_TEST_FILES ?= -f docker-compose.test-infra.yml
COMPOSE_DEV = $(DOCKER_COMPOSE) $(COMPOSE_DEV_FILES)
COMPOSE_INFRA = $(DOCKER_COMPOSE) $(COMPOSE_INFRA_FILES)
COMPOSE_TEST = $(DOCKER_COMPOSE) $(COMPOSE_TEST_FILES)
DEV_SERVICES := backend frontend celery-worker
PY_LINT_BASE ?= origin/main

# Global help request check
HELP_REQUESTED := $(filter --help -h help,$(MAKECMDGOALS))
ifneq ($(filter help,$(MAKECMDGOALS)),)
ifneq ($(filter-out help,$(MAKECMDGOALS)),)
$(error Use 'make help-TARGET'; combining 'help' with another goal would also run that goal)
endif
endif

# Canonical checkout defaults. The ignored .env overrides these with the current
# checkout's machine port registry assignments.
FRONTEND_PORT ?= 10100
BACKEND_PORT ?= 10101
ECEEE_IMGPROXY_PORT ?= 10106
ECEEE_PLAYWRIGHT_PORT ?= 10107
ECEEE_FRONTEND_E2E_PORT ?= 10108
ECEEE_FRONTEND_PREVIEW_PORT ?= 10109
PUBLISHER_PORT ?= 10115
LEGACY_DB_TUNNEL_PORT ?= 10110
SHARED_POSTGRES_PORT ?= 10300
SHARED_REDIS_PORT ?= 10301
SHARED_MINIO_API_PORT ?= 10302
SHARED_MINIO_CONSOLE_PORT ?= 10303

# Help print helper
HELP_MAKEFILES = $(filter Makefile %.mk,$(MAKEFILE_LIST))

define print_help
	grep -hE '^$(1):.*?## .*$$' $(HELP_MAKEFILES) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36mUsage:\033[0m make %s %s\n", $$1, $$2}'
endef

# Help check helper
define check_help
	@if [ -n "$(HELP_REQUESTED)" ]; then \
		$(call print_help,$(1)); \
		exit 0; \
	fi
endef

.PHONY: help help-% --help -h
.PHONY: install dev dev-build dev-stop dev-logs dev-status servers backend frontend shell
.PHONY: playwright-service playwright-down playwright-logs playwright-test theme-sync
.PHONY: publisher-dev publisher-manifest publisher-manifest-check
.PHONY: migrations migrate requirements createsuperuser changepassword
.PHONY: sample-content sample-pages sample-data sample-clean demo-reset-site demo-site
.PHONY: migrate-to-camelcase-dry migrate-to-camelcase migrate-schemas-only
.PHONY: migrate-pagedata-only migrate-widgets-only migrate-widget-images-dry migrate-widget-images
.PHONY: import-schemas import-schemas-dry import-schemas-force import-schema
.PHONY: legacy-db-tunnel legacy-news-sample-dry legacy-news-database-dry fix-minio-permissions
.PHONY: create-api-token get-jwt-token list-api-tokens test-api-auth
.PHONY: create-tenant list-tenants show-tenant activate-tenant deactivate-tenant tenant-themes delete-tenant
.PHONY: test test-build test-parallel backend-test backend-news-test backend-test-parallel frontend-test
.PHONY: prepare-test-infra test-infra-down refresh-db-collation prepare-frontend-e2e
.PHONY: frontend-e2e-test frontend-admin-e2e-test frontend-public-e2e-test regression-test
.PHONY: backend-lint frontend-lint lint
.PHONY: howto-script-editor howto-auth-prod howto-voices howto-video-edit
.PHONY: howto-video-demo howto-video-demo-both howto-video-demo-all howto-video-demo-all-both
.PHONY: howto-video-prod howto-video-prod-both howto-video-prod-all howto-video-prod-all-both
.PHONY: docker-up docker-down restart clean infra-up infra-down infra-restart
.PHONY: configure-local-infra local-dev-check shared-infra-check use-external-infra
.PHONY: check-servers check-conf check-db clear-layout-cache clear-layout-cache-all
.PHONY: tailwind-build tailwind-watch sync-from sync-to
.PHONY: prod-preflight prod-deploy prod-restart prod-env prod-rollback prod-backup
.PHONY: prod-backfill-typed-tags prod-theme-access-key validate-typed-tags-backup
.PHONY: validate-prod-typed-tags-backup prod-logs prod-status prod-audit-tenant-access
.PHONY: prod-logs-caddy prod-shell-caddy prod-ssh prod-shell prod-bash
.PHONY: prod-fix-image-permissions prod-explain-image-problem

# Dummy targets for help flags
--help:
	@:
-h:
	@:

# Default target - show help
.DEFAULT_GOAL := help

help-%: ## Show help for a specific target
	@$(call print_help,$*)

help: ## Show this help message (use: make help-TARGET for one target)
	@if [ -n "$(filter-out help,$(MAKECMDGOALS))" ]; then \
		for target in $(filter-out help,$(MAKECMDGOALS)); do \
			grep -hE "^$$target:.*?## " $(HELP_MAKEFILES) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36mUsage for %s:\033[0m make %s %s\n", $$1, $$1, $$2}'; \
		done; \
	else \
		echo "Available make targets:"; \
		echo ""; \
		echo "Development Environment:"; \
		echo "  dev               Start backend, frontend, worker, and imgproxy in background"; \
		echo "  dev-build         Rebuild images, then start the development stack"; \
		echo "  dev-stop          Stop application containers without touching shared services"; \
		echo "  dev-logs          Follow application logs"; \
		echo "  dev-status        Show containers and endpoint health"; \
		echo "  install           Install backend and frontend dependencies"; \
		echo "  servers           Compatibility alias for dev"; \
		echo "  backend           Start Django backend server"; \
		echo "  frontend          Start React frontend dev server"; \
		echo "  publisher-dev     Start standalone Next publisher on its registered port"; \
		echo "  publisher-manifest Regenerate publisher CSS/widget metadata"; \
		echo "  publisher-manifest-check Verify checked-in publisher CSS/widget metadata"; \
		echo "  playwright-service Start Playwright website rendering service"; \
		echo "  theme-sync        Start theme file sync service"; \
		echo "  shell             Open bash shell in backend container"; \
		echo "  tailwind-build    Build Tailwind CSS for backend templates"; \
		echo "  tailwind-watch    Watch and rebuild Tailwind CSS on changes"; \
		echo ""; \
		echo "Database Management:"; \
		echo "  migrations        Create Django migrations"; \
		echo "  migrate           Run Django migrations"; \
		echo "  requirements      Install backend requirements in container"; \
		echo ""; \
		echo "User Management:"; \
		echo "  createsuperuser   Create Django superuser"; \
		echo "  changepassword    Change admin password"; \
		echo ""; \
		echo "Tenant Management:"; \
		echo "  create-tenant NAME=\"Name\" IDENTIFIER=id  Create a new tenant"; \
		echo "  list-tenants                              List all tenants"; \
		echo "  show-tenant ID=uuid|IDENTIFIER=id         Show tenant details"; \
		echo "  activate-tenant ID=uuid|IDENTIFIER=id     Activate a tenant"; \
		echo "  deactivate-tenant ID=uuid|IDENTIFIER=id   Deactivate a tenant"; \
		echo "  tenant-themes ID=uuid|IDENTIFIER=id       List themes for a tenant"; \
		echo "  delete-tenant ID=uuid|IDENTIFIER=id       Delete a tenant (with confirmation)"; \
		echo ""; \
		echo "API Authentication:"; \
		echo "  create-api-token USER=username [SERVER=url]  Create DRF token for user (long-lived)"; \
		echo "  get-jwt-token USER=username [SERVER=url]    Get JWT token for user (expires in 60min)"; \
		echo "  list-api-tokens [SERVER=url]                List all API tokens"; \
		echo "  test-api-auth TOKEN=token [SERVER=url]      Test API token authentication"; \
		echo "  Note: SERVER defaults to http://localhost:$(BACKEND_PORT)"; \
		echo ""; \
		echo "Sample Data:"; \
		echo "  sample-content    Create sample content (10 items)"; \
		echo "  sample-pages      Create sample pages"; \
		echo "  sample-data       Create both sample content and pages"; \
		echo "  sample-clean      Clean and recreate sample data"; \
		echo "  demo-reset-site   Reset local demo DB from the Summer Study export"; \
		echo "  demo-site         Reset demo DB and start backend/frontend on localhost"; \
		echo ""; \
		echo "Data Migration:"; \
		echo "  migrate-to-camelcase-dry  Dry run camelCase migration"; \
		echo "  migrate-to-camelcase      Run camelCase migration with backup"; \
		echo "  migrate-schemas-only      Migrate schemas only"; \
		echo "  migrate-pagedata-only     Migrate page data only"; \
		echo "  migrate-widgets-only      Migrate widgets only"; \
		echo "  migrate-widget-images-dry Dry run widget image migration (preview)"; \
		echo "  migrate-widget-images     Migrate widget images to full MediaFile objects"; \
		echo "  legacy-db-tunnel          Open read-only legacy PostgreSQL tunnel on 10110"; \
		echo "  legacy-news-sample-dry    Validate the bounded News golden sample"; \
		echo "  legacy-news-database-dry  Report legacy News counts through the tunnel"; \
		echo ""; \
		echo "Object Type Schemas:"; \
		echo "  import-schemas            Import all JSON schemas to ObjectTypes"; \
		echo "  import-schemas-dry        Preview schema import (dry run)"; \
		echo "  import-schemas-force      Import/update schemas without prompts"; \
		echo "  import-schema FILE=x NAME=y  Import single schema file"; \
		echo ""; \
		echo "Testing & Quality:"; \
		echo "  backend-test      Run backend tests"; \
		echo "  backend-news-test Run focused News migration tests with PostgreSQL"; \
		echo "  frontend-public-e2e-test Run public-site Playwright regression tests"; \
		echo "  frontend-admin-e2e-test  Run admin Playwright regression tests"; \
		echo "  frontend-e2e-test        Run public then admin Playwright regression tests"; \
		echo "  regression-test          Run browser regression tests"; \
		echo "  playwright-test   Test Playwright service endpoints"; \
		echo "  lint              Lint frontend code"; \
		echo ""; \
		echo "How-To Video Generation:"; \
		echo "  howto-script-editor  Start the local video script editor"; \
		echo "  howto-video-demo      Generate one narrated help video against local demo"; \
		echo "  howto-video-demo-both Generate one local demo help video in Swedish and English"; \
		echo "  howto-video-demo-all  Generate all narrated help videos against local demo"; \
		echo "  howto-video-demo-all-both Generate all local demo help videos in Swedish and English"; \
		echo "  howto-auth-prod       Prompt for prod username/password and save auth state"; \
		echo "  howto-voices          List Swedish ElevenLabs voice candidates"; \
		echo "  howto-video-edit      Trim an existing rendered MP4 without recording again"; \
		echo "  howto-video-prod      Generate one narrated prod help video (GUIDE=id, HOWTO_LANGUAGE=sv|en)"; \
		echo "  howto-video-prod-both Generate one prod help video in Swedish and English (GUIDE=id)"; \
		echo "  howto-video-prod-all  Generate narrated prod help videos for all guides (HOWTO_LANGUAGE=sv|en)"; \
		echo "  howto-video-prod-all-both Generate all prod help videos in Swedish and English"; \
		echo ""; \
		echo "Docker Management:"; \
		echo "  docker-up         Compatibility alias for dev-build"; \
		echo "  docker-down       Stop all Docker Compose services"; \
		echo "  restart           Restart all Docker Compose services"; \
		echo "  playwright-down   Stop Playwright service"; \
		echo "  playwright-logs   View Playwright service logs"; \
		echo "  clean             Clean Python, Node, and Docker artifacts"; \
		echo ""; \
		echo "Production Deployment:"; \
		echo "  prod-deploy       Check and deploy latest main, or a specific TAG/ref/hash"; \
		echo "  prod-rollback     Rollback to previous deployment"; \
		echo "  prod-backup       Run ad-hoc production DB backup"; \
		echo "  validate-prod-typed-tags-backup  Create, fetch, and locally validate a fresh production backup"; \
		echo "  prod-theme-access-key  Create/rotate a workspace-scoped theme key"; \
		echo "  prod-logs         Tail production logs (SERVICE=backend optional)"; \
		echo "  prod-status       Show production container status"; \
		echo "  prod-audit-tenant-access  Read-only tenant migration risk audit"; \
		echo "  prod-ssh          SSH into production server"; \
		echo "  prod-shell        Open Django shell in production"; \
		echo "  prod-fix-image-permissions  Fix permissions on all MinIO assets"; \
		echo "  prod-explain-image-problem  Debug imgproxy 403 for a URL"; \
		echo ""; \
		echo "Environment & Health Checks:"; \
		echo "  infra-up               Run infrastructure services"; \
		echo "  infra-down             Stop infrastructure services"; \
		echo "  infra-restart          Restart infrastructure services"; \
		echo "  clear-layout-cache     Clear layout-related caches to force refresh"; \
		echo "  clear-layout-cache-all Clear ALL caches (nuclear option)"; \
		echo "  check-servers          Check if backend and frontend servers are up"; \
		echo "  check-conf             Check database and server configuration"; \
		echo "  configure-local-infra  Configure .env for shared OrbStack services"; \
		echo "  shared-infra-check     Validate OrbStack and ECEEE service isolation"; \
		echo ""; \
		echo "Usage:"; \
		echo "  make <target>          Run a specific target"; \
		echo "  make help-<target>     Show help for a specific target"; \
	fi

# Install backend and frontend dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Preferred local development workflow. Shared PostgreSQL, Redis, and MinIO are
# lifecycle-owned by ../shared-local-infrastructure and are never stopped here.
dev: infra-up ## Start the development stack in the background.
	VITE_GIT_COMMIT_HASH=$$(git rev-parse --short HEAD) $(COMPOSE_DEV) up -d $(DEV_SERVICES)

dev-build: infra-up ## Rebuild images and start the development stack.
	VITE_GIT_COMMIT_HASH=$$(git rev-parse --short HEAD) $(COMPOSE_DEV) up -d --build $(DEV_SERVICES)

dev-stop: ## Stop application containers without touching shared services.
	$(COMPOSE_DEV) stop $(DEV_SERVICES)

dev-logs: ## Follow backend, frontend, and worker logs.
	$(COMPOSE_DEV) logs -f --tail=100 $(DEV_SERVICES)

dev-status: ## Show development containers and endpoint health.
	$(COMPOSE_DEV) ps $(DEV_SERVICES)
	@$(MAKE) --no-print-directory check-servers

servers: dev ## Backwards-compatible alias for dev.

# Run Django backend server
backend:
	@BP="$${BACKEND_PORT:-10101}"; \
	 echo "🚀 Starting Backend on http://localhost:$$BP (internal: 8000)"; \
	 $(COMPOSE_DEV) up backend

# Run React frontend dev server
frontend:
	@FP="$${FRONTEND_PORT:-10100}"; \
	 echo "🚀 Starting Frontend on http://localhost:$$FP (internal: 3000)"; \
	 VITE_GIT_COMMIT_HASH=$$(git rev-parse --short HEAD) $(COMPOSE_DEV) up frontend

publisher-dev: ## Start the standalone publisher with HMR on the reserved local port
	@if [ -z "$(DATABASE_URL)" ]; then echo "DATABASE_URL is required in the ignored repository .env" >&2; exit 1; fi
	@echo "🚀 Starting Publisher on http://summerstudy.localhost:$(PUBLISHER_PORT)"
	@cd publisher && PUBLISHER_DATABASE_URL="$(DATABASE_URL)" PUBLISHER_IMGPROXY_PUBLIC_URL="http://localhost:$(ECEEE_IMGPROXY_PORT)" npm run dev -- --hostname 0.0.0.0 --port "$(PUBLISHER_PORT)"

publisher-manifest: ## Regenerate publisher CSS/widget metadata
	$(COMPOSE_DEV) run --rm --no-deps -v "$(CURDIR)/publisher:/publisher" backend python manage.py export_publisher_manifest

publisher-manifest-check: ## Verify publisher CSS/widget metadata is current
	$(COMPOSE_DEV) run --rm --no-deps -v "$(CURDIR)/publisher:/publisher" backend python manage.py export_publisher_manifest --check

# Run Playwright website rendering service
playwright-service:
	cd playwright-service && docker compose up -d

# Run theme sync service
theme-sync:
	$(COMPOSE_DEV) up theme-sync

# Run Django migrations
migrations:
	$(COMPOSE_DEV) exec backend python manage.py makemigrations

migrate:
	$(COMPOSE_DEV) exec backend python manage.py migrate

requirements:
	$(COMPOSE_DEV) exec backend pip install -r requirements.txt


# Create Django superuser
createsuperuser:
	$(COMPOSE_DEV) exec backend python manage.py createsuperuser

changepassword:
	$(COMPOSE_DEV) exec backend python manage.py changepassword admin

# API Token Management
SERVER ?= http://localhost:$(BACKEND_PORT)
HOWTO_PROD_BASE_URL ?= https://app.eceee.org
HOWTO_DEMO_BASE_URL ?= http://localhost:$(FRONTEND_PORT)
HOWTO_AUTH_STATE ?= .auth/eceee-prod-storage-state.json
HOWTO_LANGUAGE ?= sv
HOWTO_TRANSLATION_PROVIDER ?=
HOWTO_USE_SCRIPT_TRANSLATION ?= 0
HOWTO_TRANSLATION_MODEL ?=
HOWTO_TRANSLATION_FALLBACK ?= original
HOWTO_DOCS_DIR ?=
HOWTO_OUTPUT_BASE_DIR ?= $(CURDIR)/frontend/public/howto-videos/prod
HOWTO_OUTPUT_DIR ?= $(HOWTO_OUTPUT_BASE_DIR)/$(HOWTO_LANGUAGE)
HOWTO_DEMO_OUTPUT_BASE_DIR ?= $(CURDIR)/frontend/public/howto-videos/demo
HOWTO_DEMO_OUTPUT_DIR ?= $(CURDIR)/frontend/public/howto-videos/demo/$(HOWTO_LANGUAGE)
HOWTO_MD ?= $(MD)
HOWTO_VIDEO ?= $(VIDEO)
HOWTO_VIDEO_OUTPUT ?= $(OUTPUT)
HOWTO_VIDEO_CUTS ?= $(CUTS)
HOWTO_EXTRA_FLAGS ?=
HOWTO_SCRIPT_EDITOR_PATH ?= /help/script-editor
DEMO_EXPORT ?= demo/summerstudy.eceee.org-20260525-181814-871e39ea.zip
DEMO_DB ?= eceee_demo
DEMO_BACKEND_PORT ?= $(BACKEND_PORT)
DEMO_FRONTEND_PORT ?= $(FRONTEND_PORT)
DEMO_HOSTNAMES ?= localhost,127.0.0.1
DEMO_USER ?= demo
DEMO_PASSWORD ?= demo

HOWTO_LANGUAGE_ORIGIN := $(origin HOWTO_LANGUAGE)
HOWTO_OUTPUT_DIR_ORIGIN := $(origin HOWTO_OUTPUT_DIR)
HOWTO_DEMO_OUTPUT_DIR_ORIGIN := $(origin HOWTO_DEMO_OUTPUT_DIR)
HOWTO_TRANSLATE_FLAGS := $(if $(filter 1 true yes,$(HOWTO_USE_SCRIPT_TRANSLATION)),$(if $(strip $(HOWTO_TRANSLATION_PROVIDER)),--translate "$(HOWTO_TRANSLATION_PROVIDER)" --translation-fallback "$(HOWTO_TRANSLATION_FALLBACK)",--no-translate),--no-translate)

demo-reset-site: ## Reset local demo DB from export (use: make demo-reset-site [DEMO_EXPORT=demo/file.zip])
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,demo-reset-site)
else
	DEMO_EXPORT="$(DEMO_EXPORT)" DEMO_DB="$(DEMO_DB)" DEMO_BACKEND_PORT="$(DEMO_BACKEND_PORT)" DEMO_FRONTEND_PORT="$(DEMO_FRONTEND_PORT)" DEMO_HOSTNAMES="$(DEMO_HOSTNAMES)" DEMO_USER="$(DEMO_USER)" DEMO_PASSWORD="$(DEMO_PASSWORD)" scripts/reset-demo-site.sh
endif

demo-site: ## Reset local demo DB and start backend/frontend (use: make demo-site)
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,demo-site)
else
	DEMO_EXPORT="$(DEMO_EXPORT)" DEMO_DB="$(DEMO_DB)" DEMO_BACKEND_PORT="$(DEMO_BACKEND_PORT)" DEMO_FRONTEND_PORT="$(DEMO_FRONTEND_PORT)" DEMO_HOSTNAMES="$(DEMO_HOSTNAMES)" DEMO_USER="$(DEMO_USER)" DEMO_PASSWORD="$(DEMO_PASSWORD)" START_DEMO_SITE=1 scripts/reset-demo-site.sh
endif

create-api-token: ## Create DRF token for user (use: make create-api-token USER=username [SERVER=url])
	$(call check_help,create-api-token)
	@if [ -z "$(USER)" ]; then \
		echo "❌ Error: USER is required"; \
		$(call print_help,create-api-token); \
		exit 1; \
	fi
	@if echo "$(SERVER)" | grep -q "^http://localhost\|^http://127.0.0.1"; then \
		echo "Creating DRF token for user: $(USER) on local server"; \
		echo ""; \
		TOKEN=$$($(COMPOSE_DEV) exec -T backend python manage.py drf_create_token $(USER) 2>/dev/null | grep -o '[a-f0-9]\{40\}' | head -1 || \
			$(COMPOSE_DEV) exec backend python manage.py drf_create_token $(USER) 2>/dev/null | grep -o '[a-f0-9]\{40\}' | head -1); \
		if [ -n "$$TOKEN" ]; then \
			echo ""; \
			echo "✓ Token created successfully!"; \
			echo ""; \
			echo "Token: $$TOKEN"; \
			echo ""; \
			echo "To use this token, add it to docker-compose.dev.yml:"; \
			echo "  theme-sync:"; \
			echo "    environment:"; \
			echo "      - API_TOKEN=$$TOKEN"; \
			echo ""; \
			echo "Or test it with:"; \
			echo "  make test-api-auth TOKEN=$$TOKEN"; \
			echo ""; \
		else \
			echo "Error: Failed to create or extract token"; \
			exit 1; \
		fi \
	else \
		echo "Error: DRF tokens can only be created on local server via Docker"; \
		echo "For production, use: make get-jwt-token USER=$(USER) SERVER=$(SERVER)"; \
		exit 1; \
	fi

get-jwt-token: ## Get JWT token for user (use: make get-jwt-token USER=username [SERVER=url])
	$(call check_help,get-jwt-token)
	@if [ -z "$(USER)" ]; then \
		echo "❌ Error: USER is required"; \
		$(call print_help,get-jwt-token); \
		exit 1; \
	fi
	@if [ -z "$(PASSWORD)" ]; then \
		echo "Getting JWT token for user: $(USER) from $(SERVER)"; \
		echo "Enter password:"; \
		read -s PASSWORD; \
	fi
	@echo "Requesting JWT token from $(SERVER)..."
	@curl -s -X POST $(SERVER)/api/auth/token/ \
		-H "Content-Type: application/json" \
		-d "{\"username\": \"$(USER)\", \"password\": \"$(PASSWORD)\"}" | \
		python3 -m json.tool || \
		(echo "Error: Failed to get token. Check username/password and ensure server is accessible." && exit 1)

list-api-tokens: ## List all API tokens (use: make list-api-tokens [SERVER=url])
	@if echo "$(SERVER)" | grep -q "^http://localhost\|^http://127.0.0.1"; then \
		echo "Listing all API tokens from local server..."; \
		$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; print('\nAPI Tokens:'); print('=' * 80); [print(f'{user.username:20} | {Token.objects.get_or_create(user=user)[0].key:40} | EXISTS') for user in User.objects.all().order_by('username')]; print('=' * 80); print(f'\nTotal users: {User.objects.count()}')" || \
		$(COMPOSE_DEV) exec backend python manage.py shell -c "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; print('\nAPI Tokens:'); print('=' * 80); [print(f'{user.username:20} | {Token.objects.get_or_create(user=user)[0].key:40} | EXISTS') for user in User.objects.all().order_by('username')]; print('=' * 80); print(f'\nTotal users: {User.objects.count()}')"; \
	else \
		echo "Error: Token listing only available on local server via Docker"; \
		echo "For production, tokens must be managed through Django admin or API"; \
		exit 1; \
	fi

create-tenant: ## Create a new tenant (use: make create-tenant NAME="Tenant Name" IDENTIFIER=tenant_id)
	$(call check_help,create-tenant)
	@if [ -z "$(NAME)" ] || [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: NAME and IDENTIFIER are required"; \
		$(call print_help,create-tenant); \
		exit 1; \
	fi
	@echo "Creating tenant: $(NAME) with identifier: $(IDENTIFIER)"
	@$(COMPOSE_DEV) exec backend python manage.py create_tenant --name "$(NAME)" --identifier "$(IDENTIFIER)" || \
		(echo "Error: Failed to create tenant." && exit 1)

list-tenants: ## List all tenants
	@echo "Listing all tenants..."
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; tenants = Tenant.objects.all().order_by('name'); print('\nTenants:'); print('=' * 100); print('UUID                                 | Name                            | Identifier          | Status'); print('-' * 100); [print(f'{str(t.id):36} | {t.name:30} | {t.identifier:20} | {\"Active\" if t.is_active else \"Inactive\"}') for t in tenants]; print('=' * 100); print(f'\nTotal tenants: {Tenant.objects.count()}')" || (echo "Error: Failed to list tenants." && exit 1)

show-tenant: ## Show tenant details (use: make show-tenant ID=uuid or IDENTIFIER=identifier)
	$(call check_help,show-tenant)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: ID or IDENTIFIER is required"; \
		$(call print_help,show-tenant); \
		exit 1; \
	fi
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; import json; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); print(f'\nTenant Details:'); print('=' * 80); print(f'ID:          {tenant.id}'); print(f'Name:        {tenant.name}'); print(f'Identifier:  {tenant.identifier}'); print(f'Active:      {tenant.is_active}'); print(f'Created:     {tenant.created_at}'); print(f'Updated:     {tenant.updated_at}'); print(f'Created by:  {tenant.created_by.username if tenant.created_by else \"N/A\"}'); print(f'\nSettings:'); print(json.dumps(tenant.settings, indent=2) if tenant.settings else '  (empty)'); print(f'\nThemes: {tenant.themes.count()}'); [print(f'  - {theme.name} (v{theme.sync_version})') for theme in tenant.themes.all()[:10]]; print(f'  ... and {tenant.themes.count() - 10} more' if tenant.themes.count() > 10 else ''); print('=' * 80)" || (echo "Error: Failed to show tenant." && exit 1)

activate-tenant: ## Activate a tenant (use: make activate-tenant ID=uuid or IDENTIFIER=identifier)
	$(call check_help,activate-tenant)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: ID or IDENTIFIER is required"; \
		$(call print_help,activate-tenant); \
		exit 1; \
	fi
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); tenant.is_active = True; tenant.save(); print(f'✓ Tenant \"{tenant.name}\" (identifier: {tenant.identifier}) activated')" || (echo "Error: Failed to activate tenant." && exit 1)

deactivate-tenant: ## Deactivate a tenant (use: make deactivate-tenant ID=uuid or IDENTIFIER=identifier)
	$(call check_help,deactivate-tenant)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: ID or IDENTIFIER is required"; \
		$(call print_help,deactivate-tenant); \
		exit 1; \
	fi
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); tenant.is_active = False; tenant.save(); print(f'✓ Tenant \"{tenant.name}\" (identifier: {tenant.identifier}) deactivated')" || (echo "Error: Failed to deactivate tenant." && exit 1)

tenant-themes: ## List themes for a tenant (use: make tenant-themes ID=uuid or IDENTIFIER=identifier)
	$(call check_help,tenant-themes)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: ID or IDENTIFIER is required"; \
		$(call print_help,tenant-themes); \
		exit 1; \
	fi
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); print(f'\nThemes for tenant: {tenant.name} (identifier: {tenant.identifier})'); print('=' * 80); themes = tenant.themes.all().order_by('name'); [print(f'{t.id:5} | {t.name:30} | v{t.sync_version:5} | {\"Active\" if t.is_active else \"Inactive\"}{\" (Default)\" if t.is_default else \"\"}') for t in themes] if themes.exists() else print('  (no themes)'); print('=' * 80); print(f'\nTotal themes: {themes.count()}')" || (echo "Error: Failed to list tenant themes." && exit 1)

delete-tenant: ## Delete a tenant (use: make delete-tenant ID=uuid or IDENTIFIER=identifier [FORCE=yes])
	$(call check_help,delete-tenant)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "❌ Error: ID or IDENTIFIER is required"; \
		$(call print_help,delete-tenant); \
		exit 1; \
	fi
	@if [ "$(FORCE)" != "yes" ]; then \
		echo "WARNING: This will delete the tenant and all associated themes!"; \
		echo "Press Ctrl+C to cancel, or Enter to continue..."; \
		read confirm; \
	fi
	@$(COMPOSE_DEV) exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); theme_count = tenant.themes.count(); tenant_name = tenant.name; tenant_identifier = tenant.identifier; tenant.delete(); print(f'✓ Tenant \"{tenant_name}\" (identifier: {tenant_identifier}) deleted'); print(f'  Deleted {theme_count} associated theme(s)')" || (echo "Error: Failed to delete tenant." && exit 1)

test-api-auth: ## Test API token authentication (use: make test-api-auth TOKEN=token [SERVER=url])
	$(call check_help,test-api-auth)
	@if [ -z "$(TOKEN)" ]; then \
		echo "❌ Error: TOKEN is required"; \
		$(call print_help,test-api-auth); \
		exit 1; \
	fi
	@echo "Testing API authentication on $(SERVER)..."
	@if echo "$(TOKEN)" | grep -q "^eyJ"; then \
		AUTH_HEADER="Bearer $(TOKEN)"; \
	else \
		AUTH_HEADER="Token $(TOKEN)"; \
		echo "Detected DRF token, using Token authentication..."; \
	fi
	@RESPONSE=$$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET $(SERVER)/api/v1/webpages/themes/sync/status/ \
		-H "Authorization: $$AUTH_HEADER" -H "Content-Type: application/json"); \
	HTTP_CODE=$$(echo "$$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2); \
	BODY=$$(echo "$$RESPONSE" | sed '/HTTP_CODE:/d'); \
	if [ "$$HTTP_CODE" = "200" ]; then \
		echo "✓ Authentication successful!"; \
		echo "$$BODY" | python3 -m json.tool 2>/dev/null || echo "$$BODY"; \
	elif [ "$$HTTP_CODE" = "403" ]; then \
		if echo "$$BODY" | grep -q "THEME_SYNC_ENABLED"; then \
			echo "✗ Error: Theme sync is disabled on server"; \
			echo "Set THEME_SYNC_ENABLED=True in backend environment"; \
		else \
			echo "✗ Error: Access forbidden (403)"; \
			echo "Response: $$BODY" | head -5; \
		fi; \
		exit 1; \
	elif [ "$$HTTP_CODE" = "401" ]; then \
		echo "✗ Error: Authentication failed (401)"; \
		echo "Token is invalid or expired"; \
		exit 1; \
	elif [ "$$HTTP_CODE" = "404" ]; then \
		echo "✗ Error: Endpoint not found (404)"; \
		echo "Check that the server URL is correct: $(SERVER)"; \
		exit 1; \
	else \
		echo "✗ Error: Unexpected response (HTTP $$HTTP_CODE)"; \
		echo "Response: $$BODY" | head -10; \
		exit 1; \
	fi

# Create sample data
sample-content:
	$(COMPOSE_DEV) exec backend python manage.py create_sample_content --count 10 --verbose

sample-pages:
	$(COMPOSE_DEV) exec backend python manage.py create_sample_pages --verbose

sample-data: sample-content sample-pages

sample-clean:
	$(COMPOSE_DEV) exec backend python manage.py create_sample_content --clean --count 10 --verbose
	$(COMPOSE_DEV) exec backend python manage.py create_sample_pages --clear --verbose

# Migration commands for camelCase conversion
migrate-to-camelcase-dry:
	$(COMPOSE_DEV) exec backend python manage.py migrate_to_camelcase --dry-run --backup

migrate-to-camelcase:
	$(COMPOSE_DEV) exec backend python manage.py migrate_to_camelcase --backup

migrate-schemas-only:
	$(COMPOSE_DEV) exec backend python manage.py migrate_to_camelcase --schemas-only --backup

migrate-pagedata-only:
	$(COMPOSE_DEV) exec backend python manage.py migrate_to_camelcase --pagedata-only --backup

migrate-widgets-only:
	$(COMPOSE_DEV) exec backend python manage.py migrate_to_camelcase --widgets-only --backup

# Widget Image Migration
migrate-widget-images-dry:
	$(COMPOSE_DEV) exec backend python manage.py migrate_widget_images --dry-run --verbose

migrate-widget-images:
	$(COMPOSE_DEV) exec backend python manage.py migrate_widget_images --backup

# Object Type Schema Management
import-schemas: ## Import all JSON schemas to ObjectTypeDefinitions
	$(COMPOSE_DEV) exec backend python manage.py import_schemas

import-schemas-dry: ## Preview schema import without saving (dry run)
	$(COMPOSE_DEV) exec backend python manage.py import_schemas --dry-run

import-schemas-force: ## Import/update all schemas without confirmation prompts
	$(COMPOSE_DEV) exec backend python manage.py import_schemas --force

import-schema: ## Import single schema file (use: make import-schema FILE=news.json NAME=news)
	$(call check_help,import-schema)
	@if [ -z "$(FILE)" ] || [ -z "$(NAME)" ]; then \
		echo "❌ Error: Both FILE and NAME are required"; \
		$(call print_help,import-schema); \
		exit 1; \
	fi
	$(COMPOSE_DEV) exec backend python manage.py import_schemas \
		--file scripts/migration/schemas/$(FILE) \
		--name $(NAME)

legacy-db-tunnel: ## Open loopback-only legacy PostgreSQL tunnel on reserved port 10110
	@LEGACY_ENV_FILE="$${LEGACY_ENV_FILE:-.env.local}" python3 scripts/legacy_db_tunnel.py

legacy-news-sample-dry: ## Validate the bounded golden News sample (TENANT=identifier)
	@cd backend && python manage.py migrate_legacy_news --sample-manifest --tenant "$(TENANT)" --dry-run

legacy-news-database-dry: ## Read legacy News counts through the tunnel without importing (TENANT=identifier)
	@cd backend && python manage.py migrate_legacy_news --database --tenant "$(TENANT)" --dry-run --env-file ../.env.local

fix-minio-permissions: ## Fix permissions on all MinIO assets (local)
	$(COMPOSE_DEV) exec backend python manage.py fix_minio_permissions

prod-fix-image-permissions: ## Fix permissions on all MinIO assets (production)
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backend python manage.py fix_minio_permissions"

prod-explain-image-problem: ## Debug imgproxy 403 for a URL (use: make prod-explain-image-problem URL="https://...")
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backend python manage.py explain_imgproxy_problem '$(URL)'"

shell:
	$(COMPOSE_DEV) exec backend bash

include make/tests.mk
include make/howto.mk
# Lint backend and frontend code
lint: backend-lint frontend-lint

# Backwards-compatible alias. Prefer dev-build for an explicit rebuild.
docker-up: dev-build

# Stop all Docker Compose services
docker-down:
	$(COMPOSE_DEV) down
	$(COMPOSE_INFRA) down

# Restart all Docker Compose services
restart:
	$(COMPOSE_DEV) restart $(DEV_SERVICES)
	$(COMPOSE_INFRA) restart imgproxy

# Stop Playwright service
playwright-down:
	cd playwright-service && docker compose down

# View Playwright service logs
playwright-logs:
	cd playwright-service && docker compose logs -f

# Clean Python, Node, and Docker artifacts
clean:
	find backend -type d -name '__pycache__' -exec rm -rf {} +
	rm -rf backend/*.pyc backend/*.pyo backend/.pytest_cache
	rm -rf frontend/node_modules frontend/dist
	$(COMPOSE_DEV) down -v
	$(COMPOSE_INFRA) down
	$(COMPOSE_TEST) down -v
	cd playwright-service && docker compose down -v

# ECEEE Components Sync Commands
#sync-from: ## Sync components FROM eceee-components TO eceee_v4
#	@echo "🔄 Syncing components FROM eceee-components TO eceee_v4..."
#	@./sync-from-eceee-components.sh

# sync-to: ## Sync components FROM eceee_v4 TO eceee-components
# 	@echo "🔄 Syncing components FROM eceee_v4 TO eceee-components..."
# 	@./sync-to-eceee-components.sh

# Environment & Health Checks
configure-local-infra: ## Configure ignored .env for the shared OrbStack services.
	python3 scripts/configure_orbstack.py

shared-infra-check: ## Validate OrbStack, shared endpoints, and ECEEE's local configuration.
	python3 scripts/configure_orbstack.py --check-only

local-dev-check: ## Validate this checkout's runtime without rewriting local credentials.
	python3 scripts/configure_orbstack.py --runtime-check

infra-up: local-dev-check ## Start only ECEEE-owned stateless infrastructure.
	$(COMPOSE_INFRA) up -d imgproxy

infra-down: ## Stop only ECEEE-owned stateless infrastructure.
	$(COMPOSE_INFRA) down

infra-restart: shared-infra-check ## Restart only ECEEE-owned stateless infrastructure.
	$(COMPOSE_INFRA) restart imgproxy

clear-layout-cache: ## Clear layout-related caches to force refresh
	@echo "🧹 Clearing layout caches..."
	$(COMPOSE_DEV) exec backend python manage.py clear_layout_cache

clear-layout-cache-all: ## Clear all caches (nuclear option)
	@echo "🧹 Clearing ALL caches..."
	$(COMPOSE_DEV) exec backend python manage.py clear_layout_cache --all

check-servers: ## Check if backend and frontend servers are up
	@echo "🔍 Checking status of services..."
	@echo ""
	@BP="$${BACKEND_PORT:-10101}"; \
	 FP="$${FRONTEND_PORT:-10100}"; \
	 check_http() { \
		name=$$1; url=$$2; \
		status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 $$url 2>/dev/null); \
		if [ "$$status" = "200" ]; then \
			printf "%-25s [\033[0;32mUP\033[0m] at $$url\n" "$$name"; \
		elif [ "$$status" = "000" ] || [ -z "$$status" ]; then \
			printf "%-25s [\033[0;33mNOT STARTED\033[0m] at $$url\n" "$$name"; \
		else \
			printf "%-25s [\033[0;31mBROKEN (HTTP $$status)\033[0m] at $$url\n" "$$name"; \
		fi; \
	 }; \
	 echo "--- Local Apps (this repo) ---"; \
	 check_http "Backend (Django)" "http://localhost:$$BP/health/"; \
	 check_http "Frontend (Vite)" "http://localhost:$$FP/"; \
	 echo ""; \
	 echo "--- Shared OrbStack Services ---"; \
	 status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:$${SHARED_MINIO_API_PORT:-10302}/minio/health/live 2>/dev/null); \
	 if [ "$$status" = "200" ]; then printf "%-25s [\033[0;32mUP\033[0m]\n" "MinIO"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "MinIO"; fi; \
	 status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:$${ECEEE_IMGPROXY_PORT:-10106}/health 2>/dev/null); \
	 if [ "$$status" = "200" ]; then printf "%-25s [\033[0;32mUP\033[0m]\n" "ImgProxy"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "ImgProxy"; fi; \
	 if nc -z localhost $${SHARED_REDIS_PORT:-10301} 2>/dev/null; then printf "%-25s [\033[0;32mUP\033[0m]\n" "Redis"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "Redis"; fi; \
	 if nc -z localhost $${SHARED_POSTGRES_PORT:-10300} 2>/dev/null; then printf "%-25s [\033[0;32mUP\033[0m]\n" "Postgres"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "Postgres"; fi; \
	 echo ""

use-external-infra: configure-local-infra ## Backwards-compatible alias for configure-local-infra.

check-conf: ## Check current database and server configuration
	python3 scripts/configure_orbstack.py --check-only

check-db: check-conf ## Alias for check-conf

# Tailwind CSS build commands
tailwind-build: ## Build Tailwind CSS for backend templates
	@echo "🎨 Building Tailwind CSS..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --minify

tailwind-watch: ## Watch and rebuild Tailwind CSS on changes
	@echo "👀 Watching Tailwind CSS for changes..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --watch

include make/production.mk
