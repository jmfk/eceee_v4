---
id: ADR-0054
title: Kanban card presentation and mirrors
status: accepted
date: 2026-10-25
related_prds: [PRD-0039]
supersedes: []
superseded_by: []
---

# ADR-0054: Kanban card presentation and mirrors

## Decision
Retain ADR-0045's tenant-locked relational workflow. Add an optional palette cover color and a nullable self-reference identifying a mirror's canonical card. Mirrors have independent placement, identity and archive state. Shared editable content is projected from the canonical card into mirror records inside the same transaction, keeping existing search/filter contracts usable. Open/edit actions target the canonical card; copies are independent snapshots of content and checklist, without copying discussions or files. Mirror creation flattens chains and validates the source and destination in the current tenant. Mirrors never generate duplicate assignment/deadline notifications.

Use Headless UI floating popovers for quick actions, with Escape/outside dismissal and focus handling. Keep native HTML drag-and-drop, explicitly clone whole cards/columns for the drag image and render insertion feedback; an animation loop scrolls the board/column while the pointer stays near an edge. No drag library is required.

## Consequences
The additive migration leaves existing cards unchanged. Copying excludes attachment binaries and comments. Mirrors share source discussions/files through their canonical detail link. Shared content edits must go through the canonical card. Source archive does not destroy mirrors; there is no permanent delete API. Projection work grows linearly with mirrors of a changed card, suitable for current small boards.

## Links
- [PRD-0039](../../prds/0039-kanban-interactions.md)
