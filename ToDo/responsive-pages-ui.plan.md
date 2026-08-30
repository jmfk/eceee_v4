# Responsive Pages UI

## Status

- **Priority:** High
- **State:** In progress
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

### Completed in this batch

- Page-tree identity, publication metadata, version badges, warnings, and
  actions now occupy separate responsive regions.
- Edit and add-child remain directly available; secondary row actions use a
  labelled, keyboard-accessible overflow menu below 1280 CSS pixels.
- Deep hierarchy indentation is capped on phones while the full hierarchy is
  retained on desktop.
- The shared bottom status/save bar stacks on phones, compacts Git and clipboard
  state, respects safe-area insets, and stays outside the scrollable content.
- Component and Playwright regressions cover long titles, warning/draft/
  scheduled/published states, deep nesting, menu geometry, and bottom-bar
  clearance at phone and tablet widths.

### Remaining

- Finish the separate application-navigation collapse/menu work described
  below; it is outside the page-tree/action/bottom-bar batch.

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

- [x] The Pages and Deleted views work at viewport widths of 320, 375, 768,
      1024, and 1440 CSS pixels.
- [x] No text, badge, icon, or button overlaps another interactive element.
- [x] There is no page-level horizontal scrollbar at the tested widths.
- [x] Nested page hierarchy remains understandable and operable.
- [x] Primary page actions remain directly available; secondary actions remain
      available through a labelled overflow menu.
- [x] Every icon-only action has an accessible name and a visible tooltip or
      equivalent explanation.
- [x] Keyboard navigation and focus indicators work throughout the toolbar,
      page tree, menus, and bottom bar.
- [x] The bottom bar does not obscure the final page row or notification content.
- [x] Published, draft, warning, long-title, and deeply nested rows are covered
      by responsive component tests.
- [x] Browser tests or visual snapshots cover phone, tablet, and desktop layouts.

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
