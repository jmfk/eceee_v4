# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands and Development

### Docker Environment
```bash
# Start development environment
docker-compose up db redis -d
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
docker-compose exec backend python manage.py collectstatic

# Testing
docker-compose exec backend python manage.py test
docker-compose exec backend coverage run --source='.' manage.py test
docker-compose exec backend coverage report

# Code quality
cd backend && black .
cd backend && flake8
cd backend && isort .
cd backend && mypy .
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
```

### Makefile Commands
```bash
# Quick setup
make install
make migrate
make createsuperuser

# Development
make backend    # Start Django server
make frontend   # Start React dev server
make backend-test
make lint

# Docker
make docker-up
make docker-down
make clean
```

## Architecture

### Backend (Django)
- **Core App**: `webpages/` - Hierarchical CMS with widget system
- **Models**: WebPage, PageVersion, PageLayout, PageTheme, WidgetType, PageWidget
- **Key Features**: Page hierarchy, version control, widget inheritance, themes/layouts
- **Database**: PostgreSQL with Redis caching
- **APIs**: DRF with comprehensive serializers and viewsets
- **Authentication**: JWT + Session auth via django-allauth

### Frontend (React)
- **Framework**: React 19 with Vite build system
- **State Management**: Zustand for global state, React Query for server state
- **Styling**: Tailwind CSS with mobile-first responsive design
- **Components**: `src/components/` - WidgetLibrary, SlotManager, WidgetConfigurator
- **Pages**: `src/pages/` - PageManagement for CMS interface
- **Testing**: Vitest with React Testing Library

### Widget System
The CMS uses a flexible widget system:
- **WidgetType**: Defines available widget types with JSON schemas
- **PageWidget**: Widget instances on pages with configuration
- **Inheritance**: Widgets can inherit from parent pages
- **Slots**: Layouts define named slots where widgets are placed
- **Templates**: Each widget type has a Django template for rendering

### Key Architecture Patterns
1. **Page Hierarchy**: WebPage models support parent-child relationships
2. **Version Control**: PageVersion model tracks all page changes
3. **Layout/Theme Inheritance**: Pages inherit layouts and themes from parents
4. **Widget Inheritance**: Child pages can inherit widgets from parents
5. **JSON Schema Validation**: Widget configurations validated against schemas

## Testing

### Backend Testing
- Uses Django's test framework with pytest
- Factory Boy for test data generation
- Coverage reports required
- Models: `backend/webpages/tests.py`

### Frontend Testing
- Vitest with React Testing Library
- Component tests in `__tests__/` directories
- Coverage via `npm run test:coverage`

### Running Tests
```bash
# Backend
docker-compose exec backend python manage.py test webpages

# Frontend
docker-compose exec frontend npm test
docker-compose exec frontend npm run test:run
```

## Development Workflow

### Code Quality Standards
- Python: PEP 8, type hints, comprehensive docstrings
- JavaScript: ESLint/Prettier, functional components with hooks
- 80%+ test coverage required
- Proper error handling and validation

### Security Requirements
- Input validation on client and server
- CSRF and XSS protection enabled
- Authentication required for admin operations
- Parameterized queries for all database operations

### Performance Considerations
- Database query optimization with select_related/prefetch_related
- Redis caching for frequently accessed data
- React.memo for expensive components
- Code splitting and lazy loading implemented

### API Conventions
- RESTful endpoints following DRF patterns
- Consistent serializer usage for validation
- Proper HTTP status codes and error responses
- Comprehensive filtering and search capabilities

## File Structure Notes

### Backend Key Files
- `backend/webpages/models.py` - Core CMS models
- `backend/webpages/views.py` - API viewsets
- `backend/webpages/serializers.py` - DRF serializers
- `backend/config/settings.py` - Django configuration
- `backend/templates/` - Django templates for rendering

### Frontend Key Files
- `frontend/src/App.jsx` - Main app with routing
- `frontend/src/pages/PageManagement.jsx` - CMS interface
- `frontend/src/components/` - Reusable components
- `frontend/vite.config.js` - Build configuration with path aliases

### Configuration Files
- `docker-compose.yml` - Multi-service orchestration
- `Makefile` - Development shortcuts
- `.cursor/rules/` - Cursor IDE development standards

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