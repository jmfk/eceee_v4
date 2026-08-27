# EASY v4 - AI-Integrated Development Environment

A comprehensive, AI-assisted development environment featuring Django backend, React frontend, PostgreSQL database, and Model Context Protocol (MCP) servers for enhanced AI-assisted development workflows.

## 🚀 Quick Start

### Prerequisites

- **OrbStack** with the Docker context set to `orbstack`
- The sibling `shared-local-infrastructure` repository provisioned and running
- **Node.js** 18+ and npm
- **Python** 3.11+
- **Git**

### Setup

```bash
make configure-local-infra
make servers
```

`configure-local-infra` writes the ignored mode-0600 `.env` from provider-managed credentials. `make servers` starts only ECEEE-owned application containers and imgproxy; PostgreSQL, Redis, and MinIO remain lifecycle-owned by `../shared-local-infrastructure`.

## 📋 Project Overview

ECEEE v4 is a modern content management system built with AI-assisted development principles. It combines robust backend technologies with modern frontend frameworks, all containerized for consistent development and deployment.

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Django Backend │    │   PostgreSQL    │
│  (Port 10100)   │◄──►│  (Port 10101)   │◄──►│ (Shared 10300)  │
│                 │    │                 │    │                 │
│ • Vite          │    │ • REST API      │    │ • Primary DB    │
│ • Tailwind CSS  │    │ • HTMX Views    │    │ • UUID Support  │
│ • React Query   │    │ • Authentication│    │ • Full-text     │
│ • React Router  │    │ • Admin Panel   │    │   Search        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │     Redis       │
                    │ (Shared 10301)  │
                    │                 │
                    │ • Caching       │
                    │ • Sessions      │
                    │ • Celery Queue  │
                    └─────────────────┘
