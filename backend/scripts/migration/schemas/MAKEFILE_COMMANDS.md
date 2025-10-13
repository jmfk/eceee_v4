# Makefile Commands for Schema Import

Quick reference for Make commands that import JSON schemas into ObjectTypeDefinitions.

## Available Commands

### `make import-schemas`

Import all JSON schemas from the schemas directory.

```bash
make import-schemas
```

**What it does:**
- Imports all `.json` files from `backend/scripts/migration/schemas/`
- Creates new ObjectTypeDefinitions or updates existing ones
- Converts snake_case to camelCase automatically
- Prompts for confirmation before updating existing types

**Use when:**
- First-time setup
- After editing schema files
- Regular schema updates

---

### `make import-schemas-dry`

Preview what would happen without actually importing.

```bash
make import-schemas-dry
```

**What it does:**
- Shows exactly what would be created or updated
- No database changes
- Safe to run anytime

**Use when:**
- Want to see what will change before committing
- Validating schema files
- Testing new schemas

**Example output:**
```
DRY RUN MODE - No changes will be saved

+ news - New
  Label: News Article
  Fields: 3
  [DRY RUN] Would CREATE
```

---

### `make import-schemas-force`

Import/update all schemas without confirmation prompts.

```bash
make import-schemas-force
```

**What it does:**
- Updates all ObjectTypeDefinitions automatically
- No confirmation prompts
- Ideal for automation

**Use when:**
- CI/CD pipelines
- Deployment scripts
- Batch updates
- You're confident about the changes

---

### `make import-schema FILE=x NAME=y`

Import a single schema file.

```bash
make import-schema FILE=news.json NAME=news
```

**Parameters:**
- `FILE` - Schema filename (in schemas directory)
- `NAME` - Object type name

**Examples:**
```bash
# Import news schema
make import-schema FILE=news.json NAME=news

# Import event schema
make import-schema FILE=event.json NAME=event

# Import custom schema
make import-schema FILE=my_type.json NAME=my_type
```

**Use when:**
- Adding a new object type
- Testing a single schema
- Updating one specific type

---

## Common Workflows

### Initial Project Setup

```bash
# 1. Check what will happen
make import-schemas-dry

# 2. Import all schemas
make import-schemas
```

### After Editing Schemas

```bash
# Quick update without prompts
make import-schemas-force
```

### Adding New Schema

```bash
# 1. Create the schema file
vim backend/scripts/migration/schemas/my_new_type.json

# 2. Import it
make import-schema FILE=my_new_type.json NAME=my_new_type
```

### Testing Changes

```bash
# Preview changes
make import-schemas-dry

# If looks good, apply
make import-schemas
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

git pull origin main
make import-schemas-force
make migrate
make restart
```

## Comparison: Make vs Django Command

| Make Command | Django Command |
|--------------|----------------|
| `make import-schemas` | `docker-compose exec backend python manage.py import_schemas` |
| `make import-schemas-dry` | `docker-compose exec backend python manage.py import_schemas --dry-run` |
| `make import-schemas-force` | `docker-compose exec backend python manage.py import_schemas --force` |
| `make import-schema FILE=x NAME=y` | `docker-compose exec backend python manage.py import_schemas --file backend/scripts/migration/schemas/x --name y` |

**Benefit of Make commands:** Much shorter and easier to remember!

## Quick Reference Table

| Command | When to Use | Safe? | Prompts? |
|---------|-------------|-------|----------|
| `import-schemas` | Regular updates | ✅ Yes | ✅ Yes |
| `import-schemas-dry` | Preview/test | ✅ Yes | ❌ No |
| `import-schemas-force` | CI/CD, batch | ⚠️ Careful | ❌ No |
| `import-schema` | Single file | ✅ Yes | ✅ Yes |

## Tips

1. **Always dry-run first** when unsure:
   ```bash
   make import-schemas-dry
   ```

2. **Use force for automation**:
   ```bash
   make import-schemas-force
   ```

3. **Check the help** anytime:
   ```bash
   make help
   ```

4. **View all schema commands**:
   ```bash
   make help | grep -A 5 "Object Type"
   ```

## Troubleshooting

### Command Not Found

```bash
# Make sure you're in the project root
cd /path/to/eceee_v4
make import-schemas
```

### Docker Not Running

```bash
# Start Docker services first
make servers

# Then import schemas
make import-schemas
```

### Schema File Not Found

```bash
# Check the file exists
ls backend/scripts/migration/schemas/

# Use correct filename
make import-schema FILE=news.json NAME=news
```

### Wrong Parameters

```bash
# Both FILE and NAME are required
make import-schema FILE=news.json NAME=news

# ❌ Wrong
make import-schema FILE=news.json

# ❌ Wrong  
make import-schema NAME=news
```

## See Also

- **Full Command Documentation**: [IMPORT_SCHEMAS_COMMAND.md](IMPORT_SCHEMAS_COMMAND.md)
- **Usage Examples**: [COMMAND_USAGE_EXAMPLES.md](COMMAND_USAGE_EXAMPLES.md)
- **Schema Creation**: [HOW_TO_CREATE_SCHEMAS.md](HOW_TO_CREATE_SCHEMAS.md)
- **All Make Commands**: Run `make help`

---

**Quick Start:** `make import-schemas-dry` → `make import-schemas`

