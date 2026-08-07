---
id: pages-organize
title: Organize the page tree
summary: Move, copy, import, export, and clean up pages.
order: 2
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
---

# Organize the page tree

Move, copy, import, export, and clean up pages.

<!-- narration: Use the tree controls and bulk actions to move, copy, duplicate, publish, unpublish, import, export, or clean up pages. -->

1. Use the page tree controls to expand the area you want to work in.
2. Select one or more pages when you need bulk actions.
3. Use cut, copy, duplicate, publish, unpublish, or delete from the available actions.
4. Refresh the tree after large imports or exports if the latest structure is not visible.

```video
[
  {
    "type": "goto",
    "path": "/pages",
    "caption": "Start on the page tree. Expand and search before moving or editing pages.",
    "holdMs": 450
  },
  {
    "type": "fill",
    "placeholder": "Search pages...",
    "value": "Venue and travel",
    "caption": "Use search to narrow the tree when the site has many pages.",
    "holdMs": 500
  },
  {
    "type": "waitForText",
    "text": "Venue and travel",
    "caption": "The matching page row is now visible, so you can use its row actions without relying on a specific root page name.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='refresh-button']",
    "caption": "Refresh the tree after imports, publishes, or work by another editor.",
    "holdMs": 500
  }
]
```
