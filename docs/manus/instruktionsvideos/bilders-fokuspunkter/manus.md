---
id: bilders-fokuspunkter
helpGuideId: media-upload
title: "Bilder: välja fokuspunkt och förstå beskärningen"
summary: "Sätt fokus på motivet och granska tre beskärningar med lokal demodata."
sectionId: media
sectionTitle: Media
order: 1
language: sv
sourceLanguage: sv
---

# Bilder: välja fokuspunkt och förstå beskärningen

**Miljö:** Lokalt CMS med `--mock-api`. Bilden är en lokal illustration. Fokus sparas bara i inspelningens minne.

**Mål:** Visa hur en bilds fokuspunkt sätts, hur förhandsvisningarna ändras och hur den sparade punkten kontrolleras.

**Om banner:** Bilddialogens beskärningar fungerar i demon. Banner-widgetens renderare använder ännu inte sparad fokusmetadata. En separat film om bannerlayouter kräver att den kopplingen finns och verifieras i faktisk sidförhandsvisning.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna mediabiblioteket. Demobilden har sitt motiv till höger, så en centrerad beskärning kan missa det.

### 2. assertVisible

**Berättarröst och undertext:** Välj Demo portrait, en lokal övningsbild som kan ändras utan att påverka publicerat material.

### 3. click

**Berättarröst och undertext:** Öppna bildens redigering för att komma åt fokuspunkten.

### 4. click

**Berättarröst och undertext:** Välj Choose focus point. Punkten börjar i bildens mitt.

### 5. assertVisible

**Berättarröst och undertext:** Till höger visas liggande, stående och kvadratiska beskärningar av samma bild.

### 6. click

**Berättarröst och undertext:** Klicka på motivet till höger. Den blå markeringen flyttas dit och beskärningarna räknas om direkt.

### 7. assertVisible

**Berättarröst och undertext:** Jämför Landscape, Portrait och Square. Samma fokuspunkt ger olika utsnitt beroende på bildrutans form.

### 8. click

**Berättarröst och undertext:** Välj Save focus för att spara koordinaterna på bilden.

### 9. pause

**Berättarröst och undertext:** Ändringen är sparad i den lokala bilden. Vi öppnar inställningen igen för att kontrollera den.

### 10. click

**Berättarröst och undertext:** Öppna dialogen igen. Den sparade punkten ligger kvar på motivet.

```video-script
[
  {
    "scene": 1,
    "captureStatus": "ready",
    "type": "goto",
    "path": "/media",
    "captionSv": "Öppna mediabiblioteket. Demobilden har sitt motiv till höger, så en centrerad beskärning kan missa det.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 2,
    "captureStatus": "ready",
    "type": "assertVisible",
    "text": "Demo portrait",
    "captionSv": "Välj Demo portrait, en lokal övningsbild som kan ändras utan att påverka publicerat material.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 3,
    "captureStatus": "ready",
    "type": "click",
    "selector": "button[title='Edit file']",
    "captionSv": "Öppna bildens redigering för att komma åt fokuspunkten.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 4,
    "captureStatus": "ready",
    "type": "click",
    "role": "button",
    "name": "Choose focus point",
    "captionSv": "Välj Choose focus point. Punkten börjar i bildens mitt.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 5,
    "captureStatus": "ready",
    "type": "assertVisible",
    "text": "Live previews",
    "captionSv": "Till höger visas liggande, stående och kvadratiska beskärningar av samma bild.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 6,
    "captureStatus": "ready",
    "type": "click",
    "selector": "[aria-label^='Image focus at']",
    "positionFractionX": 0.75,
    "positionFractionY": 0.4,
    "captionSv": "Klicka på motivet till höger. Den blå markeringen flyttas dit och beskärningarna räknas om direkt.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 7,
    "captureStatus": "ready",
    "type": "assertVisible",
    "text": "Portrait",
    "captionSv": "Jämför Landscape, Portrait och Square. Samma fokuspunkt ger olika utsnitt beroende på bildrutans form.",
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 8,
    "captureStatus": "ready",
    "type": "click",
    "role": "button",
    "name": "Save focus",
    "captionSv": "Välj Save focus för att spara koordinaterna på bilden.",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "pause",
    "ms": 1000,
    "captionSv": "Ändringen är sparad i den lokala bilden. Vi öppnar inställningen igen för att kontrollera den.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 9
  },
  {
    "scene": 10,
    "captureStatus": "ready",
    "type": "click",
    "role": "button",
    "name": "Choose focus point",
    "captionSv": "Öppna dialogen igen. Den sparade punkten ligger kvar på motivet.",
    "postNarrationPauseMs": 1500
  }
]
```
