---
id: widgets-toolbar
title: Use widget row actions
summary: Use the row actions to manage widgets without leaving the editor.
order: 2
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Use widget row actions

Use the row actions to manage widgets without leaving the editor.

<!-- narration: Widget rows have contextual actions for moving, copying, cutting, pasting, editing, hiding, and deleting content. -->

1. Use the up and down actions to reorder widgets inside the same slot.
2. Use copy when you want to reuse a widget elsewhere.
3. Use cut when you want to move a widget to another position.
4. Use paste to insert copied or cut widget content near the current row.
5. Use the Active control to hide or show a widget without deleting it.
6. Use delete only when the widget should be removed from the page or object.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start on a page editor that already contains widgets." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand Main Content to reveal the widget row you want to manage." },
  { "type": "waitForText", "text": "Example content", "caption": "Find the widget row you want to manage." },
  { "type": "click", "selector": "[data-testid='page-widget-copy-easy-widgets-contentwidget']", "caption": "Click the copy icon when you want to reuse this widget elsewhere." },
  { "type": "click", "selector": "[data-testid='page-widget-active-easy-widgets-contentwidget']", "caption": "Click Active to temporarily hide the widget without deleting its settings." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-contentwidget']", "caption": "Click the settings icon when you need to edit the widget configuration." }
]
```
