---
id: PRD-0029
title: Theme-owned versioned widget types
status: completed
locked: true
created: 2026-10-21
related_adrs:
  - ADR-0040
---

# PRD-0029: Theme-owned Versioned Widget Types

## Problem

Designers cannot create reusable widget types without changing application code and deploying.

## Goals

- Author theme-owned content widgets with visual fields, HTML/Mustache and scoped CSS.
- Use published widgets in page and object editors, pinned to immutable type revisions.
- Preserve the existing tenant, draft, publishing and recovery boundaries.

## Non-Goals

- Executable JavaScript/React, data queries, child slots or bulk instance upgrades.

## Requirements

- Persist definitions and append-only numbered revisions in PageTheme.widget_types.
- Support text, multiline text, rich text, image, URL, number, boolean and choices.
- Save working definitions to the shared Designer draft; publish atomically with the complete theme.
- Keep existing instances pinned, including their schema, template and widget-specific CSS.
- Offer an explicit upgrade preview with removed values and validation errors before saving.
- Enforce authoritative server validation, tenant isolation and Designer authoring permissions.
- Preserve references through copying, nesting, inheritance, predefined object widgets and transfers.
- Reject incompatible theme switches and recovery/import operations; archive rather than delete released types.
- Include definitions in theme snapshots, export/import and file synchronization.
- Sanitize rendered HTML and parser-scope CSS; never execute template code.

## Acceptance Criteria

- Create, reload, publish and use a person card and fact box on pages and objects.
- Publishing revision 2 leaves revision 1 instances unchanged; new instances use revision 2.
- Unpublished definitions are unavailable outside authorized Designer previews.
- Unsafe input, stale drafts, cross-tenant access and altered releases are rejected.
- Preview and public React/Django output preserve the pinned revision.

## Constraints

- Preserve code-based widget behavior and the effective-theme resolution contract.
- Theme-wide tokens remain shared; only widget-specific presentation is pinned.
- Production operations require the existing separate owner gates.

## Implementation Notes

- 2026-10-21: Local implementation started on codex/theme-widget-types. Batch includes model, API, Designer, renderers, content integration and focused verification.

## Linked ADRs

- [ADR-0040](../adrs/active/0040-theme-widget-revisions.md)

## Completion Evidence

- Backend: 43 focused PostgreSQL tests passed across `webpages.tests.test_theme_widgets`, `webpages.tests.test_theme_widget_integration` and `webpages.tests.test_theme_versions`. The feature tests also passed against a fresh test database; the existing test database exercised the additive upgrade.
- Frontend: 183 tests passed across the new author/upgrade/render tests and existing registry parity, page renderer, object editor, nested slot/cut and DataManager tests. Authoring/object tests were rerun after the final UI edits.
- Publisher: 39 tests passed with `npm test -- tests/theme-widgets.test.ts tests/model.test.ts tests/theme.test.ts`.
- Both `frontend` and `publisher` passed `npm run build`; publisher TypeScript and client-bundle verification passed. Existing frontend chunk-size warnings remain.
- `python manage.py makemigrations --check --dry-run`: no unrecorded model changes. `git diff --check` and focused ESLint checks passed.
- File synchronization preserved complete definitions through JSON → Python → JSON in both inline and module modes. Theme ZIP export/import preserves released definitions in a PostgreSQL integration test.
- Synthetic person-card and fact-box browser checks passed at desktop/mobile sizes, including draft saving and iframe media-query behavior (28px desktop heading, 20px mobile heading), with no browser JavaScript errors. Temporary browser fixtures/server were removed/stopped.
- Implementation and usage notes: [Theme widget types](../../docs/theme-widget-types.md). Local batch remains on `codex/theme-widget-types`, without push, PR, CI or production operations.
