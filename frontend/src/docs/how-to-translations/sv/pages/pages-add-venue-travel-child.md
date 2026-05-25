---
id: pages-add-venue-travel-child
title: Lägg till en undersida
summary: Skapa en ny underordnad sida under den korrekta överordnade sidan.
order: 3
language: sv
sourceLanguage: en
translationOf: english-origin
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
videoLanguage: sv
videoLanguages: sv
mp4UrlSv: /howto-videos/editor-preview/sv/pages-pages-add-venue-travel-child.mp4
captionsUrlSv: /howto-videos/editor-preview/sv/pages-pages-add-venue-travel-child.vtt
---

# Lägg till en undersida

Skapa en ny underordnad sida under den korrekta överordnade sidan.

1. Gå till pages vyn.
2. Hitta sidan du vill skapa en under sida till.
3. Klicka på plus-ikonen på sidan rad.
4. Ett nytt sidformuläret öppnas där du kan fylla i infromation om den nya sidan
5. Ange en tydlig titel för undersidan.
6. Kontrollera slugen eftersom den blir en del av URL:en.
7. Välj en layout för undersidan innan du skapar den.
8. Klicka på Create Page för att skapa undersidan.
9. Innan du publicerar kontrollerar du att sidans sökväg och navigeringsområde matchar den förälder sida du valde.

```video-script
[
  {
    "caption": "Gå till pages vyn.",
    "action": {
      "type": "goto",
      "path": "/pages",
      "holdMs": 450
    }
  },
  {
    "caption": "Hitta sidan du vill skapa en under sida till.",
    "action": {
      "type": "waitForText",
      "text": "Venue & travel",
      "holdMs": 350
    }
  },
  {
    "caption": "Klicka på plus-ikonen på sidan rad.",
    "action": {
      "type": "click",
      "holdMs": 500,
      "pageTreeAddChildForText": "Venue & travel"
    }
  },
  {
    "caption": "Ett nytt sidformuläret öppnas där du kan fylla i infromation om den nya sidan",
    "action": {
      "type": "waitForText",
      "text": "Create New Page",
      "holdMs": 400
    }
  },
  {
    "caption": "Ange en tydlig titel för undersidan.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., News, About Us, Contact",
      "value": "Getting around town",
      "holdMs": 400
    }
  },
  {
    "caption": "Kontrollera slugen eftersom den blir en del av URL:en.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., news, about-us, contact",
      "value": "getting-around-town",
      "holdMs": 400
    }
  },
  {
    "caption": "Välj en layout för undersidan innan du skapar den.",
    "action": {
      "type": "select",
      "label": "Layout (optional)",
      "value": "main_layout",
      "holdMs": 500
    }
  },
  {
    "caption": "Klicka på Create Page för att skapa undersidan.",
    "action": {
      "type": "click",
      "text": "Create Page",
      "exact": true,
      "holdMs": 500,
      "mockOnly": true
    }
  },
  {
    "caption": "Innan du publicerar kontrollerar du att sidans sökväg och navigeringsområde matchar den förälder sida du valde.",
    "action": {
      "type": "caption",
      "ms": 1200
    }
  }
]
```
