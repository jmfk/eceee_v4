---
id: widget-section-widget
title: Section widget
summary: Create a collapsible or anchored section with child content.
order: 115
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Section widget

Create a collapsible or anchored section with child content.

<!-- narration: Use the Section widget to group child widgets under a named page section. -->
<!-- goal: In this walkthrough, we add the Section widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the Section widget and where to continue configuring it. -->

1. Add or edit a Section widget.
2. Set the section title and optional anchor.
3. Configure collapsible behavior if the content should expand and collapse.
4. Add child widgets to the section slot.
5. Preview anchor links and collapsed states before publishing.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the Section widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-sectionwidget']", "caption": "Choose Section widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-sectionwidget']", "caption": "Open the settings panel for the new Section widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
