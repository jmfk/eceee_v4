---
id: widgets-sidebar-logos
title: Change logos in the sidebar
summary: Replace sidebar logos and use image sizes that fit the sidebar from the start.
order: 5
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
---

# Change logos in the sidebar

Replace sidebar logos and use image sizes that fit the sidebar from the start.

<!-- narration: Open the page editor, find the Sidebar widget, replace the logo images in the sidebar content or child image widgets, then preview at desktop and mobile widths. -->
<!-- goal: In this walkthrough, we replace logos used in a sidebar and check that they fit before saving. -->
<!-- why: This matters because oversized logos make sidebars look uneven and force editors to fix layout problems after upload. Preparing the right dimensions first makes the sidebar much easier to maintain. -->
<!-- outcome: After this walkthrough, you should know where sidebar logos are edited, what size to prepare, and how to preview the result. -->

1. Open the page editor for the page that contains the sidebar.
2. Find the Sidebar widget, or the child Image/Content widgets inside the sidebar slot.
3. Open the widget settings for the logo you want to replace.
4. Choose the replacement image from Media, or upload it first if it is not in the media library.
5. Use consistent logo files before uploading: transparent PNG or SVG when possible.
6. For a normal sidebar logo, prepare the image around `240 px` wide. Keep the visible logo height around `80-120 px` unless the design intentionally needs more.
7. For retina/sharp display, upload a source around `480 px` wide and let the widget/display style show it at roughly `240 px`.
8. Save and preview the page at desktop and mobile widths.

```video
[
  {
    "type": "goto",
    "path": "/pages/101/edit/slots",
    "caption": "Open a page editor that contains the Sidebar widget and its logo content.",
    "holdMs": 1800
  },
  { "type": "click", "selector": "[data-testid='page-slot-toggle-sidebar']", "caption": "Expand the Sidebar slot to reveal the logo-related widget rows." },
  { "type": "click", "selector": "[data-testid='page-slot-add-sidebar']", "caption": "Use the plus icon on Sidebar to add or replace a logo/image widget in the correct slot." },
  { "type": "click", "selector": "[data-testid='page-widget-option-easy-widgets-imagewidget']", "caption": "Choose Image widget for a logo file. Prepare logos around 480 px wide so they display sharply at about 240 px." },
  { "type": "click", "selector": "[data-testid='page-widget-edit-easy-widgets-imagewidget']", "caption": "Click the settings icon on the Image widget row." },
  { "type": "fill", "placeholder": "Enter widget title...", "value": "Partner logos", "caption": "Use the widget settings to name and replace the sidebar logo content before saving." }
]
```
