---
id: PRD-0010
title: Public form submissions
status: completed
locked: true
created: 2026-09-29
related_adrs:
  - ADR-0011
---

# PRD-0010: Public Form Submissions

## Problem

The TypeScript public publisher can render configured forms but cannot safely accept submissions. The existing widget configuration can point at arbitrary URLs and contains options for storage and notifications without a server-side contract that validates the published form or isolates tenant data.

## Goals

- Let visitors submit forms rendered by the TypeScript public publisher.
- Validate every submission against the currently published form widget on the requested site and page.
- Store accepted submissions with explicit tenant, page, page-version, and widget identity.
- Keep the public request path independent of Django/Python APIs.
- Preserve a useful no-JavaScript submission path with clear success and error feedback.

## Non-Goals

- File uploads.
- Email notifications, webhooks, or arbitrary external submission URLs.
- CAPTCHA provider integration.
- A submission-management UI.
- Submitting forms from editor or preview surfaces.

## Users and Use Cases

- A visitor submits a contact or registration form on a published page.
- A site owner later retrieves tenant-scoped submissions from the database through a separately authorized management surface.
- A visitor using a browser without JavaScript receives success or error feedback after submission.

## Requirements

- The TypeScript publisher owns the public POST endpoint and writes directly to PostgreSQL.
- The endpoint re-resolves the hostname and published page; client-provided schema, tenant, version, destination URL, and success state are never trusted.
- Only a currently published `easy_widgets.FormsWidget` with `store_submissions` enabled may accept a submission.
- Submitted field names, required values, scalar/choice types, option membership, and bounded lengths are validated against the published widget configuration.
- Unknown fields are rejected, except for documented publisher control fields and the honeypot.
- Tenant, page, page-version, and widget identifiers are recorded with the validated payload and receipt time.
- A dedicated database credential is used for the narrow submission write path; the existing publisher read connection remains read-only.
- Honeypot spam is accepted without storage, request bodies are bounded, and responses do not disclose database or validation internals.
- Successful and failed native submissions redirect back to the same published page with widget-scoped feedback.

## Acceptance Criteria

- A valid form POST creates exactly one tenant-scoped submission row and redirects to visible success feedback.
- Missing required values, invalid choice values, unknown fields, oversized requests, stale page versions, and unknown widgets do not create rows.
- A non-empty honeypot does not create a row and returns the normal success redirect.
- The endpoint cannot use a client-supplied external URL or cross tenant/page boundaries.
- Preview/editor forms remain non-submitting.
- Focused publisher, render, model, and migration tests pass.

## Constraints

- Django continues to own database models and migrations, but no Django/Python API participates in public submission requests.
- Submission payloads contain no uploaded files in this iteration.
- Retention and a staff-facing management UI require later product decisions.

## Implementation Notes

- 2026-09-29: Implementation started on `codex/publisher-public-forms`.

## Linked ADRs

- [ADR-0011: Validate published forms and write through a dedicated PostgreSQL role](../adrs/active/0011-public-form-write-boundary.md)

## Completion Evidence

- 2026-09-29: Publisher unit and render tests cover valid storage, current-page and widget resolution, tenant/page/version identity, validation failures, duplicate fields, honeypot handling, request limits, rate limiting, transaction rollback, and native redirects.
- 2026-09-29: Publisher lint, typecheck, full test suite, and production build passed; the shared renderer parity tests, preview runtime tests, frontend lint, and frontend production build passed.
- 2026-09-29: Django reports no missing model migrations. PostgreSQL 17 checks passed for a clean install, upgrade with existing data, rollback, roll-forward, and an idempotent second migration run.
