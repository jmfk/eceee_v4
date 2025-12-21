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
	@echo "Cache Management:"
	@echo "  clear-layout-cache     Clear layout-related caches to force refresh"
	@echo "  clear-layout-cache-all Clear ALL caches (nuclear option)"
	@echo "  check-servers     Check if backend and frontend servers are up"
	@echo "  check-conf        Check database and server configuration"
	@echo "  use-external-infra Setup .env to use shared infrastructure"
	@echo "  replicate-db      Clone current DB to branch-specific DB and update .env"
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

backend:
	docker-compose -f docker-compose.dev.yml up backend

# Run React frontend dev server
frontend:
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

create-api-token: ## Create DRF token for user (use: make create-api-token USER=username [SERVER=url])
	@if [ -z "$(USER)" ]; then \
		echo "Error: USER is required"; \
		echo "Usage: make create-api-token USER=username [SERVER=http://localhost:8000]"; \
		echo "Example: make create-api-token USER=admin SERVER=https://api.example.com"; \
		exit 1; \
	fi
	@if echo "$(SERVER)" | grep -q "^http://localhost\|^http://127.0.0.1"; then \
		echo "Creating DRF token for user: $(USER) on local server"; \
		echo ""; \
		TOKEN=$$(docker-compose -f docker-compose.dev.yml exec -T backend python manage.py drf_create_token $(USER) 2>/dev/null | grep -o '[a-f0-9]\{40\}' | head -1 || \
			docker-compose -f docker-compose.dev.yml exec backend python manage.py drf_create_token $(USER) 2>/dev/null | grep -o '[a-f0-9]\{40\}' | head -1); \
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
	@if [ -z "$(USER)" ]; then \
		echo "Error: USER is required"; \
		echo "Usage: make get-jwt-token USER=username [SERVER=http://localhost:8000]"; \
		echo "Example: make get-jwt-token USER=admin SERVER=https://api.example.com"; \
		echo ""; \
		echo "You will be prompted for the password."; \
		echo "Or set PASSWORD env var: make get-jwt-token USER=username PASSWORD=pass SERVER=url"; \
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
		docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; print('\nAPI Tokens:'); print('=' * 80); [print(f'{user.username:20} | {Token.objects.get_or_create(user=user)[0].key:40} | EXISTS') for user in User.objects.all().order_by('username')]; print('=' * 80); print(f'\nTotal users: {User.objects.count()}')" || \
		docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "from rest_framework.authtoken.models import Token; from django.contrib.auth.models import User; print('\nAPI Tokens:'); print('=' * 80); [print(f'{user.username:20} | {Token.objects.get_or_create(user=user)[0].key:40} | EXISTS') for user in User.objects.all().order_by('username')]; print('=' * 80); print(f'\nTotal users: {User.objects.count()}')"; \
	else \
		echo "Error: Token listing only available on local server via Docker"; \
		echo "For production, tokens must be managed through Django admin or API"; \
		exit 1; \
	fi

create-tenant: ## Create a new tenant (use: make create-tenant NAME="Tenant Name" IDENTIFIER=tenant_id)
	@if [ -z "$(NAME)" ] || [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: NAME and IDENTIFIER are required"; \
		echo "Usage: make create-tenant NAME=\"Tenant Name\" IDENTIFIER=tenant_id"; \
		exit 1; \
	fi
	@echo "Creating tenant: $(NAME) with identifier: $(IDENTIFIER)"
	@docker-compose -f docker-compose.dev.yml exec backend python manage.py create_tenant --name "$(NAME)" --identifier "$(IDENTIFIER)" || \
		(echo "Error: Failed to create tenant." && exit 1)

list-tenants: ## List all tenants
	@echo "Listing all tenants..."
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; tenants = Tenant.objects.all().order_by('name'); print('\nTenants:'); print('=' * 100); print('UUID                                 | Name                            | Identifier          | Status'); print('-' * 100); [print(f'{str(t.id):36} | {t.name:30} | {t.identifier:20} | {\"Active\" if t.is_active else \"Inactive\"}') for t in tenants]; print('=' * 100); print(f'\nTotal tenants: {Tenant.objects.count()}')" || (echo "Error: Failed to list tenants." && exit 1)

show-tenant: ## Show tenant details (use: make show-tenant ID=uuid or IDENTIFIER=identifier)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: ID or IDENTIFIER is required"; \
		echo "Usage: make show-tenant ID=uuid or make show-tenant IDENTIFIER=default"; \
		exit 1; \
	fi
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; import json; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); print(f'\nTenant Details:'); print('=' * 80); print(f'ID:          {tenant.id}'); print(f'Name:        {tenant.name}'); print(f'Identifier:  {tenant.identifier}'); print(f'Active:      {tenant.is_active}'); print(f'Created:     {tenant.created_at}'); print(f'Updated:     {tenant.updated_at}'); print(f'Created by:  {tenant.created_by.username if tenant.created_by else \"N/A\"}'); print(f'\nSettings:'); print(json.dumps(tenant.settings, indent=2) if tenant.settings else '  (empty)'); print(f'\nThemes: {tenant.themes.count()}'); [print(f'  - {theme.name} (v{theme.sync_version})') for theme in tenant.themes.all()[:10]]; print(f'  ... and {tenant.themes.count() - 10} more' if tenant.themes.count() > 10 else ''); print('=' * 80)" || (echo "Error: Failed to show tenant." && exit 1)

