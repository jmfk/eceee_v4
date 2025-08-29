# Product Requirements Document: Object Storage System

## Executive Summary

Design and implement a flexible, database-driven object storage system for non-hierarchical content publishing (news, blogs, events, calendars, etc.) that complements the existing hierarchical page publishing system in the eceee_v4 Django/React CMS.

## System Overview

### Purpose
Create a dynamic content management system for non-hierarchical content types that supports:
- Database-defined object types with configurable schemas
- Widget-based content slots with type restrictions
- Parent-child relationships between object instances
- Display through specialized widgets in the existing page system

### Key Differentiators from Page System
- **Non-hierarchical**: Objects don't follow URL-based hierarchy
- **Type-driven**: Object behavior defined by database configurations
- **Display-agnostic**: Objects rendered through widgets, not direct URLs
- **Dynamic schemas**: Object types and fields defined at runtime

## Core Requirements

### 1. Object Type Definition System

#### Database Models Required

```python
# Pseudocode structure for clarity
ObjectTypeDefinition:
    - name: string (unique, e.g., "news", "blog", "event")
    - label: string (display name)
    - plural_label: string 
    - description: text
    - icon_image: image field (visual representation)
    - schema: JSONField (defines data fields)
    - slot_configuration: JSONField (widget slots and restrictions)
    - allowed_child_types: M2M relationship to self
    - is_active: boolean
    - created_at: datetime
    - updated_at: datetime
    - metadata: JSONField (extensible properties)

ObjectTypeSchema:
    - object_type: FK to ObjectTypeDefinition
    - field_name: string
    - field_type: choice (text, number, date, image, rich_text, etc.)
    - field_config: JSONField (validation rules, defaults, etc.)
    - is_required: boolean
    - order: integer
```

#### Schema Definition Format
```json
{
  "fields": [
    {
      "name": "title",
      "type": "text",
      "required": true,
      "maxLength": 200,
      "label": "Article Title"
    },
    {
      "name": "publishDate",
      "type": "datetime",
      "required": true,
      "default": "now"
    },
    {
      "name": "author",
      "type": "reference",
      "referenceType": "user",
      "required": false
    }
  ]
}
```

#### Slot Configuration Format
```json
{
  "slots": [
    {
      "name": "main_content",
      "label": "Main Content Area",
      "allowedWidgets": ["text_block", "html_block", "image", "gallery"],
      "maxWidgets": null,
      "required": true
    },
    {
      "name": "sidebar",
      "label": "Sidebar Content",
      "allowedWidgets": ["text_block", "related_items", "tags"],
      "maxWidgets": 5,
      "required": false
    }
  ]
}
```

### 2. Object Instance Storage

#### Database Models Required

```python
ObjectInstance:
    - object_type: FK to ObjectTypeDefinition
    - title: string (for display/reference)
    - slug: string (unique within type)
    - data: JSONField (stores schema-defined fields)
    - status: choice (draft, published, archived)
    - parent_object: FK to self (nullable, for sub-objects)
    - widgets: JSONField (widget configurations per slot)
    - publish_date: datetime
    - unpublish_date: datetime (nullable)
    - version: integer
    - created_by: FK to User
    - created_at: datetime
    - updated_at: datetime
    - metadata: JSONField

ObjectVersion:
    - object: FK to ObjectInstance
    - version_number: integer
    - data: JSONField (snapshot of data at this version)
    - widgets: JSONField (snapshot of widgets)
    - created_by: FK to User
    - created_at: datetime
    - change_description: text
```

### 3. Sub-object Hierarchy Management

#### Requirements
- Sub-objects maintain reference to parent object
- Support multiple levels of nesting (configurable depth limit)
- Independent from page hierarchy system
- Query optimization for fetching object trees

#### Implementation Approach
```python
# Suggested approach using MPTT or similar
ObjectHierarchy:
    - object: FK to ObjectInstance
    - parent: FK to self (nullable)
    - level: integer
    - tree_id: integer
    - lft: integer (MPTT left)
    - rght: integer (MPTT right)
    - path: string (materialized path for quick lookups)
```

### 4. API Endpoints

#### Object Type Management
```
GET    /api/object-types/                 # List all object types
POST   /api/object-types/                 # Create new object type
GET    /api/object-types/{id}/            # Get object type details
PUT    /api/object-types/{id}/            # Update object type
DELETE /api/object-types/{id}/            # Delete object type
GET    /api/object-types/{id}/schema/     # Get type schema
PUT    /api/object-types/{id}/schema/     # Update type schema
```

