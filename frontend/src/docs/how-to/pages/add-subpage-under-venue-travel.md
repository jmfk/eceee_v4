---
id: pages-add-venue-travel-child
title: Add a subpage
summary: Create a new child page below the correct parent page.
order: 3
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
---

# Add a subpage

Create a new child page below the correct parent page.

1. Start on the Pages screen. This is where parent and child pages are managed.
2. Confirm that the parent page row is visible before you use its row actions.
3. Click the add child page action on that parent row. This is the step that makes the new page a subpage.
4. The new page form opens from that parent, so the child relationship is carried into the page you are about to create.
5. Enter a clear title for the subpage.
6. Check the slug because it becomes part of the URL path below Venue and travel.
7. Click Create Page to create the subpage. Tutorial recordings use demo data, so this does not create real production content.
8. Before publishing, check that the page path and navigation area match the parent you selected.

```video-script
[
  {
    "caption": "Start on the Pages screen. This is where parent and child pages are managed.",
    "action": {
      "type": "goto",
      "path": "/pages",
      "holdMs": 450
    }
  },
  {
    "caption": "Confirm that the parent page row is visible before you use its row actions.",
    "action": {
      "type": "waitForText",
      "text": "Venue & travel",
      "holdMs": 350
    }
  },
  {
    "caption": "Click the add child page action on that parent row. This is the step that makes the new page a subpage.",
    "action": {
      "type": "click",
      "holdMs": 500,
      "pageTreeAddChildForText": "Venue & travel"
    }
  },
  {
    "caption": "The new page form opens from that parent, so the child relationship is carried into the page you are about to create.",
    "action": {
      "type": "waitForText",
      "text": "Create New Page",
      "holdMs": 400
    }
  },
  {
    "caption": "Enter a clear title for the subpage.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., News, About Us, Contact",
      "value": "Getting around town",
      "holdMs": 400
    }
  },
  {
    "caption": "Check the slug because it becomes part of the URL path below Venue and travel.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., news, about-us, contact",
      "value": "getting-around-town",
      "holdMs": 400
    }
  },
  {
    "caption": "Click Create Page to create the subpage. Tutorial recordings use demo data, so this does not create real production content.",
    "action": {
      "type": "click",
      "text": "Create Page",
      "exact": true,
      "holdMs": 500,
      "mockOnly": true
    }
  },
  {
    "caption": "Before publishing, check that the page path and navigation area match the parent you selected.",
    "action": {
      "type": "caption",
      "ms": 1200
    }
  }
]
```
