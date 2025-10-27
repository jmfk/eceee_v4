# Version Control

Version Control in eceee_v4 provides comprehensive tracking of all changes to your pages, allowing you to view history, compare versions, and revert to previous states when needed.

## Overview

Every time a page is saved, eceee_v4 automatically creates a new version. This provides:

- Complete change history
- Ability to compare different versions
- Safe rollback to previous states
- Audit trail of who changed what and when
- Protection against accidental changes

## How Version Control Works

### Automatic Version Creation

Versions are automatically created when:

- A page is saved (manual save)
- A page is published
- Auto-save triggers (if enabled)
- Bulk operations modify the page
- API updates occur

### What's Stored in a Version

Each version captures:

- **Complete Page Content**: All widgets and their configuration
- **Page Data**: Metadata, SEO fields, custom data
- **Layout Configuration**: Active layout and settings
- **Theme Settings**: Applied theme and customizations
- **Publication Status**: Published, draft, scheduled
- **Timestamp**: Exact date and time of creation
- **Author**: User who created the version
- **Version Note**: Optional comment about changes

## Page Version History

![Version History View](images/page-version-history.png)

To view a page's version history:

1. Open the page in the editor
2. Click the **"History"** button in the toolbar
3. The version history panel displays:
   - Chronological list of all versions
   - Version number and creation date
   - Author information
   - Version type (manual save, publish, auto-save)
   - Optional version notes

### Version List Interface

**Version Entry Shows:**
- **Version Number**: Sequential identifier (v1, v2, v3...)
- **Date/Time**: When created
- **Author**: User who made the change
- **Type Badge**: Manual save, publish, auto-save
- **Status**: Published, draft, current
- **Actions**: View, compare, restore

**Filtering Options:**
- All versions
- Published versions only
- By author
- By date range
- By version type

## Viewing a Previous Version

![View Version Details](images/version-details-view.png)

To view the details of a previous version:

1. Open version history
2. Click on the version you want to view
3. The version viewer displays:
   - Full page preview as it appeared in that version
   - Widget configuration at that time
   - Page data and metadata
   - Publication status
   - Version metadata

### Version Viewer Features

**Read-Only Preview**
- See exact content from that version
- No editing capability (prevents accidental changes)
- Full rendering with layout and theme

**Version Information Panel**
- Creation timestamp
- Author details
- Version notes
- File sizes
- Number of widgets

**Quick Actions**
- Restore this version
- Compare with another version
- Export version
- Copy version URL

## Comparing Versions

![Compare Versions](images/compare-versions-view.png)

Compare two versions to see what changed:

1. Open version history
2. Select the **first version** (baseline)
3. Click **"Compare"**
4. Select the **second version**
5. View the comparison

### Comparison Display

**Side-by-Side View**
- Left panel: Older version
- Right panel: Newer version
- Synchronized scrolling
- Highlighted differences

**Unified Diff View**
- Single panel showing both versions
- Deleted content in red
- Added content in green
- Modified content in yellow
- Unchanged content in gray

**Change Summary**
- Total additions and deletions
- Widget changes (added, removed, modified)
- Field changes (data modifications)
- Percentage of page changed

### What's Highlighted

**Content Changes:**
- Modified text
- Changed images
- Updated links
- Altered formatting

**Widget Changes:**
- Added widgets (green highlight)
- Removed widgets (red highlight)
- Reordered widgets (blue highlight)
- Modified configurations (yellow highlight)

**Data Changes:**
- Updated metadata
- Changed SEO fields
- Modified custom data
- Layout/theme changes

## Reverting to a Previous Version

![Revert to Version](images/revert-to-version-dialog.png)

To restore a previous version:

1. View the version you want to restore
2. Click **"Restore This Version"**
3. Choose restore options:
   - **Restore as Draft**: Creates new draft without publishing
   - **Restore and Publish**: Immediately publishes restored version
   - **Schedule Restore**: Set future date for restoration
4. Add optional restoration note
5. Confirm the restoration

**Important**: Reverting doesn't delete newer versions. It creates a new version based on the old content.

### After Reverting

**What Happens:**
- New version created with old content
- Previous versions remain in history
- Version history shows restoration event
- You can continue editing or publish

