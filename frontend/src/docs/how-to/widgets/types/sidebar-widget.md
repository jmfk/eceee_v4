---
id: widget-sidebar-widget
title: Sidebar widget
summary: Build sidebar content with nested widgets.
order: 117
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Sidebar widget

Build sidebar content with nested widgets.

<!-- narration: Use the Sidebar widget as a container for related secondary content. -->
<!-- goal: In this walkthrough, we add the Sidebar widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the Sidebar widget and where to continue configuring it. -->

1. Add or edit a Sidebar widget.
2. Configure sidebar position and collapsible behavior if available.
3. Add child widgets to the sidebar slot.
4. Keep sidebar content secondary to the main page purpose.
5. Preview the sidebar on narrow screens.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the Sidebar widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-sidebarwidget']", "caption": "Choose Sidebar widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-sidebarwidget']", "caption": "Open the settings panel for the new Sidebar widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
