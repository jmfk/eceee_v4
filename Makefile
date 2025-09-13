# Makefile for eceee_v4_test_1

.PHONY: help install backend frontend playwright-service migrate createsuperuser sample-content sample-pages sample-data sample-clean migrate-to-camelcase-dry migrate-to-camelcase migrate-schemas-only migrate-pagedata-only migrate-widgets-only test lint docker-up docker-down restart clean playwright-test playwright-down playwright-logs

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
	@echo "Usage: make <target>"

# Install backend and frontend dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Run Django backend server
servers:
	docker-compose up db redis minio imgproxy -d

backend:
	docker-compose up backend

# Run React frontend dev server
frontend:
	docker-compose up frontend

# Run Playwright website rendering service
playwright-service:
	cd playwright-service && docker-compose up -d

# Run Django migrations
migrations:
	docker-compose exec backend python manage.py makemigrations

migrate:
	docker-compose exec backend python manage.py migrate

requirements:
	docker-compose exec backend pip install -r requirements.txt


# Create Django superuser
createsuperuser:
	docker-compose exec backend python manage.py createsuperuser

changepassword:
	docker-compose exec backend python manage.py changepassword admin

# Create sample data
sample-content:
	docker-compose exec backend python manage.py create_sample_content --count 10 --verbose

sample-pages:
	docker-compose exec backend python manage.py create_sample_pages --verbose

sample-data: sample-content sample-pages

sample-clean:
	docker-compose exec backend python manage.py create_sample_content --clean --count 10 --verbose
	docker-compose exec backend python manage.py create_sample_pages --clear --verbose

# Migration commands for camelCase conversion
migrate-to-camelcase-dry:
	docker-compose exec backend python manage.py migrate_to_camelcase --dry-run --backup

migrate-to-camelcase:
	docker-compose exec backend python manage.py migrate_to_camelcase --backup

migrate-schemas-only:
	docker-compose exec backend python manage.py migrate_to_camelcase --schemas-only --backup

migrate-pagedata-only:
	docker-compose exec backend python manage.py migrate_to_camelcase --pagedata-only --backup

migrate-widgets-only:
	docker-compose exec backend python manage.py migrate_to_camelcase --widgets-only --backup

shell:
	docker-compose exec backend bash

# Run backend tests
backend-test:
	docker-compose exec backend python manage.py test

# Test Playwright service endpoints
playwright-test:
	cd playwright-service && python test_service.py

# Lint frontend code
lint:
	cd frontend && npm run lint

# Start all services with Docker Compose
docker-up:
	docker-compose up --build

# Stop all Docker Compose services
docker-down:
	docker-compose down

# Restart all Docker Compose services
restart:
	docker-compose restart

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
	docker-compose down -v
	cd playwright-service && docker-compose down -v