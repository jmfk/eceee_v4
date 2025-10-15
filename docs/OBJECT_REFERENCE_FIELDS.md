# Object Reference Fields - Comprehensive Guide

## Date
October 14, 2025

## Overview

Object Reference Fields are schema field types that enable declarative relationship management between ObjectInstances. They provide a user-friendly way to define and manage many-to-many relationships through ObjectType schemas.

## Field Types

### 1. object_reference (Forward References)

A field type for referencing other ObjectInstances with configurable constraints.

#### Basic Configuration

```json
{
  "name": "authors",
  "type": "object_reference",
  "label": "Authors",
  "componentType": "object_reference",
  "multiple": true,
  "max_items": 5,
  "allowed_object_types": ["columnist", "contributor"],
  "relationship_type": "authors",
  "default": [],
  "required": false,
  "helpText": "Select columnists who authored this column"
}
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `multiple` | boolean | false | Allow multiple selections |
| `max_items` | integer | null | Maximum number of items (only for multiple) |
| `allowed_object_types` | array | [] (all) | List of allowed object type names |
| `relationship_type` | string | field name | Override relationship type name |
| `default` | array/int | [] or null | Default value |
| `required` | boolean | false | Is field required |

#### Single vs Multiple References

**Single Reference** (one object):
```json
{
  "name": "primary_author",
  "componentType": "object_reference",
  "multiple": false,
  "allowed_object_types": ["columnist"],
  "required": true
}
```

Data value: `123` (single integer)

**Multiple References** (array of objects):
```json
{
  "name": "authors",
  "componentType": "object_reference",
  "multiple": true,
  "max_items": 5,
  "allowed_object_types": ["columnist"]
}
```

Data value: `[123, 456, 789]` (array of integers)

### 2. reverse_object_reference (Reverse References)

A read-only field type that displays objects that reference this object.

#### Basic Configuration

```json
{
  "name": "columns_authored",
  "type": "reverse_object_reference",
  "label": "Columns Authored",
  "componentType": "reverse_object_reference",
  "reverse_relationship_type": "authors",
  "reverse_object_types": ["column"],
  "helpText": "Columns where this columnist is listed as an author"
}
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `reverse_relationship_type` | string | Yes | The relationship type to look for in related_from |
| `reverse_object_types` | array | No | Filter by source object types |

#### How It Works

The `reverse_object_reference` field is **computed automatically**:

1. Object A has field: `{"authors": [B.id, C.id]}`
2. Object B automatically gets: `related_from = [{"type": "authors", "object_id": A.id}]`
3. Object B's `reverse_object_reference` field (if configured) displays: `[A.id]`

**Important**: This field is read-only. Attempting to set a value will result in a validation error.

## How Object References Work

### Data Storage Flow

#### Forward References (object_reference)

```
User Input → ObjectVersion.data → Sync → ObjectInstance.relationships
```

**Step-by-step**:

1. User selects objects in UI
2. Frontend sends: `{"authors": [123, 456]}`
3. Saved to `ObjectVersion.data`
4. `save()` triggers `sync_relationships_from_data()`
5. Synced to `ObjectInstance.relationships`:
   ```python
   [
     {"type": "authors", "object_id": 123},
     {"type": "authors", "object_id": 456}
   ]
   ```
6. Bidirectional sync updates `related_from` on objects 123 and 456

#### Reverse References (reverse_object_reference)

```
ObjectInstance.related_from → Compute → ObjectVersion.data (temporary)
```

**Step-by-step**:

1. API request for object data
2. Serializer calls `populate_reverse_references()`
3. Queries `related_from` field
4. Filters by `reverse_relationship_type` and `reverse_object_types`
5. Returns computed array: `[999, 1000]`
6. **Not saved** to database (computed on-the-fly)

### Validation

#### object_reference Validation

Automatically validates:
- ✅ Referenced objects exist
- ✅ Object types match `allowed_object_types`
- ✅ Number of items ≤ `max_items`
- ✅ Required field has value
- ✅ No self-references

**Example Error**:
```json
{
  "data": {
    "authors": "ObjectInstance with id 999 does not exist"
  }
}
```

#### reverse_object_reference Validation

- ✅ Cannot be set (read-only)
- ✅ Attempting to set raises error

## API Reference

### Search for Objects

**Endpoint**: `GET /api/objects/search_for_references/`

**Purpose**: Search for objects to add as references (used by autocomplete UI)

**Query Parameters**:
- `q` (string): Search term (searches title and slug)
- `object_types` (string): Comma-separated type names to filter
- `page` (integer): Page number (default: 1)
- `page_size` (integer): Results per page (default: 20, max: 100)

