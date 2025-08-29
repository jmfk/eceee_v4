# Object Storage System Documentation

## Overview

The Object Storage System is a comprehensive, database-driven content management solution for non-hierarchical content in the eceee_v4 CMS. It provides dynamic object types with configurable schemas, hierarchical relationships, and seamless integration with the existing widget system.

## Key Features

### 🔧 Dynamic Object Types
- **Database-Defined Schemas**: Create object types without code changes
- **Field Type Support**: Text, rich text, numbers, dates, booleans, images, files, URLs, emails, choices, user references
- **Widget Slot Configuration**: Define where widgets can be placed in object instances
- **Parent-Child Relationships**: Configure which object types can be children of others

### 🌳 Advanced Hierarchy Management
- **MPTT Integration**: Efficient tree operations with O(1) queries
- **Multi-Level Hierarchies**: Support for deep nested structures
- **Tree Operations**: Move objects, get ancestors/descendants, traverse trees
- **Hierarchy Validation**: Prevent circular references and invalid relationships

### 🎨 Widget System Integration
- **Display Widgets**: Object List, Object Detail, Object Children widgets
- **Page Integration**: Display objects in any page using specialized widgets
- **Template Customization**: Multiple display templates (card, list, minimal)
- **CSS Styling**: Customizable styling with CSS variables

### 📊 Content Management
- **Full CRUD Operations**: Create, read, update, delete object types and instances
- **Publishing Workflow**: Draft, published, archived status with scheduling
- **Bulk Operations**: Multi-select publish/unpublish/archive/delete
- **Version Control**: Automatic version snapshots with comparison tools

### 🔍 Advanced Search
- **Multi-Field Search**: Search across titles, content, and metadata
- **Advanced Filters**: Filter by type, status, hierarchy level, dates
- **Relevance Scoring**: Results ordered by relevance and recency
- **Real-Time Filtering**: Instant search results with query caching

## System Architecture

### Backend Components

#### Models
```python
# Core Models
ObjectTypeDefinition  # Defines object types with schemas and slots
ObjectInstance       # Actual object instances with MPTT hierarchy
ObjectVersion        # Version history and snapshots

# Key Features
- JSONField for flexible data storage
- MPTT for efficient tree operations
- Comprehensive validation and constraints
- Optimized database indexes
```

#### API Endpoints
```
Object Type Management:
GET/POST   /api/v1/objects/api/object-types/
GET/PUT/DELETE /api/v1/objects/api/object-types/{id}/
GET        /api/v1/objects/api/object-types/{id}/schema/
GET        /api/v1/objects/api/object-types/{id}/instances/
GET        /api/v1/objects/api/object-types/active/

Object Instance Management:
GET/POST   /api/v1/objects/api/objects/
GET/PUT/DELETE /api/v1/objects/api/objects/{id}/
POST       /api/v1/objects/api/objects/{id}/publish/
GET        /api/v1/objects/api/objects/{id}/versions/

Hierarchy Operations:
GET        /api/v1/objects/api/objects/{id}/children/
GET        /api/v1/objects/api/objects/{id}/descendants/
GET        /api/v1/objects/api/objects/{id}/ancestors/
GET        /api/v1/objects/api/objects/{id}/siblings/
GET        /api/v1/objects/api/objects/{id}/tree/
POST       /api/v1/objects/api/objects/{id}/move_to/

Advanced Operations:
GET        /api/v1/objects/api/objects/published/
GET        /api/v1/objects/api/objects/search/
GET        /api/v1/objects/api/objects/roots/
POST       /api/v1/objects/api/objects/bulk-operations/
```

#### Display Widgets
```python
# Available Widgets
ObjectListWidget     # Display filtered lists of objects
ObjectDetailWidget   # Show single object with full details
ObjectChildrenWidget # Display child objects hierarchically

# Widget Configuration
- Flexible configuration through Pydantic models
- Template customization options
- CSS styling with variables
- Integration with page widget system
```

### Frontend Components

