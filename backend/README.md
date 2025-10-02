# ECEEE v4 Backend

> **Django Backend for AI-Integrated Content Management System**  
> **Status**: Production Ready with Professional CMS Features  
> **Tech Stack**: Django 4.2+ + DRF + PostgreSQL + Redis + Celery  
> **Last Updated**: December 2024

## 🚀 Quick Start

```bash
# Start development environment (from project root)
docker-compose up backend

# Or start all services
docker-compose up

# Access backend
# API: http://localhost:8000
# Admin: http://localhost:8000/admin/
# API Docs: http://localhost:8000/api/docs/
```

## 📋 Project Overview

The eceee_v4 backend is a robust Django application that provides a comprehensive content management system with advanced features including hierarchical page management, version control, widget systems, publishing workflows, and multi-tenancy support. Built for scalability and maintainability, it serves as the foundation for modern content management needs.

## 🏗️ Architecture

### Technology Stack

- **Django 4.2+** - Python web framework
- **Django REST Framework** - API development
- **PostgreSQL 15** - Primary database with UUID support
- **Redis** - Caching and session storage
- **Celery** - Background task processing
- **Pydantic** - Data validation and serialization
- **HTMX** - Server-side dynamic interactions

### Project Structure

```
backend/
├── config/                 # Django project configuration
│   ├── settings.py        # Main settings
│   ├── urls.py           # URL routing
│   └── api_urls.py       # API routing
├── webpages/             # Core CMS application
│   ├── models.py         # Data models
│   ├── views.py          # API viewsets
│   ├── serializers.py    # DRF serializers
│   ├── urls.py           # App URLs
│   └── management/       # Django commands
├── default_widgets/      # Built-in widget types
│   ├── widgets/          # Widget implementations
│   │   ├── content.py    # Content widget + config
│   │   ├── image.py      # Image widget + config
│   │   └── ...           # Other widgets
│   └── templates/        # Widget templates
├── content/              # Content management
├── htmx/                 # HTMX demonstrations
├── templates/            # Django templates
├── static/               # Static files
└── requirements.txt      # Python dependencies
```

## ✨ Key Features

### 🔄 Page Version Management
- **Complete Audit Trail** - Track all page changes with user attribution
- **Draft/Published Workflow** - Professional content publishing process
- **Version Comparison** - Compare any two versions with detailed diffs
- **One-Click Restore** - Instantly rollback to any previous version
- **Advanced Filtering** - Find versions by status, date, user, and content

### 🧩 Code-Based Widget System
- **Type-Safe Components** - Pydantic model-based widget definitions
- **Auto-Discovery** - Automatic widget registration from Django apps
- **Zero Database Queries** - Widget types loaded once at startup
- **Generated Configuration UI** - Auto-generated forms from Pydantic schemas
- **Widget Inheritance** - Inherit and override widgets from parent pages

### 🎨 Layout & Theme System
- **Code-Based Layouts** - Python class-based layouts with automatic discovery
- **Slot Architecture** - Slot-based page layouts with custom template selection
- **Theme Inheritance** - Automatic propagation down page hierarchy
- **Template Integration** - Layout-specific template files for flexibility

### 🚀 Publishing Workflow
- **Scheduled Publishing** - Queue content for future publication
- **Bulk Operations** - Mass publish/schedule multiple pages
- **Publication Status** - Real-time status monitoring and tracking
- **Automated Processing** - Background task processing for large operations

### 🏢 Multi-Tenancy (Namespace System)
- **Isolated Content** - Complete content separation by namespace
- **Shared Infrastructure** - Efficient resource utilization
- **Flexible Configuration** - Per-namespace settings and customization

## 🔧 Development

### Development Setup

```bash
# Django management commands
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py collectstatic

# Create sample data
docker-compose exec backend python manage.py create_sample_pages
docker-compose exec backend python manage.py create_sample_content

# Django shell with enhanced features
docker-compose exec backend python manage.py shell_plus
```

