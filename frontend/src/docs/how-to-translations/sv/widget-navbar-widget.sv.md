---
id: widget-navbar-widget
uuid: ab5df26d-ab5d-426d-8b5d-ab5df26dab5d
title: Navbar widget
summary: Configure a navigation bar with primary and secondary menu items.
order: 110
language: sv
sourceLanguage: en
translationOf: english-origin
sectionId: widgets
sectionTitle: Widgets
sectionSummary: Add, edit, move, copy, hide, and remove widgets in page and object editors.
sectionOrder: 2
videoLanguage: sv
videoLanguages: sv
---

# Navbar widget

Configure a navigation bar with primary and secondary menu items.


```video-script
[
  {
    "caption": "",
    "action": {
      "type": "goto",
      "path": "/pages/1/edit/content",
      "holdMs": 450
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1)",
      "clickSelector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > button",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div > div > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2)",
      "clickSelector": "[data-testid=\"page-widget-edit-easy-widgets-navbarwidget\"]",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2) > div > div > div:nth-of-type(2)",
      "clickSelector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > button:nth-of-type(1)",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "html > body > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3) > div",
      "clickSelector": "html > body > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(3) > div > div:nth-of-type(2) > button:nth-of-type(1)",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "fill",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(6) > div > div:nth-of-type(2) > div > div > div:nth-of-type(1) > input",
      "value": "Test",
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "click",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(1) > div > div:nth-of-type(2)",
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2)",
      "clickSelector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > button:nth-of-type(2)",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > div > nav > div > ul:nth-of-type(1) > li:nth-of-type(6) > span",
      "clickSelector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > div > nav > div > ul:nth-of-type(1) > li:nth-of-type(6) > span > a",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  },
  {
    "caption": "",
    "action": {
      "type": "hoverClick",
      "selector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div > div:nth-of-type(2) > div > div > div > div > div",
      "clickSelector": "#root > div:nth-of-type(1) > div:nth-of-type(4) > div > div > div > div > div > div > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > div > div > div:nth-of-type(2) > div > div > nav > div > ul:nth-of-type(1) > li:nth-of-type(6) > span > div > button:nth-of-type(4)",
      "hoverHoldMs": 300,
      "holdMs": 500
    }
  }
]
```
