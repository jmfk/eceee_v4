---
id: designer-marginaler-och-padding
helpGuideId: settings-themes
title: "Designer: marginaler och padding"
summary: "Undersök och ändra ett avstånd i ett lokalt demotema."
sectionId: designer
sectionTitle: Designer
language: sv
sourceLanguage: sv
---

# Designer: marginaler och padding

**Miljö:** Lokalt CMS med `--mock-api`. Alla ändringar stannar i demotemats minne.

**Mål:** Skilj yttre marginal från inre padding, välj rätt element och ändra ett värde åt gången.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna det lokala demotemat och välj en textyta i förhandsvisningen.

### 2. assertVisible

**Berättarröst och undertext:** Förhandsvisningen visar hur temat ser ut innan du ändrar ett avstånd.

### 3. click

**Berättarröst och undertext:** Dölj inspektören tillfälligt så att förhandsvisningen får mer plats.

### 4. click

**Berättarröst och undertext:** Klicka i förhandsvisningen för att markera innehållswidgeten.

### 5. click

**Berättarröst och undertext:** Öppna inspektören igen för att se inställningarna för den valda textytan.

### 6. click

**Berättarröst och undertext:** Välj Heading 1 i elementlistan så att inspektören visar rubrikens egna avstånd.

### 7. assertVisible

**Berättarröst och undertext:** Margin bottom är yttre avstånd under textytan. Padding är inre avstånd mellan innehåll och kant.

### 8. fill

**Berättarröst och undertext:** Ändra ett värde i taget och jämför förhandsvisningen. Här ökar vi textytans nedre marginal till 20 pixlar.

### 9. assertVisible

**Berättarröst och undertext:** Rubrikens padding är ett inre avstånd. Ändra det separat från den yttre marginalen.

### 10. fill

**Berättarröst och undertext:** Öka rubrikens övre padding till tolv pixlar och jämför utrymmet innanför kanten.

### 11. click

**Berättarröst och undertext:** Spara ändringen i demotemats utkast. Publicering är ett separat beslut.

```video-script
[
  {
    "type": "goto",
    "path": "/designer/themes/1",
    "captionSv": "Öppna det lokala demotemat och välj en textyta i förhandsvisningen.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "selector": "iframe[title=\"Live theme preview\"]",
    "captionSv": "Förhandsvisningen visar hur temat ser ut innan du ändrar ett avstånd.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Collapse theme inspector",
    "captionSv": "Dölj inspektören tillfälligt så att förhandsvisningen får mer plats.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 3
  },
  {
    "type": "click",
    "frameSelector": "iframe[title=\"Live theme preview\"]",
    "selector": "h1",
    "captionSv": "Klicka i förhandsvisningen för att markera innehållswidgeten.",
    "scene": 4,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "forceClick": true
  },
  {
    "type": "click",
    "role": "button",
    "name": "Expand theme inspector",
    "captionSv": "Öppna inspektören igen för att se inställningarna för den valda textytan.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 5
  },
  {
    "type": "click",
    "role": "button",
    "name": "Edit Heading 1",
    "captionSv": "Välj Heading 1 i elementlistan så att inspektören visar rubrikens egna avstånd.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 6
  },
  {
    "type": "assertVisible",
    "text": "Margin bottom",
    "captionSv": "Margin bottom är yttre avstånd under textytan. Padding är inre avstånd mellan innehåll och kant.",
    "scene": 7,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "fill",
    "value": "20px",
    "captionSv": "Ändra ett värde i taget och jämför förhandsvisningen. Här ökar vi textytans nedre marginal till 20 pixlar.",
    "scene": 8,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "atomicFill": true,
    "selector": "input[aria-label=\"element Margin bottom\"]"
  },
  {
    "type": "assertVisible",
    "text": "Padding",
    "captionSv": "Rubrikens padding är ett inre avstånd. Ändra det separat från den yttre marginalen.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 9
  },
  {
    "type": "fill",
    "selector": "input[aria-label=\"element Padding top\"]",
    "value": "12px",
    "atomicFill": true,
    "captionSv": "Öka rubrikens övre padding till tolv pixlar och jämför utrymmet innanför kanten.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 10
  },
  {
    "type": "click",
    "role": "button",
    "name": "Save draft",
    "captionSv": "Spara ändringen i demotemats utkast. Publicering är ett separat beslut.",
    "scene": 11,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  }
]
```
