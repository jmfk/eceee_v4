---
id: tags-manage
title: Manage content tags
summary: Create and maintain the tag vocabulary used across the CMS.
order: 1
sectionId: tags
sectionTitle: Tags
sectionSummary: Manage tags used to organize pages, objects, and media.
sectionOrder: 5
---

# Manage content tags

Create and maintain the tag vocabulary used across the CMS.

<!-- narration: Search before creating a tag, keep names consistent, and use tags to help editors find related content. -->

1. Open Tags from the main navigation.
2. Search for an existing tag before creating a new one.
3. Create or edit the tag name and related metadata.
4. Use consistent naming so editors can find tags quickly.

```video
[
  {
    "type": "goto",
    "path": "/tags",
    "caption": "Start in Tags when you need to organize pages, objects, or media by shared labels.",
    "holdMs": 450
  },
  {
    "type": "fill",
    "selector": "[data-testid='tags-search-input']",
    "value": "venue",
    "caption": "Search first so you do not create duplicate tags.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='tags-create-button']",
    "caption": "Click Create Tag when the tag does not already exist.",
    "holdMs": 500
  },
  {
    "type": "fill",
    "placeholder": "Enter tag name",
    "value": "venue",
    "caption": "Enter the tag name that editors will recognize.",
    "holdMs": 500
  },
  {
    "type": "click",
    "text": "Create Tag",
    "exact": true,
    "mockOnly": true,
    "caption": "Save the tag in tutorial recordings. On real content, confirm naming rules before saving.",
    "holdMs": 500
  }
]
```
