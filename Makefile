# Makefile for eceee_v4_test_1

.PHONY: help install backend frontend playwright-service theme-sync migrate createsuperuser sample-content sample-pages sample-data sample-clean migrate-to-camelcase-dry migrate-to-camelcase migrate-schemas-only migrate-pagedata-only migrate-widgets-only migrate-widget-images-dry migrate-widget-images import-schemas import-schemas-dry import-schemas-force import-schema test lint docker-up docker-down restart clean playwright-test playwright-down playwright-logs sync-from sync-to clear-layout-cache clear-layout-cache-all tailwind-build tailwind-watch create-api-token get-jwt-token list-api-tokens test-api-auth create-tenant list-tenants show-tenant activate-tenant deactivate-tenant tenant-themes delete-tenant

# Default target - show help
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Available make targets:"
	@echo ""
	@echo "Development Environment:"
	@echo "  install           Install backend and frontend dependencies"
	@echo "  servers           Start database, Redis, MinIO, and ImgProxy services"
	@echo "  backend           Start Django backend server"
	@echo "  frontend          Start React frontend dev server"
	@echo "  playwright-service Start Playwright website rendering service"
	@echo "  theme-sync        Start theme file sync service"
	@echo "  shell             Open bash shell in backend container"
	@echo "  tailwind-build    Build Tailwind CSS for backend templates"
	@echo "  tailwind-watch    Watch and rebuild Tailwind CSS on changes"
	@echo ""
	@echo "Database Management:"
	@echo "  migrations        Create Django migrations"
	@echo "  migrate           Run Django migrations"
	@echo "  requirements      Install backend requirements in container"
	@echo ""
	@echo "User Management:"
	@echo "  createsuperuser   Create Django superuser"
	@echo "  changepassword    Change admin password"
	@echo ""
	@echo "Tenant Management:"
	@echo "  create-tenant NAME=\"Name\" IDENTIFIER=id  Create a new tenant"
	@echo "  list-tenants                              List all tenants"
	@echo "  show-tenant ID=uuid|IDENTIFIER=id         Show tenant details"
	@echo "  activate-tenant ID=uuid|IDENTIFIER=id     Activate a tenant"
	@echo "  deactivate-tenant ID=uuid|IDENTIFIER=id   Deactivate a tenant"
	@echo "  tenant-themes ID=uuid|IDENTIFIER=id       List themes for a tenant"
	@echo "  delete-tenant ID=uuid|IDENTIFIER=id       Delete a tenant (with confirmation)"
	@echo ""
	@echo "API Authentication:"
	@echo "  create-api-token USER=username [SERVER=url]  Create DRF token for user (long-lived)"
	@echo "  get-jwt-token USER=username [SERVER=url]    Get JWT token for user (expires in 60min)"
	@echo "  list-api-tokens [SERVER=url]                List all API tokens"
	@echo "  test-api-auth TOKEN=token [SERVER=url]      Test API token authentication"
	@echo "  Note: SERVER defaults to http://localhost:8000"
	@echo ""
	@echo "Sample Data:"
	@echo "  sample-content    Create sample content (10 items)"
	@echo "  sample-pages      Create sample pages"
	@echo "  sample-data       Create both sample content and pages"
	@echo "  sample-clean      Clean and recreate sample data"
	@echo ""
	@echo "Data Migration:"
	@echo "  migrate-to-camelcase-dry  Dry run camelCase migration"
	@echo "  migrate-to-camelcase      Run camelCase migration with backup"
	@echo "  migrate-schemas-only      Migrate schemas only"
	@echo "  migrate-pagedata-only     Migrate page data only"
	@echo "  migrate-widgets-only      Migrate widgets only"
	@echo "  migrate-widget-images-dry Dry run widget image migration (preview)"
	@echo "  migrate-widget-images     Migrate widget images to full MediaFile objects"
	@echo ""
	@echo "Object Type Schemas:"
	@echo "  import-schemas            Import all JSON schemas to ObjectTypes"
	@echo "  import-schemas-dry        Preview schema import (dry run)"
	@echo "  import-schemas-force      Import/update schemas without prompts"
	@echo "  import-schema FILE=x NAME=y  Import single schema file"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  backend-test      Run backend tests"
	@echo "  playwright-test   Test Playwright service endpoints"
	@echo "  lint              Lint frontend code"
	@echo ""
	@echo "Docker Management:"
	@echo "  docker-up         Start all services with Docker Compose"
	@echo "  docker-down       Stop all Docker Compose services"
	@echo "  restart           Restart all Docker Compose services"
	@echo "  playwright-down   Stop Playwright service"
	@echo "  playwright-logs   View Playwright service logs"
	@echo "  clean             Clean Python, Node, and Docker artifacts"
	@echo ""
	@echo "ECEEE Components Sync:"
	@echo "  sync-to           Sync components FROM eceee_v4 TO eceee-components"
	@echo ""
	@echo "Environment & Health Checks:"
	@echo "  clear-layout-cache     Clear layout-related caches"
	@echo "  clear-layout-cache-all Clear ALL caches"
	@echo "  check-servers          Check if backend and frontend servers are up"
	@echo "  check-conf             Check database and server configuration"
	@echo "  use-external-infra     Setup .env to use shared infrastructure"
	@echo "  change-ports           Change backend and frontend ports"
	@echo "  replicate-db           Clone current DB to branch-specific DB"
	@echo ""
	@echo "Usage: make <target>"

