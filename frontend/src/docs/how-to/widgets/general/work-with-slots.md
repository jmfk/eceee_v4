---
id: widgets-slots
title: Work with slots
summary: Add child widgets to container slots.
order: 3
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Work with slots

Add child widgets to container slots.

<!-- narration: Container widgets can have nested slots. Add widgets to the correct slot and keep each slot focused on its layout purpose. -->

1. Open the container widget or section that exposes slots.
2. Use the slot plus action to add a child widget.
3. Keep each slot focused on its intended layout area, such as header, hero, sidebar, or footer.
4. Copy or paste complete slot contents when repeating a structure.
5. Clear a slot only after confirming that all child widgets can be removed.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots where the layout exposes named slots." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-sidebar']", "caption": "Expand the Sidebar slot so the slot toolbar is visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-sidebar']", "caption": "Click the plus icon on the Sidebar slot to add content exactly there." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-sidebartopnewswidget']", "caption": "Choose a widget that belongs in the sidebar slot." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-sidebartopnewswidget']", "caption": "Open the new widget settings so the sidebar content can be configured." }
]
```
