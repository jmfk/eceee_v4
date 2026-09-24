---
id: PRD-0003
title: Designer draft publishing
status: started
locked: true
created: 2026-09-24
related_adrs:
  - ADR-0004
---

# PRD-0003: Designer Draft Publishing

## Problem

Designer workspace edits currently affect the live theme one mutation at a time. A designer needs to assemble and review value and image changes without exposing a partially updated theme to site visitors.

## Goals

- Give each theme a persistent Designer draft.
- Keep uploaded assets and visual value changes out of the live theme until explicit publication.
- Publish the complete draft as one coherent live-theme change.

## Non-Goals

- Add branching, approval chains, or multiple named drafts.
- Replace the advanced administrator theme editor.
- Make unused library-file replacement part of the first draft workflow.

## Users and Use Cases

- An assigned designer uploads images, changes palette values, typography, and spacing, reviews the combined preview, and publishes when satisfied.
- A tenant administrator can continue changing the live theme; conflicting Designer drafts must not overwrite those changes silently.

## Requirements

- A theme has at most one shared Designer draft.
- Draft state persists across page reloads and includes approved visual settings and staged asset references.
- Draft saves and asset uploads do not mutate `PageTheme`.
- Publishing checks both draft and live-theme versions, records one recoverable revision, and updates all live theme fields in one database transaction.
- A designer can discard the complete draft and return to current live state.
- Preview and export use draft state.
- The UI distinguishes local unsaved edits, saved draft changes, and published live state.

## Acceptance Criteria

- Changing values and uploading an asset leaves the live theme unchanged before Publish.
- Publish applies all staged fields together and creates one live revision.
- Concurrent draft or live-theme changes return a conflict instead of overwriting data.
- Pending local value edits are saved before an asset is staged or a publish is attempted.
- Google Fonts selected in the draft render in the preview.

## Constraints

- Object storage cannot participate in a database transaction. Uploaded files must therefore use immutable staging keys; publishing atomically changes only live database references.
- Existing tenant and theme Designer permissions remain authoritative.

## Implementation Notes

- 2026-09-24: Implementation started in the Designer workspace batch associated with PR #151.

## Linked ADRs

- [ADR-0004: Theme-scoped Designer draft and atomic reference publication](../adrs/active/0004-designer-draft-publication.md)

## Completion Evidence

- Pending local verification.
