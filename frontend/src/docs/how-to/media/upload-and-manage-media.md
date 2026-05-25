---
id: media-upload
title: Upload and manage media
summary: Add media files to the selected namespace and keep the library tidy.
order: 1
sectionId: media
sectionTitle: Media
sectionSummary: Upload, approve, organize, and reuse media files.
sectionOrder: 4
---

# Upload and manage media

Add media files to the selected namespace and keep the library tidy.

<!-- narration: Pick the right namespace, upload or review files, and maintain metadata so editors can reuse media safely. -->

1. Open Media from the main navigation.
2. Select the namespace you want to manage.
3. Upload files or review pending files depending on the workflow.
4. Edit metadata, tags, approval state, and references as needed.

```video
[
  {
    "type": "goto",
    "path": "/media",
    "caption": "Start on the Media Manager. Choose the namespace you are working in before you upload or organize files.",
    "holdMs": 450
  },
  {
    "type": "fill",
    "placeholder": "Search media files...",
    "value": "logo",
    "caption": "Use search to find an existing file before uploading a duplicate.",
    "holdMs": 500
  },
  {
    "type": "click",
    "selector": "[data-testid='media-tab-collections']",
    "caption": "Open Collections when files should be grouped for reuse.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='media-tab-tags']",
    "caption": "Open Tags when you need to clean up or review media tags.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='media-tab-pending']",
    "caption": "Open Pending Files to approve or reject files that were uploaded for review.",
    "holdMs": 500
  }
]
```