**What to Check:**
- Verify content restored correctly
- Check all widgets are functioning
- Review metadata and settings
- Test any dynamic content or forms
- Preview before publishing

## Version Notes

Add notes to versions for better documentation:

### Adding Notes During Save

![Add Version Note](images/add-version-note.png)

When saving a page:

1. Click **"Save"** (or Ctrl/Cmd + S)
2. Optional: Enter a version note
3. Examples:
   - "Updated hero image"
   - "Fixed typo in contact email"
   - "Added new product section"
4. Click **"Save with Note"**

Version notes help you and your team understand why changes were made.

### Editing Version Notes

Edit notes after creation:

1. Open version history
2. Find the version
3. Click the edit icon next to the note
4. Update the note text
5. Save changes

**Note**: Only note text can be edited. Version content is immutable.

## Auto-Save Versions

eceee_v4 can automatically save versions while you work:

### Auto-Save Configuration

1. Navigate to **Settings** → **Version Control**
2. Enable **"Auto-save"**
3. Set auto-save interval (1-10 minutes)
4. Choose options:
   - Save only on significant changes
   - Maximum auto-save versions to keep
   - Auto-save notification preferences

### Managing Auto-Save Versions

Auto-save versions:
- Marked with auto-save badge
- Can be cleaned up periodically
- Won't trigger publication
- Useful for recovery from browser crashes

**Cleanup Options:**
- Keep last N auto-save versions
- Delete auto-saves older than X days
- Delete auto-saves when page is published
- Manual cleanup from version history

## Version Annotations

Annotate versions with additional context:

### Adding Annotations

![Version Annotations](images/version-annotations.png)

1. View a version
2. Click **"Add Annotation"**
3. Enter annotation text
4. Optionally @mention team members
5. Save annotation

**Use Cases:**
- Explain complex changes
- Link to related issues or tickets
- Note approval or review status
- Document reason for rollback

### Viewing Annotations

- Displayed in version history timeline
- Show in version detail view
- Searchable across all versions
- Can include links and mentions

## Diff Tools

Advanced comparison tools for detailed analysis:

### Field-Level Diff

![Field-Level Diff](images/field-level-diff.png)

View changes to specific fields:

- Metadata changes (titles, descriptions)
- Custom data field modifications
- Configuration changes
- Theme/layout switches

### Widget-Level Diff

See changes to individual widgets:

- Widget configuration changes
- Content modifications within widgets
- Style and appearance updates
- Position and ordering changes

### Structural Diff

Visualize page structure changes:

- Tree view of widget hierarchy
- Added/removed/moved widgets
- Slot assignments
- Layout modifications

## Version Export

Export versions for archival or analysis:

### Export Options

**JSON Export**
- Complete version data
- Programmatically parseable
- Useful for backups

**HTML Export**
- Rendered page output
- Includes styles
- Viewable in any browser

**PDF Export**
- Formatted document
- Print-ready
- Good for archival

**Zip Package**
- All version files
- Media and assets
- Complete page bundle

### Exporting a Version

1. View the version to export
2. Click **"Export"**
3. Choose export format
4. Set export options
5. Click **"Download"**

## Version Statistics

Track version activity and metrics:

### Available Statistics

**Page Version Count**
- Total versions
- Versions per day/week/month
- Active editors

**Change Frequency**
- Most frequently updated pages
- Update patterns over time
- Peak editing hours

**Author Statistics**
- Most active authors
- Average changes per author
- Collaboration patterns

**Version Size Metrics**
- Average version size
- Largest versions
- Storage usage trends

### Viewing Statistics

1. Navigate to **Reports** → **Version Control**
2. Select page or site-wide view
3. Choose date range
4. View charts and graphs
5. Export reports if needed

## Best Practices

### Version Management

1. **Meaningful Notes**: Always add notes for significant changes
2. **Review Before Revert**: Carefully review versions before restoring
3. **Regular Cleanup**: Archive or delete unnecessary auto-save versions
4. **Test After Restore**: Always test after reverting to ensure everything works
5. **Communicate Changes**: Notify team of major restorations

### Collaboration

