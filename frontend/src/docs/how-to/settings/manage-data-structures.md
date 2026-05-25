---
id: settings-data
title: Manage data structures
summary: Configure object types, value lists, widgets, and data connections.
order: 3
sectionId: settings
sectionTitle: Settings
sectionSummary: Configure layouts, themes, widgets, data structures, publishing, and system behavior.
sectionOrder: 6
---

# Manage data structures

Configure object types, value lists, widgets, and data connections.

<!-- narration: Data structures include object types, value lists, widgets, and data connections. Change them carefully because editors depend on them. -->

1. Open the relevant Settings section for the structure you need.
2. Review existing configuration before adding a new type or value.
3. Validate names, labels, fields, and relationships before saving.
4. Test the updated structure in the editor that consumes it.

```video
[
  {
    "type": "goto",
    "path": "/settings/object-types",
    "caption": "Start in Object Types when you need to manage reusable structured content.",
    "holdMs": 450
  },
  {
    "type": "fill",
    "selector": "[data-testid='object-types-search-input']",
    "value": "speaker",
    "caption": "Search for an existing object type before adding a new structure.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='object-types-new-button']",
    "caption": "Click New Object Type when the structure does not already exist.",
    "holdMs": 500
  }
]
```