**Example Request**:
```http
GET /api/objects/search_for_references/?q=climate&object_types=columnist&page=1&page_size=20
```

**Example Response**:
```json
{
  "results": [
    {
      "id": 123,
      "title": "John Climate Expert",
      "slug": "john-climate-expert",
      "object_type": {
        "id": 2,
        "name": "columnist",
        "label": "Columnist"
      },
      "created_at": "2025-10-01T10:00:00Z"
    }
  ],
  "count": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3,
  "has_next": true,
  "has_previous": false
}
```

### Save Object with References

**Endpoint**: `POST /api/objects/` or `PUT /api/objects/{id}/`

**Example**:
```http
POST /api/objects/

{
  "object_type_id": 1,
  "title": "Energy Efficiency Trends",
  "data": {
    "presentationalPublishingDate": "2025-10-14",
    "authors": [123, 456],
    "priority": false
  }
}
```

### Retrieve with Reverse References

**Endpoint**: `GET /api/objects/{id}/`

The response automatically includes computed reverse references:

```json
{
  "id": 123,
  "title": "John Smith",
  "data": {
    "firstName": "John",
    "lastName": "Smith",
    "columns_authored": [999, 1000, 1001]  // Computed automatically
  }
}
```

## Frontend Components

### ObjectReferenceField (To be Implemented)

**Component**: `ObjectReferenceInput`

**Features**:
- Search input with debounced AJAX (300ms)
- Autocomplete dropdown with pagination
- Selected items as removable chips
- Drag-and-drop reordering (when multiple)
- Direct PK entry field
- Loading states
- Error handling

**Props**:
```typescript
interface ObjectReferenceFieldProps {
  value: number | number[];
  onChange: (value: number | number[]) => void;
  fieldConfig: {
    multiple?: boolean;
    max_items?: number;
    allowed_object_types?: string[];
    relationship_type?: string;
  };
  label: string;
  helpText?: string;
  required?: boolean;
}
```

**Usage**:
```jsx
<ObjectReferenceField
  value={[123, 456]}
  onChange={handleChange}
  fieldConfig={{
    multiple: true,
    max_items: 5,
    allowed_object_types: ['columnist']
  }}
  label="Authors"
  required={false}
/>
```

### ReverseObjectReferenceField (To be Implemented)

**Component**: `ReverseObjectReferenceDisplay`

**Features**:
- Read-only display
- Links to referenced objects
- Count display
- Grouped by relationship type

**Props**:
```typescript
interface ReverseObjectReferenceFieldProps {
  value: number[];
  fieldConfig: {
    reverse_relationship_type: string;
    reverse_object_types?: string[];
  };
  label: string;
}
```

**Usage**:
```jsx
<ReverseObjectReferenceField
  value={[999, 1000]}
  fieldConfig={{
    reverse_relationship_type: 'authors',
    reverse_object_types: ['column']
  }}
  label="Columns Authored"
/>
```

## Use Cases

### Use Case 1: Columns with Multiple Authors

**Column Schema**:
```json
{
  "authors": {
    "title": "Authors",
    "componentType": "object_reference",
    "multiple": true,
    "max_items": 5,
    "allowed_object_types": ["columnist"],
    "helpText": "Select columnists who authored this column"
  }
}
```

**Columnist Schema**:
```json
{
  "columns_authored": {
    "title": "Columns Authored",
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "authors",
    "reverse_object_types": ["column"]
  }
}
```

**Result**:
- Columns can have 1-5 columnists as authors
- Columnists can see all columns they've authored
- Bidirectional relationship automatically maintained
- Search UI for finding columnists
- Validates all references exist

### Use Case 2: Related Articles

```json
{
  "related_articles": {
    "title": "Related Articles",
    "componentType": "object_reference",
    "multiple": true,
    "max_items": 10,
    "allowed_object_types": ["news", "blog", "column"],
    "helpText": "Link to related content"
  }
}
```

**Features**:
- Cross-object-type references
- Up to 10 related items
- Only specific content types allowed
- Order preserved

### Use Case 3: Single Parent Reference

```json
{
  "parent_conference": {
    "title": "Parent Conference",
    "componentType": "object_reference",
    "multiple": false,
    "allowed_object_types": ["conference"],
    "required": true,
    "helpText": "Conference this panel belongs to"
  }
}
```

**Features**:
- Exactly one parent
- Required field
- Only conference type allowed
- Type-safe validation

## Best Practices