# Install backend and frontend dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Run infrastructure services
infra-up:
	docker-compose -f docker-compose.infra.yml up -d

infra-down:
	docker-compose -f docker-compose.infra.yml down

servers: infra-up

# Run Django backend server
backend:
	@BP=$$(grep "^BACKEND_PORT=" .env | cut -d= -f2 || echo "8000"); \
	 echo "🚀 Starting Backend on http://localhost:$$BP (internal: 8000)"; \
	 docker-compose -f docker-compose.dev.yml up backend

# Run React frontend dev server
frontend:
	@FP=$$(grep "^FRONTEND_PORT=" .env | cut -d= -f2 || echo "3000"); \
	 echo "🚀 Starting Frontend on http://localhost:$$FP (internal: 3000)"; \
	 docker-compose -f docker-compose.dev.yml up frontend

# Run Playwright website rendering service
playwright-service:
	cd playwright-service && docker-compose up -d

# Run theme sync service
theme-sync:
	docker-compose -f docker-compose.dev.yml up theme-sync

# Run Django migrations
migrations:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

migrate:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

requirements:
	docker-compose -f docker-compose.dev.yml exec backend pip install -r requirements.txt


# Create Django superuser
createsuperuser:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

changepassword:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py changepassword admin

# API Token Management
SERVER ?= http://localhost:8000

create-api-token: ## Create DRF token for user
	@if [ -z "$(USER)" ]; then \
		echo "Error: USER is required"; \
		exit 1; \
	fi
	TOKEN=$$(docker-compose -f docker-compose.dev.yml exec backend python manage.py drf_create_token $(USER) 2>/dev/null | grep -o '[a-f0-9]\{40\}' | head -1); \
	echo "Token: $$TOKEN"

get-jwt-token: ## Get JWT token for user
	@if [ -z "$(USER)" ]; then \
		echo "Error: USER is required"; \
		exit 1; \
	fi
	@echo "Enter password:"; \
	read -s PASSWORD; \
	curl -s -X POST $(SERVER)/api/auth/token/ -H "Content-Type: application/json" -d "{\"username\": \"$(USER)\", \"password\": \"$$PASSWORD\"}" | python3 -m json.tool

list-api-tokens: ## List all API tokens
	docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "from rest_framework.authtoken.models import Token; [print(f'{t.user.username}: {t.key}') for t in Token.objects.all()]"

