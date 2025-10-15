# Quick Start: Object Reference Fields

## ✅ JSON Files Already Updated

Both schema files have been updated with the new object_reference fields:

- ✅ **`backend/scripts/migration/schemas/column.json`**
  - Added `authors` field (object_reference)
  - Removed old `columnistIds` array field
  
- ✅ **`backend/scripts/migration/schemas/columnist.json`**
  - Added `columns_authored` field (reverse_object_reference)

## 🚀 How to Update ObjectTypes in Database

### Option 1: Update Specific ObjectTypes (Recommended)

```bash
# Start Django shell
cd backend
python manage.py shell
```

```python
from scripts.migration.update_object_type_schemas import update_schema, show_schema_diff

# First, preview the changes
show_schema_diff('column')
show_schema_diff('columnist')

# Update column ObjectType
update_schema('column', dry_run=True)   # Preview first
update_schema('column', dry_run=False)  # Apply changes

# Update columnist ObjectType
update_schema('columnist', dry_run=True)   # Preview first
update_schema('columnist', dry_run=False)  # Apply changes
```

### Option 2: Update All ObjectTypes at Once

```python
from scripts.migration.update_object_type_schemas import update_all_schemas

# Preview all changes
update_all_schemas(dry_run=True)

# Apply all changes
update_all_schemas(dry_run=False)
```

### Option 3: Manual Update (Alternative)

```python
from object_storage.models import ObjectTypeDefinition
import json

# Update column
column_type = ObjectTypeDefinition.objects.get(name='column')
with open('scripts/migration/schemas/column.json') as f:
    column_type.schema = json.load(f)
column_type.save()
print(f"✅ Updated {column_type.label}")

# Update columnist
columnist_type = ObjectTypeDefinition.objects.get(name='columnist')
with open('scripts/migration/schemas/columnist.json') as f:
    columnist_type.schema = json.load(f)
columnist_type.save()
print(f"✅ Updated {columnist_type.label}")
```

## 🔄 What Happens When You Update

### For Column ObjectType:
**Before**:
```json
{
  "columnistIds": {
    "componentType": "array",
    "items": {"type": "number"}
  }
}
```

**After**:
```json
{
  "authors": {
    "componentType": "object_reference",
    "multiple": true,
    "max_items": 5,
    "allowed_object_types": ["columnist"],
    "relationship_type": "authors"
  }
}
```

**Impact**:
- New columns will use the new `authors` field
- Existing columns with `columnistIds` still work
- Need data migration to convert old field to new field (optional)

### For Columnist ObjectType:
**Before**: No reverse reference field

**After**:
```json
{
  "columns_authored": {
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "authors",
    "reverse_object_types": ["column"]
  }
}
```

**Impact**:
- Columnists can now see which columns they've authored
- No data migration needed (computed automatically)

## 📋 Step-by-Step Update Process

### 1. Backup (Safety First)
```bash
# Backup your database first
pg_dump your_database > backup_before_schema_update.sql
```

### 2. Run the Relationship Migration
```bash
cd backend
python manage.py migrate object_storage
```

This adds the `relationships` and `related_from` fields.

### 3. Update ObjectType Schemas
```bash
python manage.py shell
```

```python
from scripts.migration.update_object_type_schemas import update_schema

# Preview changes
update_schema('column', dry_run=True)
update_schema('columnist', dry_run=True)

# Apply if looks good
update_schema('column', dry_run=False)
update_schema('columnist', dry_run=False)
```

### 4. Verify Updates
```python
from object_storage.models import ObjectTypeDefinition

column = ObjectTypeDefinition.objects.get(name='column')
print("Column fields:", list(column.schema['properties'].keys()))
# Should include 'authors'

columnist = ObjectTypeDefinition.objects.get(name='columnist')
print("Columnist fields:", list(columnist.schema['properties'].keys()))
# Should include 'columns_authored'
```

### 5. Test with Sample Data
```python
from object_storage.models import ObjectInstance, ObjectVersion
from django.contrib.auth.models import User

user = User.objects.first()

# Create test columnist
columnist = ObjectInstance.objects.create(
    object_type=columnist_type,
    title="Test Columnist",
    created_by=user
)

# Create test column with author reference
column = ObjectInstance.objects.create(
    object_type=column_type,
    title="Test Column",
    created_by=user
)

column_version = ObjectVersion.objects.create(
    object_instance=column,
    version_number=1,
    created_by=user,
    data={
        'presentationalPublishingDate': '2025-10-14',
        'authors': [columnist.id],  # NEW object_reference field!
        'priority': False
    },
    widgets={}
)

# Verify sync happened
column.refresh_from_db()
print(f"Relationships synced: {column.has_relationship('authors', columnist.id)}")

# Check reverse reference
columnist_version = columnist.get_current_published_version()
columnist_version.populate_reverse_references()
print(f"Reverse refs: {columnist_version.data.get('columns_authored')}")
```

## 🔧 Troubleshooting

### ObjectType Not Found
```python
# List all object types
from object_storage.models import ObjectTypeDefinition
for ot in ObjectTypeDefinition.objects.all():
    print(f"{ot.name} - {ot.label}")

# Create if missing
from scripts.migration.create_object_types import create_all_object_types
create_all_object_types(dry_run=False)
```

### Schema File Not Found
```bash
# Check schema files exist
ls -la backend/scripts/migration/schemas/*.json

# Should see column.json and columnist.json
```

### Migration Not Run
```bash
# Check migration status
python manage.py showmigrations object_storage

# Run if needed
python manage.py migrate object_storage
```

## 📝 Migrating Existing Data (Optional)

If you have existing columns with `columnistIds`, migrate them:

```python
from object_storage.models import ObjectInstance, ObjectVersion

# Get all column instances
columns = ObjectInstance.objects.filter(object_type__name='column')

for column in columns:
    version = column.get_current_published_version()
    if not version:
        continue
    
    # Check if has old field
    if 'columnistIds' in version.data:
        columnist_ids = version.data.get('columnistIds', [])
        
        # Set new field
        version.data['authors'] = columnist_ids
        
        # Remove old field
        del version.data['columnistIds']
        
        # Save (auto-syncs to relationships)
        version.save()
        
        print(f"✅ Migrated {column.title}: {len(columnist_ids)} authors")

print("\n✅ Migration complete!")
```

## 🎯 Quick Verification

After updating, verify everything works:

```python
from object_storage.models import ObjectTypeDefinition

# Check column has new field
column_type = ObjectTypeDefinition.objects.get(name='column')
authors_field = column_type.schema['properties'].get('authors')
print(f"Column has 'authors' field: {authors_field is not None}")
print(f"Field type: {authors_field.get('componentType')}")

# Check columnist has reverse field
columnist_type = ObjectTypeDefinition.objects.get(name='columnist')
reverse_field = columnist_type.schema['properties'].get('columns_authored')
print(f"Columnist has 'columns_authored' field: {reverse_field is not None}")
print(f"Field type: {reverse_field.get('componentType')}")
```

## ✨ What You Get

After updating:
- ✅ Frontend UI shows searchable dropdown for selecting authors
- ✅ Validation prevents non-columnist objects
- ✅ Max 5 authors enforced
- ✅ Auto-syncs to relationships infrastructure
- ✅ Columnists show list of columns they've authored
- ✅ Bidirectional queries work perfectly
- ✅ Order preserved and reorderable

## 📚 More Information

- Complete docs: `docs/OBJECT_REFERENCE_FIELDS.md`
- API reference: `docs/OBJECT_STORAGE_SYSTEM_DOCUMENTATION.md`
- Implementation details: `IMPLEMENTATION_COMPLETE.md`

