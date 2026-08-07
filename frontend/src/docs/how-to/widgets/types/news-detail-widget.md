---
id: widget-news-detail-widget
title: News detail widget
summary: Display a single news article based on the URL path.
order: 112
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# News detail widget

Display a single news article based on the URL path.

<!-- narration: Use the News Detail widget on article detail pages that resolve content from the current path. -->
<!-- goal: In this walkthrough, we add the News detail widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the News detail widget and where to continue configuring it. -->

1. Add or edit a News Detail widget on a detail page layout.
2. Confirm the page path provides the expected article slug.
3. Choose the object type or article source if configurable.
4. Preview with a real article URL.
5. Check empty or missing article behavior before publishing.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the News detail widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-newsdetailwidget']", "caption": "Choose News detail widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-newsdetailwidget']", "caption": "Open the settings panel for the new News detail widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
