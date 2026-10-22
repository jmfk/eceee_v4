---
name: eceee-v4-design
description: Design, implement and review the ECEEE v4 CMS application UI using its established visual language. Use for ECEEE admin frontend pages, forms, navigation, Inbox, Kanban and Profile. Does not govern tenant website themes or public render widgets.
---

# ECEEE v4 application design

The existing ECEEE application is the visual authority. Match it even when generic UI skills recommend something different. In particular, white cards, subtle shadows, borders, blue actions and nested form/tool panels are intentional here. Do not import another product's visual system or redesign the application while adding a feature.

## Inspect the right references

Read the relevant nearby view before editing. In this repository:

- `frontend/src/pages/TagsPage.jsx`: overview heading, description, container width and white content panel.
- `frontend/src/pages/ProfilePage.jsx`: account sections and forms.
- `frontend/src/pages/SettingsManager.jsx` and `frontend/src/components/SettingsDashboard.jsx`: management panels, tabs and action hierarchy.
- `frontend/src/components/Navbar.jsx` and `frontend/src/components/StatusBar.jsx`: persistent app chrome.
- `frontend/src/index.css`: Inter font, primary color variables and `.btn-primary`, `.btn-secondary`, `.card`, `.input-field`.
- `frontend/src/components/user-tools.css`: scoped application controls shared by Inbox, Kanban and embedded import tools.

Compare the running local page with an established page, not just with a generic mockup. Choose the closest reference by task: overview, table/list, form or dense editor. Preserve the distinct density of each.

## Visual contract

- Use the existing light application shell: gray-50 background, gray-900 text, white navigation/panels and gray-200 borders. Do not independently enable OS-driven dark mode on one feature. A future app-wide theme must cover chrome and content together.
- Use Inter through the existing global font. Normal controls are text-sm; secondary text is gray-500/600. Overview titles use text-3xl font-bold with an optional 32px Lucide icon, and section titles text-lg/xl font-semibold. Dense editors may use smaller headings.
- Overview content uses `container mx-auto px-4 py-8`; narrow account forms may use max-w-4xl. Kanban boards and editors use the available width with their own overflow handling.
- Main panels are white with rounded-lg, a subtle border/shadow and about p-6 spacing. Toolbars/filter strips may have their own gray-50 surface or border inside a panel, as established elsewhere in ECEEE.
- Primary actions use the existing blue-600/700 buttons, white text, px-4 py-2 and rounded-lg. Secondary actions have gray text, a light neutral surface/border and matching geometry. Destructive actions use the established red treatment. Do not leave bare text buttons as the default.
- Inputs/selects/textareas use white backgrounds, gray-300 borders, rounded-md/lg, px-3 py-2, text-sm and a blue focus ring. Checkboxes stay compact native controls. Do not turn file pickers into ordinary text fields.
- Navigation links are not all underlined. Tabs use a visible blue selected state with aria-current/aria-pressed. Underline prose links where useful. Use Lucide icons consistently rather than introducing decorative assets.
- Keep the main Navbar and StatusBar visible while the work area scrolls. Loading and error states retain app navigation so users can leave the page.
- Inbox, Kanban and reporting are reached from Profile. Preserve existing direct URLs, workspace scope, unread indicators and report source context.

## Scope and verification

Change presentation without rewriting data/query, tenant, permission, upload, editing or realtime behavior. Scope feature CSS to its content; never let it restyle Navbar, StatusBar, unrelated pages or rendered tenant content. Reuse existing shared classes before adding a small feature-specific rule; do not introduce a design framework.

Check the actual local views at wide and narrow widths: overview/list, selected board/card, forms, empty/loading/error states and keyboard focus. Check that the OS color scheme cannot create an isolated dark feature inside the light app. Use existing focused tests for affected behavior and a frontend build; no broad suite is required for styling alone. Report any view that could not be inspected.
