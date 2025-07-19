# ECEEE v4 System Overview

## Introduction

ECEEE v4 is a comprehensive content management system designed for modern web development with AI-assisted workflows. The system provides enterprise-level features including advanced version control, flexible layout systems, and comprehensive widget management.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  React 19 + Vite + Tailwind CSS + React Query + Zustand       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │    Pages    │  │ Components  │  │    API      │            │
│  │             │  │             │  │ Integration │            │
│  │ • Page Mgmt │  │ • Layouts   │  │             │            │
│  │ • Versions  │  │ • Themes    │  │ • Versions  │            │
│  │ • Widgets   │  │ • Widgets   │  │ • Pages     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                  │
                              HTTP/REST
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│              Django 4.2+ + DRF + PostgreSQL                   │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Models    │  │   Views     │  │  Serializers│            │
│  │             │  │             │  │             │            │
│  │ • WebPage   │  │ • REST APIs │  │ • Page Data │            │
│  │ • Versions  │  │ • Filters   │  │ • Versions  │            │
│  │ • Layouts   │  │ • Actions   │  │ • Layouts   │            │
│  │ • Themes    │  │ • Workflow  │  │ • Themes    │            │
│  │ • Widgets   │  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                  │
                              Database
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                              │
├─────────────────────────────────────────────────────────────────┤
│           PostgreSQL 15 + Redis + File Storage                 │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Primary DB  │  │   Caching   │  │   Storage   │            │
│  │             │  │             │  │             │            │
│  │ • Pages     │  │ • Sessions  │  │ • Media     │            │
│  │ • Versions  │  │ • API Cache │  │ • Static    │            │
│  │ • Users     │  │ • Query     │  │ • Uploads   │            │
│  │ • Content   │  │   Cache     │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Core Systems

### 1. Page Version Management System

#### Purpose
Comprehensive version control for web pages enabling draft/published workflows, change tracking, and content restoration.

#### Key Components

**Backend Models:**
- `PageVersion`: Stores complete page snapshots with metadata
- Version statuses: `draft`, `published`, `archived`
- User attribution and timestamps
- Change summaries and descriptions

**API Endpoints:**
- `GET /api/webpages/versions/` - List and filter versions
- `POST /api/webpages/versions/{id}/publish/` - Publish draft versions
- `POST /api/webpages/versions/{id}/create_draft/` - Create drafts from published
- `POST /api/webpages/versions/{id}/restore/` - Restore previous versions
- `GET /api/webpages/versions/compare/` - Compare version differences

**Frontend Interface:**
- Version management modal with statistics dashboard
- Visual version cards with status indicators
- One-click publish, restore, and comparison actions
- Advanced filtering and search capabilities

#### Workflow
1. **Content Creation**: Users edit pages creating automatic draft versions
2. **Review Process**: Drafts can be previewed and compared with published versions
3. **Publishing**: Drafts are published to become live content
4. **History Management**: Complete audit trail maintained for all changes
5. **Recovery**: Any version can be restored as current content

### 2. Layout & Theme System

#### Purpose
Flexible page structure and styling system with inheritance capabilities.

#### Key Components

**Layout System:**
- Code-based layout definitions as Python classes
- Slot-based page structure definition
- Automatic layout discovery from Django apps
- Custom template selection per layout
- Layout-specific CSS classes for enhanced styling
- Layout inheritance down page hierarchy
- Override capabilities for specific pages

**Theme System:**
- CSS variable-based theming
- Custom CSS support
- Theme inheritance and overrides
- Real-time preview capabilities

**Inheritance Engine:**
- Automatic propagation of layouts/themes
- Conflict detection and resolution
- Override tracking and management
- Performance-optimized inheritance queries

### 3. Widget System

#### Purpose
Reusable, configurable page components with full versioning support.

#### Key Components

**Widget Types:**
- JSON Schema-based widget definitions
- Auto-generated configuration forms
- Template-based rendering
- Validation and type checking

**Widget Management:**
- Drag-and-drop placement
- Slot-based organization
- Sort order management
- Configuration persistence

**Widget Inheritance:**
- Inherit widgets from parent pages
- Override inherited widgets
- Add page-specific widgets
- Complete change tracking

### 4. Template System

#### Purpose
Standardized template architecture with flexible layout rendering and theme integration.

#### Key Components

**Base Template Architecture:**
- `base_eceee.html` - Primary base template with modern web standards
- Tailwind CSS integration for utility-first styling
- HTMX for progressive enhancement and dynamic interactions
- Alpine.js for lightweight JavaScript functionality
- Consistent navigation and responsive design structure

**Layout Template System:**
- Custom template selection via PageLayout `template_name` field
- Defaults to `webpages/page_detail.html` for backward compatibility
- Support for layout-specific template files
- Template inheritance from base_eceee.html
- Automatic theme and CSS variable injection

**Template Features:**
- Dynamic CSS variable injection from PageTheme
- Custom CSS support with safe rendering
- Layout-specific CSS classes from PageLayout
- Breadcrumb navigation with hierarchical structure
- SEO-optimized meta tags and structured data
- Child page navigation and discovery
- Widget slot rendering with inheritance tracking

