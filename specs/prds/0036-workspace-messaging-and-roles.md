---
id: PRD-0036
title: Workspace messaging, roles and profiles
status: completed
locked: true
created: 2026-10-23
related_adrs: [ADR-0051]
---

# PRD-0036: Workspace messaging, roles and profiles

## Requirements
- Gmail-like Inbox with recipient selection: configured support, tenant users, tenant groups, board membership groups and delivery into a board's Inbox.
- Every board has automatically created Inbox, Done and Archive lists that cannot be removed or archived; otherwise ordinary lists.
- Trello-like board work surface separate from overview/creation. Consistent Profile/Inbox/Kanban navigation and page width.
- Optional type defaults to question; optional location. Report from the affected page prepopulates its URL and attaches available redacted browser/system diagnostics.
- Files, images and videos up to five seconds in new messages and replies. Instruction videos are a separate, longer-video workflow; an operator can upload a how-to video for recording bug reports.
- Tenant-scoped roles apply across CMS APIs and navigation. Preserve tenant isolation and existing accounts during upgrade.
- Users can upload, replace and remove their own profile photo.

## Acceptance Criteria
- Recipient access is server-enforced; unrelated tenant members and unrelated support users cannot read private direct threads or attachments.
- Duplicate submission does not duplicate messages, board cards or attachments.
- Protected list identities survive renaming/reordering and existing board upgrades preserve cards.
- Relevant backend, frontend and browser checks pass; no production deployment is included.

## Implementation Notes
- Implements the owner's successive requests on 2026-10-23. Existing PRD-0032 and PRD-0033 requirements remain locked.

## Linked ADRs
- [ADR-0051](../adrs/active/0051-workspace-messaging-and-roles.md)


## Completion Evidence
- Coherent local batch covers Trello-like board navigation/layout, Gmail-like Inbox, recipient snapshots and board delivery, message files/five-second videos, contextual diagnostics/help upload, CMS roles and private profile photos.
- `scripts/test-kanban.sh kanban tenant_support core.test_roles_profiles`: 82 tests passed. Follow-up focused tests cover board-send role checks, per-user/tenant diagnostics, mixed recipients, preserved Designer assignments and role-grant inbox catch-up; passing evidence is retained for unchanged tests.
- `npm --prefix frontend run test:run -- src/pages/__tests__/KanbanPage.test.jsx src/pages/__tests__/ProfilePage.test.jsx src/pages/__tests__/InboxPage.test.jsx src/components/__tests__/Navbar.test.jsx`: 21 passed. Two diagnostic redaction/session tests also passed; affected Inbox checks rerun after the final settings text change.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:10100 npx playwright test --config playwright.kanban.config.js` from frontend: nine passed. Desktop Inbox/Profile/board and narrow message/board screenshots inspected. Browser APIs are mocked; backend authorization/storage validation is tested separately.
- Frontend production build passed with the existing chunk/import warnings. Focused new-file ESLint had no errors (two non-blocking warnings).
- Local development migrations applied after the PostgreSQL checks; existing card list references/positions preserved and all board mandatory lists active. Local private support bucket readiness/privacy verified; application worker refreshed. No production deployment or actual notification email was performed.
- PR preparation uses branch `codex/workspace-messaging-roles` after local checks. Production authorization/merge gates remain separate.