#### Management Interface
```jsx
// Core Components
ObjectTypeManager    # Manage object type definitions
ObjectTypeForm      # Create/edit object types with schema editor
ObjectInstanceEditor # Dynamic form generator for object instances
ObjectBrowser       # Browse and manage object instances

// Page Integration
ObjectStoragePage   # Main object browser page (/objects)
SettingsManager     # Object types in Settings tab
```

#### Key Features
- **Dynamic Forms**: Generated based on object type schemas
- **Hierarchy Visualization**: Visual tree structure with indentation
- **Bulk Operations**: Multi-select with batch actions
- **Advanced Search**: Comprehensive filtering and search capabilities
- **Version Management**: Version history viewer with comparison tools

## Usage Guide

### Creating Object Types

1. **Navigate to Settings** → Object Types tab
2. **Click "New Object Type"**
3. **Configure Basic Info**:
   - Name: Unique identifier (e.g., "news", "blog")
   - Label: Display name (e.g., "News Article")
   - Description: What this type represents

4. **Define Schema Fields**:
   - Add fields with appropriate types
   - Set required/optional status
   - Configure validation rules

5. **Configure Widget Slots**:
   - Define areas where widgets can be placed
   - Set allowed widget types
   - Configure requirements and limits

6. **Set Relationships**:
   - Choose which object types can be children
   - Enable hierarchical structures

### Managing Object Instances

1. **Navigate to Objects** page (`/objects`)
2. **Use Search and Filters**:
   - Text search across all fields
   - Filter by object type, status
   - Use advanced filters for precise results

3. **Create New Objects**:
   - Click "New Object"
   - Select object type
   - Fill dynamic form based on schema
   - Configure publishing settings

4. **Bulk Operations**:
   - Select multiple objects with checkboxes
   - Use bulk actions: publish, unpublish, archive, delete
   - Efficient content management workflows

### Displaying Objects in Pages

1. **Add Object Widgets** to pages:
   - **Object List**: Show filtered lists of objects
   - **Object Detail**: Display single object with details
   - **Object Children**: Show hierarchical child content

2. **Configure Widget Settings**:
   - Choose object type to display
   - Set filtering and ordering options
   - Select display template (card, list, minimal)
   - Configure hierarchy and excerpt options

## API Integration

### Frontend API Client
```javascript
import { objectTypesApi, objectInstancesApi } from '../api/objectStorage'

// Object Types
const types = await objectTypesApi.list()
const type = await objectTypesApi.get(id)
await objectTypesApi.create(data)

// Object Instances  
const objects = await objectInstancesApi.list(params)
const object = await objectInstancesApi.get(id)
await objectInstancesApi.create(data)

// Hierarchy Operations
const children = await objectInstancesApi.getChildren(id)
const ancestors = await objectInstancesApi.getAncestors(id)
await objectInstancesApi.moveTo(id, newParentId, position)

// Search and Bulk Operations
const results = await objectInstancesApi.search(query, filters)
await objectInstancesApi.bulkOperation(operation, objectIds)
```

### Case Conversion
The API automatically converts between:
- **Frontend**: camelCase (JavaScript convention)
- **Backend**: snake_case (Python/Django convention)

## Database Schema

### Object Type Definition
```sql
CREATE TABLE object_storage_objecttypedefinition (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(200) NOT NULL,
    plural_label VARCHAR(200) NOT NULL,
    description TEXT,
    icon_image VARCHAR(100),
    schema JSONB DEFAULT '{}',
    slot_configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_id INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'
);
```

### Object Instance (with MPTT)
```sql
CREATE TABLE object_storage_objectinstance (
    id SERIAL PRIMARY KEY,
    object_type_id INTEGER NOT NULL,
    title VARCHAR(300) NOT NULL,
    slug VARCHAR(300) NOT NULL,
    data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft',
    parent_id INTEGER,
    widgets JSONB DEFAULT '{}',
    publish_date TIMESTAMP WITH TIME ZONE,
    unpublish_date TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    created_by_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    -- MPTT Fields
    level INTEGER NOT NULL,
    lft INTEGER NOT NULL,
    rght INTEGER NOT NULL,
    tree_id INTEGER NOT NULL
);
```

