# Import Schemas Management Command

## Overview

The `import_schemas` management command imports JSON schemas into ObjectTypeDefinitions. It can create new object types or update existing ones, and intelligently handles both camelCase and snake_case property names.

## Features

✅ **Batch Import** - Import all schemas from a directory  
✅ **Single File Import** - Import a specific schema file  
✅ **Auto-Convert** - Converts snake_case to camelCase automatically  
✅ **Create or Update** - Creates new or updates existing ObjectTypeDefinitions  
✅ **Dry Run Mode** - Preview changes without saving  
✅ **Validation** - Validates JSON syntax before import  
✅ **Detailed Output** - Shows exactly what changes will be made

## Command Location

```
backend/object_storage/management/commands/import_schemas.py
```

## Basic Usage

### Import All Schemas from Directory

```bash
# Inside Docker (using docker-compose)
docker-compose exec backend python manage.py import_schemas

# Or use Make command (recommended)
make import-schemas
```

This will:
- Import all `.json` files from `scripts/migration/schemas/` (relative to Django project root)
- Convert snake_case to camelCase
- Create or update ObjectTypeDefinitions
- Show detailed progress

**Note:** When running inside Docker, paths are relative to `/app` (the Django project root inside the container).

### Import from Custom Directory

```bash
# Inside Docker
docker-compose exec backend python manage.py import_schemas --schemas-dir /path/to/schemas

# Outside Docker (if running manage.py directly)
python manage.py import_schemas --schemas-dir backend/scripts/migration/schemas
```

**Path Note:** 
- **Inside Docker**: Use paths relative to `/app` (e.g., `scripts/migration/schemas`)
- **Outside Docker**: Use paths relative to project root (e.g., `backend/scripts/migration/schemas`)
- **Make commands**: Automatically handle Docker paths ✅

### Dry Run (Preview Only)

```bash
python manage.py import_schemas --dry-run
```

This shows what would happen without actually saving anything.

### Import Single Schema

```bash
python manage.py import_schemas \
  --file backend/scripts/migration/schemas/news.json \
  --name news \
  --label "News Article" \
  --plural-label "News Articles" \
  --description "News articles and announcements"
```

## Options

### Required for Single File Import

- `--file` - Path to JSON schema file
- `--name` - Object type name (e.g., "news", "event")

### Optional Arguments

| Option | Description | Default |
|--------|-------------|---------|
| `--schemas-dir` | Directory with schema files | `scripts/migration/schemas` |
| `--label` | Display name | Derived from name |
| `--plural-label` | Plural display name | `{label}s` |
| `--description` | Description of object type | `{label} objects` |
| `--hierarchy-level` | `top_level_only`, `sub_object_only`, `both` | `both` |
| `--user` | Username for created_by field | First superuser |
| `--dry-run` | Preview without saving | `False` |
| `--force` | Update without confirmation | `False` |
| `--convert-snake-case` | Convert snake_case to camelCase | `True` |

## Examples

### Example 1: Standard Import

```bash
# Import all schemas with preview
python manage.py import_schemas --dry-run

# If everything looks good, run for real
python manage.py import_schemas
```

**Output:**
```
Found 9 schema file(s) in backend/scripts/migration/schemas

+ news - New
  Label: News Article
  Plural: News Articles
  Description: News articles - content stored in Content Widget
  Hierarchy: both
  File: backend/scripts/migration/schemas/news.json
  Fields: 3
  → sourceDate, externalUrl, featuredImage
  ✓ Created news (ID: 1)

⟳ event - Exists (will update)
  Label: Event
  Plural: Events
  Description: Calendar events - content stored in Content Widget
  Hierarchy: both
  File: backend/scripts/migration/schemas/event.json
  Fields: 7
  → eventType, venue, organiser, eventStartDate, eventEndDate, ...
  Update existing 'event'? [y/N]: y
  ✓ Updated event (ID: 2)

======================================================================
✓ Successfully processed: 9
======================================================================
```

### Example 2: Import with Snake Case Conversion

```bash
# If your schemas have snake_case properties
python manage.py import_schemas --convert-snake-case
```

