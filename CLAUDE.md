# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eceee_v4 is a Django-based CMS with a React frontend featuring:
- Hierarchical page management system with widget-based content
- Real-time validation and schema-driven forms
- Version control for page changes
- Theme and layout inheritance system
- Dynamic widget configuration with JSON schemas

## Commands and Development

### Docker Environment
```bash
# Start database and cache services
docker-compose up db redis -d

# Start backend and frontend
docker-compose up backend
docker-compose up frontend

# Full rebuild
docker-compose up --build

# Stop and reset
docker-compose down -v
```

### Backend Commands
```bash
# Django development
docker-compose exec backend python manage.py runserver
docker-compose exec backend python manage.py shell
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py makemigrations

# Testing
docker-compose exec backend python manage.py test
docker-compose exec backend python manage.py test webpages
docker-compose exec backend coverage run --source='.' manage.py test
docker-compose exec backend coverage report

# Code quality
docker-compose exec backend black .
docker-compose exec backend flake8
docker-compose exec backend isort .
docker-compose exec backend mypy .
```

### Frontend Commands
```bash
# Development
docker-compose exec frontend npm run dev
docker-compose exec frontend npm run build

# Testing
docker-compose exec frontend npm test
docker-compose exec frontend npm run test:run
docker-compose exec frontend npm run test:coverage

# Code quality
docker-compose exec frontend npm run lint
docker-compose exec frontend npx eslint .
```

### Makefile Commands
```bash
# Quick setup
make install        # Install dependencies
make migrate        # Run migrations
make createsuperuser # Create admin user

# Development servers
make servers        # Start db and redis
make backend        # Start Django server
make frontend       # Start React dev server

# Sample data
make sample-pages   # Create sample pages
make sample-content # Create sample content
make sample-data    # Create all sample data
make sample-clean   # Clean and recreate sample data

# Testing
make backend-test   # Run backend tests
make lint          # Run frontend linter

# Docker
make docker-up     # Start all services
make docker-down   # Stop all services
make clean         # Clean build artifacts

# Utilities
make shell         # Django shell access
make migrations    # Create new migrations
```

## Architecture

### Backend (Django 4.2+)
- **Core App**: `webpages/` - Hierarchical CMS with widget system
- **Models**: WebPage, PageVersion, PageDataSchema (page schemas)
- **Content App**: `content/` - Events, LibraryItems, Tags, Namespace system
- **Key Features**: Page hierarchy, version control, widget configuration, JSON schemas
- **Database**: PostgreSQL with Redis caching
- **APIs**: DRF with camelCase serialization, separated into modular views
- **Authentication**: JWT + Session auth via django-allauth

### Frontend (React 19 + Vite)
- **Build System**: Vite with path aliases configured
- **State Management**: Zustand for global state, React Query for server state
- **Styling**: Tailwind CSS v4 with mobile-first responsive design
- **UI Libraries**: Headless UI, Lucide React icons, React Hook Form
- **Components**: 
  - Page management: `TreePageManager`, `PageEditor`, `ContentEditor`
  - Widget system: `WidgetLibrary`, `WidgetEditorPanel`, custom widget editors
  - Schema management: `VisualSchemaEditor`, `SchemaDrivenForm`
  - Publishing: `BulkPublishingOperations`, `PublicationTimeline`
- **Testing**: Vitest with React Testing Library, 80%+ coverage target

### Widget System
The CMS uses a code-based widget system:
- **Widget Registry**: Dynamic widget discovery and registration
- **Widget Configuration**: JSON schema-based configuration with validation
- **Widget Editors**: Custom React components for each widget type
- **Inheritance**: Widgets can inherit from parent pages
- **Templates**: Django templates for server-side rendering
- **Core Widgets**: text_block, html_block, image, button, gallery, events, news, calendar, forms, spacer