## Configuration Examples

### News Article Type
```json
{
  "name": "news",
  "label": "News Article",
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "text",
        "required": true,
        "maxLength": 200
      },
      {
        "name": "content",
        "type": "rich_text",
        "required": true
      },
      {
        "name": "category",
        "type": "choice",
        "choices": ["company", "industry", "research"]
      }
    ]
  },
  "slot_configuration": {
    "slots": [
      {
        "name": "main_content",
        "label": "Main Content",
        "allowedWidgets": ["text_block", "image"],
        "required": true
      }
    ]
  }
}
```

### Blog with Comments
```json
{
  "name": "blog",
  "label": "Blog Post", 
  "allowed_child_types": ["comment"],
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "text",
        "required": true
      },
      {
        "name": "content", 
        "type": "rich_text",
        "required": true
      }
    ]
  }
}
```

## Performance Considerations

### Database Optimization
- **GIN Indexes**: On JSON fields for fast search
- **MPTT Indexes**: Optimized tree traversal
- **Composite Indexes**: For common query patterns
- **Query Optimization**: Select/prefetch related objects

### Frontend Optimization
- **React Query Caching**: Efficient data fetching and caching
- **Lazy Loading**: Components load data as needed
- **Debounced Search**: Reduced API calls during typing
- **Bulk Operations**: Efficient multi-item operations

## Security Features

### Authentication & Authorization
- **JWT Authentication**: Secure API access
- **Permission Checks**: User-based access control
- **CSRF Protection**: Cross-site request forgery prevention
- **Input Validation**: Comprehensive data validation

### Data Protection
- **Schema Validation**: Ensure data integrity
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Safe template rendering
- **File Upload Security**: Secure image/file handling

## Deployment Notes

### Requirements
- Django 4.2+
- PostgreSQL 15+
- Redis (for caching)
- Python 3.11+
- Node.js 18+ (frontend)

### Environment Setup
```bash
# Backend
docker-compose up backend

# Frontend  
docker-compose up frontend

# Create demo data
docker-compose exec backend python manage.py create_object_demo_data
```

### Production Considerations
- **Database Migrations**: Run migrations before deployment
- **Static Files**: Collect static files for production
- **Environment Variables**: Configure production settings
- **Monitoring**: Set up logging and monitoring for object operations

## Troubleshooting

### Common Issues

**API 404 Errors**:
- Verify backend is running on port 8000
- Check API URLs use `/api/v1/objects/api/` prefix
- Ensure authentication is properly configured

**Widget Loading Errors**:
- Verify `configuration_model` is defined as property
- Check widget templates exist in correct directories
- Ensure widget registration in Django apps

**Hierarchy Issues**:
- Run `ObjectInstance.objects.rebuild()` to fix MPTT tree
- Check parent-child type relationships are properly configured
- Verify MPTT fields have correct default values

**Frontend Errors**:
- Check case conversion functions are imported correctly
- Verify API response structure handling (paginated vs direct)
- Ensure React Query cache invalidation after mutations

## Future Enhancements

### Potential Features
- **Full-Text Search**: PostgreSQL full-text search integration
- **Media Integration**: Enhanced image/file field support  
- **Workflow Management**: Advanced publishing workflows
- **API Permissions**: Fine-grained permission system
- **Import/Export**: Bulk data import/export capabilities
- **Audit Trail**: Detailed change tracking and audit logs

### Performance Improvements
- **Database Partitioning**: For large object collections
- **Caching Layer**: Redis caching for frequently accessed objects
- **Search Optimization**: Elasticsearch integration for complex search
- **API Optimization**: GraphQL support for flexible queries

## Support

For issues, questions, or feature requests related to the Object Storage System:
1. Check this documentation for common solutions
2. Review the API endpoint documentation
3. Test with demo data to isolate issues
4. Check Django admin for direct database access

The Object Storage System provides a powerful, flexible foundation for managing dynamic content types while maintaining performance and usability.
