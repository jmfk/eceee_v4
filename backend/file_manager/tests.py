"""
Media System Tests

This file imports all test modules for the file_manager app.
Individual test modules are organized in the tests/ directory.

To run all media system tests:
    docker-compose exec backend python manage.py test file_manager

To run specific test modules:
    docker-compose exec backend python manage.py test file_manager.tests.test_models
    docker-compose exec backend python manage.py test file_manager.tests.test_api
    docker-compose exec backend python manage.py test file_manager.tests.test_storage
    docker-compose exec backend python manage.py test file_manager.tests.test_ai_services

Test Coverage:
- Model validation and relationships
- API endpoints and authentication
- S3 storage integration
- AI services and content analysis
- Error handling and edge cases
- Performance and scalability
"""

# Import all test modules to ensure they're discovered by Django's test runner
from .tests.test_models import *
from .tests.test_api import *
from .tests.test_storage import *
from .tests.test_ai_services import *