This will automatically convert:
- `source_date` → `sourceDate`
- `external_url` → `externalUrl`
- `event_start_date` → `eventStartDate`
- etc.

**Output:**
```
  → Converted snake_case to camelCase in news.json
```

### Example 3: Import Single Schema

```bash
python manage.py import_schemas \
  --file backend/scripts/migration/schemas/news.json \
  --name news
```

### Example 4: Force Update All (No Prompts)

```bash
python manage.py import_schemas --force
```

This will update existing ObjectTypeDefinitions without asking for confirmation.

### Example 5: Custom User

```bash
python manage.py import_schemas --user admin
```

Uses "admin" user as the creator instead of the first superuser.

## Snake Case to Camel Case Conversion

The command automatically converts snake_case property names to camelCase in the schema.

### What Gets Converted

**Property Names:**
```json
// BEFORE
"properties": {
  "source_date": {...},
  "external_url": {...},
  "featured_image": {...}
}

// AFTER
"properties": {
  "sourceDate": {...},
  "externalUrl": {...},
  "featuredImage": {...}
}
```

**Required Array:**
```json
// BEFORE
"required": ["source_date", "event_start_date"]

// AFTER
"required": ["sourceDate", "eventStartDate"]
```

**Property Order Array:**
```json
// BEFORE
"propertyOrder": ["featured_image", "source_date", "external_url"]

// AFTER
"propertyOrder": ["featuredImage", "sourceDate", "externalUrl"]
```

### Conversion Rules

| Original | Converted |
|----------|-----------|
| source_date | sourceDate |
| external_url | externalUrl |
| event_start_date | eventStartDate |
| doc_nummer | docNummer |
| conference_id | conferenceId |

## Schema File Detection

The command looks for `.json` files in the schemas directory and:

1. **Loads JSON** - Validates JSON syntax
2. **Derives Name** - Uses filename without extension as object type name
3. **Converts Names** - Converts snake_case to camelCase if needed
4. **Guesses Hierarchy** - Intelligently determines hierarchy level:
   - `conference_panel`, `paper` → `sub_object_only`
   - `conference` → `top_level_only`
   - All others → `both`
5. **Extracts Metadata** - Reads description from `additionalInfo` if present

## Hierarchy Level Detection

The command automatically determines the appropriate hierarchy level:

| Object Type | Hierarchy Level | Reason |
|-------------|----------------|--------|
| conference_panel | sub_object_only | Always child of conference |
| paper | sub_object_only | Always child of panel |
| conference | top_level_only | Always top-level |
| news, event, job, etc. | both | Can be standalone or nested |

You can override this with `--hierarchy-level`.

## Error Handling

The command handles various errors gracefully:

### Invalid JSON
```
✗ Invalid JSON in malformed.json: Expecting ',' delimiter: line 10 column 5
```

### File Not Found
```
CommandError: File not found: /path/to/missing.json
```

### Missing Required Arguments
```
CommandError: --name is required when using --file
```

### Database Errors
```
✗ Failed to save: duplicate key value violates unique constraint "object_storage_objecttypedefinition_name_key"
```

## Output Format

### Success (Create)
```
+ news - New
  Label: News Article
  Plural: News Articles
  Description: News articles and announcements
  Hierarchy: both
  File: backend/scripts/migration/schemas/news.json
  Fields: 3
  → sourceDate, externalUrl, featuredImage
  ✓ Created news (ID: 1)
```

### Success (Update)
```
⟳ event - Exists (will update)
  Label: Event
  Plural: Events
  Description: Calendar events
  Hierarchy: both
  File: backend/scripts/migration/schemas/event.json
  Fields: 7
  → eventType, venue, organiser, eventStartDate, eventEndDate, ...
  Update existing 'event'? [y/N]: y
  ✓ Updated event (ID: 2)
```

### Dry Run
```
+ columnist - New
  Label: Columnist
  Plural: Columnists
  Description: Opinion columnists
  Hierarchy: both
  File: backend/scripts/migration/schemas/columnist.json
  Fields: 7
  → prefix, firstName, lastName, affiliation, photoUrl, ...
  [DRY RUN] Would CREATE
```

