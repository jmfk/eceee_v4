---
name: eceee-v4-design
description: Design, implement and review the ECEEE v4 CMS application UI using its established visual language. Use for ECEEE admin frontend pages, forms, navigation, Inbox, Kanban and Profile. Does not govern tenant website themes or public render widgets.
---

# ECEEE v4 application design

The Tags UI establishes the search and filter interaction pattern; the object editor's Properties and Tags panel establishes the updated control scale. Follow this guide when older screens use cramped controls, permanent field captions or overly rounded corners. White panels, subtle borders/shadows and blue actions remain part of ECEEE's visual language. Do not import another product's visual system or expand a focused UI task into an app-wide redesign.

## Inspect the right references

Read the relevant nearby view before editing. In this repository:

- `frontend/src/pages/TagsPage.jsx`: compact overview heading, description and white content panel.
- `frontend/src/components/classification/ClassificationManager.jsx` and `classification.css`: floating labels, search with filter pills, slim rows and connected tabs.
- `frontend/src/components/objectEdit/ObjectContentView.jsx` and `object-property-panel.css`: approved field, button and option density for the object editor's right panel.
- `frontend/src/components/classification/CompactSelect.jsx` and `compact-select.css`: compact dropdowns with keyboard interaction and required-field validation.
- `frontend/src/pages/ProfilePage.jsx`: account sections and forms.
- `frontend/src/pages/SettingsManager.jsx` and `frontend/src/components/SettingsDashboard.jsx`: management panels, tabs and action hierarchy.
- `frontend/src/components/Navbar.jsx` and `frontend/src/components/StatusBar.jsx`: persistent app chrome.
- `frontend/src/index.css`: Inter font, primary color variables and `.btn-primary`, `.btn-secondary`, `.card`, `.input-field`.
- `frontend/src/components/user-tools.css`: scoped application controls shared by Inbox, Kanban and embedded import tools.

Compare the running local page with an established page, not just with a generic mockup. Choose the closest reference by task: overview, table/list, form or dense editor. Preserve the distinct density of each, using the compact dimensions below as the default.

## Visual contract

- Use the existing light application shell: gray-50 background, gray-900 text, white navigation/panels and gray-200 borders. Do not independently enable OS-driven dark mode on one feature. A future app-wide theme must cover chrome and content together.
- Use Inter through the existing global font. Normal management controls and lists use 14px text; secondary text is gray-500/600. Overview titles use text-2xl font-bold with an optional 24px Lucide icon; section titles usually use text-lg font-semibold. Dense metadata and tertiary labels may use 12–13px.
- Overview content uses `container mx-auto px-4 py-6`; narrow account forms may use max-w-4xl. Kanban boards and editors use the available width with their own overflow handling.
- Main panels are white with small corners (about 4px), a subtle border/shadow and about 16–20px padding. Toolbars/filter strips may have their own gray-50 surface or border inside a panel, as established elsewhere in ECEEE.
- Primary actions use the existing blue-600/700 buttons and white text. Standard buttons are about 38px high with 14px text; small contextual actions are at least 32px high with 13px text. Use a 4px corner radius. Secondary actions use neutral styling; destructive actions use the established red treatment. List rows and tabs have their own styling rather than action-button boxes.
- Fields use white backgrounds, gray-300 borders, 4px corners, 14px text and a blue focus border. Standard single-line fields and search are about 42px high; option rows are about 40px high with 14px text. Do not enlarge a field far beyond this scale just to make it prominent. Follow the floating-label behavior below for search, text inputs, textareas and selects. Native checkboxes remain compact; file pickers remain file pickers.
- Tabs join a continuous baseline. The active tab meets the content area with a visible blue text/state treatment; inactive tabs stay quiet. Do not render tab menus as separated rounded action buttons. Preserve accessible selection and keyboard behavior; allow horizontal scrolling on narrow screens. Underline prose links where useful and use Lucide icons consistently.
- Keep the main Navbar and StatusBar visible while the work area scrolls. Loading and error states retain app navigation so users can leave the page.
- Inbox, Kanban and reporting are reached from Profile. Preserve existing direct URLs, workspace scope, unread indicators and report source context.

## Floating labels and dropdowns

- Use one visible label per field, always with a programmatic association. Empty and unfocused: show the label inside the field in the placeholder position. Focused or filled: lift it into the top border as a small legend. A numeric zero is filled; an empty select's prompt is not.
- Animate position and size together over about 140ms. Honor `prefers-reduced-motion` by moving immediately. Keep the field height stable during the transition.
- Center the floated legend on the border with a white background masking the line. Leave clear vertical space between label and value; compact sizing must never make them collide. Use 14px for the resting label and about 11px for the floated label.
- Highlight the border on focus. Do not use a rectangular outline or box-shadow ring that crosses the legend. Preserve visible keyboard focus.
- Do not show a second placeholder or empty select caption under the resting label. Keep a select label floated while its popup is open, including when focus moves into portalled options. After blur, populated fields stay floated; cleared fields return to the placeholder position.
- Dropdown popups match the fields: 14px options in roughly 40px rows, 4px corners, subtle blue selection and a small checkmark. Reuse the existing Headless UI dependency and compact select pattern instead of the oversized browser/OS menu. Preserve keyboard selection, typeahead, Escape, outside-click dismissal, focus return, disabled options and required-field validation.

## Compact search, filters and spacing

- Start browse/manage views with useful results and search. Do not require choosing a category/type before showing the default list.
- Filters are secondary controls: use one accessible **Add filter** icon button in the search field. Show chosen filters as small removable pills inside that field. Reveal selectors only when adding or changing a filter; omit a permanent full-width dropdown for an optional filter. Support Escape, outside-click dismissal, focus return and clear accessible names for icon buttons and pill removal.
- Keep search fields near 42px high, including their border legend, with 14px text. Make the search prominent through placement and available width instead of extra height. Do not repeat the label in the placeholder.
- Compact does not mean cramped. Keep about 12px between field text and its border, reserve space around select chevrons and trailing icons, and inset list text on both sides. Hover surfaces, focus rings and selected rows must retain those insets. Use roughly 16–20px panel padding and 8–12px between related controls; avoid large empty toolbar blocks.
- Show information once where it is useful. Avoid repeating the active tab as an adjacent heading or putting the same type/category on every row when the filter or a common grouping already establishes it. Keep labels, counts and supporting copy concise.
- Keep icon hit targets at least 24px on the web with visible keyboard focus. Check long pill names, wrapped content and narrow screens before reducing dimensions further.
- Interaction reference: `frontend/src/components/classification/ClassificationManager.jsx` and its scoped `classification.css` for search pills, border labels, list insets and connected tabs. Use the object property panel's updated sizes for new or revised controls. Do not apply these rules to tenant website themes or public rendering.

## Scope and verification

Change presentation without rewriting data/query, tenant, permission, upload, editing or realtime behavior. Scope feature CSS to its content; never let it restyle Navbar, StatusBar, unrelated pages or rendered tenant content. Reuse existing shared classes before adding a small feature-specific rule; do not introduce a design framework.

Check empty/unfocused, focused, populated/blurred and cleared field states, including a prefilled value and numeric zero. Verify label transitions, Reduce Motion, an open dropdown and keyboard focus. Check the actual local views at wide and narrow widths, including field insets, filter pills and the tab baseline: overview/list, selected board/card, forms, empty/loading/error states and keyboard focus. Check that the OS color scheme cannot create an isolated dark feature inside the light app. Use existing focused tests for affected behavior and a frontend build; no broad suite is required for styling alone. Report any view that could not be inspected.
