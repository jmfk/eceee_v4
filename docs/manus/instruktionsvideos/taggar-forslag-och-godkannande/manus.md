---
id: taggar-forslag-och-godkannande
helpGuideId: tags-manage
title: "Taggar: lämna och granska ett förslag"
summary: "Lämna ett förslag och granska det med lokala demoroller."
sectionId: tags
sectionTitle: Tags
language: sv
sourceLanguage: sv
---

# Taggar: lämna och granska ett förslag

**Miljö:** Lokalt CMS med `--mock-api`. Förslagsställare, granskare och termen Energy transition finns bara i den lokala inspelningssessionen.

**Mål:** Sök först, skicka ett motiverat förslag och visa hur beslutet syns i Proposals. Detta är registrets förslagsflöde; AI-rekommendationer för media är ett separat hjälpmedel.

## Scener

### 1. goto

**Berättarröst och undertext:** Vi börjar i Tags med en lokal förslagsställare. Sök efter termen innan du föreslår en ny.

### 2. click

**Berättarröst och undertext:** Öppna New tag och välj typen Topics för en ny term.

### 3. fill

**Berättarröst och undertext:** Skriv ett tydligt namn på den föreslagna termen.

### 4. fill

**Berättarröst och undertext:** Beskriv termen så att granskaren förstår hur den ska användas.

### 5. click

**Berättarröst och undertext:** Välj Submit proposal. Förslaget sparas lokalt och väntar på granskning.

### 6. click

**Berättarröst och undertext:** Öppna Proposals för att följa förslagets status.

### 7. assertVisible

**Berättarröst och undertext:** Status pending visar att förslaget ännu inte är godkänt.

### 8. goto

**Berättarröst och undertext:** Nu byter vi till en lokal granskare med rätt att fatta beslut.

### 9. click

**Berättarröst och undertext:** Granskaren öppnar samma förslag och läser den föreslagna ändringen.

### 10. click

**Berättarröst och undertext:** Efter kontroll väljer granskaren Approve för det lokala demoförslaget.

### 11. assertVisible

**Berättarröst och undertext:** Status approved visar att beslutet är registrerat i demomiljön.

```video-script
[
  {
    "type": "goto",
    "path": "/tags?demoRole=proposer",
    "captionSv": "Vi börjar i Tags med en lokal förslagsställare. Sök efter termen innan du föreslår en ny.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "New tag",
    "captionSv": "Öppna New tag och välj typen Topics för en ny term.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "fill",
    "label": "Name",
    "value": "Energy transition",
    "captionSv": "Skriv ett tydligt namn på den föreslagna termen.",
    "scene": 3,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "fill",
    "label": "Description",
    "value": "A local tutorial example.",
    "captionSv": "Beskriv termen så att granskaren förstår hur den ska användas.",
    "scene": 4,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Submit proposal",
    "captionSv": "Välj Submit proposal. Förslaget sparas lokalt och väntar på granskning.",
    "scene": 5,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Proposals",
    "captionSv": "Öppna Proposals för att följa förslagets status.",
    "scene": 6,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "text": "Energy transition · create · pending",
    "captionSv": "Status pending visar att förslaget ännu inte är godkänt.",
    "scene": 7,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "goto",
    "path": "/tags?demoRole=reviewer",
    "captionSv": "Nu byter vi till en lokal granskare med rätt att fatta beslut.",
    "scene": 8,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Proposals",
    "captionSv": "Granskaren öppnar samma förslag och läser den föreslagna ändringen.",
    "scene": 9,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Approve",
    "captionSv": "Efter kontroll väljer granskaren Approve för det lokala demoförslaget.",
    "scene": 10,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "text": "Energy transition · create · approved",
    "captionSv": "Status approved visar att beslutet är registrerat i demomiljön.",
    "scene": 11,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  }
]
```
