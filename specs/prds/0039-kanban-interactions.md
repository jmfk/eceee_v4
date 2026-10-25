---
id: PRD-0039
title: Kanban contrast, dragging and contextual actions
status: in-progress
locked: true
created: 2026-10-25
related_adrs: [ADR-0054]
---

# PRD-0039: Kanban contrast, dragging and contextual actions

## Problem
The pale blue/gray board lacks contrast, drag destinations are unclear, and inline menus obscure everyday card actions.

## Requirements
- Use a neutral board, distinct columns and white cards with readable contrast.
- Drag a card ghost with a card-sized insertion placeholder; drag a whole-column ghost with insertion lines before, between and after columns.
- Autoscroll horizontally and vertically at drag edges.
- Provide floating column action menus and card actions for opening, labels, assignees, covers, dates, movement, copying, links, mirroring and archiving. Exclude Jira.
- Preserve keyboard alternatives, tenant boundaries, revision conflicts and reversible archive behavior.

## Implementation Notes
Implementation stays in the existing Kanban service and React screen. No production deployment is authorized.

## Linked ADRs
- [ADR-0054](../adrs/active/0054-kanban-card-presentation.md)

## Verification and handoff
- Files: `frontend/src/pages/KanbanPage.jsx`, scoped Kanban CSS, new `KanbanActions.jsx`, `useBoardDrag.js`, and `cardPresentation.js`; Kanban model/serializer/service/view/task changes and additive migration `0003_card_presentation`.
- Focused Vitest page/API checks: 6 passed. Focused backend card-action tests: 6 passed; four existing move/revision/labels/deadline regressions also passed before the atomic column-copy addition.
- Browser checks cover board/detail navigation, preserved conflict drafts, persisted/filtered movement, desktop/mobile/light appearance, quick assignments/labels/covers/dates, clipboard, copy/mirror requests, card-sized landing boxes, whole-column ghosts, and horizontal/vertical edge scrolling. All 9 scenarios passed across focused runs; the edge scrolling test found and verified the fix for the strip below a column.
- ESLint, backend Flake8, frontend production build and specs validation passed. Build retains existing chunk-size/import warnings. No broad repository suite or external CI run was requested.
- Local activation is outstanding: `eceee-v4-backend-1` mounts `/Users/jmfk/.codex/worktrees/support-setup-commands/eceee_v4/backend`, which is missing; even a migration-plan command cannot enter `/app`. The existing instance was not recreated or repointed. Reattach the local development stack to this checkout and apply `python manage.py migrate kanban 0003`. The migration was exercised on a clean disposable test database; it adds a blank cover and nullable mirror reference without backfilling existing content.
- No commit, push, production connection or deployment was performed. Existing unrelated working-tree edits are preserved.