```

## 📚 Documentation

### 🎯 **Major Achievement: 100% Frontend Test Success!** 🎯

We've achieved **100% frontend test success rate** - transforming from 31 failing tests to **128/128 tests passing**!

**📖 Complete Documentation Navigation:**
- **[🗂️ COMPLETE DOCUMENTATION INDEX](DOCUMENTATION_INDEX.md)** - **Master navigation for ALL project documentation**
- **[📋 Getting Started Guide](docs/README.md)** - Development workflow and project status
- **[🏗️ System Overview](docs/SYSTEM_OVERVIEW.md)** - Architecture and technology deep-dive
- **[🏆 Frontend Testing Success](docs/FRONTEND_TESTING_SUCCESS.md)** - Complete transformation story
- **[🧪 Testing Best Practices](docs/TESTING_BEST_PRACTICES.md)** - Standards for reliable testing
- **[📝 Publishing Workflow](docs/PHASE_8_PUBLISHING_WORKFLOW_SUMMARY.md)** - Professional CMS features
- **[🔄 Multi-Repo Development](docs/MULTI_REPO_DEVELOPMENT.md)** - Working with shared infra and branch DBs
- **[🔧 Frontend Refactoring Guide](docs/FRONTEND_REFACTORING_GUIDE.md)** - Component patterns

**📊 Quality Metrics:**
- ✅ **Test Success Rate**: 128/128 (100%)
- ✅ **Components Covered**: All 5 major components (100%)
- ✅ **Test Categories**: Unit, Integration, Accessibility
- ✅ **Best Practices**: Established and documented

### 📖 Quick Navigation by Role
- **New Developers**: [Quick Start](#-quick-start) → [Documentation Index](DOCUMENTATION_INDEX.md#-new-to-eceee-v4-start-here)
- **Frontend Developers**: [Documentation Index](DOCUMENTATION_INDEX.md#-frontend-developers)
- **Backend Developers**: [Documentation Index](DOCUMENTATION_INDEX.md#-backend-developers)
- **System Admins**: [Documentation Index](DOCUMENTATION_INDEX.md#-system-administrators)

## ✨ Key Features

### 🔄 Page Version Management
- **Draft/Published Workflow**: Create drafts, review changes, and publish when ready
- **Version History**: Complete audit trail of all page changes with user attribution
- **Version Comparison**: Visual diff between any two versions showing field and widget changes
- **One-Click Restoration**: Restore any previous version instantly
- **Advanced Filtering**: Find versions by status, date ranges, users, and content
- **Auto-Version Creation**: Automatic version snapshots on every page update

### 🎨 Layout & Theme System
- **Code-Based Layouts**: Python class-based layouts with automatic discovery
- **Slot Architecture**: Slot-based page layouts with custom template selection
- **Dynamic Themes**: CSS variable-based themes with real-time preview
- **Template Architecture**: Modern base template with Tailwind CSS, HTMX, and Alpine.js
- **Inheritance Engine**: Automatic propagation of layouts and themes down page hierarchy
- **Version Control**: Layouts tracked in Git with the codebase
- **Custom Templates**: Layout-specific template files for enhanced flexibility
- **Multi-Device Preview**: Preview pages across desktop, tablet, and mobile

### 🧩 Code-Based Widget System
- **Type-Safe Components**: Pydantic model-based widget definitions with compile-time validation
- **Auto-Discovery**: Automatic widget registration from Django apps
- **Zero Database Queries**: Widget types loaded once at startup for optimal performance
- **Generated Configuration UI**: Auto-generated forms from Pydantic schemas
- **Widget Inheritance**: Inherit and override widgets from parent pages with granular control
- **Version Control**: Widget types tracked in Git alongside your code
- **Developer Experience**: Full IDE support, auto-completion, and type checking

### 🚀 Modern Development Experience
- **Hot Reload**: Instant feedback during development
- **Component Library**: Comprehensive UI component system
- **Type Safety**: Full TypeScript support across frontend
- **API Documentation**: Interactive API docs with OpenAPI/Swagger
- **Database Migrations**: Zero-downtime schema evolution

## 🛠️ Technology Stack

### Backend
- **Django 4.2+** - Python web framework
- **Django REST Framework** - API development
- **PostgreSQL 17** - Shared local primary database
- **Redis** - Caching and session storage
- **Celery** - Background task processing
- **HTMX** - Server-side dynamic interactions

### Frontend
- **React 19** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Zustand** - State management
- **React Hook Form** - Form handling

### DevOps & Infrastructure
- **Docker & Docker Compose** - Containerization
- **nginx** - Web server (production)
- **GitHub Actions** - CI/CD (configured)
- **PostgreSQL** - Production database

### AI Integration
- **Model Context Protocol (MCP)** - AI tool integration
- **MCP Servers** - Filesystem, Git, GitHub, Database operations
- **Claude Desktop** - AI assistant integration
- **Cursor IDE** - AI-powered development environment

## 🎯 Recent Improvements

### Frontend Refactoring (2024)

The PageManagement component has been comprehensively refactored following clean code principles:

- **37% size reduction** - From 730 to 459 lines in main component
- **Component extraction** - Created focused, single-responsibility components
- **Custom hooks** - Extracted business logic into reusable hooks
- **Improved maintainability** - Easier testing, debugging, and future enhancements

**New Architecture:**
- `PageFilters` - Advanced search and filtering UI
- `PageList` - Paginated listing with action buttons
- `PageForm` - Create/edit forms with validation
- `PageDetails` - Clean information display
- `usePageFilters` - Filtering logic with memoization
- `usePageMutations` - CRUD operations with error handling

See [Frontend Refactoring Guide](docs/FRONTEND_REFACTORING_GUIDE.md) for detailed information.

## 🏗️ Development Environment

### Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:10100 | React application |
| Backend API | http://localhost:10101 | Django REST API |
| Admin Panel | http://localhost:10101/admin/ | Django admin interface |
| API Docs | http://localhost:10101/api/docs/ | Interactive API documentation |
| MinIO API | http://localhost:10302 | Shared S3-compatible object storage |
| MinIO Console | http://localhost:10303 | Shared object storage administration |
| Imgproxy | http://localhost:10106 | Image transformation service |
| Playwright renderer | http://localhost:10107 | Website rendering service |

ECEEE owns the local application range `10100-10199` in the machine-wide port registry. Shared services use their provider-owned range `10300-10309`; ECEEE does not start, stop, reset, or delete those containers or volumes.

### Database Access

- **Host**: localhost
- **Port**: 10300
- **Database**: eceee_v4
- **Username**: local_eceee_v4
- **Password**: generated under the shared provider's ignored `secrets/projects/`

### Redis Access

- **Host**: localhost
- **Port**: 10301
- **Database**: 0
- **User/namespace**: eceee_v4 / `eceee_v4:*`

## 📁 Project Structure

```
eceee_v4/
├── backend/                 # Django application
│   ├── config/             # Django project settings
│   ├── templates/          # HTML templates
│   ├── static/             # Static files
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Backend container config
├── frontend/               # React application
│   ├── src/               # Source code
│   │   ├── components/    # Reusable components
│   │   │   └── page-management/  # Refactored page components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks (usePageFilters, etc.)
│   │   ├── stores/        # State management
│   │   ├── api/           # API integration
│   │   └── utils/         # Utility functions
│   ├── package.json       # Node.js dependencies
│   └── Dockerfile         # Frontend container config
├── docker/                # Docker configurations
│   ├── init-db.sql       # Database initialization
│   └── mcp-servers/      # MCP server configurations
├── scripts/               # Development scripts
│   └── start-dev.sh      # Environment startup script
├── docs/                  # Project documentation
│   ├── SYSTEM_OVERVIEW.md       # System architecture
│   └── FRONTEND_REFACTORING_GUIDE.md  # Clean code refactoring
├── tests/                 # Integration tests
├── docker-compose.dev.yml # Multi-container orchestration
├── .env.template          # Environment variables template
└── README.md             # This file
```

## 🔧 Development Commands

### Docker Management

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build

# Remove volumes (reset database)
docker-compose -f docker-compose.dev.yml down -v
```