activate-tenant: ## Activate a tenant (use: make activate-tenant ID=uuid or IDENTIFIER=identifier)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: ID or IDENTIFIER is required"; \
		echo "Usage: make activate-tenant ID=uuid or make activate-tenant IDENTIFIER=default"; \
		exit 1; \
	fi
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); tenant.is_active = True; tenant.save(); print(f'✓ Tenant \"{tenant.name}\" (identifier: {tenant.identifier}) activated')" || (echo "Error: Failed to activate tenant." && exit 1)

deactivate-tenant: ## Deactivate a tenant (use: make deactivate-tenant ID=uuid or IDENTIFIER=identifier)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: ID or IDENTIFIER is required"; \
		echo "Usage: make deactivate-tenant ID=uuid or make deactivate-tenant IDENTIFIER=default"; \
		exit 1; \
	fi
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); tenant.is_active = False; tenant.save(); print(f'✓ Tenant \"{tenant.name}\" (identifier: {tenant.identifier}) deactivated')" || (echo "Error: Failed to deactivate tenant." && exit 1)

tenant-themes: ## List themes for a tenant (use: make tenant-themes ID=uuid or IDENTIFIER=identifier)
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: ID or IDENTIFIER is required"; \
		echo "Usage: make tenant-themes ID=uuid or make tenant-themes IDENTIFIER=default"; \
		exit 1; \
	fi
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); print(f'\nThemes for tenant: {tenant.name} (identifier: {tenant.identifier})'); print('=' * 80); themes = tenant.themes.all().order_by('name'); [print(f'{t.id:5} | {t.name:30} | v{t.sync_version:5} | {\"Active\" if t.is_active else \"Inactive\"}{\" (Default)\" if t.is_default else \"\"}') for t in themes] if themes.exists() else print('  (no themes)'); print('=' * 80); print(f'\nTotal themes: {themes.count()}')" || (echo "Error: Failed to list tenant themes." && exit 1)

delete-tenant: ## Delete a tenant (use: make delete-tenant ID=uuid or IDENTIFIER=identifier [FORCE=yes])
	@if [ -z "$(ID)" ] && [ -z "$(IDENTIFIER)" ]; then \
		echo "Error: ID or IDENTIFIER is required"; \
		echo "Usage: make delete-tenant ID=uuid or make delete-tenant IDENTIFIER=default"; \
		echo "Add FORCE=yes to skip confirmation"; \
		exit 1; \
	fi
	@if [ "$(FORCE)" != "yes" ]; then \
		echo "WARNING: This will delete the tenant and all associated themes!"; \
		echo "Press Ctrl+C to cancel, or Enter to continue..."; \
		read confirm; \
	fi
	@docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "from core.models import Tenant; import uuid; tenant = Tenant.objects.get(id=uuid.UUID('$(ID)')) if '$(ID)' else Tenant.objects.get(identifier='$(IDENTIFIER)'); theme_count = tenant.themes.count(); tenant_name = tenant.name; tenant_identifier = tenant.identifier; tenant.delete(); print(f'✓ Tenant \"{tenant_name}\" (identifier: {tenant_identifier}) deleted'); print(f'  Deleted {theme_count} associated theme(s)')" || (echo "Error: Failed to delete tenant." && exit 1)

test-api-auth: ## Test API token authentication (use: make test-api-auth TOKEN=token [SERVER=url])
	@if [ -z "$(TOKEN)" ]; then \
		echo "Error: TOKEN is required"; \
		echo "Usage: make test-api-auth TOKEN=your-token-here [SERVER=http://localhost:8000]"; \
		echo "Example: make test-api-auth TOKEN=abc123 SERVER=https://api.example.com"; \
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
	docker-compose -f docker-compose.dev.yml exec backend python manage.py create_sample_content --count 10 --verbose

