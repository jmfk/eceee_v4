# Docker Path Fix for import_schemas Command

## Issue

When running the `import_schemas` command inside Docker, it was looking for the schemas directory at:
```
backend/scripts/migration/schemas
```

But inside the Docker container, the working directory is already at the Django project root (`/app`), so it couldn't find the directory.

## Solution

Changed the default path from `backend/scripts/migration/schemas` to `scripts/migration/schemas`.

## Files Modified

### 1. Command File

**File:** `backend/object_storage/management/commands/import_schemas.py`

**Change:**
```python
# Before
default="backend/scripts/migration/schemas"

# After  
default="scripts/migration/schemas"
```

### 2. Makefile

**File:** `Makefile`

**Change:**
```makefile
# Before
--file backend/scripts/migration/schemas/$(FILE)

# After
--file scripts/migration/schemas/$(FILE)
```

### 3. Documentation

**File:** `backend/scripts/migration/schemas/IMPORT_SCHEMAS_COMMAND.md`

**Added:**
- Path explanation for Docker vs non-Docker
- Troubleshooting section for "Directory not found" error
- Updated default path in options table

## How It Works Now

### Inside Docker (Recommended)

```bash
# ✅ Works - Uses default path (scripts/migration/schemas)
docker-compose exec backend python manage.py import_schemas

# ✅ Works - Make command handles everything
make import-schemas
```

**Working directory in Docker:** `/app` (Django project root)  
**Path resolution:** `/app/scripts/migration/schemas/`

### Outside Docker (Local Development)

If running Django directly without Docker:

```bash
# Need to specify full path from project root
cd /path/to/eceee_v4
python backend/manage.py import_schemas --schemas-dir backend/scripts/migration/schemas
```

**Working directory:** `/path/to/eceee_v4`  
**Path resolution:** `/path/to/eceee_v4/backend/scripts/migration/schemas/`

## Make Commands (Easiest)

The Make commands automatically handle the Docker execution and paths:

```bash
make import-schemas          # Just works ✅
make import-schemas-dry      # Just works ✅  
make import-schemas-force    # Just works ✅
```

## Why This Matters

### Before Fix

```bash
$ docker-compose exec backend python manage.py import_schemas
CommandError: Directory not found: backend/scripts/migration/schemas
```

### After Fix

```bash
$ docker-compose exec backend python manage.py import_schemas
Found 9 schema file(s) in scripts/migration/schemas
✓ Created news (ID: 1)
...
```

## Testing

To verify it works:

```bash
# 1. Test with dry run
make import-schemas-dry

# 2. Check the path is found
docker-compose exec backend python manage.py import_schemas --dry-run

# Should show:
# Found 9 schema file(s) in scripts/migration/schemas
```

## Path Reference

| Context | Working Dir | Command Path | Resolved Path |
|---------|-------------|--------------|---------------|
| Inside Docker | `/app` | `scripts/migration/schemas` | `/app/scripts/migration/schemas` |
| Make command | Project root | (handles Docker) | `/app/scripts/migration/schemas` |
| Outside Docker | Project root | `backend/scripts/migration/schemas` | `./backend/scripts/migration/schemas` |

## Quick Fix Summary

✅ **Changed:** Default path from `backend/scripts/migration/schemas` → `scripts/migration/schemas`  
✅ **Updated:** Makefile to use correct path  
✅ **Added:** Documentation about Docker paths  
✅ **Added:** Troubleshooting section for this error

## Now You Can

```bash
# Just run this and it works!
make import-schemas
```

No more path errors! 🎉

---

**Fixed:** 2025-10-13  
**Status:** ✅ Resolved

