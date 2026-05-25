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
mp4UrlSv: /howto-videos/prod/sv/pages-pages-add-venue-travel-child.mp4
captionsUrlSv: /howto-videos/prod/sv/pages-pages-add-venue-travel-child.vtt
---

# Lägg till en undersida

Skapa en ny underordnad sida under den korrekta överordnade sidan.

1. Börja på skärmen Sidor. Det är här överordnade och underordnade sidor hanteras.
2. Bekräfta att raden för den överordnade sidan är synlig innan du använder dess radåtgärder.
3. Klicka på åtgärden för att lägga till underordnad sida på den överordnade raden. Det här är steget som gör den nya sidan till en undersida.
4. Det nya sidformuläret öppnas från den överordnade sidan, så den underordnade relationen överförs till sidan du är på väg att skapa.
5. Ange en tydlig titel för undersidan.
6. Kontrollera slugen eftersom den blir en del av URL-sökvägen under Venue and travel.
7. Klicka på Create Page för att skapa undersidan. Handledningsinspelningar använder demodata, så detta skapar inte verkligt produktionsinnehål.
8. Innan du publicerar kontrollerar du att sidans sökväg och navigeringsområde matchar den överordnade sida du valde.

```video-script
[
  {
    "caption": "Börja på skärmen Sidor. Det är här överordnade och underordnade sidor hanteras.",
    "action": {
      "type": "goto",
      "path": "/pages",
      "holdMs": 450
    }
  },
  {
    "caption": "Bekräfta att raden för den överordnade sidan är synlig innan du använder dess radåtgärder.",
    "action": {
      "type": "waitForText",
      "text": "Venue & travel",
      "holdMs": 350
    }
  },
  {
    "caption": "Klicka på åtgärden för att lägga till underordnad sida på den överordnade raden. Det här är steget som gör den nya sidan till en undersida.",
    "action": {
      "type": "click",
      "holdMs": 500,
      "pageTreeAddChildForText": "Venue & travel"
    }
  },
  {
    "caption": "Det nya sidformuläret öppnas från den överordnade sidan, så den underordnade relationen överförs till sidan du är på väg att skapa.",
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
    "caption": "Kontrollera slugen eftersom den blir en del av URL-sökvägen under Venue and travel.",
    "action": {
      "type": "fill",
      "placeholder": "e.g., news, about-us, contact",
      "value": "getting-around-town",
      "holdMs": 400
    }
  },
  {
    "caption": "Klicka på Create Page för att skapa undersidan. Handledningsinspelningar använder demodata, så detta skapar inte verkligt produktionsinnehål.",
    "action": {
      "type": "click",
      "text": "Create Page",
      "exact": true,
      "holdMs": 500,
      "mockOnly": true
    }
  },
  {
    "caption": "Innan du publicerar kontrollerar du att sidans sökväg och navigeringsområde matchar den överordnade sida du valde.",
    "action": {
      "type": "caption",
      "ms": 1200
    }
  }
]
```