### Django Backend

```bash
# Django shell
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

# Create superuser
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Collect static files
docker-compose -f docker-compose.dev.yml exec backend python manage.py collectstatic

# Run tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Django shell with enhanced features
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell_plus
```

### React Frontend

```bash
# Install new package
docker-compose -f docker-compose.dev.yml exec frontend npm install <package-name>

# Run linting
docker-compose -f docker-compose.dev.yml exec frontend npm run lint

# Build for production
docker-compose -f docker-compose.dev.yml exec frontend npm run build
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose -f docker-compose.dev.yml exec db psql -U postgres -d eceee_v4

# Backup database
docker-compose -f docker-compose.dev.yml exec db pg_dump -U postgres eceee_v4 > backup.sql

# Restore database
docker-compose -f docker-compose.dev.yml exec -T db psql -U postgres eceee_v4 < backup.sql
```

## 🧪 Testing

### Backend Testing

```bash
# Run all tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Run specific test file
docker-compose -f docker-compose.dev.yml exec backend python manage.py test apps.core.tests

# Run with coverage
docker-compose -f docker-compose.dev.yml exec backend coverage run --source='.' manage.py test
docker-compose -f docker-compose.dev.yml exec backend coverage report
```

### Frontend Testing

```bash
# Run Jest tests
docker-compose -f docker-compose.dev.yml exec frontend npm test

# Run tests with coverage
docker-compose -f docker-compose.dev.yml exec frontend npm run test:coverage

# Run E2E tests
docker-compose -f docker-compose.dev.yml exec frontend npm run test:e2e
```

## 🤖 AI Integration

This project is designed for AI-assisted development using:

### Model Context Protocol (MCP) Servers

- **Filesystem Server**: File operations and code exploration
- **Git Server**: Version control operations
- **GitHub Server**: Repository management and issue tracking
- **PostgreSQL Server**: Database queries and schema analysis

### AI Development Workflow

1. **Code Generation**: Use AI assistants to generate boilerplate code
2. **Testing**: AI-assisted test case generation and coverage analysis
3. **Documentation**: Automated documentation generation and updates
4. **Debugging**: AI-powered error analysis and solution suggestions
5. **Optimization**: Performance analysis and improvement recommendations

### Cursor IDE Integration

This project is optimized for use with Cursor IDE:

1. Open the project root in Cursor
2. The AI will automatically understand the project structure
3. Use Ctrl+K for AI-assisted code generation
4. Use Ctrl+L for AI chat about the codebase

## 🔒 Security

### Development Security

- CSRF protection enabled
- CORS configured for frontend integration
- Environment variable management
- SQL injection prevention
- XSS protection
- Secure headers configuration

### Production Considerations

- Use strong secret keys
- Enable HTTPS
- Configure proper firewall rules
- Regular security updates
- Database connection encryption
- Rate limiting implementation

## 📈 Monitoring and Performance

### Built-in Monitoring

- **Django Debug Toolbar**: Development debugging
- **Silk Profiling**: Performance analysis
- **Prometheus Metrics**: Application metrics
- **PostgreSQL Performance**: Query analysis
- **Redis Monitoring**: Cache performance

### Performance Optimization

- Database query optimization
- Redis caching strategy
- Frontend code splitting
- Static file optimization
- Image optimization
- CDN integration (production)