1. **Check History**: Review recent changes before editing
2. **Coordinate**: Avoid simultaneous editing of the same page
3. **Document**: Use version notes to communicate with team
4. **Review**: Compare versions when merging collaborative work

### Performance

1. **Limit Auto-Save**: Don't auto-save too frequently
2. **Clean Old Versions**: Periodically remove old auto-saves
3. **Archive**: Export and delete very old versions if needed
4. **Monitor Storage**: Keep an eye on version storage usage

## Advanced Features

### Version Branching

Create alternative version branches:

1. **Main Branch**: Primary version timeline
2. **Experimental Branch**: Try changes without affecting main
3. **Merge**: Combine branches when ready
4. **Discard**: Delete experimental branch if not needed

**Use Cases:**
- Testing major redesigns
- A/B testing content
- Collaborative editing workflows

### Version Locking

Lock versions to prevent changes:

- **Lock Published Versions**: Prevent accidental modification
- **Lock Historical Versions**: Protect important milestones
- **Unlock with Permissions**: Admin can unlock if needed

### Version Templates

Save versions as templates:

1. Find a version with desired configuration
2. Click **"Save as Template"**
3. Name the template
4. Use to create similar pages
5. Templates preserve structure and settings

### External Version Control Integration

For technical users, integrate with Git:

- **Export to Git**: Push versions to Git repository
- **Import from Git**: Pull changes from Git
- **Sync**: Keep versions synchronized
- **Conflict Resolution**: Handle merge conflicts

## Keyboard Shortcuts

- `Ctrl/Cmd + H`: Open version history
- `Ctrl/Cmd + Shift + C`: Compare versions
- `Ctrl/Cmd + Z`: Undo (creates new version)
- `Ctrl/Cmd + Shift + R`: Restore previous version
- `Alt + N`: Add version note

## Troubleshooting

### Common Issues

**Problem**: Version history not showing  
**Solution**: Check permissions. Ensure versions exist for the page. Try refreshing the page.

**Problem**: Can't restore a version  
**Solution**: Verify you have edit permissions. Check if page is locked. Ensure target version is valid.

**Problem**: Comparison shows unexpected changes  
**Solution**: Verify you selected the correct versions. Check if auto-save created intermediate versions.

**Problem**: Auto-save not working  
**Solution**: Check auto-save settings are enabled. Verify sufficient storage space. Check browser console for errors.

**Problem**: Version restore didn't work as expected  
**Solution**: Check that the correct version was selected. Verify all widgets and data restored. Check browser console for errors.

### Version Recovery

**Lost Changes:**
- Check version history for auto-saves
- Look for recent versions before the loss
- Check browser session storage (may have temp data)
- Contact administrator for database-level recovery

**Corrupted Versions:**
- Try restoring an earlier version
- Export version and check JSON for corruption
- Contact administrator for manual repair

## Version Retention Policies

Configure how long versions are kept:

### Retention Rules

**Published Versions**
- Keep indefinitely (default)
- Keep for specified period (e.g., 1 year)
- Keep last N published versions

**Draft Versions**
- Keep for 90 days (default)
- Keep for custom period
- Auto-delete after page publication

**Auto-Save Versions**
- Keep for 30 days (default)
- Keep last N auto-saves only
- Delete on manual save

### Configuring Retention

1. Navigate to **Settings** → **Version Control**
2. Set retention policies for each version type
3. Enable/disable automatic cleanup
4. Set cleanup schedule
5. Save configuration

**Warning**: Deleted versions cannot be recovered. Archive important versions before cleanup.

## Compliance and Auditing

Version control supports compliance requirements:

### Audit Trail

Complete audit trail includes:
- All version changes
- User actions (view, edit, restore)
- Timestamps for all events
- IP addresses (if enabled)
- Before/after states

### Compliance Features

**Immutability**: Versions cannot be edited (only notes)  
**Traceability**: Track all changes to source  
**Retention**: Configurable retention policies  
**Export**: Generate compliance reports  
**Access Logs**: Track who accessed which versions  

### Generating Audit Reports

1. Navigate to **Reports** → **Audit Trail**
2. Select page or user
3. Set date range
4. Choose report format
5. Generate and download report

---

[← Back: Layouts & Themes](layouts-themes.md) | [Return to Index](README.md)


