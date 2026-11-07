---
id: PRD-0048
title: Columnist and event directory pages
status: completed
locked: true
created: 2026-11-07
related_adrs:
  - ADR-0068
  - ADR-0069
---

# Columnist and event directory pages

## Requirements

- Provide a columnist overview showing published names, portraits and introductions, linking to each columnist's own page.
- On a columnist page show their profile and published Article columns linked by the existing authors reference.
- Provide an events overview following the supplied reference, with larger ECEEE event cards and compact other-event cards. Every event links to its own detail page.
- Both index and detail pages support separately editable hero, content and additional widget slots.
- Preserve all existing object definitions, fields and content. Use published snapshots and tenant-scoped public media only.
- Implement selection and rendering in TypeScript, with minimal CMS schema compatibility where necessary.
- Preserve the existing typography, responsive card appearance, focus-point image cropping and accessible navigation. Lists stop at their actual end.

## Acceptance

- Real published columnists/events render and their links resolve; no invented content or filler cards.
- A columnist's list contains only their published columns. Draft, expired and foreign-tenant objects never appear.
- Event detail shows description and practical fields; profile/detail content stays editable through widgets.
- Public and editor-preview adapters share the same selection behavior. Focused tests and desktop/mobile visual checks are recorded.

## Completion evidence

Implemented locally on 2026-11-07; see ADR-0068 for configuration, recovery points and verification. Public routes, profile columns, manual event grouping, responsive layouts, editor Preview and saved standalone preview were checked. No production changes or deployment were made.