### Summary
```
======================================================================
✓ Successfully processed: 9
⊘ Skipped: 0
✗ Errors: 0
======================================================================
```

## Integration with Migration Workflow

### Step 1: Create/Update Schemas

Edit or create JSON schema files in `backend/scripts/migration/schemas/`

### Step 2: Preview Import

```bash
python manage.py import_schemas --dry-run
```

### Step 3: Import for Real

```bash
python manage.py import_schemas
```

### Step 4: Verify

```bash
python manage.py shell
>>> from object_storage.models import ObjectTypeDefinition
>>> ObjectTypeDefinition.objects.all()
<QuerySet [<ObjectTypeDefinition: news>, <ObjectTypeDefinition: event>, ...]>
```

## Common Workflows

### Initial Setup

```bash
# First time importing all schemas
python manage.py import_schemas --dry-run  # Preview
python manage.py import_schemas            # Import
```

### Update After Schema Changes

```bash
# After editing schemas
python manage.py import_schemas --force    # Update without prompts
```

### Add New Schema

```bash
# Create new schema file
echo '{...}' > backend/scripts/migration/schemas/my_type.json

# Import just that file
python manage.py import_schemas \
  --file backend/scripts/migration/schemas/my_type.json \
  --name my_type \
  --label "My Type"
```

### Convert Legacy Snake Case Schemas

```bash
# If you have old snake_case schemas
python manage.py import_schemas --convert-snake-case
```

## Troubleshooting

### Issue: "Directory not found: backend/scripts/migration/schemas"

**Solution:**

This happens when running inside Docker. The path is relative to the Django project root.

```bash
# ✅ Correct - Use Make command (handles paths automatically)
make import-schemas

# ✅ Correct - Inside Docker, use relative path
docker-compose exec backend python manage.py import_schemas

# ❌ Wrong - Don't include 'backend/' prefix inside Docker
docker-compose exec backend python manage.py import_schemas --schemas-dir backend/scripts/migration/schemas
```

**Why:** Inside the Docker container, the working directory is already `/app` (the Django project root), so paths should be relative to that.

### Issue: "No superuser found"

**Solution:**
```bash
# Create a superuser first
docker-compose exec backend python manage.py createsuperuser

# Or specify a user
make import-schemas  # (will prompt for user if needed)
docker-compose exec backend python manage.py import_schemas --user your_username
```

### Issue: Schema not updating

**Solution:**
```bash
# Force update without confirmation
python manage.py import_schemas --force
```

### Issue: Want to see what would change

**Solution:**
```bash
# Use dry run mode
python manage.py import_schemas --dry-run
```

### Issue: Snake case not converting

**Solution:**
```bash
# Ensure conversion is enabled (it's on by default)
python manage.py import_schemas --convert-snake-case
```

## Best Practices

1. **Always Dry Run First** - Preview changes before applying
2. **Version Control** - Keep schema files in git
3. **Test Schemas** - Validate JSON before importing
4. **Backup Database** - Before bulk updates
5. **Use Force in CI/CD** - Automate with `--force` flag
6. **Document Changes** - Update schema documentation

## Related Files

- **Schemas**: `backend/scripts/migration/schemas/*.json`
- **Command**: `backend/object_storage/management/commands/import_schemas.py`
- **Models**: `backend/object_storage/models.py`
- **Documentation**: 
  - `HOW_TO_CREATE_SCHEMAS.md`
  - `FIELD_NAME_MAPPING.md`
  - `SCHEMAS_INDEX.md`

## See Also

- [HOW_TO_CREATE_SCHEMAS.md](HOW_TO_CREATE_SCHEMAS.md) - Schema creation guide
- [FIELD_NAME_MAPPING.md](FIELD_NAME_MAPPING.md) - Field name conversions
- [SCHEMAS_INDEX.md](SCHEMAS_INDEX.md) - All available schemas

---

**Created**: 2025-10-13  
**Status**: ✅ Ready for use

