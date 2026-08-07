---
id: widgets-navigation-papers-authors
title: Change Papers to For authors in navigation
summary: Rename a navigation tab and point it to the correct page.
order: 4
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Change Papers to For authors in navigation

Rename a navigation tab and point it to the correct page.

<!-- narration: Open the page editor that owns the navigation widget, edit the menu item labeled Papers, change the label to For authors, and make sure the link still points to the intended content page. -->
<!-- goal: In this walkthrough, we change the visible navigation label from Papers to For authors. -->
<!-- why: This matters because navigation labels are edited in the widget configuration, not directly on the public website. The label and the linked page are separate things. -->
<!-- outcome: After this walkthrough, you should know where to open the navigation widget, which menu item to edit, and what to check before saving. -->

1. Open the page editor for the page that contains the navigation widget.
2. Go to All Slots if you need to see every editable slot.
3. Find the Navbar or Navigation widget that renders the public menu.
4. Open the widget settings.
5. Find the menu item currently labeled `Papers`.
6. Change the menu item label to `For authors`.
7. Confirm that the link still points to the correct page, for example the content page at `/pages/71/edit/content`.
8. Save the widget/page and preview the public page.

```video
[
  {
    "type": "goto",
    "path": "/pages/71/edit/slots",
    "caption": "Open the page editor for the page that contains the navigation used on the site.",
    "holdMs": 1800
  },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-navigation']", "caption": "Expand the Navigation slot to reveal the navigation widget row." },
  { "type": "waitForText", "text": "Navigation widget", "caption": "Find the Navigation widget that controls the public menu." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-navigationwidget']", "caption": "Click the settings icon on the Navigation widget row." },
  { "type": "fill", "placeholder": "Enter menu label...", "value": "For authors", "caption": "Change the visible menu label from Papers to For authors." },
  { "type": "fill", "placeholder": "Enter link URL...", "value": "/pages/71/edit/content", "caption": "Check that the link still points to the intended author information page." }
]
```
