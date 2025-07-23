# Makefile for eceee_v4_test_1

.PHONY: install backend frontend migrate createsuperuser test lint docker-up docker-down clean

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

# Create Django superuser
createsuperuser:
	docker-compose exec backend python manage.py createsuperuser

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