#### Object Instance Management
```
GET    /api/objects/                      # List objects (filterable by type)
POST   /api/objects/                      # Create new object
GET    /api/objects/{id}/                 # Get object details
PUT    /api/objects/{id}/                 # Update object
DELETE /api/objects/{id}/                 # Delete object
POST   /api/objects/{id}/publish/         # Publish object
POST   /api/objects/{id}/unpublish/       # Unpublish object
GET    /api/objects/{id}/versions/        # Get version history
GET    /api/objects/{id}/children/        # Get child objects
```

#### Query Endpoints
```
GET    /api/objects/by-type/{type}/       # Get objects of specific type
GET    /api/objects/published/            # Get published objects
GET    /api/objects/search/               # Search across objects
POST   /api/objects/bulk-operations/      # Bulk publish/unpublish/delete
```

### 5. Frontend Components

#### Object Type Manager
- List view of all object types with icons
- Create/edit object type interface
- Visual schema editor (similar to existing VisualSchemaEditor)
- Slot configuration UI
- Child type relationship manager

#### Object Editor
- Dynamic form generation based on object schema
- Widget management for each slot
- Preview capability
- Version comparison view
- Publishing controls

#### Object Browser
- Filterable list of objects by type
- Tree view for objects with children
- Bulk selection and operations
- Search and advanced filtering

### 6. Integration Requirements

#### With Existing Widget System
- Objects accessible through specialized display widgets
- Widget configurations to query and display objects:
  ```json
  {
    "widget_type": "object_list",
    "config": {
      "objectType": "news",
      "limit": 5,
      "orderBy": "publishDate",
      "filterBy": {"status": "published"},
      "displayTemplate": "card"
    }
  }
  ```

#### With Existing Permission System
- Reuse existing permission framework
- Per-object-type permissions
- Instance-level permissions where needed

### 7. Technical Requirements

#### Performance
- Efficient querying of objects by type
- Optimized tree traversal for hierarchical objects
- Caching strategy for frequently accessed objects
- Pagination for large object lists

#### Validation
- Schema validation on object save
- Widget slot validation
- Parent-child type validation
- Custom validation rules per object type

#### Search
- Full-text search across object data
- Filtering by object type, status, dates
- Tag-based categorization support

## Migration Strategy

1. Create new Django app: `object_storage`
2. Implement models without disrupting existing system
3. Build API endpoints with tests
4. Create React components in parallel
5. Add integration widgets to existing widget system
6. Migrate any existing non-hierarchical content

## Success Criteria

- Support for 10+ different object types without code changes
- Sub-second response times for object queries
- 90% test coverage for critical paths
- Seamless integration with existing widget system
- No impact on existing page hierarchy system

## Technical Constraints

- Must work within existing Django 4.2+ / React 19 stack
- Maintain camelCase API convention
- Follow existing authentication/authorization patterns
- Compatible with PostgreSQL and Redis caching
- Support existing Docker development environment

## Example Use Cases

### News System
```python
ObjectTypeDefinition(
    name="news",
    schema={
        "title": {"type": "text", "required": True},
        "summary": {"type": "text", "maxLength": 300},
        "content": {"type": "rich_text"},
        "publishDate": {"type": "datetime"},
        "author": {"type": "user_reference"},
        "category": {"type": "choice", "choices": ["company", "industry", "research"]}
    },
    slots=["main_content", "related_items"],
    allowed_child_types=[]  # No children for news items
)
```

### Blog with Comments
```python
BlogType = ObjectTypeDefinition(name="blog_post", ...)
CommentType = ObjectTypeDefinition(
    name="comment",
    allowed_parent_types=["blog_post"],
    schema={"author": ..., "content": ..., "timestamp": ...}
)
```

### Event Calendar
```python
ObjectTypeDefinition(
    name="event",
    schema={
        "title": {"type": "text"},
        "startDate": {"type": "datetime"},
        "endDate": {"type": "datetime"},
        "location": {"type": "text"},
        "capacity": {"type": "number"},
        "registrationDeadline": {"type": "datetime"}
    }
)
```

## Implementation Priority

1. **Phase 1**: Core models and object type definition
2. **Phase 2**: Object instance CRUD operations
3. **Phase 3**: Sub-object hierarchy support
4. **Phase 4**: Frontend management interfaces
5. **Phase 5**: Display widgets integration
6. **Phase 6**: Advanced features (versioning, bulk operations)

## Notes for AI Implementation

When implementing this system:
1. Start with the Django models in a new `object_storage` app
2. Follow existing patterns from the `webpages` app for inspiration
3. Reuse serialization patterns and API conventions
4. Leverage existing widget system architecture
5. Maintain separation from page hierarchy - this is a parallel system
6. Ensure all object type configurations are database-driven
7. Design for extensibility - new object types should require no code changes
8. Include comprehensive tests following existing test patterns
9. Use existing validation utilities where applicable
10. Maintain consistent error handling and user feedback patterns