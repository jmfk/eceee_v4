# Help Video Sitemap And Script Plan

This is the first working map for producing useful automatic help videos. The goal is to stop recording passive page tours and instead record task-based Playwright flows that start on the right fixture page, show the real controls, and pause at teaching moments while narration catches up.

## Public Website Sitemap

The public site is rendered by Django through hostname-based page routing, so the exact sitemap depends on the selected root page and hostname.

- `/` -> hostname root page, rendered by `HostnamePageView`.
- `/<slug_path>` -> public child page, rendered by `HostnamePageView`.
- `/webpages/page/<slug_path>/` -> explicit public page detail route.
- `/webpages/sitemap.xml` -> generated public sitemap.
- `/webpages/hierarchy.json` -> page hierarchy API.
- `/webpages/search/` -> public page search.
- `/webpages/widget/<widget_id>/` -> standalone widget rendering.
- `/lb/item` and `/lb/group` -> lightbox rendering endpoints.

For videos, create stable demo website fixtures rather than recording against whatever page tree is currently in production. Suggested fixture roots:

- `Demo Help Site` -> normal content site with Home, News, About, Contact.
- `Widget Showcase` -> one page per important layout/widget scenario.
- `Theme Preview` -> pages that make color, typography, image, and component style changes visible.
- `Object Content Demo` -> articles/people/events pages backed by object content.

## Admin Tool Sitemap

Primary admin areas:

- `/pages` -> page tree, create root page, create child page, search, refresh, import/export, bulk actions.
- `/pages/:pageId/edit` and `/pages/:pageId/edit/:tab` -> page editor, page settings, content widgets, publishing/version controls.
- `/pages/new` and `/pages/new/:tab` -> new page editor.
- `/pages/:pageId/versions` -> version timeline.
- `/objects` -> object type browser.
- `/objects/:typeName` -> objects for one type.
- `/objects/new/:objectTypeId/:tab?` -> create object instance.
- `/objects/:instanceId/edit/:tab?` -> edit object instance.
- `/media` -> media manager, namespaces, upload, pending files, metadata, tags, approval.
- `/tags` -> content tag management.
- `/settings` -> settings dashboard.
- `/settings/layouts` -> layout overview and slot structure.
- `/settings/themes` -> theme list.
- `/settings/themes/:themeId/:tab` -> theme editor tabs such as colors, fonts, images, design groups, component styles, image styles, gallery styles, table templates, CSS.
- `/settings/themes/:themeId/image-styles/:styleKey` -> image style editor.
- `/settings/themes/:themeId/component-styles/:styleKey` -> component style editor.
- `/settings/widgets` -> widget registry/metadata.
- `/settings/value-lists` -> reusable value lists.
- `/settings/object-types` -> data structures.
- `/settings/object-types/new/:tab?` and `/settings/object-types/:id/:tab?` -> object type editor.
- `/settings/versions` -> version overview.
- `/settings/publishing` -> publishing dashboard, timeline, and bulk operations.
- `/settings/namespaces` -> namespaces.
- `/settings/data-connections` and `/settings/data-connections/:id` -> external data connections.
- `/settings/content-migration` -> migration plans, jobs, and task progress.
- `/schemas/system`, `/schemas/layout`, `/schemas/layout/:layoutName` -> schema editors.
- `/settings/users` -> user management.
- `/profile` -> user profile.
- `/help/how-to` -> help site.

## Video Principles

- Start every video on the screen where the task actually happens. Widget videos should start on a known page editor route, not `/pages`.
- Prefer fixture IDs and helper environment variables for start URLs, for example `HOWTO_DEMO_WIDGET_PAGE_ID`.
- Refresh at the beginning of a recording when the first view can contain stale status messages.
- Use real `click`, `fill`, and `select` actions for the behavior being taught.
- Use `caption` only for short explanations between interactions.
- Avoid destructive actions in production recordings. Show cancel, draft, or read-only flows unless a local fixture backend is used.
- Record the complete interaction first, then retime with keyframe pauses around important UI states.

## Proposed Keyframe Model

The current generator runs each caption before its action. That makes the browser sit still while narration talks, then move quickly. The next version should support a full-flow timeline:

1. Run Playwright actions as a continuous scenario.
2. Mark keyframes after important actions, such as modal opened, widget library visible, field changed, preview updated, save controls visible.
3. Generate voiceover per keyframe.
4. Extend the video at each keyframe by cloning the frame until the voiceover segment has finished.
5. Mux narration and UI sound after retiming.

Suggested markdown action shape:

```json
[
  {
    "type": "goto",
    "path": "/pages/${HOWTO_DEMO_WIDGET_PAGE_ID}/edit/content",
    "caption": "Open a prepared page that already has widget slots.",
    "keyframe": "page-editor-open"
  },
  {
    "type": "click",
    "selector": "[data-testid='slot-main-add-widget']",
    "caption": "Use the plus action in the slot where the new widget should appear.",
    "keyframe": "widget-library-open"
  }
]
```

## First Manus Coverage

### Pages

- Create page: show page tree, create root page modal, required fields, draft status, cancel, search, refresh.
- Organize tree: start on page tree with selected fixture pages; show expand, select, bulk actions, copy/cut/duplicate, import/export entry points, refresh.
- Page editor: start on `/pages/:pageId/edit/content`; show editor tabs, save/version control, page settings, preview/publish checks.

### Widgets

- Add and edit widgets: start on `/pages/:pageId/edit/content`; show empty slot, add widget button, widget library, choose widget, open settings, edit fields, close/save.
- Widget row actions: start on a page editor with several widgets; show move up/down, copy, cut, paste, active toggle, delete confirmation without confirming deletion.
- Slots and container widgets: start on a page with Section/Two Columns/Three Columns; show nested slots and adding a child widget to a specific column.
- Widget type videos: use one fixture page per family, then open the relevant widget config subview. Keep each video focused on why that widget exists and which fields matter first.

### Objects

- Manage object content: start on `/objects`; choose an object type, open list, create/edit object, show content tab, status/version check.
- Object-backed widgets: show how object selection/filtering affects a widget such as News List or News Detail.

### Media

- Upload and manage media: start on `/media`; show namespace selector, upload area, pending approval, metadata/tags, copy/use media URL.
- Media in widgets: start inside a widget config that uses images/files; show media picker and metadata impact.

### Tags

- Manage tags: start on `/tags`; show create tag, search/filter, edit metadata, and where tags are reused.

### Settings

- Layouts: show layout list, slots, choosing a layout for a page.
- Themes: show theme list, theme editor tabs, colors/fonts/design groups, preview impact.
- Data structures: show object types, value lists, schemas, and how they relate to object editor fields.
- Publishing: show dashboard, timeline, bulk operations, and what to verify before publishing.
- Migrations/data connections: show connection list, migration plan, run/job dashboard without starting a destructive run in production.

## Fixture Needs

- One root page with clean page tree.
- One page per major layout: default, section, two-column, three-column, news/detail style.
- One editable page with at least three widgets in one slot.
- One editable page with nested container widgets.
- One object type with list/detail content.
- One media namespace with approved and pending files.
- One theme with visible colors, fonts, component styles, and image styles.

## Manual Override Rule

Manual videos belong in:

`frontend/public/howto-videos/manual/<language>/<section>-<guide>.mp4`

The help site checks manual videos before generated videos. Generated videos stay in:

`frontend/public/howto-videos/prod/<language>/<section>-<guide>.mp4`
