---
id: taggar-gemensam-taggstruktur
helpGuideId: tags-manage
title: "Taggar: den gemensamma taggstrukturen"
summary: "Sök, granska och filtrera godkända taggar."
sectionId: tags
sectionTitle: Tags
language: sv
sourceLanguage: sv
---

# Taggar: den gemensamma taggstrukturen

**Miljö:** Lokalt CMS med `--mock-api`. Demot visar godkända termer och typen Topics. Inga produktionsdata används.

**Mål:** Hitta en term, kontrollera dess plats och se hur typfiltret fungerar.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna Tags för att se den gemensamma taggstrukturen i vår lokala demo.

### 2. assertVisible

**Berättarröst och undertext:** Här finns sökfältet och de godkända termerna.

### 3. click

**Berättarröst och undertext:** Öppna termen Conference och läs dess detaljer.

### 4. click

**Berättarröst och undertext:** Växla till Details för att läsa termens godkända information.

### 5. assertVisible

**Berättarröst och undertext:** Location visar termens plats i hierarkin. Kontrollera också typ och beskrivning innan du använder termen.

### 6. click

**Berättarröst och undertext:** Öppna typfiltret för att avgränsa listan.

### 7. assertVisible

**Berättarröst och undertext:** I filtret kan du välja en taggtyp. Här använder demot typen Topics.

### 8. click

**Berättarröst och undertext:** Fliken Types visar vilka taggtyper som finns. Välj alltid rätt typ innan du klassificerar innehåll.

```video-script
[
  {
    "type": "goto",
    "path": "/tags",
    "captionSv": "Öppna Tags för att se den gemensamma taggstrukturen i vår lokala demo.",
    "postNarrationPauseMs": 1500,
    "scene": 1,
    "captureStatus": "ready"
  },
  {
    "type": "assertVisible",
    "role": "searchbox",
    "name": "Search tags",
    "captionSv": "Här finns sökfältet och de godkända termerna.",
    "postNarrationPauseMs": 1200,
    "scene": 2,
    "captureStatus": "ready"
  },
  {
    "type": "click",
    "role": "button",
    "name": "Conference",
    "captionSv": "Öppna termen Conference och läs dess detaljer.",
    "actionAtFraction": 0.7,
    "postNarrationPauseMs": 1500,
    "scene": 3,
    "captureStatus": "ready"
  },
  {
    "type": "click",
    "role": "button",
    "name": "Details",
    "captionSv": "Växla till Details för att läsa termens godkända information.",
    "actionAtFraction": 0.7,
    "postNarrationPauseMs": 1200,
    "captureStatus": "ready",
    "scene": 4
  },
  {
    "type": "assertVisible",
    "text": "Location",
    "captionSv": "Location visar termens plats i hierarkin. Kontrollera också typ och beskrivning innan du använder termen.",
    "postNarrationPauseMs": 1500,
    "scene": 5,
    "captureStatus": "ready"
  },
  {
    "type": "click",
    "role": "button",
    "name": "Add filter",
    "captionSv": "Öppna typfiltret för att avgränsa listan.",
    "actionAtFraction": 0.7,
    "postNarrationPauseMs": 1200,
    "scene": 6,
    "captureStatus": "ready"
  },
  {
    "type": "assertVisible",
    "role": "dialog",
    "name": "Add tag filter",
    "captionSv": "I filtret kan du välja en taggtyp. Här använder demot typen Topics.",
    "postNarrationPauseMs": 1500,
    "scene": 7,
    "captureStatus": "ready"
  },
  {
    "type": "click",
    "role": "button",
    "name": "Types",
    "captionSv": "Fliken Types visar vilka taggtyper som finns. Välj alltid rätt typ innan du klassificerar innehåll.",
    "actionAtFraction": 0.7,
    "postNarrationPauseMs": 1500,
    "scene": 8,
    "captureStatus": "ready"
  }
]
```
