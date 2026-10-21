# Object publishing workflow

Objects use one **Publish** tab with publication status, schedule controls, and history. Save updates the canonical working copy; it never modifies live version content. Publishing promotes the reviewed working copy. Scheduled content remains editable until its effective time. Restore copies historical content into the working copy without publishing. Featured status is versioned too.

Existing extra drafts and schedules remain intact. Older drafts are historical; additional schedules must be explicitly cancelled before another schedule or publication. Unpublish ends current public visibility and preserves history. A separately scheduled future publication remains scheduled.

## API

All routes are relative to `/api/v1/objects/` and require authentication and access to the selected `X-Tenant-ID` workspace. Backend serializers use snake_case field names (shown below); the configured JSON renderer exposes camelCase responses to the frontend, and the parser accepts camelCase requests.

- `GET objects/{id}/workflow/`: aggregate state, editable/live/scheduled version summaries, and legacy conflict counts.
- `GET objects/{id}/`: canonical editor snapshot with `version_id`, `edit_revision`, `is_working_copy`, title, data, widgets, and featured status; reading does not create a draft.
- `POST objects/{id}/save_working_copy/`: complete `title`, `data`, `widgets`, plus `expected_version_id` and `expected_revision`. Optional `is_featured`. Send `parent` only with `expected_parent_id`, and `metadata` only with `expected_metadata`, using the values from the editor's original Object snapshot. Omit unchanged parent and metadata. If either submitted baseline differs from the current Object setting, the whole save returns **409**. Parent and metadata remain Object settings rather than version content. The first save after publication copies the reviewed live version atomically; later saves reuse that working copy.
- `POST versions/{id}/publish/`: publish the reviewed working copy.
- `POST versions/{id}/schedule/`: add `effective_date` (future ISO datetime). Omit `expiry_date` to retain the current expiry when rescheduling; send `null` to clear it, or a later ISO datetime to set it. A retained expiry before the new publication time returns **400**.
- `POST versions/{id}/cancel_schedule/`: cancel the explicitly reviewed schedule, including legacy extra schedules.
- `POST versions/{id}/unpublish/`: unpublish the explicitly reviewed live version.
- `POST versions/{reviewed_id}/restore/`: add `source_version_id` to copy history into the reviewed working copy. If no working copy exists, review the live or latest historical version instead.

Every version mutation requires `expected_version_id` matching its URL and `expected_revision` from the last read. A stale request returns **409** and preserves newer data. Content is validated again on restoration, scheduling, and publication against the current Object type. Read history through `objects/{id}/versions/` and snapshots through `versions/{id}/`.

Implicit object `publish/`, content writes through ordinary Object PUT/PATCH, `update_current_version/`, `update_widgets/`, direct version PATCH, and implicit bulk publication/archive return **410**. Clients must reload and adopt the working-copy API. Internal imports/transfers keep their explicit contracts; ordinary model saves advance revision tokens so an editor cannot overwrite an intervening import.

## Local operation and upgrade

Migration `object_storage.0028_object_version_workflow` adds title snapshots, revision counters, and workflow metadata without rewriting or deleting version content. Apply it before starting updated backend, worker, and publisher code. Legacy title snapshots are filled lazily from the known Object title when copied or superseded; titles predating this feature cannot be reconstructed.

Public content selection, titles, featured status, and publication order use the live version. The existing publication-cache worker also refreshes scheduled Object title/relationship projections using a retryable pending marker. Public version selection does not wait for that worker; derived relationship projections follow its normal cycle. Ordinary draft saves do not update these projections.

Production deployment requires the repository's separate owner gate. If recovery is needed, preserve the added columns and content; prefer a forward fix. Do not reverse the migration to discard title or revision metadata.
