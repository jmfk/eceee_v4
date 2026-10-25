---
id: ADR-0055
title: Contextual Kanban card overlay
status: accepted
date: 2026-10-25
related_prds: [PRD-0040]
supersedes: []
superseded_by: []
---

# ADR-0055: Contextual Kanban card overlay

## Decision
Honor the user's explicit overlay reference for Kanban card details. This scoped choice takes precedence over the generic UI skill's preference for full-page editing. Keep `/kanban/cards/:cardId` as the canonical URL and derive the background board from the loaded card, including direct links. Keep the board rendered underneath a Headless UI Dialog for focus trapping, inert background and Escape handling. Close navigates to the card's current board and restores focus to the card, or the board heading when filters/archive hide it.

Use a reading-first description with explicit editing and reveal metadata controls on demand. Retain the existing revision-aware form and comments/attachments workflow. When closing with an unsaved form or comment, keep the overlay open with inline actions to continue editing or discard; do not silently discard drafts. Realtime changes refresh pristine forms and preserve local edits with conflict feedback. On narrow screens, stack activity below content inside one scrolling overlay.

## Consequences
The card detail uses the same API contracts as before. The background board list is also fetched on direct card URLs. No persistent data or production changes are introduced.

## Links
- [PRD-0040](../../prds/0040-kanban-card-detail.md)
