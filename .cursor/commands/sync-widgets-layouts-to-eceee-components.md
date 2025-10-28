# Cursor Command: Sync Widgets and Layouts to eceee-components

## Purpose
Sync widget and layout implementations from the development repository (`eceee_v4`) to the deployment repository (`eceee-components`). This includes both backend templates/Python code and frontend widget editors.

## Background
The `eceee_widgets` and `eceee_layouts` directories are managed by the separate `eceee-components` repository and are intentionally excluded from version control in `eceee_v4` via `.gitignore`. The workflow is:
1. Make changes in `eceee_v4/backend/eceee_widgets/` or `eceee_v4/backend/eceee_layouts/`
2. Test locally in development
3. Sync to `eceee-components` repository (using programmatic file operations)
4. Commit in `eceee-components` repository

## Sync Method
This command uses **programmatic file operations** (read_file, write, list_dir, glob_file_search) instead of rsync. This allows intelligent analysis of each file for production safety before syncing.

## Instructions for Agent

### Step 1: Identify What Needs to Be Synced

Check for changes in the following directories:

**Backend Widget Implementation:**
- Source: `/Users/jmfk/code/eceee_v4/backend/eceee_widgets/`
- Destination: `/Users/jmfk/code/eceee-components/backend/eceee_widgets/`

**Backend Layout Implementation:**
- Source: `/Users/jmfk/code/eceee_v4/backend/eceee_layouts/`
- Destination: `/Users/jmfk/code/eceee-components/backend/eceee_layouts/`

**Frontend Widget Editors:**
- Source: `/Users/jmfk/code/eceee_v4/frontend/src/widget-editors/`
- Destination: `/Users/jmfk/code/eceee-components/frontend/src/widget-editors/`

### Step 2: Files to Sync

#### Backend Widget Files
Sync all files in `backend/eceee_widgets/`:
- `__init__.py` - App initialization
- `apps.py` - Django app configuration
- `widget_registry.py` - Widget registration
- `widgets/*.py` - Individual widget implementations
- `templates/eceee_widgets/**/*.html` - Widget templates
- `README.md` - Documentation

#### Backend Layout Files
Sync all files in `backend/eceee_layouts/`:
- `__init__.py` - App initialization
- `apps.py` - Django app configuration
- `layout_registry.py` - Layout registration
- `layouts/*.py` - Individual layout implementations
- `templates/eceee_layouts/**/*.html` - Layout templates
- `README.md` - Documentation

#### Frontend Widget Editor Files
Sync all files in `frontend/src/widget-editors/`:
- `*.jsx` - React components for widget configuration
- `*.js` - Utility functions for widgets
- Individual widget editor components

### Step 3: Pre-Sync Verification

Before syncing, verify:

1. **Test Local Changes:**
   ```bash
   # Ensure development environment is working
   docker-compose exec backend python manage.py check
   docker-compose exec frontend npm run build
   ```

2. **Check for Syntax Errors:**
   Use grep to scan for common issues before reading files:
   ```bash
   # Check for debug statements
   grep -r "print(" backend/eceee_widgets/ backend/eceee_layouts/ || echo "No print statements"
   grep -r "console.log" frontend/src/widget-editors/ || echo "No console.log statements"
   
   # Check for TODO/FIXME
   grep -r "TODO\|FIXME" backend/eceee_widgets/ backend/eceee_layouts/ frontend/src/widget-editors/ || echo "No TODO/FIXME"
   ```

3. **Verify Widget Registry:**
   ```bash
   docker-compose exec backend python manage.py shell -c "
   from eceee_widgets.widget_registry import widget_registry
   print('Registered widgets:', list(widget_registry.get_all_widgets().keys()))
   "
   ```

4. **Verify Layout Registry:**
   ```bash
   docker-compose exec backend python manage.py shell -c "
   from eceee_layouts.layout_registry import layout_registry
   print('Registered layouts:', list(layout_registry.get_all_layouts().keys()))
   "
   ```

### Step 4: Sync Process (Programmatic Approach)

Use AI tools to intelligently sync files with safety analysis:

#### 4.1: Discover Files to Sync

Use `glob_file_search` to find all files in each directory:

