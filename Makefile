# Makefile for eceee_v4_test_1

.PHONY: help install backend frontend playwright-service migrate createsuperuser sample-content sample-pages sample-data sample-clean migrate-to-camelcase-dry migrate-to-camelcase migrate-schemas-only migrate-pagedata-only migrate-widgets-only migrate-widget-images-dry migrate-widget-images import-schemas import-schemas-dry import-schemas-force import-schema test lint docker-up docker-down restart clean playwright-test playwright-down playwright-logs sync-from sync-to clear-layout-cache clear-layout-cache-all tailwind-build tailwind-watch

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
	@echo ""
	@echo "Usage: make <target>"

# Install backend and frontend dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Run Django backend server
servers:
	docker-compose -f docker-compose.dev.yml up db redis minio imgproxy -d

backend:
	docker-compose -f docker-compose.dev.yml up backend

# Run React frontend dev server
frontend:
	docker-compose -f docker-compose.dev.yml up frontend

# Run Playwright website rendering service
playwright-service:
	cd playwright-service && docker-compose up -d

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
docker-up:
	docker-compose -f docker-compose.dev.yml up --build

# Stop all Docker Compose services
docker-down:
	docker-compose -f docker-compose.dev.yml down

# Restart all Docker Compose services
restart:
	docker-compose -f docker-compose.dev.yml restart

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

# Tailwind CSS build commands
tailwind-build: ## Build Tailwind CSS for backend templates
	@echo "🎨 Building Tailwind CSS..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --minify

tailwind-watch: ## Watch and rebuild Tailwind CSS on changes
	@echo "👀 Watching Tailwind CSS for changes..."
	cd backend && npx tailwindcss -i ./static/css/tailwind.input.css -o ./static/css/tailwind.output.css --watch