## Data Models

### Core Models

```python
# Page Management
WebPage
├── id (UUID)
├── title, slug, description
├── parent (self-referential hierarchy)
├── code_layout (CharField) - references code-based layout by name
├── theme (FK to PageTheme)
├── publication_status
├── effective_date, expiry_date
├── created_by, last_modified_by
└── timestamps

# Version Management  
PageVersion
├── id (UUID)
├── page (FK to WebPage)
├── version_number (auto-incrementing)
├── description
├── page_data (JSON snapshot)
├── status (draft/published/archived)
├── is_current (boolean)
├── created_at, created_by
├── published_at, published_by
└── change_summary (JSON)

# Layout System (Code-Based)
# Layouts are defined as Python classes in application code:
# - Automatic discovery from Django apps
# - Slot configuration defined in class attributes  
# - Template and CSS class specifications
# - Version controlled with application code
# - No database storage required

# Theme System
PageTheme
├── id (UUID)
├── name, description  
├── css_variables (JSON)
├── custom_css (TextField)
├── is_active
└── created_by, created_at

# Widget System
WidgetType
├── id (UUID)
├── name, description
├── json_schema (widget configuration)
├── template_name
├── is_active
└── created_by, created_at

PageWidget
├── id (UUID)
├── page (FK to WebPage)
├── widget_type (FK to WidgetType)
├── slot_name
├── sort_order
├── configuration (JSON)
├── inherit_from_parent (boolean)
├── override_parent (boolean)
└── created_by, created_at
```

### Relationships

```
WebPage (1) ──── (Many) PageVersion
WebPage (Many) ──── (1) PageTheme
WebPage (1) ──── (Many) PageWidget
PageWidget (Many) ──── (1) WidgetType
WebPage (1) ──── (Many) WebPage (parent/child)
# Note: Layout relationships are code-based, not database foreign keys
```

## API Architecture

### REST API Design

**Base URL:** `/api/webpages/`

**Resource Endpoints:**
- `/pages/` - Page CRUD operations
- `/versions/` - Version management
- `/layouts/` - Layout management  
- `/themes/` - Theme management
- `/widgets/` - Widget management
- `/widget-types/` - Widget type definitions

**Action Endpoints:**
- `/pages/{id}/publish/` - Publish page
- `/pages/{id}/preview/` - Preview page
- `/versions/{id}/publish/` - Publish version
- `/versions/{id}/restore/` - Restore version
- `/versions/compare/` - Compare versions

### Authentication & Permissions

- **Authentication**: Django's session-based authentication
- **Permissions**: Django's built-in permission system
- **User Attribution**: All changes tracked to users
- **API Access**: DRF token authentication for API clients

### Data Serialization

**List Serializers**: Lightweight data for list views
**Detail Serializers**: Complete data for individual resources
**Nested Serializers**: Related data inclusion for efficiency
**Custom Fields**: Specialized fields for JSON data and relationships

## Frontend Architecture

### Template Rendering (Public Views)

**Enhanced Page Rendering:**
- Dynamic template selection based on code layout template_name
- Automatic theme CSS variable injection into page head
- Layout-specific CSS classes for enhanced styling flexibility  
- Breadcrumb navigation with hierarchical page structure
- SEO-optimized meta tags (title, description, keywords)
- Child page discovery and navigation
- Widget inheritance visualization and tracking

**Base Template Integration:**
- Modern web standards with Tailwind CSS, HTMX, and Alpine.js
- Progressive enhancement for dynamic interactions
- Consistent navigation structure across all pages
- Responsive design patterns and accessibility features
- Performance-optimized asset loading and caching

**Template Inheritance Flow:**
```
base_eceee.html (base template)
    ↓ extends
page_detail.html (default layout template)
    ↓ or custom template via code layout template_name
custom_layout.html (layout-specific template)
```

### Component Organization

```
src/
├── components/           # Reusable UI components
│   ├── LayoutEditor.jsx     # Layout management interface
│   ├── ThemeEditor.jsx      # Theme management interface  
│   ├── VersionManager.jsx   # Version control interface
│   ├── WidgetLibrary.jsx    # Widget selection and config
│   ├── PagePreview.jsx      # Page preview with inheritance
│   └── page-management/     # Page management components
│       ├── PageFilters.jsx     # Search and filtering UI
│       ├── PageList.jsx        # Page listing with actions
│       ├── PageForm.jsx        # Page creation/edit form
│       ├── PageDetails.jsx     # Page information display
│       └── index.js           # Component exports
├── pages/               # Top-level page components
│   └── PageManagement.jsx   # Main orchestrator component
├── api/                 # API integration layer
│   ├── pages.js            # Page-related API calls
│   ├── versions.js         # Version management API
│   ├── layouts.js          # Layout API integration
│   └── themes.js           # Theme API integration
├── hooks/               # Custom React hooks
│   ├── usePageFilters.js   # Page filtering logic
│   ├── usePageMutations.js # Page CRUD operations
│   └── ...                 # Other custom hooks
├── stores/              # Zustand state management
└── utils/               # Utility functions
```

### Component Architecture Principles