### Key Architecture Patterns
1. **Page Hierarchy**: WebPage models support parent-child relationships with slug uniqueness per parent
2. **Version Control**: PageVersion tracks all changes with publish/unpublish functionality
3. **Schema-Driven Forms**: JSON schemas define and validate page/widget configurations
4. **CamelCase API**: Frontend uses camelCase, backend uses snake_case with automatic conversion
5. **Namespace System**: Content isolation across different sites/sections
6. **Real-time Validation**: Client and server-side validation with visual feedback
7. **Publishing Workflow**: Date-based publishing with bulk operations support

## Testing

### Backend Testing
- Django test framework with comprehensive test suite
- Test files in `webpages/tests/` directory
- Coverage reporting with coverage.py
- Key test areas: version management, publishing, security, widget system

### Frontend Testing
- Vitest with React Testing Library
- Component tests in `src/components/__tests__/` 
- Page tests in `src/pages/__tests__/`
- Utils tests in `src/utils/__tests__/`
- Coverage target: 80%+

### Running Tests
```bash
# Backend
docker-compose exec backend python manage.py test
docker-compose exec backend python manage.py test webpages
docker-compose exec backend python manage.py test content

# Frontend
docker-compose exec frontend npm test
docker-compose exec frontend npm run test:run
docker-compose exec frontend npm run test:coverage

# Code quality checks
make lint                    # Frontend linting
docker-compose exec backend black . --check
docker-compose exec backend flake8
```

## Development Workflow

### Code Quality Standards
- Python: PEP 8 compliance, Black formatting, flake8 linting
- JavaScript/React: ESLint configuration, functional components with hooks
- TypeScript types in `src/types/api.ts` for API interfaces
- Test coverage target: 80%+ for critical paths
- Comprehensive error handling with user-friendly messages

### Security Requirements
- Django security middleware enabled (CSRF, XSS protection)
- DOMPurify for sanitizing user-generated HTML content
- JWT authentication for API endpoints
- Input validation at both client and server levels
- SQL injection prevention via Django ORM

### Performance Considerations
- Database query optimization with select_related/prefetch_related
- Redis caching for session and frequently accessed data
- React.memo and useMemo for expensive computations
- Vite build optimization with code splitting
- Lazy loading for route components

### API Conventions
- RESTful endpoints with consistent naming
- CamelCase in frontend, snake_case in backend
- Automatic case conversion via djangorestframework-camel-case
- Standardized error response format
- Comprehensive filtering, search, and pagination

## File Structure Notes

### Backend Key Files
- `backend/webpages/models.py` - Core CMS models (WebPage, PageVersion)
- `backend/webpages/views/` - Modular API views (webpage, version, schema, rendering)
- `backend/webpages/serializers.py` - DRF serializers with validation
- `backend/webpages/widgets.py` - Widget registry and base classes
- `backend/content/` - Content management (Events, LibraryItems, Tags)
- `backend/config/settings.py` - Django configuration
- `backend/templates/webpages/` - Page and widget templates

### Frontend Key Files
- `frontend/src/App.jsx` - Main app with React Router setup
- `frontend/src/api/` - API client with endpoint definitions
- `frontend/src/components/` - Reusable UI components
  - `TreePageManager.jsx` - Page hierarchy management
  - `PageEditor.jsx` - Main page editing interface
  - `ContentEditor.jsx` - Content and widget management
  - `WidgetEditorPanel.jsx` - Widget configuration panel
- `frontend/src/pages/` - Route components
- `frontend/src/utils/` - Utility functions (validation, case conversion, etc.)
- `frontend/vite.config.js` - Build config with @ alias for src/

### Configuration Files
- `docker-compose.yml` - PostgreSQL, Redis, Django, React services
- `Makefile` - Development command shortcuts
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Node dependencies

## Common Patterns

### Widget Management
When working with widgets:
1. Widget types define JSON schemas for configuration
2. PageWidget instances store configuration data
3. Widgets can be inherited from parent pages
4. Use SlotManager component for widget placement

### Page Operations
Common page management tasks:
1. Creating versions on every update
2. Validating parent-child relationships
3. Handling layout/theme inheritance
4. Managing publication status and dates

### API Integration
Frontend-backend communication:
- React Query for data fetching and caching
- Axios for HTTP requests with proxy to backend
- JWT tokens for authentication
- Real-time updates via cache invalidation