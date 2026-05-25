---
id: pages-create
title: Create a page
summary: Start a new page and place it in the page tree.
order: 1
language: sv
sectionId: pages
sectionTitle: Pages
sectionSummary: Create, organize, edit, and publish pages in the site tree.
sectionOrder: 1
videoLanguage: sv
videoLanguages: sv
sourceLanguage: en
translationOf: english-origin
---
# Create a page

Start a new page and place it in the page tree.

1. Open the Pages workspace and wait for the page tree to load.
2. Click the add root page button to start a new site tree.
3. The root page form asks for the key fields before anything is saved.
4. Type a clear page title. The title helps editors recognize the new site tree.
5. Enter the hostname where the root page should answer.
6. Keep the page unpublished while you are still preparing content.
7. For this walkthrough we cancel instead of creating demo content on the server.
8. Use search to find existing pages before editing or adding more content.
9. Refresh the page tree after changes or when collaborating with other editors.

```video-script
[
  {
    "caption": "Öppna Pages-arbetsytan och vänta tills sidträdet läses in.",
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
    "caption": "Håll sidan opublicerad medan du fortfarande förbereder innehål.",
    "action": {
      "type": "select",
      "selector": "#root-publication-status",
      "value": "unpublished",
      "holdMs": 900
    }
  },
  {
    "caption": "För denna genomgång avbryter vi istället för att skapa demoinnehål på servern.",
    "action": {
      "type": "click",
      "text": "Cancel",
      "exact": true,
      "holdMs": 1200
    }
  },
  {
    "caption": "Använd sökning för att hitta befintliga sidor innan du redigerar eller lägger till mer innehål.",
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