**Clean Architecture**: Components follow single responsibility principle
**Extract Method Pattern**: Complex logic extracted into custom hooks
**Composition over Inheritance**: Components compose smaller, focused pieces
**Separation of Concerns**: UI, business logic, and data fetching are separated

#### Page Management Refactoring

The PageManagement component has been refactored following clean code principles:

- **Main Component (459 lines)**: Orchestrates child components and manages high-level state
- **PageFilters**: Handles search, filtering, and advanced filter options
- **PageList**: Displays paginated page list with loading states and actions
- **PageForm**: Manages page creation and editing with validation
- **PageDetails**: Shows selected page information in a clean layout
- **usePageFilters Hook**: Encapsulates filtering logic with memoization
- **usePageMutations Hook**: Handles CRUD operations with error handling

This refactoring reduced the main component size by 37% while improving maintainability and testability.

### State Management

**React Query**: Server state management and caching
**Zustand**: Client-side state for UI interactions
**Local State**: Component-level state with useState
**Form State**: React Hook Form for complex forms
**Custom Hooks**: Encapsulated business logic and state management

### Routing & Navigation

**React Router v6**: Client-side routing
**Tabbed Interface**: Section-based navigation
**Modal Overlays**: Non-disruptive workflows
**Deep Linking**: Direct access to specific functions

## Development Workflow

### AI-Assisted Development

**Model Context Protocol (MCP)**: Integration with AI development tools
**Cursor IDE**: AI-powered code generation and refactoring
**Documentation**: Comprehensive inline and external documentation
**Testing**: Automated test generation and validation

### Version Control Integration

**Git Workflow**: Feature branches with pull request reviews
**Automatic Testing**: CI/CD pipeline with comprehensive test suite
**Code Quality**: ESLint, Prettier, Black code formatting
**Security**: Dependency scanning and vulnerability assessments

### Database Management

**Migrations**: Django's migration system for schema evolution
**Fixtures**: Seed data for development and testing
**Backup/Restore**: Automated database backup procedures
**Performance**: Query optimization and indexing strategies

## Security Considerations

### Authentication & Authorization

- **User Authentication**: Secure login with session management
- **Permission-Based Access**: Granular permissions for different user roles
- **API Security**: Token-based authentication for API access
- **Session Security**: Secure session configuration

### Data Protection

- **Input Validation**: Comprehensive validation on all inputs
- **SQL Injection Prevention**: ORM usage and parameterized queries
- **XSS Protection**: Template auto-escaping and CSP headers
- **CSRF Protection**: Django's built-in CSRF protection

### Infrastructure Security

- **HTTPS Enforcement**: SSL/TLS encryption for all communications
- **Secure Headers**: Security-focused HTTP headers
- **Secrets Management**: Environment-based secret configuration
- **Container Security**: Minimal container images and security scanning

## Performance Optimization

### Database Performance

- **Indexing Strategy**: Optimized indexes for common query patterns
- **Query Optimization**: Select_related and prefetch_related usage
- **Connection Pooling**: Efficient database connection management
- **Caching**: Redis-based caching for frequently accessed data

### Frontend Performance

- **Code Splitting**: Lazy loading of route-based components
- **Asset Optimization**: Image compression and efficient bundling
- **Caching Strategy**: Browser and CDN caching optimization
- **React Optimization**: Memoization and efficient re-rendering

### API Performance

- **Pagination**: Efficient pagination for large datasets
- **Filtering**: Database-level filtering to reduce data transfer
- **Compression**: Response compression for reduced bandwidth
- **Rate Limiting**: API rate limiting to prevent abuse

## Monitoring & Observability

### Application Monitoring

- **Django Debug Toolbar**: Development debugging information
- **Silk Profiling**: Performance profiling and optimization
- **Prometheus Metrics**: Application metrics collection
- **Health Checks**: System health monitoring endpoints

### Error Tracking

- **Exception Handling**: Comprehensive error handling and logging
- **User-Friendly Errors**: Meaningful error messages for users
- **Error Recovery**: Graceful degradation and recovery mechanisms
- **Audit Logging**: Complete audit trail for all system changes

### Performance Monitoring

- **Response Time Tracking**: API and page load time monitoring
- **Resource Usage**: Memory and CPU utilization tracking
- **Database Performance**: Query performance and optimization
- **User Experience**: Frontend performance and user interaction tracking

## Deployment & Operations

### Containerization

- **Docker Compose**: Multi-container orchestration
- **Environment Separation**: Development, staging, and production environments
- **Service Isolation**: Separate containers for different services
- **Volume Management**: Persistent data storage management

### Scaling Considerations

- **Horizontal Scaling**: Multiple application server instances
- **Database Scaling**: Read replicas and connection pooling
- **Static File Serving**: CDN integration for static assets
- **Load Balancing**: Traffic distribution across instances

### Backup & Recovery

- **Database Backups**: Automated database backup procedures
- **File Storage Backups**: Media and static file backup strategies
- **Disaster Recovery**: Complete system recovery procedures
- **Testing**: Regular backup testing and recovery validation

This comprehensive system provides enterprise-level content management capabilities with modern development practices and AI-assisted workflows. 