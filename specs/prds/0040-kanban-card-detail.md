---
id: PRD-0040
title: Contextual Kanban card detail
status: completed
locked: true
created: 2026-10-25
related_adrs: [ADR-0055]
---

# PRD-0040: Contextual Kanban card detail

## Requirements
- Match the supplied detail reference with a large card overlay over the board, content on the left and comments/activity on the right.
- Keep destination, actions menu and close control in a compact top bar; keep labels, dates, checklists and attachments within reach below the title.
- Render descriptions as formatted content initially, with explicit editing; show the comment composer before activity.
- Preserve the existing card functionality and direct URLs, excluding Jira integration.
- Support narrow layouts, keyboard focus, Escape and draft preservation on attempted close.

## Implementation Notes
Uses the existing card APIs and mutations. No schema changes are required for this presentation update. PRD-0039's local backend activation blocker remains separate.

## Linked ADRs
- [ADR-0055](../adrs/active/0055-contextual-kanban-card-overlay.md)

## Completion Evidence
- Implemented in `frontend/src/pages/KanbanPage.jsx`, scoped Kanban CSS and shared `KanbanActions.jsx`; no backend/schema changes in this follow-up.
- Five focused browser scenarios pass across desktop/mobile, dark system preference/Reduce Motion, Markdown/comments, conflict drafts, overlay close/focus restoration, metadata/checklist editing, attachments and pristine-form rebasing after quick cover edits.
- Five page unit tests, focused ESLint, frontend production build and specs validation pass. Existing chunk/import warnings remain. No broad suite, external CI, commit or deployment was requested.
- Desktop and mobile review images saved in the chat visualization directory as `kanban-card-detail-overlay.png` and `kanban-card-detail-overlay-mobile.png`.
- Local backend activation is still subject to the existing missing-worktree container blocker recorded in PRD-0039; browser verification uses the real React UI and mocked API responses.

## Editor appearance follow-up
- The user's subsequent editor reference is implemented with the existing rich-text commands in one white frame, compact neutral toolbar, blue focus border, larger writing area, visual/Markdown controls and optional member mentions.
- Description Save/Cancel actions sit directly below the editor alongside inline formatting help. Cancel restores only the description, preserving other card drafts. The general card-save action stays hidden while the description editor provides the save path.
- Focused editor unit checks (8 tests) and page checks (5 tests) passed. Browser checks verify selection-preserving bold formatting, Markdown/caret behavior, save/cancel isolation, help and card/comment workflow. Frontend build and lint pass. No AI calls, credentials or schema changes are part of this editor refinement; image generation is still waiting for the key-reuse decision.
