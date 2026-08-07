---
id: pages-create
title: Skapa en sida
summary: Starta en ny sida och placera den i sidträdet.
order: 1
language: sv
sectionId: pages
sectionTitle: Sidor
sectionSummary: Skapa, organisera, redigera och publicera sidor i sidträdet.
sectionOrder: 1
videoLanguage: sv
videoLanguages: sv
sourceLanguage: en
translationOf: english-origin
---
# Skapa en sida

Starta en ny sida och placera den i sidträdet.

1. Öppna Sidor från huvudnavigeringen.
2. Välj åtgärden för att lägga till en vanlig sida, eller skapa en rotsida när du startar ett nytt sidträd.
3. Fyll i sidtitel, slug, layout och innehållsdetaljer.
4. Spara sidan som utkast och publicera den först när den är klar.

```video-script
[
  {
    "caption": "Öppna Sidor från huvudnavigeringen.",
    "action": {
      "type": "goto",
      "path": "/pages",
      "holdMs": 2200
    }
  },
  {
    "caption": "Klicka på knappen för att lägga till rotöversida för att starta ett nytt sidträd.",
    "action": {
      "type": "click",
      "selector": "[data-testid='add-root-page-button']",
      "holdMs": 900
    }
  },
  {
    "caption": "Formuläret för rotöversida ber om nyckelfelten innan något sparas.",
    "action": {
      "type": "waitForText",
      "text": "Create Root Page",
      "holdMs": 900
    }
  },
  {
    "caption": "Skriv en tydlig sidtitel. Titeln hjälper redigerare att känna igen det nya sidträdet.",
    "action": {
      "type": "fill",
      "selector": "#root-page-title",
      "value": "Demo Help Site",
      "holdMs": 800
    }
  },
  {
    "caption": "Ange värdnamnet där rotöversidan ska svara.",
    "action": {
      "type": "fill",
      "selector": "#root-page-hostnames",
      "value": "demo.example.org",
      "holdMs": 800
    }
  },
  {
    "caption": "Håll sidan opublicerad medan du fortfarande förbereder innehållet.",
    "action": {
      "type": "select",
      "selector": "#root-publication-status",
      "value": "unpublished",
      "holdMs": 900
    }
  },
  {
    "caption": "För denna genomgång avbryter vi istället för att skapa demoinnehåll på servern.",
    "action": {
      "type": "click",
      "text": "Cancel",
      "exact": true,
      "holdMs": 1200
    }
  },
  {
    "caption": "Använd sökning för att hitta befintliga sidor innan du redigerar eller lägger till mer innehåll.",
    "action": {
      "type": "fill",
      "placeholder": "Search pages...",
      "value": "ECEEE Example Site",
      "holdMs": 1200
    }
  },
  {
    "caption": "Uppdatera sidträdet efter ändringar eller när du samarbetar med andra redigerare.",
    "action": {
      "type": "click",
      "selector": "[data-testid='refresh-button']",
      "holdMs": 1600
    }
  }
]
```
