---
id: widget-news-list-widget
title: News list widget
summary: Display a list of articles from selected object types.
order: 113
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# News list widget

Display a list of articles from selected object types.

<!-- narration: Use the News List widget for article indexes and filtered news lists. -->
<!-- goal: In this walkthrough, we add the News list widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the News list widget and where to continue configuring it. -->

1. Add or edit a News List widget.
2. Select the object types or article sources to include.
3. Configure sorting, filtering, and item count.
4. Choose the display style that fits the slot.
5. Preview with enough real articles to check spacing and ordering.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the News list widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-newslistwidget']", "caption": "Choose News list widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-newslistwidget']", "caption": "Open the settings panel for the new News list widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