### API Development

```bash
# Start development server
docker-compose exec backend python manage.py runserver

# Run tests
docker-compose exec backend python manage.py test

# Run with coverage
docker-compose exec backend coverage run --source='.' manage.py test
docker-compose exec backend coverage report
```

### Code Quality

```bash
# Code formatting
cd backend && black .

# Import sorting
cd backend && isort .

# Linting
cd backend && flake8

# Type checking
cd backend && mypy .
```

## 📊 Database Architecture

### Core Models

#### Page Management
- **`WebPage`** - Hierarchical page structure with parent-child relationships
- **`PageVersion`** - Complete version control with change tracking
- **`PageLayout`** - Layout assignments and inheritance
- **`PageTheme`** - Theme configuration and inheritance

#### Widget System
- **`WidgetType`** - Widget type definitions (replaced by code-based system)
- **`PageWidget`** - Widget instances with configuration data
- **`WidgetInheritance`** - Widget inheritance from parent pages

#### Content Management
- **`LibraryItem`** - Reusable content components
- **`Event`** - Event management with date/location metadata
- **`Namespace`** - Multi-tenancy support

### Database Relationships

```
WebPage (1) ←→ (N) PageVersion
WebPage (1) ←→ (N) PageWidget
WebPage (1) ←→ (N) WebPage (parent-child)
PageWidget (N) ←→ (1) WidgetType (legacy)
```

## 🔌 API Endpoints

### Core APIs

#### Page Management
- `GET /api/webpages/` - List pages with filtering
- `POST /api/webpages/` - Create new page
- `PUT /api/webpages/{id}/` - Update page
- `DELETE /api/webpages/{id}/` - Delete page

#### Version Control
- `GET /api/webpages/versions/` - List versions with filtering
- `POST /api/webpages/versions/{id}/publish/` - Publish version
- `POST /api/webpages/versions/{id}/restore/` - Restore version
- `GET /api/webpages/versions/compare/` - Compare versions

#### Widget System
- `GET /api/widget-types/` - List available widget types
- `GET /api/webpages/{id}/widgets/` - Get page widgets
- `POST /api/webpages/{id}/widgets/` - Add widget to page
- `PUT /api/webpages/{id}/widgets/{widget_id}/` - Update widget

#### Publishing Workflow
- `POST /api/webpages/schedule/` - Schedule publication
- `POST /api/webpages/bulk_publish/` - Bulk publish pages
- `GET /api/webpages/publication_status/` - Get publication status

### API Documentation
- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/api/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

## 🧪 Testing

### Running Tests

```bash
# Run all tests
docker-compose exec backend python manage.py test

# Run specific app tests
docker-compose exec backend python manage.py test webpages

# Run specific test class
docker-compose exec backend python manage.py test webpages.tests.WidgetRegistryTest

# Run with coverage
docker-compose exec backend coverage run --source='.' manage.py test
docker-compose exec backend coverage report --show-missing
```

### Test Categories

#### Model Tests
- Data validation and constraints
- Model methods and properties
- Relationship integrity
- Custom managers and querysets

#### API Tests
- Endpoint functionality
- Authentication and permissions
- Input validation
- Response formatting

#### Integration Tests
- End-to-end workflows
- Widget system integration
- Version control workflows
- Publishing system operation

## 🔒 Security

### Authentication & Authorization
- **JWT Authentication** - Token-based API access
- **Session Authentication** - Web interface access
- **Permission System** - Role-based access control
- **CSRF Protection** - Cross-site request forgery prevention

### Data Protection
- **Input Validation** - Comprehensive data validation using Pydantic
- **SQL Injection Prevention** - Parameterized queries and ORM usage
- **XSS Protection** - Output sanitization and content security policies
- **CORS Configuration** - Controlled cross-origin resource sharing

## 🚀 Performance

