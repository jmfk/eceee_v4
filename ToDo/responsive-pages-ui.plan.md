# Responsive Pages UI

## Status

- **Priority:** High
- **State:** Todo
- **Surface:** Frontend page manager and shared application chrome

## Problem

The Pages interface is not usable at narrow and tablet-sized viewports. Page
metadata, publication state, version controls, and row actions overlap instead
of adapting to the available width. The application navigation and bottom
status/action bar also consume too much horizontal space.

The issue is especially visible for nested page trees containing publication
status, version badges, warnings, and several row actions at the same time.

## Desired Outcome

Editors can browse and operate the complete page tree on phones, tablets, and
desktop screens without overlapping text, clipped controls, hidden content, or
page-level horizontal scrolling.

## Scope

### Application navigation

- Collapse or progressively hide secondary navigation items at narrow widths.
- Keep the current section and a discoverable navigation/menu control visible.
- Prevent the logo, breadcrumb, and primary navigation from competing for the
  same horizontal space.

### Pages toolbar

- Let tabs, help, overflow actions, search, and filters wrap or stack cleanly.
- Preserve a full-width search field where practical.
- Keep all controls keyboard accessible with touch targets of at least 44 by 44
  CSS pixels.

### Page tree rows

- Separate the page identity, status/version metadata, and actions into
  responsive regions.
- Preserve hierarchy, indentation, and expand/collapse affordances.
- Keep the page title readable and truncate only with an accessible way to read
  the complete value.
- Move secondary row actions into an overflow menu when they cannot fit.
- Ensure status text, version badges, warnings, and action icons never overlap.
- Do not rely on icon shape or color alone to communicate action or state.

### Bottom status and save controls

- Prevent the bottom bar from covering page-tree content.
- Allow pagination, Git status, clipboard state, and save controls to collapse,
  wrap, or move into an overflow menu at narrow widths.
- Respect mobile safe-area insets.

## Acceptance Criteria

- [ ] The Pages and Deleted views work at viewport widths of 320, 375, 768,
      1024, and 1440 CSS pixels.
- [ ] No text, badge, icon, or button overlaps another interactive element.
- [ ] There is no page-level horizontal scrollbar at the tested widths.
- [ ] Nested page hierarchy remains understandable and operable.
- [ ] Primary page actions remain directly available; secondary actions remain
      available through a labelled overflow menu.
- [ ] Every icon-only action has an accessible name and a visible tooltip or
      equivalent explanation.
- [ ] Keyboard navigation and focus indicators work throughout the toolbar,
      page tree, menus, and bottom bar.
- [ ] The bottom bar does not obscure the final page row or notification content.
- [ ] Published, draft, warning, long-title, and deeply nested rows are covered
      by responsive component tests.
- [ ] Browser tests or visual snapshots cover phone, tablet, and desktop layouts.

## Verification Checklist

- Test Pages and Deleted with both collapsed and expanded trees.
- Test long page titles, multiple-digit child counts, draft versions, published
  versions, and warning states.
- Test browser zoom at 200 percent at a desktop viewport.
- Verify touch operation on a phone-sized viewport.
- Run the relevant frontend unit tests, lint, and production build.
- Capture before/after screenshots at 375 and 768 CSS pixels.

## Likely Implementation Areas

- `frontend/src/components/TreePageManager.jsx`
- Page-tree row and action components used by `TreePageManager`
- Shared navigation/header components
- Shared bottom status/save controls
- Responsive component tests under `frontend/src/components/__tests__/`

