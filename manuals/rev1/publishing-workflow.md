# Publishing Workflow

The Publishing Workflow system provides sophisticated content scheduling, bulk publishing operations, and comprehensive publication status tracking for managing your content lifecycle.

## Overview

eceee_v4 implements a professional-grade publishing workflow that allows you to:

- Publish and unpublish pages on demand
- Schedule pages for future publication
- Schedule automatic unpublishing
- Perform bulk publishing operations
- Track publication status across your site
- View publication timeline and history

## Publication States

Pages in eceee_v4 can be in one of several publication states:

### Draft
- Page has never been published
- Not visible to site visitors
- Can be edited freely
- Indicated by gray dot (●)

### Published
- Page is live and visible to visitors
- Has a published version
- Can still be edited (creates new draft version)
- Indicated by green checkmark (✓)

### Scheduled for Publication
- Publication date set in the future
- Will automatically publish at scheduled time
- Not yet visible to visitors
- Indicated by yellow clock icon (🕐)

### Scheduled for Unpublish
- Currently published
- Will automatically unpublish at scheduled time
- Currently visible but will become hidden
- Indicated by orange clock icon (🕐)

### Unpublished
- Was previously published but now hidden
- Not visible to visitors
- Can be republished at any time
- Indicated by crossed-out circle (⊘)

## Publishing a Page

![Publish Page Dialog](images/publish-page-dialog.png)

To publish a page immediately:

1. Open the page in the editor
2. Click the **"Publish"** button in the toolbar
3. Review the publication summary:
   - Current version number
   - Last published date (if any)
   - Changes since last publication
4. Optionally add a publication note
5. Click **"Publish Now"**

The page becomes immediately visible to site visitors.

### Publish Options

**Publish with Children**
- Publish the page and all child pages
- Useful for launching entire sections
- Respects individual page permissions

