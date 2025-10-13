# Object Storage Management Commands

## Available Commands

### `import_schemas`

Import JSON schemas into ObjectTypeDefinitions. Automatically handles both camelCase and snake_case property names.

**Location:** `object_storage/management/commands/import_schemas.py`

**Usage:**
```bash
# Import all schemas from default directory
python manage.py import_schemas

# Preview without saving
python manage.py import_schemas --dry-run

# Force update without prompts
python manage.py import_schemas --force

# Import single file
python manage.py import_schemas \
  --file path/to/schema.json \
  --name my_type
```

**Features:**
- ✅ Batch import from directory
- ✅ Single file import
- ✅ Auto-converts snake_case to camelCase
- ✅ Creates or updates ObjectTypeDefinitions
- ✅ Dry run mode
- ✅ JSON validation
- ✅ Detailed progress output

**Documentation:** See `/backend/scripts/migration/schemas/IMPORT_SCHEMAS_COMMAND.md`

---

### `create_object_demo_data`

Create sample ObjectTypeDefinitions and ObjectInstances for testing.

**Location:** `object_storage/management/commands/create_object_demo_data.py`

**Usage:**
```bash
# Create demo data
python manage.py create_object_demo_data

# Clear and recreate
python manage.py create_object_demo_data --clear
```

---

### `add_field_types_to_schemas`

Add field type information to ObjectTypeDefinition schemas.

**Location:** `object_storage/management/commands/add_field_types_to_schemas.py`

**Usage:**
```bash
python manage.py add_field_types_to_schemas
```

---

### `migrate_schema_to_json_schema`

Migrate old schema format to JSON Schema format.

**Location:** `object_storage/management/commands/migrate_schema_to_json_schema.py`

---

### `migrate_schema_to_properties`

Migrate old schema format to properties format.

**Location:** `object_storage/management/commands/migrate_schema_to_properties.py`

---

## Common Workflows

### Initial Project Setup

```bash
# 1. Import schemas
python manage.py import_schemas

# 2. Create demo data (optional)
python manage.py create_object_demo_data
```

### After Updating Schemas

```bash
# Update ObjectTypeDefinitions
python manage.py import_schemas --force
```

### Development Testing

```bash
# Clear and recreate demo data
python manage.py create_object_demo_data --clear
```

## See Also

- [Object Storage Models](../../object_storage/models.py)
- [Schema Documentation](/backend/scripts/migration/schemas/)
- [Import Schemas Command](/backend/scripts/migration/schemas/IMPORT_SCHEMAS_COMMAND.md)

