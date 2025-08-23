# Makefile for eceee_v4_test_1

.PHONY: install backend frontend migrate createsuperuser sample-content sample-pages sample-data sample-clean migrate-to-camelcase-dry migrate-to-camelcase migrate-schemas-only migrate-pagedata-only migrate-widgets-only test lint docker-up docker-down clean

# Install backend and frontend dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Run Django backend server
servers:
	docker-compose up db redis -d

backend:
	docker-compose up backend

# Run React frontend dev server
frontend:
	docker-compose up frontend

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

# Lint frontend code
lint:
	cd frontend && npm run lint

# Start all services with Docker Compose
docker-up:
	docker-compose up --build

# Stop all Docker Compose services
docker-down:
	docker-compose down

# Clean Python, Node, and Docker artifacts
clean:
	find backend -type d -name '__pycache__' -exec rm -rf {} +
	rm -rf backend/*.pyc backend/*.pyo backend/.pytest_cache
	rm -rf frontend/node_modules frontend/dist
	docker-compose down -v