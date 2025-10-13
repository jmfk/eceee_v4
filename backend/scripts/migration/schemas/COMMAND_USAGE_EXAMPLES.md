# Import Schemas Command - Usage Examples

Quick reference for the most common use cases of the `import_schemas` command.

## Quick Start

### 1. Import All Schemas (First Time)

```bash
# Preview what will happen
python manage.py import_schemas --dry-run

# Import all schemas
python manage.py import_schemas
```

### 2. Update All Schemas (After Changes)

```bash
# Update all without prompts
python manage.py import_schemas --force
```

### 3. Import Single Schema

```bash
python manage.py import_schemas \
  --file backend/scripts/migration/schemas/news.json \
  --name news
```

## Common Scenarios

### Scenario 1: Initial Project Setup

```bash
# You have schema files and need to create ObjectTypeDefinitions
python manage.py import_schemas
```

**What it does:**
- Reads all `.json` files from `backend/scripts/migration/schemas/`
- Creates ObjectTypeDefinition for each schema
- Converts snake_case to camelCase automatically
- Shows progress for each file

### Scenario 2: Schema Files Updated

```bash
# You edited schema files and want to update the database
python manage.py import_schemas --force
```

**What it does:**
- Updates existing ObjectTypeDefinitions
- No confirmation prompts (good for automation)
- Shows what changed

### Scenario 3: Legacy Snake Case Schemas

```bash
# You have old schemas with snake_case property names
python manage.py import_schemas --convert-snake-case
```

**What it does:**
- Automatically converts `source_date` → `sourceDate`
- Converts `external_url` → `externalUrl`
- Updates `required` and `propertyOrder` arrays
- Shows warning when conversions happen

### Scenario 4: New Schema File Added

```bash
# You created a new schema file and want to import just that one
python manage.py import_schemas \
  --file backend/scripts/migration/schemas/my_new_type.json \
  --name my_new_type \
  --label "My New Type" \
  --plural-label "My New Types" \
  --description "Description of my new type"
```

### Scenario 5: CI/CD Pipeline

```bash
# Automated deployment script
python manage.py import_schemas --force --user deploy_bot
```

**What it does:**
- No interactive prompts
- Uses specific user as creator
- Suitable for automation

### Scenario 6: Preview Changes Before Applying

```bash
# See what would happen without making changes
python manage.py import_schemas --dry-run
```

**Example output:**
```
DRY RUN MODE - No changes will be saved

Found 9 schema file(s) in backend/scripts/migration/schemas

+ news - New
  Label: News Article
  Plural: News Articles
  Description: News articles - content stored in Content Widget
  Hierarchy: both
  File: backend/scripts/migration/schemas/news.json
  Fields: 3
  → sourceDate, externalUrl, featuredImage
  [DRY RUN] Would CREATE
```

## Field Name Conversion Examples

### Before (snake_case schema):

```json
{
  "type": "object",
  "properties": {
    "source_date": {...},
    "external_url": {...},
    "event_start_date": {...}
  },
  "required": ["event_start_date"],
  "propertyOrder": ["event_start_date", "source_date", "external_url"]
}
```

### After (automatic conversion):

```json
{
  "type": "object",
  "properties": {
    "sourceDate": {...},
    "externalUrl": {...},
    "eventStartDate": {...}
  },
  "required": ["eventStartDate"],
  "propertyOrder": ["eventStartDate", "sourceDate", "externalUrl"]
}
```

## Troubleshooting Examples

### Problem: No superuser found

```bash
# Create superuser first
python manage.py createsuperuser

# Or specify existing user
python manage.py import_schemas --user your_username
```

### Problem: Want to see changes before applying

```bash
python manage.py import_schemas --dry-run
```

### Problem: Schema already exists, want to update

```bash
# With prompts
python manage.py import_schemas

# Without prompts
python manage.py import_schemas --force
```

### Problem: Import from different directory

```bash
python manage.py import_schemas --schemas-dir /path/to/other/schemas
```

