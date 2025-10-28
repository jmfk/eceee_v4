# Cursor Commands - Quick Reference

This directory contains Cursor command files that guide the AI agent to perform specific sync operations between the `eceee_v4` development repository and the `eceee-components` deployment repository.

## Available Commands

### 🚀 Master Sync Command

**`sync-all-to-eceee-components.md`**  
Sync everything from eceee_v4 to eceee-components in one operation.

**Syncs:**
- ✓ Django settings
- ✓ Docker Compose configuration
- ✓ Widgets & layouts (backend + frontend)

**Usage:**
```
"Sync all to eceee-components"
"Sync everything to production"
```

---

### 📋 Individual Sync Commands

#### 1. **`sync-django-settings-to-production-repo.md`**
Sync Django settings from development to production.

**What it syncs:**
- New INSTALLED_APPS
- New configuration sections
- Environment variables
- Security fixes
- Feature flags

**Files affected:**
- Source: `backend/config/settings.py`
- Destination: `../eceee-components/backend/config/local_settings.py`

**Usage:**
```
"Sync Django settings to production"
"Sync new settings to eceee-components"
```

---

#### 2. **`sync-docker-compose-to-production-repo.md`**
Sync Docker Compose configuration to production deployment.

**What it syncs:**
- Environment variables
- New services (Celery, Playwright, etc.)
- Volume definitions
- Service configurations

**Files affected:**
- Source: `docker-compose.production.yml`
- Destination: `../eceee-components/deploy/docker-compose.production.template.yml`

**Usage:**
```
"Sync docker-compose to production"
"Update production docker configuration"
```

---

#### 3. **`sync-widgets-layouts-to-eceee-components.md`**
Sync widget and layout implementations.

**What it syncs:**
- Backend widget implementations
- Backend layout implementations
- Widget templates
- Layout templates
- Frontend widget editors

**Directories affected:**
- `backend/eceee_widgets/` → `../eceee-components/backend/eceee_widgets/`
- `backend/eceee_layouts/` → `../eceee-components/backend/eceee_layouts/`
- `frontend/src/widget-editors/` → `../eceee-components/frontend/src/widget-editors/`

**Usage:**
```
"Sync widgets to eceee-components"
"Sync widgets and layouts"
"Sync new CarouselWidget to eceee-components"
```

---

## Command Workflow

### When to Use Each Command

| Scenario | Command to Use |
|----------|----------------|
| Changed Django settings | `sync-django-settings-to-production-repo.md` |
| Added new environment variables | `sync-docker-compose-to-production-repo.md` |
| Created/modified widgets | `sync-widgets-layouts-to-eceee-components.md` |
| Created/modified layouts | `sync-widgets-layouts-to-eceee-components.md` |
| Sync everything at once | `sync-all-to-eceee-components.md` |

### Typical Development Workflow

1. **Make changes in eceee_v4** (development)
   - Add features, widgets, layouts
   - Update configurations
   - Test thoroughly

2. **Sync to eceee-components** (deployment)
   - Use appropriate sync command
   - Review changes
   - Commit to eceee-components

3. **Deploy to production**
   - Pull changes in production
   - Update .env file
   - Run migrations
   - Restart services

---

## Quick Start Examples

### Example 1: Full Sync After Major Development
```
You: "I've added AI tracking, updated widgets, and changed settings. Sync all to eceee-components."

Agent:
1. ✓ Validates repositories
2. ✓ Syncs Django settings (AI tracking config, etc.)
3. ✓ Syncs Docker Compose (Celery services, env vars)
4. ✓ Syncs widgets/layouts
5. ✓ Generates comprehensive report
6. ❓ Asks for commit approval
```

### Example 2: Sync Just Settings
```
You: "Sync Django settings to production"

Agent:
1. ✓ Compares settings files
2. ✓ Identifies new configurations
3. ✓ Applies changes to local_settings.py
4. ✓ Verifies syntax
5. ✓ Reports changes
6. ❓ Asks for commit approval
```