**Backend Widgets:**
```
Source: /Users/jmfk/code/eceee_v4/backend/eceee_widgets/
Destination: /Users/jmfk/code/eceee-components/backend/eceee_widgets/
```

**Backend Layouts:**
```
Source: /Users/jmfk/code/eceee_v4/backend/eceee_layouts/
Destination: /Users/jmfk/code/eceee-components/backend/eceee_layouts/
```

**Frontend Widget Editors:**
```
Source: /Users/jmfk/code/eceee_v4/frontend/src/widget-editors/
Destination: /Users/jmfk/code/eceee-components/frontend/src/widget-editors/
```

#### 4.2: Analyze Each File for Safety

For each file discovered, perform safety analysis:

**Files to SKIP automatically:**
- `__pycache__/` directories
- `*.pyc`, `*.pyo` compiled Python files
- `.DS_Store` macOS metadata
- `*.log` log files
- `node_modules/` (shouldn't exist but check)

**Safety Checks for Python files (*.py):**
- ⚠ **HIGH**: Contains `print(` statements (debug code)
- ⚠ **MEDIUM**: Contains `TODO` or `FIXME` comments
- ⚠ **MEDIUM**: Contains hardcoded URLs with `localhost` or `127.0.0.1`
- ⚠ **HIGH**: Contains `pdb.set_trace()` or `breakpoint()`
- ⚠ **INFO**: File is new (doesn't exist in destination)
- ⚠ **INFO**: Widget schema version changed

**Safety Checks for JavaScript/JSX files (*.js, *.jsx):**
- ⚠ **HIGH**: Contains `console.log(`, `console.debug(`, `console.warn(`
- ⚠ **HIGH**: Contains `debugger;` statement
- ⚠ **MEDIUM**: Contains `TODO` or `FIXME` comments
- ⚠ **MEDIUM**: Contains hardcoded URLs with `localhost` or `127.0.0.1`
- ⚠ **INFO**: File is new

**Safety Checks for Template files (*.html):**
- ⚠ **MEDIUM**: Contains `{% debug %}` tag
- ⚠ **MEDIUM**: Contains hardcoded development URLs
- ⚠ **INFO**: File is new

**Safety Checks for All Files:**
- ⚠ **CRITICAL**: Contains common password patterns (`password=`, `api_key=` with hardcoded values)
- ⚠ **CRITICAL**: Python syntax errors (for .py files)
- ⚠ **CRITICAL**: File size is 0 bytes (empty file)

#### 4.3: Categorize and Report

Categorize each file:
- **SAFE**: No warnings, ready to sync
- **WARN**: Has warnings but can be synced with user approval
- **SKIP**: Should not be synced (compiled files, caches, etc.)
- **ERROR**: Has critical issues, must not be synced

Generate report:
```
Sync Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAFE (25 files):
  ✓ backend/eceee_widgets/__init__.py
  ✓ backend/eceee_widgets/apps.py
  ✓ backend/eceee_widgets/widget_registry.py
  ✓ backend/eceee_widgets/widgets/table_widget.py
  ✓ backend/eceee_widgets/templates/eceee_widgets/widgets/table_widget.html
  ... (20 more)

WARNINGS (3 files):
  ⚠ backend/eceee_widgets/widgets/events_widget.py
     - HIGH: Contains print() statement at line 45
     - MEDIUM: Contains TODO comment at line 89
  
  ⚠ frontend/src/widget-editors/GalleryWidgetEditor.jsx
     - HIGH: Contains console.log() at line 23
  
  ⚠ backend/eceee_layouts/layouts/main_layout.py
     - MEDIUM: Contains FIXME comment at line 67

SKIPPED (4 files):
  ⊗ backend/eceee_widgets/__pycache__/widget_registry.cpython-311.pyc
     Reason: Compiled Python file
  ⊗ backend/eceee_widgets/.DS_Store
     Reason: System metadata file
  ⊗ backend/eceee_layouts/__pycache__/
     Reason: Python cache directory
  ⊗ frontend/src/widget-editors/.DS_Store
     Reason: System metadata file

ERRORS (0 files):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  Total files found: 32
  Safe to sync: 25
  Need review: 3
  Skipped: 4
  Errors: 0
```

#### 4.4: User Approval

Ask user for approval before proceeding:

```
Review completed. Sync recommendations:

1. AUTO-SYNC (25 SAFE files): These can be synced immediately
2. REVIEW FIRST (3 WARNING files): Please review warnings above
3. AUTO-SKIP (4 files): Will not be copied

Would you like to:
  a) Sync all SAFE files now (recommended)
  b) Review WARNING files first, then decide
  c) Abort sync
```

#### 4.5: Execute Sync

For approved files:
1. Use `read_file` to read source file content
2. Use `write` to write to destination path
3. Preserve directory structure (create subdirectories as needed)
4. Track what was copied for final report

**Example sync operation:**
```
Read: /Users/jmfk/code/eceee_v4/backend/eceee_widgets/widgets/table_widget.py
Write: /Users/jmfk/code/eceee-components/backend/eceee_widgets/widgets/table_widget.py
✓ Synced successfully
```

### Step 5: Post-Sync Verification

After syncing, verify in the eceee-components repository:

1. **Validate Python Syntax:**
   For all synced .py files, verify syntax:
   ```bash
   cd /Users/jmfk/code/eceee-components
   
   # Validate Python syntax
   python -m py_compile backend/eceee_widgets/widget_registry.py
   find backend/eceee_widgets/widgets -name "*.py" -exec python -m py_compile {} \;
   find backend/eceee_layouts/layouts -name "*.py" -exec python -m py_compile {} \;
   ```

2. **Check Git Status:**
   ```bash
   cd /Users/jmfk/code/eceee-components
   git status --short
   ```

3. **Verify Python Imports:**
   ```bash
   cd /Users/jmfk/code/eceee-components
   python -c "import sys; sys.path.insert(0, 'backend'); from eceee_widgets.widget_registry import widget_registry; print('✓ Widget registry imports successfully')"
   python -c "import sys; sys.path.insert(0, 'backend'); from eceee_layouts.layout_registry import layout_registry; print('✓ Layout registry imports successfully')"
   ```

4. **Verify File Counts:**
   Compare source and destination to ensure all intended files were synced:
   ```bash
   # Count synced files
   cd /Users/jmfk/code/eceee-components
   echo "Widget Python files:" $(find backend/eceee_widgets -name "*.py" | wc -l)
   echo "Widget templates:" $(find backend/eceee_widgets/templates -name "*.html" | wc -l)
   echo "Layout Python files:" $(find backend/eceee_layouts -name "*.py" | wc -l)
   echo "Layout templates:" $(find backend/eceee_layouts/templates -name "*.html" | wc -l)
   echo "Widget editors:" $(find frontend/src/widget-editors -name "*.jsx" -o -name "*.js" | wc -l)
   ```

### Step 6: Review Changes

Compare synced changes:

```bash
cd /Users/jmfk/code/eceee-components

# Show what changed
git diff backend/eceee_widgets/
git diff backend/eceee_layouts/
git diff frontend/src/widget-editors/

# Show new/deleted files
git status --short
```

### Step 7: Generate Final Report

Provide a comprehensive summary including:
- Number of files synced (safe vs warning)
- Files added/modified/deleted in destination
- New widgets or layouts added
- Widget editors added or updated
- All warnings encountered
- Any breaking changes or API modifications
- Template changes

**Example Report Format:**
```
═══════════════════════════════════════════════════════════
                    SYNC COMPLETE
═══════════════════════════════════════════════════════════

Sync Summary:
  Total files analyzed: 32
  Successfully synced: 28
  Skipped (auto): 4
  Errors: 0

By Category:
  Backend Widgets: 15 files synced
    - Modified: table_widget.py, gallery_widget.py, events_widget.py
    - Added: carousel_widget.py
    - Templates: 12 files synced
  
  Backend Layouts: 6 files synced
    - Modified: main_layout.py
    - Templates: 4 files synced
  
  Frontend Editors: 7 files synced
    - Modified: TableWidgetEditor.jsx, GalleryWidgetEditor.jsx
    - Added: CarouselWidgetEditor.jsx

Warnings Encountered (3):
  ⚠ HIGH: events_widget.py contains print() statement (line 45)
  ⚠ HIGH: GalleryWidgetEditor.jsx contains console.log() (line 23)
  ⚠ MEDIUM: main_layout.py contains FIXME comment (line 67)

  Note: These files were synced but should be reviewed for production readiness.

Git Status:
  Files changed: 28
  New files: 2 (carousel_widget.py, CarouselWidgetEditor.jsx)
  Modified files: 26

Next Steps:
  1. Review warnings above and fix if needed
  2. Review git diff to confirm changes
  3. Commit to eceee-components (awaiting approval)
  4. Test in staging environment
  5. Deploy to production

═══════════════════════════════════════════════════════════
```

### Step 8: Commit to eceee-components (User Decision)

**DO NOT automatically commit.** Ask the user if they want to commit the changes:

```
The sync is complete. Would you like me to commit these changes to the eceee-components repository?

Files changed:
- backend/eceee_widgets/: X files
- backend/eceee_layouts/: Y files  
- frontend/src/widget-editors/: Z files

Suggested commit message:
"Sync widgets and layouts from eceee_v4

- [List of changes]
"
```

If user approves, commit:
```bash
cd /Users/jmfk/code/eceee-components
git add backend/eceee_widgets/ backend/eceee_layouts/ frontend/src/widget-editors/
git commit -m "Sync widgets and layouts from eceee_v4

[Detailed change list]
"
```

## Safety Checks

### Before Syncing
- ✅ Verify local development environment is working
- ✅ All tests pass in development
- ✅ No syntax errors in Python or JavaScript files
- ✅ Widget and layout registries load successfully
- ✅ No uncommitted critical changes in eceee_v4

### During Sync
- ✅ Use `rsync --delete` to ensure exact copy (removes files deleted in source)
- ✅ Preserve file permissions and timestamps
- ✅ Don't sync `__pycache__`, `.pyc`, or other generated files

### After Sync
- ✅ Verify file counts match
- ✅ Check for any unexpected deletions
- ✅ Ensure Python imports still work
- ✅ Review git diff for unintended changes

## Files to Exclude from Sync

Never sync these files/directories:
- `__pycache__/` - Python bytecode cache
- `*.pyc` - Compiled Python files
- `*.pyo` - Optimized Python files
- `.DS_Store` - macOS metadata
- `node_modules/` - Should not be in these directories anyway
- `*.log` - Log files

## Widget-Specific Considerations

### When Syncing New Widgets
1. Ensure widget is registered in `widget_registry.py`
2. Include corresponding template in `templates/eceee_widgets/widgets/`
3. Include frontend editor in `frontend/src/widget-editors/`
4. Update widget documentation if applicable

### When Syncing Widget Modifications
1. Check for breaking changes in widget configuration schema
2. Verify template changes don't break existing pages
3. Test frontend editor with existing widget configurations
4. Update version number if widget has major changes

### When Syncing New Layouts
1. Ensure layout is registered in `layout_registry.py`
2. Include corresponding template in `templates/eceee_layouts/layouts/`
3. Test layout with various widget combinations
4. Document layout slot structure

## Common Widget/Layout Files Structure

### Widget File Structure
```
backend/eceee_widgets/
├── __init__.py
├── apps.py
├── widget_registry.py
├── README.md
├── widgets/
│   ├── __init__.py
│   ├── table_widget.py
│   ├── gallery_widget.py
│   └── [other_widgets].py
└── templates/
    └── eceee_widgets/
        └── widgets/
            ├── table_widget.html
            ├── gallery_widget.html
            └── [other_widgets].html
```

### Layout File Structure
```
backend/eceee_layouts/
├── __init__.py
├── apps.py
├── layout_registry.py
├── README.md
├── layouts/
│   ├── __init__.py
│   ├── main_layout.py
│   └── [other_layouts].py
└── templates/
    └── eceee_layouts/
        └── layouts/
            ├── main_layout.html
            └── [other_layouts].html
```

### Frontend Editor Structure
```
frontend/src/widget-editors/
├── TableWidgetEditor.jsx
├── GalleryWidgetEditor.jsx
├── EventsWidgetEditor.jsx
└── [other_widget_editors].jsx
```

## Example Usage

### Scenario 1: Sync After Adding New Widget

User: "I've added a new CarouselWidget. Sync it to eceee-components."

Agent:
1. Verify CarouselWidget files exist in eceee_v4 (use glob_file_search)
2. Check widget is registered in widget_registry.py (use grep or read_file)
3. Run pre-sync verification (check for debug statements, TODOs)
4. Discover all files to sync (glob_file_search)
5. Analyze each file for safety (check for print(), console.log(), etc.)
6. Generate safety report (SAFE/WARN/SKIP categories)
7. Ask user for approval
8. Execute sync (read_file from source, write to destination)
9. Verify in eceee-components (Python syntax, git status)
10. Report changes with warnings
11. Ask user about committing

### Scenario 2: Sync After Modifying Widget Template

User: "Updated TableWidget template for better accessibility. Sync to eceee-components."

Agent:
1. Verify template changes in eceee_v4 (read_file)
2. Run pre-sync verification (check for {% debug %}, hardcoded URLs)
3. Analyze template file for safety
4. Generate safety report
5. Ask user for approval
6. Execute sync (read_file, write)
7. Show git diff of template changes
8. Report changes
9. Ask user about committing

### Scenario 3: Bulk Sync All Widgets and Layouts

User: "Sync all widgets and layouts to eceee-components."

Agent:
1. Run comprehensive pre-sync verification (grep for debug statements)
2. Discover all files in all three directories (glob_file_search)
3. Analyze each file for safety (Python, JS, templates)
4. Generate comprehensive safety report
5. Show summary (X safe, Y warnings, Z skipped)
6. Ask user for approval
7. Execute sync for approved files (read_file, write for each)
8. Verify all synced files (Python syntax, git status)
9. Generate final report with all warnings
10. Ask user to review before committing

## Related Commands

- **Reverse Sync (eceee-components → eceee_v4):** `make sync-from`
- **View Current Widget Registry:** `docker-compose exec backend python manage.py shell -c "from eceee_widgets.widget_registry import widget_registry; print(widget_registry.get_all_widgets())"`
- **View Current Layout Registry:** `docker-compose exec backend python manage.py shell -c "from eceee_layouts.layout_registry import layout_registry; print(layout_registry.get_all_layouts())"`

## Notes

- This sync uses **programmatic file operations** (no rsync) for intelligent safety analysis
- This sync is **one-way** from eceee_v4 to eceee-components by default
- The eceee-components repository is the source of truth for deployment
- Changes should be tested in eceee_v4 before syncing to eceee-components
- Always review changes before committing to eceee-components
- Coordinate with team if multiple people are working on widgets/layouts
- Files with **CRITICAL** warnings will NOT be synced automatically
- Files with **HIGH** or **MEDIUM** warnings require user approval
- All warnings are reported in the final sync summary

## Troubleshooting

### Issue: Widget Not Appearing After Sync
- Verify widget is registered in `widget_registry.py`
- Check widget template is in correct location
- Ensure widget Python file has no syntax errors
- Restart Django server to reload registry

### Issue: Frontend Editor Not Loading
- Verify editor file is properly exported
- Check for JavaScript syntax errors
- Ensure editor component name matches widget type
- Rebuild frontend: `npm run build`

### Issue: Sync Skips Files Unexpectedly
- Review the safety analysis report
- Check if files match auto-skip patterns (__pycache__, .pyc, .DS_Store)
- Verify files exist in source directory
- Check file permissions

### Issue: Template Changes Don't Appear
- Clear template cache
- Restart Django server
- Check template file path is correct
- Verify template syntax is valid

## Best Practices

1. **Test Before Sync:** Always test widgets/layouts in development before syncing
2. **Commit in eceee_v4 First:** Commit widget changes in eceee_v4 before syncing (if applicable)
3. **Descriptive Commits:** Use detailed commit messages in eceee-components
4. **Review Diffs:** Always review git diff before committing synced changes
5. **Coordinate:** Communicate with team about widget/layout changes
6. **Documentation:** Update widget/layout documentation when making changes
7. **Version Control:** Consider versioning widgets if making breaking changes
8. **Backward Compatibility:** Maintain backward compatibility when possible

---

**Remember:** This sync affects the deployment codebase. Always verify changes thoroughly before committing to eceee-components.