create-tenant: ## Create a new tenant
	@if [ -z "$(NAME)" ] || [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: NAME and IDENTIFIER are required"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.dev.yml exec backend python manage.py create_tenant --name "$(NAME)" --identifier "$(IDENTIFIER)"

list-tenants: ## List all tenants
	docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "from core.models import Tenant; [print(f'{t.name} ({t.identifier})') for t in Tenant.objects.all()]"

# Port validation helper
define check_port
	@if [ -n "$(1)" ]; then \
		if nc -z localhost $(1) 2>/dev/null; then \
			echo "❌ Error: Port $(1) is already in use."; \
			exit 1; \
		fi \
	fi
endef

use-external-infra: ## Update .env to use the shared infrastructure
	@echo "🔄 Preparing .env file..."
	@if [ ! -f .env ]; then \
		if [ -f .env.template ]; then cp .env.template .env; else touch .env; fi \
	fi
	$(call check_port,$(BP))
	$(call check_port,$(FP))
	@echo "🔄 Configuring unique container names and ports..."
	@BP_VAL=$${BP:-8001}; FP_VAL=$${FP:-3001}; \
	 if ! grep -q "BACKEND_CONTAINER_NAME" .env; then \
		echo "\n# Multi-instance Configuration" >> .env; \
		echo "BACKEND_CONTAINER_NAME=eceee-v4-backend-editor" >> .env; \
		echo "FRONTEND_CONTAINER_NAME=eceee-v4-frontend-editor" >> .env; \
		echo "BACKEND_PORT=$$BP_VAL" >> .env; \
		echo "FRONTEND_PORT=$$FP_VAL" >> .env; \
	 fi
	@echo "🔄 Updating .env to use hyphenated shared infrastructure names..."
	@if [ "$$(uname)" = "Darwin" ]; then \
		sed -i '' 's/^POSTGRES_HOST=db/POSTGRES_HOST=eceee-v4-db/' .env; \
		sed -i '' 's/@db:5432/@eceee-v4-db:5432/' .env; \
		sed -i '' 's/eceee_v4_/eceee-v4-/g' .env; \
	else \
		sed -i 's/^POSTGRES_HOST=db/POSTGRES_HOST=eceee-v4-db/' .env; \
		sed -i 's/@db:5432/@eceee-v4-db:5432/' .env; \
		sed -i 's/eceee_v4_/eceee-v4-/g' .env; \
	fi
	@make check-conf

check-conf: ## Check current database and server configuration
	@echo "🔍 Checking configuration..."
	@echo ""
	@echo "--- Database Configuration ---"
	@if [ -f .env ]; then \
		DB_ENV=$$(grep '^POSTGRES_DB=' .env | cut -d= -f2); \
		printf "POSTGRES_DB: %s\n" "$${DB_ENV:-eceee_v4}"; \
	fi
	@echo -n "Backend actual DB: "
	@docker-compose -f docker-compose.dev.yml run --rm -T backend python manage.py shell -c "from django.conf import settings; print(settings.DATABASES['default']['NAME'])" 2>/dev/null || echo "ERROR"
	@echo ""
	@echo "--- Service Connectivity ---"
	@check_conn() { \
		name=$$1; host=$$2; port=$$3; \
		if docker-compose -f docker-compose.dev.yml run --rm -T backend python -c "import socket; s = socket.socket(); s.settimeout(2); s.connect(('$$host', int('$$port'))); s.close()" >/dev/null 2>&1; then \
			printf "%-25s [\033[0;32mUP\033[0m]\n" "$$name:"; \
		else \
			printf "%-25s [\033[0;31mDOWN\033[0m]\n" "$$name:"; \
		fi; \
	}; \
	check_conn "Postgres" "eceee-v4-db" "5432"; \
	check_conn "Redis" "eceee-v4-redis" "6379"; \
	check_conn "MinIO" "eceee-v4-minio" "9000"; \
	check_conn "ImgProxy" "eceee-v4-imgproxy" "8080"
	@echo ""

check-servers: ## Quick server status check
	@echo "🔍 Local Apps status:"
	@BP=$$(grep "^BACKEND_PORT=" .env | cut -d= -f2 || echo "8000"); \
	 FP=$$(grep "^FRONTEND_PORT=" .env | cut -d= -f2 || echo "3000"); \
	 curl -s -o /dev/null -w "Backend: [UP]\n" http://localhost:$$BP/health/ || echo "Backend: [DOWN]"; \
	 curl -s -o /dev/null -w "Frontend: [UP]\n" http://localhost:$$FP/ || echo "Frontend: [DOWN]"

replicate-db: ## Clone current DB to branch-specific DB
	@echo "🔄 Ensuring backend image is built..."
	docker-compose -f docker-compose.dev.yml build backend
	@echo "🔄 Replicating database..."
	docker-compose -f docker-compose.dev.yml run --rm backend python manage.py replicate_db
	@echo "✅ Done. Run 'make backend' to start."

# Tailwind CSS build commands
tailwind-build:
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --minify

tailwind-watch:
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --watch
