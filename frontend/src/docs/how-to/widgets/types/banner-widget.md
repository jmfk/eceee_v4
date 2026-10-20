---
id: widget-banner-widget
title: Banner widget
summary: Configure a banner with text and image layout.
order: 100
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Banner widget

Configure a banner with text and image layout.

<!-- narration: Use the Banner widget for a focused visual band with text and optional image treatment. -->
<!-- goal: In this walkthrough, we add the Banner widget to a page slot and open its settings. -->
<!-- why: This matters because each widget type has its own purpose, and choosing the right widget keeps the page easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where to add the Banner widget and where to continue configuring it. -->

1. Add or edit a Banner widget in the target slot.
2. Choose Text Mode or Header Mode and edit the text directly in the banner. If a component style replaces the inline editor, edit the active text field in the settings panel instead.
3. Hover over the banner or focus it with the keyboard to show its overlay toolbar. On touch devices, the controls stay visible. Select an image even when none is selected yet. Text Mode provides Image and an Image size button that switches between Square and Rectangle. Header Mode provides Background image instead. These settings are also in the main form. Only the active mode's image is displayed; switching modes preserves both image selections.
4. Save and preview the page at desktop and mobile widths.
5. Keep the banner focused on one message or action.

```video
[
  { "type": "goto", "path": "/pages/101/edit/slots", "caption": "Start in All Slots on a page editor so you can add the Banner widget in context." },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-content']", "caption": "Expand the Main Content slot so its widget controls are visible." },
  { "type": "click", "selector": "[data-testid='page-slot-add-content']", "caption": "Click the plus icon on the Main Content slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-bannerwidget']", "caption": "Choose Banner widget from the widget picker." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-bannerwidget']", "caption": "Open the settings panel for the new Banner widget." },
  { "type": "caption", "caption": "Configure the fields, then save and preview the page before publishing.", "ms": 1200 }
]
```