sample-pages:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py create_sample_pages --verbose

sample-data: sample-content sample-pages

sample-clean:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py create_sample_content --clean --count 10 --verbose
	docker-compose -f docker-compose.dev.yml exec backend python manage.py create_sample_pages --clear --verbose

# Migration commands for camelCase conversion
migrate-to-camelcase-dry:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_to_camelcase --dry-run --backup

migrate-to-camelcase:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_to_camelcase --backup

migrate-schemas-only:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_to_camelcase --schemas-only --backup

migrate-pagedata-only:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_to_camelcase --pagedata-only --backup

migrate-widgets-only:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_to_camelcase --widgets-only --backup

# Widget Image Migration
migrate-widget-images-dry:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_widget_images --dry-run --verbose

migrate-widget-images:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate_widget_images --backup

# Object Type Schema Management
import-schemas: ## Import all JSON schemas to ObjectTypeDefinitions
	docker-compose -f docker-compose.dev.yml exec backend python manage.py import_schemas

import-schemas-dry: ## Preview schema import without saving (dry run)
	docker-compose -f docker-compose.dev.yml exec backend python manage.py import_schemas --dry-run

import-schemas-force: ## Import/update all schemas without confirmation prompts
	docker-compose -f docker-compose.dev.yml exec backend python manage.py import_schemas --force

import-schema: ## Import single schema file (use: make import-schema FILE=news.json NAME=news)
	@if [ -z "$(FILE)" ] || [ -z "$(NAME)" ]; then \
		echo "Error: Both FILE and NAME are required"; \
		echo "Usage: make import-schema FILE=news.json NAME=news"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.dev.yml exec backend python manage.py import_schemas \
		--file scripts/migration/schemas/$(FILE) \
		--name $(NAME)

shell:
	docker-compose -f docker-compose.dev.yml exec backend bash

# Run backend tests
backend-test:
	docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Test Playwright service endpoints
playwright-test:
	cd playwright-service && python test_service.py

# Lint frontend code
lint:
	cd frontend && npm run lint

# Start all services with Docker Compose
docker-up: infra-up
	docker-compose -f docker-compose.dev.yml up --build

# Stop all Docker Compose services
docker-down:
	docker-compose -f docker-compose.dev.yml down
	docker-compose -f docker-compose.infra.yml down

# Restart all Docker Compose services
restart:
	docker-compose -f docker-compose.dev.yml restart
	docker-compose -f docker-compose.infra.yml restart

# Stop Playwright service
playwright-down:
	cd playwright-service && docker-compose down

# View Playwright service logs
playwright-logs:
	cd playwright-service && docker-compose logs -f

