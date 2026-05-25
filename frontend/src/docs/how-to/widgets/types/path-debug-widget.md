---
id: widget-path-debug-widget
title: Path debug widget
summary: Inspect path-related rendering context during setup or debugging.
order: 114
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Path debug widget

Inspect path-related rendering context during setup or debugging.

<!-- narration: Use the Path Debug widget only while diagnosing routing or path-dependent content. -->
<!-- goal: In this walkthrough, we add the Path debug widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the Path debug widget and where to continue configuring it. -->

1. Add the Path Debug widget only in a safe testing context.
2. Open the page preview where routing data needs inspection.
3. Review the displayed path and context values.
4. Remove or deactivate the widget after debugging.
5. Do not publish debug output on public pages.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the Path debug widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-pathdebugwidget']", "caption": "Choose Path debug widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-pathdebugwidget']", "caption": "Open the settings panel for the new Path debug widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