### Example 3: Sync New Widget
```
You: "Created new TableWidget. Sync it to eceee-components."

Agent:
1. ✓ Verifies widget files exist
2. ✓ Checks widget registry
3. ✓ Syncs backend widget code
4. ✓ Syncs widget template
5. ✓ Syncs frontend editor
6. ✓ Validates synced files
7. ❓ Asks for commit approval
```

---

## Command Features

All sync commands include:
- ✅ **Pre-sync validation** - Checks files exist and syntax is valid
- ✅ **Safe syncing** - Reviews changes before applying
- ✅ **Post-sync verification** - Validates changes worked correctly
- ✅ **Comprehensive reporting** - Shows exactly what changed
- ✅ **Commit approval** - Never commits without asking
- ✅ **Error handling** - Graceful failure with helpful messages

---

## Safety Features

### Never Auto-Commits
All commands ask for explicit approval before committing:
```
Would you like me to commit these changes to eceee-components?
```

### Validation at Every Step
- Python syntax checking
- YAML syntax validation
- Widget/layout registry verification
- File integrity checks

### Detailed Change Reports
Every sync generates a report showing:
- Files modified/added/deleted
- Configuration changes
- New features added
- Security fixes applied

---

## File Structure

```
.cursor/commands/
├── README.md                                          # This file
├── sync-all-to-eceee-components.md                   # Master sync command
├── sync-django-settings-to-production-repo.md        # Settings sync
├── sync-docker-compose-to-production-repo.md         # Docker sync
└── sync-widgets-layouts-to-eceee-components.md       # Widgets/layouts sync
```

---

## Related Project Files

### Makefile Commands
The project includes built-in Makefile commands for common operations:

```bash
make sync-to    # Sync eceee_v4 → eceee-components
make sync-from  # Sync eceee-components → eceee_v4
```

### Sync Scripts
Direct shell scripts for syncing:

```bash
./sync-to-eceee-components.sh    # Manual sync TO eceee-components
./sync-from-eceee-components.sh  # Manual sync FROM eceee-components
```

---

## Tips for Using Commands

### 1. Be Specific
Instead of: "Sync stuff"  
Say: "Sync widgets to eceee-components"

### 2. Test First
Always test changes in development before syncing:
```bash
docker-compose up backend frontend
# Test features work correctly
# Then sync to production
```

### 3. Review Diffs
Before approving commits, review the changes:
```bash
cd /Users/jmfk/code/eceee-components
git diff
```

### 4. Use Full Sync Wisely
The master sync command is powerful but comprehensive. Use it when:
- Multiple systems were updated
- Major feature development complete
- Preparing for production deployment

Use individual commands when:
- Only settings changed
- Only widgets changed
- Quick fixes needed

---

## Troubleshooting

### Command Not Working?
1. Check file exists: `ls .cursor/commands/`
2. Verify you're in the right directory: `pwd`
3. Check repository exists: `ls /Users/jmfk/code/eceee-components`

### Sync Failed?
1. Read the error message carefully
2. Check file permissions
3. Ensure both repositories are accessible
4. Verify syntax of source files

### Changes Not Appearing?
1. Check you synced to the right directory
2. Verify files were actually modified in source
3. Review git status in eceee-components
4. Check for uncommitted changes

---

## Best Practices

1. **Test Before Sync** - Always test in development first
2. **One Feature at a Time** - Sync related changes together
3. **Review Changes** - Always review git diff before committing
4. **Descriptive Messages** - Use detailed commit messages
5. **Document Changes** - Update docs when adding features
6. **Coordinate** - Communicate with team about syncs
7. **Backup** - Consider branching in eceee-components first

---

## Version History

- **v1.0** - Initial command set
  - Django settings sync
  - Docker Compose sync
  - Widgets/layouts sync
  - Master sync command

---

## Need Help?

If a command isn't working as expected:
1. Read the full command file for detailed instructions
2. Check the troubleshooting sections
3. Review the example workflows
4. Ask the agent specific questions about the sync process

---

**Happy Syncing!** 🚀

