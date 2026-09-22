# Page editing, publishing, and history

The page editor separates saved work from the content that visitors see. Editors work with four concepts:

- **Working copy** — the one editable version of the page.
- **Live** — the read-only version currently shown to visitors.
- **Scheduled** — the working copy with a future publication date.
- **History** — older read-only versions used for preview, comparison, and restore.

Technical version numbers are shown only in History. They are not part of normal editing.

## Page status in Pages

Pages displays one combined state for each page:

- **Not published** — the page has work but nothing is live.
- **Live** — the saved live content has no newer working copy.
- **Live · unpublished changes** — visitors see the live version while an editor has newer saved work.
- **Scheduled** — the first publication is scheduled for a future date.
- **Live · scheduled changes** — the current page remains live until the scheduled working copy takes over.
- **Publication ended** — the page has historical content but no active live version.

The status indicator is informational. Open **Publishing & history** from the page actions to publish, schedule, unpublish, or inspect history.

Pages can be filtered by the same combined states. Bulk publishing first shows the pages and saved working copies that will be used. A bulk run handles each page separately and is not an atomic release.

## Edit and save

Opening a page loads its canonical working copy. If the page only has live content, the editor initially shows that content and creates a working copy on the first save.

**Save** always updates the same working copy. It never changes the live page.

If another editor saves the working copy after you loaded it, your save is stopped and the editor reports a conflict. Reload the page, review the newer work, and reapply your changes where needed.

Published versions, older drafts, and historical versions cannot be edited or deleted.

## Publish changes

Choose **Publish changes** to make the working copy live. The confirmation identifies the exact saved working copy that will be published.

Publishing does not choose an unspecified “latest” version. It publishes the working copy that the editor loaded and saved.

## Schedule changes

Choose **Schedule** and set a future publication date. The scheduled working copy remains editable and can be saved until its publication time. Existing live content remains unchanged until then.

A page can have one normal future schedule. If imported or legacy data contains additional scheduled versions, History reports a conflict. Resolve that conflict before creating another schedule; the system does not delete or cancel legacy content automatically.

Use **Cancel schedule** to return the scheduled working copy to an unscheduled working copy.

## Unpublish

Choose **Unpublish** in Publishing and confirm the action. The current live version is ended, but its content and history are retained. Unpublishing does not turn the old live version into an editable draft.

## History

Open **History** from the editor or **Publishing & history** from Pages to:

- preview any saved version;
- select two versions for comparison;
- see technical version numbers and timestamps;
- restore older content into the working copy;
- see legacy draft or scheduling conflicts.

**Restore as working copy** copies the selected historical content into the canonical working copy. It never publishes automatically. Review and save the result, then use **Publish changes** when it is ready.

## Advanced publishing with subpages

Publishing with subpages is available under **Advanced**. It operates on pages one by one and is not an atomic release. Another page can fail after earlier pages have already been published.

Use this only after reviewing the warning. Coordinated, atomic structure releases require a future release-packet feature and are not provided by this workflow.

## Product requirements

[PRD-0001](../../specs/prds/0001-simplified-page-versioning.md) is the requirement source for this workflow. The permanent rules for editable and immutable versions are recorded in [ADR-0001](../../specs/adrs/active/0001-canonical-page-version-workflow.md).
