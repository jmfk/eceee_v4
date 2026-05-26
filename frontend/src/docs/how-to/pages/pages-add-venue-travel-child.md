---
id: pages-add-venue-travel-child
uuid: 27ef8969-27ef-4969-87ef-27ef896927ef
title: Add a child page
summary: Create a new child page under the correct parent page.
order: 3
language: en
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
videoLanguage: en
videoLanguages: en
mp4UrlEn: /howto-videos/prod/en/pages-pages-add-venue-travel-child.mp4
captionsUrlEn: /howto-videos/prod/en/pages-pages-add-venue-travel-child.vtt
---

# Add a child page

Create a new child page under the correct parent page.

1. Go to the pages view.
2. Find the page you want to create a child page under.
3. Click the plus icon on the page row.
4. A new page form opens where you can fill in information about the new page.
5. Enter a clear title for the child page.
6. Check the slug since it will become part of the URL.
7. Select a layout for the child page before creating it.
8. Click Create Page to create the child page.
9. Before publishing, verify that the page's path and navigation area match the parent page you selected.

```video-script
[
  {
    "caption": "Go to the pages view.",
    "action": {
      "type": "goto",
      "path": "/pages",
      "holdMs": 450
    }
  },
  {
    "caption": "Find the page you want to create a child page under.",
    "action": {
      "type": "waitForText",
      "text": "Venue & travel",
      "holdMs": 350
    }
  },
  {
    "caption": "Click the plus icon on the page row.",
    "action": {
      "type": "click",
      "holdMs": 500,
      "pageTreeAddChildForText": "Venue & travel"
    }
  },
  {
    "caption": "A new page form opens where you can fill in information about the new page.",
    "action": {
      "type": "waitForText",
      "text": "Create New Page",
      "holdMs": 400
    }
  },
  {
    "caption": "Enter a clear title for the child page.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., News, About Us, Contact",
      "value": "Getting around town",
      "holdMs": 400
    }
  },
  {
    "caption": "Check the slug since it will become part of the URL.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., news, about-us, contact",
      "value": "getting-around-town",
      "holdMs": 400
    }
  },
  {
    "caption": "Select a layout for the child page before creating it.",
    "action": {
      "type": "select",
      "label": "Layout (optional)",
      "value": "main_layout",
      "holdMs": 500
    }
  },
  {
    "caption": "Click Create Page to create the child page.",
    "action": {
      "type": "click",
      "text": "Create Page",
      "exact": true,
      "holdMs": 500,
      "mockOnly": true
    }
  },
  {
    "caption": "Before publishing, verify that the page's path and navigation area match the parent page you selected.",
    "action": {
      "type": "caption",
      "ms": 1200
    }
  }
]
```
