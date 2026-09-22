---
id: PRD-0002
title: Page workflow invariant hardening
status: started
locked: true
created: 2026-09-22
related_adrs:
  - ADR-0002
  - ADR-0003
---

# PRD-0002: Page Workflow Invariant Hardening

## Problem

The simplified version workflow still has compatibility paths that can mutate page data or publication state without the reviewed version timestamp. Tenant selection also conflates page ownership with authorization. These exceptions weaken the workflow's concurrency and isolation guarantees.

## Goals

- Enforce one optimistic-locking write boundary for a page working copy.
- Require explicit page, version, and reviewed timestamp tuples for multi-page publication.
- Make scheduled activation failure recover to a consistent live and draft state.
- Separate tenant membership authorization from content ownership.

## Non-Goals

- Atomic release packets.
- Automatic merge of conflicting edits to the same field.
- Changes to production tenant provisioning or identity providers.

## Users and Use Cases

- An editor saves content and page attributes without mutating public output.
- A manager publishes or schedules exactly the versions they reviewed.
- Two editors receive a conflict instead of silently overwriting each other.
- A tenant member edits content regardless of which member originally created it.

## Requirements

- Every page-editor save uses the complete working-copy save endpoint with `client_updated_at`.
- A saved version cannot be reassigned to another page.
- Legacy page and granular version mutation endpoints return HTTP 410.
- Bulk publish and schedule accept only explicit page/version/timestamp items and report per-item results.
- Implicit descendant publication is unavailable until a reviewed explicit-item flow exists.
- All working-copy saves validate page attributes and the effective page-data schema.
- Scheduled slug conflicts restore the predecessor and return the rejected schedule to a draft.
- The effective Celery Beat schedule always includes scheduled-publication activation.
- A web-client version mismatch defers reload while an editor has unsaved changes.
- Tenant authorization uses explicit membership or staff access; content creators are not the authorization model.

## Acceptance Criteria

- Page-attribute-only saves create no direct `WebPage` update request.
- A stale save, publish, schedule, bulk publish, or bulk schedule item is rejected.
- Current-version reads never create versions and never cross tenant boundaries.
- A scheduled slug collision leaves the prior live version active and editable content recoverable.
- Scheduled publications are processed by the effective production Beat configuration.
- A deployment cannot discard dirty editor state through an automatic reload.
- Tenant members can edit tenant content; unrelated users cannot.
- Backend and frontend regression tests cover the enforced boundaries.

## Constraints

- The change is intentionally breaking for legacy mutation clients.
- Existing historical versions remain readable.
- Multi-page operations remain non-atomic and return item-level outcomes.

## Implementation Notes

- 2026-09-22: Implementation started and requirements locked as a consolidated review-hardening batch for PR #147.
- 2026-09-22: Consolidated editor saves behind the optimistic-locking working-copy endpoint, removed legacy mutation behavior, added explicit bulk scheduling, and introduced tenant membership authorization.
- 2026-09-22: Scheduled slug activation failures now restore the predecessor and retain the rejected content as a draft with failure metadata.
- 2026-09-22: The effective Beat schedule now retains the scheduled-publication task, and deployment reloads wait until the page editor is clean.

## Linked ADRs

- [ADR-0002: Single page workflow mutation boundary](../adrs/active/0002-single-page-workflow-mutation-boundary.md)
- [ADR-0003: Tenant membership authorization](../adrs/active/0003-tenant-membership-authorization.md)

## Completion Evidence

- Backend: 686 tests passed with 18 skipped; changed Python files pass Black, isort, and Flake8; migration drift check reports no changes.
- Frontend: 1,008 tests passed; ESLint reports no errors; production build passes.
- Governance: `/specs` validation passes.
- Remaining acceptance evidence: browser walkthrough after the updated web client is loaded.
