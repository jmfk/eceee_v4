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

## Common Workflows

### Initial Project Setup

```bash
# Import canonical object schemas
python manage.py import_schemas
```

### After Updating Schemas

```bash
# Update ObjectTypeDefinitions
python manage.py import_schemas --force
```

## See Also

- [Object Storage Models](../../object_storage/models.py)
- [Schema Documentation](/backend/scripts/migration/schemas/)
- [Import Schemas Command](/backend/scripts/migration/schemas/IMPORT_SCHEMAS_COMMAND.md)
