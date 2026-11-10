---
id: publisher-arbeta-med-objekt
helpGuideId: objects-manage
title: "Publisher: arbeta med objekt"
summary: "Hitta ett objekt, öppna det och spara en lokal arbetskopia."
sectionId: publisher
sectionTitle: Publisher
language: sv
sourceLanguage: sv
---

# Publisher: arbeta med objekt

**Miljö:** Lokalt CMS med `--mock-api`. News och Opening keynote är isolerade demodata.

**Mål:** Hitta rätt objekttyp, sök fram ett befintligt objekt, ändra titeln och spara arbetskopian.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna Publisher. I den lokala demon finns objekttyperna News och Speaker.

### 2. assertVisible

**Berättarröst och undertext:** Välj först rätt objekttyp. Här använder vi News.

### 3. click

**Berättarröst och undertext:** Klicka på News för att se objekten av den typen.

### 4. assertVisible

**Berättarröst och undertext:** Sök innan du skapar något nytt, så undviker du dubbletter.

### 5. fill

**Berättarröst och undertext:** Skriv Opening keynote i sökfältet. Detta är ett lokalt demoobjekt.

### 6. assertVisible

**Berättarröst och undertext:** Träffen visar att objektet redan finns. Öppna det befintliga objektet när du vill granska eller ändra innehållet.

### 7. click

**Berättarröst och undertext:** Öppna det befintliga objektet i redigeraren.

### 8. assertVisible

**Berättarröst och undertext:** Objektets titel och innehåll kan nu granskas i arbetsytan.

### 9. fill

**Berättarröst och undertext:** Ändra titeln i den lokala arbetskopian.

### 10. click

**Berättarröst och undertext:** Välj Save för att spara arbetskopian innan du lämnar objektet.

### 11. assertVisible

**Berättarröst och undertext:** Bekräftelsen visar att den lokala arbetskopian är sparad. Publicering görs separat.

```video-script
[
  {
    "type": "goto",
    "path": "/objects",
    "captionSv": "Öppna Publisher. I den lokala demon finns objekttyperna News och Speaker.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "selector": "[data-testid='object-type-card-news']",
    "captionSv": "Välj först rätt objekttyp. Här använder vi News.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "selector": "[data-testid='object-type-card-news']",
    "captionSv": "Klicka på News för att se objekten av den typen.",
    "scene": 3,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "captionSv": "Sök innan du skapar något nytt, så undviker du dubbletter.",
    "scene": 4,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "role": "searchbox",
    "name": "Search News"
  },
  {
    "type": "fill",
    "value": "Opening keynote",
    "captionSv": "Skriv Opening keynote i sökfältet. Detta är ett lokalt demoobjekt.",
    "scene": 5,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "role": "searchbox",
    "name": "Search News"
  },
  {
    "type": "assertVisible",
    "text": "Opening keynote",
    "captionSv": "Träffen visar att objektet redan finns. Öppna det befintliga objektet när du vill granska eller ändra innehållet.",
    "scene": 6,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "text": "Opening keynote",
    "captionSv": "Öppna det befintliga objektet i redigeraren.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 7
  },
  {
    "type": "assertVisible",
    "role": "textbox",
    "name": "Object title",
    "captionSv": "Objektets titel och innehåll kan nu granskas i arbetsytan.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 8
  },
  {
    "type": "fill",
    "role": "textbox",
    "name": "Object title",
    "value": "Opening keynote — demo",
    "captionSv": "Ändra titeln i den lokala arbetskopian.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 9
  },
  {
    "type": "click",
    "role": "button",
    "name": "Save",
    "captionSv": "Välj Save för att spara arbetskopian innan du lämnar objektet.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 10
  },
  {
    "type": "assertVisible",
    "text": "Working copy saved",
    "captionSv": "Bekräftelsen visar att den lokala arbetskopian är sparad. Publicering görs separat.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 11
  }
]
```