### 1. Use Descriptive Field Names

✅ **Good**:
- `authors` (clear what it represents)
- `related_articles` (clear relationship)
- `primary_author` (clear cardinality)

❌ **Bad**:
- `refs` (too vague)
- `ids` (doesn't describe relationship)
- `objects` (no semantic meaning)

### 2. Set Appropriate Constraints

✅ **Good**:
```json
{
  "authors": {
    "componentType": "object_reference",
    "multiple": true,
    "max_items": 5,  // Reasonable limit
    "allowed_object_types": ["columnist"]  // Type constraint
  }
}
```

❌ **Bad**:
```json
{
  "authors": {
    "componentType": "object_reference",
    "multiple": true
    // No max_items, no type constraint
  }
}
```

### 3. Use Reverse References for Navigation

When you have a forward reference, consider adding a reverse reference:

**Forward** (column → columnists):
```json
{"authors": {"componentType": "object_reference", ...}}
```

**Reverse** (columnist → columns):
```json
{
  "columns_authored": {
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "authors"
  }
}
```

### 4. Validate in Multiple Layers

- **Frontend**: Check max_items, allowed_types before submit
- **Backend**: Validate objects exist, types match
- **Database**: Ensure referential integrity through relationships

### 5. Consider Performance

- Limit `max_items` for large datasets
- Use specific `allowed_object_types` to reduce search results
- Consider indexing if querying many relationships

## Migration Guide

### Migrating from Array Fields

**Before** (array of IDs):
```json
{
  "columnistIds": {
    "componentType": "array",
    "items": {"type": "number"},
    "default": []
  }
}
```

**After** (object_reference):
```json
{
  "authors": {
    "componentType": "object_reference",
    "multiple": true,
    "allowed_object_types": ["columnist"],
    "relationship_type": "authors",
    "default": []
  }
}
```

**Migration Script**:
```python
# Get all columns
columns = ObjectInstance.objects.filter(object_type__name='column')

for column in columns:
    version = column.get_current_published_version()
    if version:
        # Get old columnistIds
        columnist_ids = version.data.get('columnistIds', [])
        
        # Set new authors field
        version.data['authors'] = columnist_ids
        
        # Remove old field
        if 'columnistIds' in version.data:
            del version.data['columnistIds']
        
        # Save (auto-syncs to relationships)
        version.save()
```

### Adding Reverse References

1. Add reverse_object_reference field to target object type schema
2. No data migration needed (computed automatically)
3. Update frontend to display reverse references

```python
# Update columnist object type
columnist_type = ObjectTypeDefinition.objects.get(name='columnist')
columnist_type.schema['properties']['columns_authored'] = {
    "title": "Columns Authored",
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "authors",
    "reverse_object_types": ["column"]
}
columnist_type.save()
```

## Troubleshooting

### Issue: "ObjectInstance with id X does not exist"

**Cause**: Referenced object was deleted or ID is invalid

**Solution**:
- Validate object exists before adding
- Use search endpoint to find valid objects
- Handle missing objects gracefully in UI

### Issue: "Object type 'X' is not allowed"

**Cause**: Trying to reference an object type not in `allowed_object_types`

**Solution**:
- Update `allowed_object_types` in schema
- Or select object of correct type

### Issue: "Cannot have more than N references"

**Cause**: Exceeding `max_items` limit

**Solution**:
- Remove some references first
- Or increase `max_items` in schema

### Issue: Reverse references not showing

**Cause**: Forward relationship not synced or reverse_relationship_type mismatch

**Solution**:
```python
# Rebuild reverse relationships
ObjectInstance.rebuild_all_related_from()

# Or for single object
instance.rebuild_related_from()
```

## Performance Considerations

### Efficient Querying

```python
# Get related objects with full details
authors = column.get_related_objects('authors')

# Prefetch to avoid N+1
columns = Column.objects.prefetch_related(
    Prefetch('relationships', queryset=ObjectInstance.objects.select_related('object_type'))
)
```

### Search Optimization

- Search endpoint uses pagination (20 items default, max 100)
- GIN indexes on relationships and related_from fields
- Frontend debounces search (300ms)
- React Query caches results

### Limits

- **max_items**: Recommended ≤ 20 for UI performance
- **Search results**: Max 100 per page
- **Validation**: O(n) where n = number of references

## Testing

### Backend Tests

```python
def test_object_reference_validation():
    """Test object_reference field validation"""
    from utils.schema_system import validate_object_reference
    
    field_config = {
        'multiple': True,
        'max_items': 3,
        'allowed_object_types': ['columnist']
    }
    
    # Valid
    validate_object_reference([123, 456], field_config)
    
    # Too many items
    with pytest.raises(ValidationError):
        validate_object_reference([123, 456, 789, 999], field_config)
    
    # Wrong type
    with pytest.raises(ValidationError):
        validate_object_reference([news_id], field_config)
```

### Frontend Tests

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import ObjectReferenceField from './ObjectReferenceField';

test('renders search input', () => {
  render(
    <ObjectReferenceField
      value={[]}
      onChange={jest.fn()}
      fieldConfig={{ multiple: true }}
      label="Authors"
    />
  );
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
});

test('adds selected item', async () => {
  const handleChange = jest.fn();
  render(
    <ObjectReferenceField
      value={[]}
      onChange={handleChange}
      fieldConfig={{ multiple: true }}
    />
  );
  
  // Simulate selecting an item
  // ... test logic
});
```

## API Contract

### ObjectVersion Data Field

**Forward Reference** (object_reference):
```json
{
  "data": {
    "authors": [123, 456]  // Array for multiple
  }
}
```

Or single:
```json
{
  "data": {
    "primary_author": 123  // Integer for single
  }
}
```

**Reverse Reference** (reverse_object_reference):
```json
{
  "data": {
    "columns_authored": [999, 1000]  // Computed, not stored
  }
}
```

### ObjectInstance Relationships

After sync:
```json
{
  "relationships": [
    {"type": "authors", "object_id": 123},
    {"type": "authors", "object_id": 456}
  ],
  "related_from": [
    {"type": "columns", "object_id": 999}
  ]
}
```

## Advanced Usage

### Custom Relationship Types

Override the relationship type name:

```json
{
  "name": "co_authors",
  "componentType": "object_reference",
  "relationship_type": "authors",  // All use "authors" type
  "multiple": true
}
```

Multiple fields can share the same relationship_type.

### Mixed Object Types

```json
{
  "contributors": {
    "componentType": "object_reference",
    "multiple": true,
    "allowed_object_types": ["columnist", "staff_writer", "guest_author"],
    "max_items": 10
  }
}
```

### Cascading Relationships

```json
// Conference schema
{
  "panels": {
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "parent_conference"
  }
}

// Panel schema
{
  "parent_conference": {
    "componentType": "object_reference",
    "multiple": false,
    "allowed_object_types": ["conference"],
    "required": true
  },
  "papers": {
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "parent_panel"
  }
}
```

## Implementation Status

### ✅ Complete (Backend)
- Schema field type definitions
- Validation functions
- Model sync methods
- Serializer support
- Search API endpoint
- Migration schemas updated
- Documentation complete

### ⏳ Pending (Frontend)
- ObjectReferenceField component
- ReverseObjectReferenceField component
- ObjectSearchDropdown component
- React Query hooks
- Component tests

### ⏳ Pending (Admin)
- ObjectReferenceWidget
- Admin template
- AJAX integration

### ⏳ Pending (Tests)
- Comprehensive backend tests
- Frontend component tests
- Integration tests

## FAQ

**Q: Can I mix object_reference and manual relationship methods?**  
A: Yes, they both use the same underlying relationships infrastructure.

**Q: What happens if I delete a referenced object?**  
A: The reference becomes invalid. You should handle this gracefully in UI and/or prevent deletion of referenced objects.

**Q: Can I reference objects of any type?**  
A: Yes, unless you specify `allowed_object_types` to constrain it.

**Q: Are reverse references updated immediately?**  
A: Yes, they're computed on-the-fly from the `related_from` field which is updated immediately when forward relationships change.

**Q: Can I have multiple object_reference fields in one schema?**  
A: Yes, each with its own relationship_type.

**Q: Do I need to run migrations?**  
A: Yes, run the 0016_add_relationships migration to add the relationships and related_from fields.

## Support

For issues or questions:
1. Check validation error messages
2. Review this guide
3. Check implementation status document
4. Test with small data sets first
5. Use repair methods if related_from is out of sync

## Related Documentation

- `docs/OBJECT_STORAGE_SYSTEM_DOCUMENTATION.md` - Main system documentation
- `backend/docs/RELATIONSHIPS_IMPLEMENTATION_SUMMARY.md` - Relationships infrastructure
- `backend/docs/OBJECT_REFERENCE_FIELDS_IMPLEMENTATION_STATUS.md` - Implementation status
- `backend/scripts/migration/schemas/HOW_TO_CREATE_SCHEMAS.md` - Schema creation guide

