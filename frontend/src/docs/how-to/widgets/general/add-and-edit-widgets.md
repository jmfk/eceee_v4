---
id: widgets-edit
title: Add and edit widgets
summary: Add a widget to a slot and open its configuration.
order: 1
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Add and edit widgets

Add a widget to a slot and open its configuration.

<!-- narration: Open a page editor, add a widget to a slot, configure the widget, then save the page content. -->

1. Open a page or object editor that has widget slots.
2. Choose the plus action on the slot where the widget should appear.
3. Pick a widget type from the widget library.
4. Use the settings action on the widget row to configure content, layout, links, and media.
5. Save the editor when the widget looks correct.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on the page editor, because widgets are added inside page slots." },
  { "type": "waitForText", "text": "ECEEE Example Site", "caption": "Confirm that the editor has opened the page you want to change." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot where the new widget should appear." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-imagewidget']", "caption": "Choose Image widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-imagewidget']", "caption": "Click the settings icon on the new widget row to open its configuration panel." },
  { "type": "caption", "caption": "The right panel is where you configure the widget before saving the page.", "ms": 1200 }
]
```