## Integration Examples

### Example 1: Development Workflow

```bash
# 1. Edit schema file
vim backend/scripts/migration/schemas/news.json

# 2. Preview changes
python manage.py import_schemas --dry-run

# 3. Apply changes
python manage.py import_schemas

# 4. Test
python manage.py shell
>>> from object_storage.models import ObjectTypeDefinition
>>> news_type = ObjectTypeDefinition.objects.get(name='news')
>>> news_type.schema
```

### Example 2: Deployment Script

```bash
#!/bin/bash
# deploy.sh

# Update code
git pull origin main

# Import/update schemas
python manage.py import_schemas --force --user deploy

# Run migrations
python manage.py migrate

# Restart server
systemctl restart django-app
```

### Example 3: Testing Script

```bash
#!/bin/bash
# test_schemas.sh

# Dry run to check schemas
python manage.py import_schemas --dry-run

if [ $? -eq 0 ]; then
  echo "✓ All schemas valid"
  exit 0
else
  echo "✗ Schema validation failed"
  exit 1
fi
```

## Command Options Quick Reference

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--schemas-dir` | | Directory with schemas | `--schemas-dir path/to/schemas` |
| `--file` | | Single file import | `--file schemas/news.json` |
| `--name` | | Object type name | `--name news` |
| `--label` | | Display label | `--label "News Article"` |
| `--plural-label` | | Plural label | `--plural-label "News Articles"` |
| `--description` | | Description | `--description "News articles"` |
| `--hierarchy-level` | | Hierarchy placement | `--hierarchy-level both` |
| `--user` | | Creator username | `--user admin` |
| `--dry-run` | | Preview only | `--dry-run` |
| `--force` | | No prompts | `--force` |
| `--convert-snake-case` | | Convert naming | `--convert-snake-case` |

## Output Interpretation

### Success Messages

```
✓ Created news (ID: 1)          # New ObjectTypeDefinition created
✓ Updated event (ID: 2)         # Existing ObjectTypeDefinition updated
```

### Warning Messages

```
⟳ event - Exists (will update)  # Object type already exists
→ Converted snake_case to...    # Property names were converted
[DRY RUN] Would CREATE          # Preview mode, no changes made
```

### Error Messages

```
✗ Invalid JSON in file.json     # JSON syntax error
✗ Failed to save: ...           # Database error
✗ Error processing file: ...    # General error
```

## Real-World Examples

### Example: Migrate from Old System

You have 50 JSON schema files with snake_case naming from an old system:

```bash
# 1. Copy schemas to standard location
cp /old/system/schemas/*.json backend/scripts/migration/schemas/

# 2. Preview conversion
python manage.py import_schemas --dry-run

# 3. Import with automatic conversion
python manage.py import_schemas --convert-snake-case

# 4. Verify all imported
python manage.py shell
>>> ObjectTypeDefinition.objects.count()
50
```

### Example: Continuous Integration

In your CI pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Import Schemas
  run: |
    python manage.py import_schemas --force --user ci_bot
  env:
    DJANGO_SETTINGS_MODULE: config.settings.production
```

### Example: Local Development

```bash
# After pulling changes from git
git pull

# Update schemas if changed
python manage.py import_schemas --force

# Continue development...
```

## Tips & Best Practices

1. **Always dry-run first** for batch imports
2. **Use --force in automation** to avoid prompts
3. **Version control schemas** with git
4. **Backup database** before bulk updates
5. **Test locally first** before production
6. **Use meaningful names** for object types
7. **Document changes** in git commits

## See Also

- [IMPORT_SCHEMAS_COMMAND.md](IMPORT_SCHEMAS_COMMAND.md) - Full documentation
- [HOW_TO_CREATE_SCHEMAS.md](HOW_TO_CREATE_SCHEMAS.md) - Schema creation guide
- [FIELD_NAME_MAPPING.md](FIELD_NAME_MAPPING.md) - Field name conversions

---

**Quick Help:** `python manage.py import_schemas --help`

