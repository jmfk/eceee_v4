---
id: pages-create
title: Create a page
summary: Start a new page and place it in the page tree.
order: 1
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
---

# Create a page

Start a new page and place it in the page tree.

<!-- narration: Start in the Pages area, create a page, fill in its required details, then save it as a draft until it is ready to publish. -->
<!-- goal: In this walkthrough, we create a new page from the Pages workspace and look at the required fields before saving. -->
<!-- why: This is useful because almost every content task starts by finding the right place in the page tree and understanding whether the page should stay as a draft or be published. -->
<!-- outcome: After this walkthrough, you should know where to start a new page, which fields matter first, and why it is safer to keep new work unpublished until the content is ready. -->

1. Open Pages from the main navigation.
2. Choose the add page action for a normal page, or add a root page when starting a new site tree.
3. Enter the page title, slug, layout, and content details.
4. Save the page as a draft, then publish when it is ready.

```video
[
  {
    "type": "goto",
    "path": "/pages",
    "caption": "Open the Pages workspace and wait for the page tree to load.",
    "holdMs": 2200
  },
  {
    "type": "click",
    "selector": "[data-testid='add-root-page-button']",
    "caption": "Click the add root page button to start a new site tree.",
    "holdMs": 900
  },
  {
    "type": "waitForText",
    "text": "Create Root Page",
    "caption": "The root page form asks for the key fields before anything is saved.",
    "holdMs": 900
  },
  {
    "type": "fill",
    "selector": "#root-page-title",
    "value": "Demo Help Site",
    "caption": "Type a clear page title. The title helps editors recognize the new site tree.",
    "holdMs": 800
  },
  {
    "type": "fill",
    "selector": "#root-page-hostnames",
    "value": "demo.example.org",
    "caption": "Enter the hostname where the root page should answer.",
    "holdMs": 800
  },
  {
    "type": "select",
    "selector": "#root-publication-status",
    "value": "unpublished",
    "caption": "Keep the page unpublished while you are still preparing content.",
    "holdMs": 900
  },
  {
    "type": "click",
    "text": "Cancel",
    "exact": true,
    "caption": "For this walkthrough we cancel instead of creating demo content on the server.",
    "holdMs": 1200
  },
  {
    "type": "fill",
    "placeholder": "Search pages...",
    "value": "ECEEE Example Site",
    "caption": "Use search to find existing pages before editing or adding more content.",
    "holdMs": 1200
  },
  {
    "type": "click",
    "selector": "[data-testid='refresh-button']",
    "caption": "Refresh the page tree after changes or when collaborating with other editors.",
    "holdMs": 1600
  }
]
```
