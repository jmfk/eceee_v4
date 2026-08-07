---
id: objects-manage
title: Manage object content
summary: Choose an object type and create or edit its content items.
order: 1
sectionId: objects
sectionTitle: Objects
sectionSummary: Work with reusable structured content such as articles, people, events, or other object types.
sectionOrder: 3
---

# Manage object content

Choose an object type and create or edit its content items.

<!-- narration: Select an object type, create or edit an item, and check version and publishing status before making structured content live. -->

1. Open Objects from the main navigation.
2. Choose the object type you want to manage.
3. Use the create action to add a new item, or open an existing item to edit it.
4. Review publishing and version details before making object content live.

```video
[
  {
    "type": "goto",
    "path": "/objects",
    "caption": "Start on Objects. First choose the content type you want to work with.",
    "holdMs": 450
  },
  {
    "type": "click",
    "selector": "[data-testid='object-type-card-news']",
    "caption": "Click an object type card to open its list of reusable content items.",
    "holdMs": 500
  },
  {
    "type": "fill",
    "selector": "[data-testid='objects-search-input']",
    "value": "keynote",
    "caption": "Search inside the selected type when you need to find an existing object before creating a new one.",
    "holdMs": 500
  },
  {
    "type": "click",
    "selector": "[data-testid='objects-new-button']",
    "caption": "Use the New button when the item does not already exist.",
    "holdMs": 500
  }
]
```