### Database Optimization
- **Query Optimization** - Strategic use of select_related and prefetch_related
- **Database Indexing** - Optimized indexes for common queries
- **Connection Pooling** - Efficient database connection management

### Caching Strategy
- **Redis Caching** - API response and query result caching
- **Template Caching** - Rendered template fragment caching
- **Widget Type Caching** - In-memory widget type registry

### Background Processing
- **Celery Tasks** - Asynchronous processing for heavy operations
- **Bulk Operations** - Efficient batch processing for large datasets
- **Scheduled Tasks** - Automated publication and maintenance tasks

## 📖 Documentation

### Backend-Specific Documentation
- **[Code-Based Widget System](docs/CODE_BASED_WIDGET_SYSTEM.md)** - Widget architecture and development
- **[Core Widgets README](core_widgets/README.md)** - Built-in widget types and usage
- **[API Version Management](docs/api/version_management.md)** - Version control API reference
- **[Publishing Workflow](docs/PHASE_8_PUBLISHING_WORKFLOW_SUMMARY.md)** - CMS publishing system

### Implementation Guides
- **[Widget Template JSON Feature](docs/WIDGET_TEMPLATE_JSON_FEATURE.md)** - Template system integration
- **[Dynamic CSS Injection](docs/PHASE_2.3_DYNAMIC_CSS_INJECTION_SUMMARY.md)** - CSS management system
- **[Template Parsing Engine](docs/PHASE_1.2_TEMPLATE_PARSING_ENGINE_SUMMARY.md)** - Template processing

### Complete Documentation
See **[Complete Documentation Index](../DOCUMENTATION_INDEX.md)** for all project documentation organized by category and user role.

## 🔧 Deployment

### Production Configuration

```bash
# Environment variables
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379/0
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com

# Static files
python manage.py collectstatic --noinput

# Database migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

### Production Services
- **Web Server**: Gunicorn with nginx reverse proxy
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session storage and caching
- **Task Queue**: Celery with Redis broker
- **Monitoring**: Django Debug Toolbar (development) and logging

## 🏆 Achievements

### Technical Excellence
- ✅ **Professional CMS Features** - Complete publishing workflow
- ✅ **Type-Safe Architecture** - Pydantic-based widget system
- ✅ **Scalable Design** - Multi-tenancy and performance optimization
- ✅ **Comprehensive API** - RESTful APIs with complete documentation
- ✅ **Background Processing** - Celery-based task management

### System Capabilities
- **Version Control** - Complete audit trail with rollback capabilities
- **Widget System** - Code-based, type-safe widget architecture
- **Publishing Workflow** - Scheduling, bulk operations, and automation
- **Multi-Tenancy** - Namespace-based content isolation
- **Performance** - Optimized queries and caching strategies

## 🤝 Contributing

### Development Guidelines
1. **Follow Django Conventions** - Use Django best practices and patterns
2. **Write Comprehensive Tests** - Maintain high test coverage
3. **Use Type Hints** - Implement proper Python type annotations
4. **Document APIs** - Update API documentation for changes
5. **Performance Considerations** - Consider query optimization and caching

### Code Standards
- **PEP 8** - Python code formatting standards
- **Django Style Guide** - Django-specific conventions
- **API Design** - RESTful principles and DRF patterns
- **Database Design** - Proper normalization and relationships

## 🔗 Related Documentation

- **[Main Project README](../README.md)** - Complete project overview
- **[Frontend Documentation](../frontend/README.md)** - React frontend guide
- **[System Architecture](../docs/SYSTEM_OVERVIEW.md)** - System design and architecture
- **[Complete Documentation Index](../DOCUMENTATION_INDEX.md)** - All project documentation

---

**ECEEE v4 Backend**: Professional Django CMS with advanced features  
**Status**: Production Ready with Comprehensive APIs  
**Achievement**: Complete Publishing Workflow Implementation  
**Documentation**: Comprehensive and Current