**Publish as Minor Update**
- Mark publication as minor (don't trigger notifications)
- Useful for small corrections
- Doesn't update major version number

**Backdated Publication**
- Set publication date in the past
- Useful for imported content
- Affects sorting and chronological displays

## Scheduling Publication

![Schedule Publication](images/schedule-publication.png)

Schedule a page to publish automatically in the future:

1. Open the page in the editor
2. Click the **"Schedule"** button or dropdown next to Publish
3. Select **"Schedule for Later"**
4. Choose the publication date and time
5. Optionally set an unpublish date
6. Add scheduling notes
7. Click **"Schedule Publication"**

### Schedule Settings

**Publication Date/Time**
- When the page will become visible
- Uses server timezone (configurable)
- Minimum: 1 minute in the future

**Unpublish Date/Time** (Optional)
- When the page will automatically hide
- Must be after publication date
- Useful for time-limited content

**Recurrence** (Advanced)
- Repeat publication pattern
- Daily, weekly, monthly schedules
- Useful for recurring events or content

## Unpublishing a Page

![Unpublish Page](images/unpublish-page-dialog.png)

To remove a page from the live site:

1. Navigate to the published page
2. Click the **"Unpublish"** button
3. Choose unpublish option:
   - **Unpublish Now**: Immediate removal
   - **Schedule Unpublish**: Set future date
4. Optionally add a note explaining why
5. Confirm unpublication

**Note**: Unpublishing makes the page inaccessible to visitors but preserves all content and versions.

### When to Unpublish

- Outdated or inaccurate content
- Temporary removal for updates
- Seasonal content (end of season)
- Time-sensitive pages (expired events)
- Content under review

## Publication Status Dashboard

![Publication Status Dashboard](images/publication-status-dashboard.png)

The Publication Status Dashboard provides a comprehensive overview of publication status across your site.

### Dashboard Sections

**Overview Statistics**
- Total pages
- Published pages
- Draft pages
- Scheduled publications
- Recently published

**Status Filters**
- All pages
- Published only
- Drafts only
- Scheduled
- Unpublished
- Recently modified

**Quick Actions**
- Bulk select pages
- Quick publish/unpublish
- Batch scheduling
- Export status report

### Using the Dashboard

1. Navigate to **Pages** → **Publication Dashboard**
2. View overall publication statistics
3. Use filters to find specific page groups
4. Select pages for bulk operations
5. Monitor scheduled publications

## Publication Timeline

![Publication Timeline](images/publication-timeline.png)

The Publication Timeline provides a visual calendar view of scheduled publications and unpublications.

### Timeline Views

**Calendar View**
- Monthly calendar
- Color-coded events
- Drag-and-drop rescheduling

**List View**
- Chronological list
- Sort by date, page, or status
- Filter by date range

**Gantt View** (Advanced)
- Timeline bars for publication periods
- Overlap visualization
- Dependencies

### Timeline Features

**Scheduled Events**
- Green: Scheduled publications
- Orange: Scheduled unpublications
- Blue: Recurring schedules

**Interactions**
- Click event to view details
- Drag to reschedule
- Right-click for quick actions

**Filters**
- Date range selection
- Page or section filter
- Author filter
- Status filter

## Bulk Publishing Operations

![Bulk Publishing Operations](images/bulk-publishing-operations.png)

Perform publishing actions on multiple pages simultaneously.

### Selecting Pages for Bulk Operations

**Method 1: Checkbox Selection**
1. Navigate to the page tree or list view
2. Check boxes next to desired pages
3. Click **"Bulk Actions"** button

**Method 2: Filter-Based Selection**
1. Apply filters to show desired pages
2. Click **"Select All Matching"**
3. Review selection count

**Method 3: Saved Selections**
1. Create a saved selection group
2. Load the selection
3. Perform bulk operation

### Bulk Publish

Publish multiple pages at once:

1. Select pages (see above)
2. Click **"Bulk Publish"** from actions menu
3. Review list of pages to be published
4. Set common publication options:
   - Publish date/time (now or scheduled)
   - Include child pages (yes/no)
   - Publication note
5. Click **"Publish All"**
6. Monitor progress bar
7. Review results summary

### Bulk Schedule

Schedule multiple pages for future publication:

1. Select pages for scheduling
2. Click **"Bulk Schedule"**
3. Set scheduling parameters:
   - Publication date/time
   - Unpublish date/time (optional)
   - Apply to all or individual dates
4. Review schedule summary
5. Click **"Schedule All"**
6. Confirm scheduling

### Bulk Unpublish

Remove multiple pages from the live site:

1. Select published pages
2. Click **"Bulk Unpublish"**
3. Choose unpublish timing:
   - Immediate
   - Scheduled (set date)
4. Add optional note
5. Confirm action
6. Review results

## Automated Publishing

eceee_v4 includes automated processing for scheduled publications.

### How Automation Works

The system runs a scheduled task every minute (configurable) that:

1. Checks for pages scheduled to publish
2. Publishes pages when their scheduled time arrives
3. Checks for pages scheduled to unpublish
4. Unpublishes pages when their scheduled time arrives
5. Sends notifications (if configured)
6. Logs all automated actions

### Monitoring Automation

**Publication Log**
- View history of automated publications
- See execution times and results
- Filter by date, page, or action

**Failure Notifications**
- Email alerts for failed publications
- Dashboard warnings
- Retry options

### Manual Processing

Force immediate processing of scheduled items:

1. Navigate to **System** → **Publishing**
2. Click **"Process Scheduled Publications"**
3. System immediately processes all due publications
4. View processing results

## Publication Notifications

Configure notifications for publication events:

### Notification Types

**Publication Confirmation**
- Email when page is published
- List of published pages
- Links to view live pages

**Schedule Reminders**
- Reminder before scheduled publication
- 24 hours, 1 hour, or custom timing
- Option to cancel or reschedule

**Unpublish Warnings**
- Warning before scheduled unpublication
- Option to cancel automatic unpublish
- Extend publication period

**Error Alerts**
- Notification if publication fails
- Error details and resolution steps
- Retry options

### Configuring Notifications

1. Navigate to **Settings** → **Notifications**
2. Enable desired notification types
3. Set recipient email addresses
4. Configure timing and frequency
5. Save notification preferences

## Version Control Integration

Publication integrates with version control:

### Publication Versions

Each publication creates a permanent record:

- **Version Number**: Incremented with each publication
- **Publication Date**: When it went live
- **Published By**: User who published
- **Publication Note**: Optional comment
- **Content Snapshot**: Frozen copy of page at publication time

### Reverting Publications

To revert to a previous published version:

1. Navigate to **Version History**
2. Find the version you want to restore
3. Click **"View"** to preview
4. Click **"Restore and Publish"**
5. The old version becomes the current published version

## Best Practices

### Planning Publications

1. **Content Calendar**: Maintain a publication schedule
2. **Review Cycle**: Allow time for review before publication
3. **Testing**: Preview pages before publishing
4. **Coordination**: Coordinate related page publications
5. **Timing**: Consider audience timezone for publication timing

### Scheduling Strategy

1. **Buffer Time**: Schedule publications with buffer time for final checks
2. **Business Hours**: Publish during business hours when support is available
3. **Traffic Patterns**: Avoid high-traffic times for major updates
4. **Batch Publishing**: Group related content for simultaneous publication
5. **Stagger Updates**: Don't overwhelm users with too many updates at once

### Quality Assurance

Before publishing:

✓ Content proofread and fact-checked  
✓ All images optimized and have alt text  
✓ Links tested and working  
✓ SEO metadata complete  
✓ Mobile preview checked  
✓ Accessibility validated  
✓ Browser testing completed  

### Rollback Planning

1. **Keep Previous Versions**: Don't delete old page versions
2. **Test Restore**: Periodically test version restoration
3. **Documentation**: Document major publication events
4. **Monitoring**: Monitor site after major publications
5. **Quick Rollback**: Know how to quickly unpublish if needed

## Advanced Features

### Workflow Approvals

Configure multi-step approval workflow:

1. **Draft**: Author creates content
2. **Review**: Editor reviews and approves
3. **Scheduled**: Content scheduled for publication
4. **Published**: Automatically published at scheduled time

### Publication Dependencies

Set up dependencies between pages:

- **Prerequisite Pages**: Require parent or related pages to be published first
- **Coordinated Publishing**: Publish multiple interdependent pages together
- **Cascade Rules**: Automatically publish or unpublish child pages

### A/B Testing

Schedule A/B tests for content:

1. Create two versions of a page
2. Schedule both for publication
3. System rotates between versions
4. Track performance metrics
5. Publish winning version permanently

## Keyboard Shortcuts

- `Ctrl/Cmd + P`: Publish current page
- `Ctrl/Cmd + Shift + P`: Schedule publication
- `Ctrl/Cmd + U`: Unpublish current page
- `Alt + P`: Open publication dashboard
- `Alt + T`: Open publication timeline

## Troubleshooting

### Common Issues

**Problem**: Scheduled publication didn't occur  
**Solution**: Check that the automated task is running. Verify the scheduled date/time was correct. Check publication log for errors.

**Problem**: Can't publish page  
**Solution**: Verify you have publish permissions. Check for validation errors. Ensure required fields are filled.

**Problem**: Page still showing old content after publishing  
**Solution**: Clear site cache. Check that you published the correct version. Verify CDN cache has refreshed.

**Problem**: Bulk publish operation failed  
**Solution**: Check publication log for specific errors. Try publishing pages individually to identify problem pages.

**Problem**: Cannot unpublish page  
**Solution**: Check for references from other pages. Verify you have unpublish permissions. Check if page has unpublish restrictions.

### Publication Errors

**Error**: "Publication time in the past"  
**Fix**: Choose a future date/time for scheduled publication

**Error**: "Unpublish date before publish date"  
**Fix**: Ensure unpublish date is after publication date

**Error**: "Required fields missing"  
**Fix**: Complete all required page data fields before publishing

**Error**: "Page has validation errors"  
**Fix**: Resolve all content validation errors before publishing

## Publication Reports

Generate reports on publication activity:

### Available Reports

**Publication Summary**
- Pages published in date range
- Author statistics
- Publication frequency
- Peak publication times

**Schedule Report**
- Upcoming scheduled publications
- Scheduled unpublications
- Recurring schedules
- Overdue publications

**Performance Report**
- Publication success rate
- Failed publication analysis
- Processing time statistics
- System load analysis

### Exporting Reports

1. Navigate to **Reports** → **Publication Reports**
2. Select report type
3. Set date range and filters
4. Choose export format (PDF, CSV, Excel)
5. Click **"Generate Report"**
6. Download or email report

---

[← Back: Content Editing](content-editing.md) | [Next: Layouts & Themes →](layouts-themes.md)


