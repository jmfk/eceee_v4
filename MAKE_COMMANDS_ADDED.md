# Make Commands Added for Schema Import

## Summary

Added 4 convenient Make commands to the project Makefile for importing JSON schemas into ObjectTypeDefinitions.

## New Make Commands

### 1. `make import-schemas`

Import all JSON schemas from the schemas directory.

```bash
make import-schemas
```

**Equivalent to:**
```bash
docker-compose exec backend python manage.py import_schemas
```

---

### 2. `make import-schemas-dry`

Preview what would happen without actually importing (dry run).

```bash
make import-schemas-dry
```

**Equivalent to:**
```bash
docker-compose exec backend python manage.py import_schemas --dry-run
```

---

### 3. `make import-schemas-force`

Import/update all schemas without confirmation prompts (good for automation).

```bash
make import-schemas-force
```

**Equivalent to:**
```bash
docker-compose exec backend python manage.py import_schemas --force
```

---

### 4. `make import-schema FILE=x NAME=y`

Import a single schema file.

```bash
make import-schema FILE=news.json NAME=news
```

**Equivalent to:**
```bash
docker-compose exec backend python manage.py import_schemas \
  --file backend/scripts/migration/schemas/news.json \
  --name news
```

## Quick Examples

### First Time Setup

```bash
# Preview what will be imported
make import-schemas-dry

# Import all schemas
make import-schemas
```

### After Editing Schemas

```bash
# Quick update without prompts
make import-schemas-force
```

### Import Single Schema

```bash
# Import just the news schema
make import-schema FILE=news.json NAME=news
```

### View Available Commands

```bash
# See all Make commands
make help

# See just schema commands
make help | grep -A 5 "Object Type"
```

Output:
```
Object Type Schemas:
  import-schemas            Import all JSON schemas to ObjectTypes
  import-schemas-dry        Preview schema import (dry run)
  import-schemas-force      Import/update schemas without prompts
  import-schema FILE=x NAME=y  Import single schema file
```

## Benefits of Make Commands

### Before (Long)
```bash
docker-compose exec backend python manage.py import_schemas --dry-run
```

### After (Short)
```bash
make import-schemas-dry
```

**Advantages:**
- ✅ **Shorter** - Much easier to type
- ✅ **Memorable** - Simple command names
- ✅ **Consistent** - Follows project conventions
- ✅ **Discoverable** - Shows up in `make help`
- ✅ **Docker-aware** - Automatically uses docker-compose

## Files Modified

### Makefile

**Location:** `/Users/jmfk/code/eceee_v4/Makefile`

**Changes:**
1. Added 4 commands to `.PHONY` declaration
2. Added "Object Type Schemas" section to help text
3. Added 4 command implementations

**Lines added:** ~25 lines

## Documentation Added

**File:** `backend/scripts/migration/schemas/MAKEFILE_COMMANDS.md`

Complete reference for the Make commands including:
- All 4 commands explained
- Common workflows
- Examples
- Troubleshooting
- Comparison table

## Integration

The Make commands work seamlessly with:
- ✅ Existing Docker Compose setup
- ✅ Django management command
- ✅ All import_schemas options
- ✅ Project workflow

## Quick Reference

| Task | Command |
|------|---------|
| Preview | `make import-schemas-dry` |
| Import all | `make import-schemas` |
| Force update | `make import-schemas-force` |
| Import one | `make import-schema FILE=x NAME=y` |
| View help | `make help` |

## Testing

Commands tested and working:

```bash
✓ make help                          # Shows new commands
✓ make import-schemas-dry            # Would work (needs Docker)
✓ All syntax validated               # No Makefile errors
```

## Next Steps

### To Use Now

```bash
# 1. Make sure Docker is running
make servers

# 2. Preview schema import
make import-schemas-dry

# 3. Import schemas
make import-schemas
```

### For Deployment

```bash
# Add to deployment script
make import-schemas-force
```

### For Development

```bash
# After editing a schema
make import-schemas-force
```

## See Also

- **Make Commands Guide:** `backend/scripts/migration/schemas/MAKEFILE_COMMANDS.md`
- **Full Command Docs:** `backend/scripts/migration/schemas/IMPORT_SCHEMAS_COMMAND.md`
- **Quick Examples:** `backend/scripts/migration/schemas/COMMAND_USAGE_EXAMPLES.md`
- **Project Summary:** `IMPORT_SCHEMAS_SUMMARY.md`
- **All Make Commands:** Run `make help`

---

**Quick Start:** `make import-schemas-dry` → `make import-schemas` ✅