## 🚀 Deployment

### Production Deployment

See **[deploy/README.md](deploy/README.md)** for the full flow. Secrets live in **`deploy/.env`** (gitignored); copy from **`deploy/.env.production.example`**. From the repo root:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
```

Use `docker-compose.dev.yml` for local development.

### Environment Configuration

Copy `.env.template` to `.env` and update:

```env
# Database
POSTGRES_PASSWORD=secure_production_password

# Django
SECRET_KEY=your_secure_secret_key
DEBUG=False
ALLOWED_HOSTS=your-domain.com

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

## 📚 Additional Documentation References

### API Documentation

- **Swagger UI**: http://localhost:10101/api/docs/
- **ReDoc**: http://localhost:10101/api/redoc/
- **OpenAPI Schema**: http://localhost:10101/api/schema/

### Detailed Documentation
For comprehensive documentation including architecture, development guides, API references, and component libraries, see the **[Complete Documentation Index](DOCUMENTATION_INDEX.md)** which organizes all project documentation by category and user role.

#### Key Documentation Highlights
- **[Version Management API](backend/docs/api/version_management.md)** - Complete API documentation for version management endpoints
- **[Version Management UI Guide](frontend/docs/version_management_guide.md)** - Step-by-step user guide for the version management interface
- **[Widget System Documentation](docs/WIDGET_SYSTEM_DOCUMENTATION_INDEX.md)** - Complete widget architecture and development guide
- **[System Architecture](docs/SYSTEM_OVERVIEW.md)** - Detailed breakdown of codebase organization and data flow

### External Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Docker Documentation](https://docs.docker.com/)

## 🧪 Testing the Code-Based Widget System

The project has been fully migrated to a code-based widget system with comprehensive test coverage:

### Backend Testing
```bash
# Run all backend tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Test widget system specifically  
docker-compose -f docker-compose.dev.yml exec backend python manage.py test webpages.tests.WidgetRegistryTest
docker-compose -f docker-compose.dev.yml exec backend python manage.py test webpages.tests.WidgetTypeAPITest
```

### Frontend Testing
```bash
# Run all frontend tests
docker-compose -f docker-compose.dev.yml exec frontend npm run test:run

# Test widget components specifically
docker-compose -f docker-compose.dev.yml exec frontend npm run test:run src/components/__tests__/WidgetLibrary.test.jsx
docker-compose -f docker-compose.dev.yml exec frontend npm run test:run src/components/__tests__/WidgetConfigurator.test.jsx
```

### Key Testing Updates
- **Backend**: Widget types now reference by name instead of database ID
- **Frontend**: API responses are direct arrays instead of paginated results
- **Validation**: Pydantic models provide compile-time type safety
- **Performance**: Zero database queries for widget type definitions

For detailed testing documentation, see [docs/CODE_BASED_WIDGET_SYSTEM_TESTING.md](docs/CODE_BASED_WIDGET_SYSTEM_TESTING.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use ESLint/Prettier for JavaScript/React code
- Write tests for new features
- Update documentation for significant changes
- Use semantic commit messages

## 📄 License

![License: SSPL-1.0](https://img.shields.io/badge/License-SSPL--1.0-blue.svg)

This project is licensed under the **Server Side Public License (SSPL) v1.0**.

### What does this mean?

- ✅ **Free to use, modify, and distribute** for any purpose
- ✅ **Strong copyleft protection** - derivatives must use the same license
- ⚠️ **Service providers must share infrastructure code** - If you offer this software as a service (SaaS), you must release all service infrastructure code under SSPL

### Why SSPL?

The SSPL license protects open source projects from being exploited by cloud providers who offer the software as a service without contributing back to the community. It ensures that if someone builds a business around this software as a service, they must share their improvements and infrastructure.

### For Users

- **Open Source Projects**: Use freely under SSPL terms
- **Self-Hosting**: No restrictions - host for yourself or your organization
- **Commercial License**: Contact for alternative licensing if SSPL Section 13 is incompatible with your use case

For full license text and terms, see the [LICENSE](LICENSE) file.

**Copyright (C) 2025 Johan Mats Fred Karlsson**

## 🙏 Acknowledgments

- Django Software Foundation
- React Team
- Tailwind CSS Team
- Anthropic (Claude AI)
- Model Context Protocol contributors
- Open source community

---

**Built with ❤️ using AI-assisted development workflows**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/your-username/eceee_v4).