# Clean Python, Node, and Docker artifacts
clean:
	find backend -type d -name '__pycache__' -exec rm -rf {} +
	rm -rf backend/*.pyc backend/*.pyo backend/.pytest_cache
	rm -rf frontend/node_modules frontend/dist
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose -f docker-compose.infra.yml down -v
	cd playwright-service && docker-compose down -v

# ECEEE Components Sync Commands
#sync-from: ## Sync components FROM eceee-components TO eceee_v4
#	@echo "🔄 Syncing components FROM eceee-components TO eceee_v4..."
#	@./sync-from-eceee-components.sh

# sync-to: ## Sync components FROM eceee_v4 TO eceee-components
# 	@echo "🔄 Syncing components FROM eceee_v4 TO eceee-components..."
# 	@./sync-to-eceee-components.sh

clear-layout-cache: ## Clear layout-related caches to force refresh
	@echo "🧹 Clearing layout caches..."
	docker-compose -f docker-compose.dev.yml exec backend python manage.py clear_layout_cache

clear-layout-cache-all: ## Clear all caches (nuclear option)
	@echo "🧹 Clearing ALL caches..."
	docker-compose -f docker-compose.dev.yml exec backend python manage.py clear_layout_cache --all

check-servers: ## Check if backend and frontend servers are up
	@echo "🔍 Checking status of services..."
	@echo ""
	@check_http() { \
		name=$$1; url=$$2; \
		status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 $$url 2>/dev/null); \
		if [ "$$status" = "200" ]; then \
			printf "%-25s [\033[0;32mUP\033[0m]\n" "$$name"; \
		elif [ "$$status" = "000" ] || [ -z "$$status" ]; then \
			printf "%-25s [\033[0;33mNOT STARTED\033[0m]\n" "$$name"; \
		else \
			printf "%-25s [\033[0;31mBROKEN (HTTP $$status)\033[0m]\n" "$$name"; \
		fi; \
	}; \
	echo "--- Local Apps (this repo) ---"; \
	check_http "Backend (Django)" "http://localhost:8000/health/"; \
	check_http "Frontend (Vite)" "http://localhost:3000/"; \
	echo ""; \
	echo "--- External Infra (main repo) ---"; \
	status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:9000/minio/health/live 2>/dev/null); \
	if [ "$$status" = "200" ]; then printf "%-25s [\033[0;32mUP\033[0m]\n" "MinIO"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "MinIO"; fi; \
	status=$$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:8080/health 2>/dev/null); \
	if [ "$$status" = "200" ]; then printf "%-25s [\033[0;32mUP\033[0m]\n" "ImgProxy"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "ImgProxy"; fi; \
	if nc -z localhost 6379 2>/dev/null; then printf "%-25s [\033[0;32mUP\033[0m]\n" "Redis"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "Redis"; fi; \
	if nc -z localhost 5432 2>/dev/null; then printf "%-25s [\033[0;32mUP\033[0m]\n" "Postgres"; else printf "%-25s [\033[0;33mOFFLINE\033[0m]\n" "Postgres"; fi; \
	echo ""

use-external-infra: ## Update .env to use the shared infrastructure from the other repo
	@echo "🔄 Preparing .env file..."
	@if [ ! -f .env ]; then \
		if [ -f .env.template ]; then \
			cp .env.template .env; \
			echo "✅ Created .env from .env.template"; \
		else \
			echo "POSTGRES_DB=eceee_v4" > .env; \
			echo "POSTGRES_HOST=db" >> .env; \
			echo "DATABASE_URL=postgresql://postgres:postgres@db:5432/eceee_v4" >> .env; \
			echo "REDIS_URL=redis://redis:6379/0" >> .env; \
			echo "✅ Created minimal .env"; \
		fi \
	fi
	@echo "🔄 Configuring unique container names for this instance..."
	@if ! grep -q "BACKEND_CONTAINER_NAME" .env; then \
		echo "\n# Multi-instance Configuration" >> .env; \
		echo "BACKEND_CONTAINER_NAME=eceee-v4-backend-editor" >> .env; \
		echo "FRONTEND_CONTAINER_NAME=eceee-v4-frontend-editor" >> .env; \
		echo "THEME_SYNC_CONTAINER_NAME=eceee-v4-theme-sync-editor" >> .env; \
		echo "BACKEND_IMAGE=eceee-v4-backend-editor" >> .env; \
		echo "FRONTEND_IMAGE=eceee-v4-frontend-editor" >> .env; \
		echo "THEME_SYNC_IMAGE=eceee-v4-theme-sync-editor" >> .env; \
		echo "BACKEND_PORT=8001" >> .env; \
		echo "FRONTEND_PORT=3001" >> .env; \
	fi
	@echo "🔄 Updating .env to use hyphenated shared infrastructure names..."
	@if [ "$$(uname)" = "Darwin" ]; then \
		sed -i '' 's/^POSTGRES_HOST=db/POSTGRES_HOST=eceee-v4-db/' .env; \
		sed -i '' 's/@db:5432/@eceee-v4-db:5432/' .env; \
		sed -i '' 's/^REDIS_URL=redis:\/\/redis:6379/REDIS_URL=redis:\/\/eceee-v4-redis:6379/' .env; \
		sed -i '' 's/eceee_v4_minio/eceee-v4-minio/g' .env; \
		sed -i '' 's/eceee_v4_db/eceee-v4-db/g' .env; \
		sed -i '' 's/eceee_v4_redis/eceee-v4-redis/g' .env; \
		sed -i '' 's/eceee_v4_imgproxy/eceee-v4-imgproxy/g' .env; \
	else \
		sed -i 's/^POSTGRES_HOST=db/POSTGRES_HOST=eceee-v4-db/' .env; \
		sed -i 's/@db:5432/@eceee-v4-db:5432/' .env; \
		sed -i 's/^REDIS_URL=redis:\/\/redis:6379/REDIS_URL=redis:\/\/eceee-v4-redis:6379/' .env; \
		sed -i 's/eceee_v4_minio/eceee-v4-minio/g' .env; \
		sed -i 's/eceee_v4_db/eceee-v4-db/g' .env; \
		sed -i 's/eceee_v4_redis/eceee-v4-redis/g' .env; \
		sed -i 's/eceee_v4_imgproxy/eceee-v4-imgproxy/g' .env; \
	fi
	@echo "✅ .env updated. Checking configuration..."
	@make check-conf

check-conf: ## Check current database and server configuration
	@echo "🔍 Checking configuration..."
	@echo ""
	@echo "--- Database Configuration ---"
	@if [ -f .env ]; then \
		DB_ENV=$$(grep '^POSTGRES_DB=' .env | cut -d= -f2); \
		if [ -n "$$DB_ENV" ]; then \
			printf "%-25s \033[0;34m$$DB_ENV\033[0m\n" ".env POSTGRES_DB:"; \
		else \
			printf "%-25s \033[0;33mDEFAULT (eceee_v4)\033[0m\n" ".env POSTGRES_DB:"; \
		fi; \
		DB_HOST=$$(grep '^POSTGRES_HOST=' .env | cut -d= -f2); \
		printf "%-25s \033[0;34m$${DB_HOST:-eceee_v4_db}\033[0m\n" "Postgres Host:"; \
	else \
		printf "%-25s \033[0;33mNONE (using defaults)\033[0m\n" ".env configuration:"; \
	fi
	@printf "%-25s " "Backend actual DB:"
	@docker-compose -f docker-compose.dev.yml run --rm -T backend python manage.py shell -c "from django.conf import settings; print(settings.DATABASES['default']['NAME'])" 2>/dev/null || echo "\033[0;31mERROR: Could not query backend\033[0m"
	@if [ -f .env ]; then \
		DB_HOST=$$(grep '^POSTGRES_HOST=' .env | cut -d= -f2); \
		if [ "$$DB_HOST" = "db" ]; then \
			echo ""; \
			echo "\033[0;33m⚠️  Warning: POSTGRES_HOST is still set to 'db' in .env.\033[0m"; \
			echo "Run \033[0;36mmake use-external-infra\033[0m to fix this."; \
		fi; \
	fi
	@echo ""
	@echo "--- Service Connectivity (from Backend) ---"
	@check_conn() { \
		name=$$1; host=$$2; port=$$3; \
		if docker-compose -f docker-compose.dev.yml run --rm -T backend python -c "import socket; s = socket.socket(); s.settimeout(2); s.connect(('$$host', int('$$port'))); s.close()" >/dev/null 2>&1; then \
			printf "%-25s [\033[0;32mCONNECTED\033[0m] to $$host:$$port\n" "$$name:"; \
		else \
			printf "%-25s [\033[0;31mFAILED\033[0m] to $$host:$$port\n" "$$name:"; \
		fi; \
	}; \
	DB_HOST=$$(grep '^POSTGRES_HOST=' .env | cut -d= -f2 || echo "eceee_v4_db"); \
	REDIS_URL=$$(grep '^REDIS_URL=' .env | cut -d= -f2 || echo "redis://eceee_v4_redis:6379/0"); \
	REDIS_HOST=$$(echo $$REDIS_URL | sed -e 's/redis:\/\///' -e 's/[:\/].*//'); \
	REDIS_PORT=$$(echo $$REDIS_URL | sed -e 's/.*://' -e 's/\/.*//' | grep -E '^[0-9]+$$' || echo "6379"); \
	check_conn "Postgres" "$$DB_HOST" "5432"; \
	check_conn "Redis" "$$REDIS_HOST" "$$REDIS_PORT"; \
	check_conn "MinIO" "eceee_v4_minio" "9000"; \
	check_conn "ImgProxy" "eceee_v4_imgproxy" "8080"; \
	echo ""
	@echo "--- Server Network Configuration ---"
	@if docker network inspect eceee_shared_network >/dev/null 2>&1; then \
		printf "%-25s [\033[0;32mCONNECTED\033[0m] (eceee_shared_network)\n" "Shared Network:"; \
	else \
		printf "%-25s [\033[0;31mMISSING\033[0m] (eceee_shared_network)\n" "Shared Network:"; \
	fi
	@echo ""

check-db: check-conf ## Alias for check-conf

replicate-db: ## Clone current DB to branch-specific DB and update .env
	@echo "🔄 Ensuring backend image is built (to include new dependencies)..."
	docker-compose -f docker-compose.dev.yml build backend
	@echo "🔄 Replicating database to branch-specific version..."
	docker-compose -f docker-compose.dev.yml run --rm backend python manage.py replicate_db
	@echo ""
	@echo "✅ Database replicated. Please start the backend to apply changes:"
	@echo "   make backend"
	@echo ""

# Tailwind CSS build commands
tailwind-build: ## Build Tailwind CSS for backend templates
	@echo "🎨 Building Tailwind CSS..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --minify

tailwind-watch: ## Watch and rebuild Tailwind CSS on changes
	@echo "👀 Watching Tailwind CSS for changes..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --watch
