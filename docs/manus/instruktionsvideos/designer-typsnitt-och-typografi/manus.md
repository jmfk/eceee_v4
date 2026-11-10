---
id: designer-typsnitt-och-typografi
helpGuideId: settings-themes
title: "Designer: typsnitt och typografi"
summary: "Undersök installerade typsnitt och rubrikens typografivärden."
sectionId: designer
sectionTitle: Designer
language: sv
sourceLanguage: sv
---

# Designer: typsnitt och typografi

**Miljö:** Lokalt CMS med `--mock-api` och ett isolerat demotema.

**Mål:** Hitta installerade typsnitt och undersök rubrikens typografivärden i förhandsvisningen.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna demotemat och börja med att se vilka typsnitt som redan finns.

### 2. click

**Berättarröst och undertext:** Theme fonts visar de installerade familjer som kan användas i typografin.

### 3. assertVisible

**Berättarröst och undertext:** Här är Inter installerat. Använd en tillgänglig familj när du ändrar textegenskaper.

### 4. click

**Berättarröst och undertext:** Gå tillbaka till sidans förhandsvisning för att välja en text.

### 5. click

**Berättarröst och undertext:** Dölj inspektören tillfälligt så att förhandsvisningen får mer plats.

### 6. click

**Berättarröst och undertext:** Klicka i förhandsvisningen för att markera innehållswidgeten innan du väljer ett textelement.

### 7. click

**Berättarröst och undertext:** Öppna inspektören igen för att se inställningarna för den valda textytan.

### 8. click

**Berättarröst och undertext:** Välj Heading 1 i elementlistan för att se rubrikens egna typografivärden.

### 9. assertVisible

**Berättarröst och undertext:** Ändra en typografisk egenskap i taget och kontrollera resultatet i förhandsvisningen.

```video-script
[
  {
    "type": "goto",
    "path": "/designer/themes/1",
    "captionSv": "Öppna demotemat och börja med att se vilka typsnitt som redan finns.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Theme fonts",
    "captionSv": "Theme fonts visar de installerade familjer som kan användas i typografin.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "text": "Installed font families",
    "captionSv": "Här är Inter installerat. Använd en tillgänglig familj när du ändrar textegenskaper.",
    "scene": 3,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Article page",
    "captionSv": "Gå tillbaka till sidans förhandsvisning för att välja en text.",
    "scene": 4,
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
    "scene": 5
  },
  {
    "type": "click",
    "frameSelector": "iframe[title=\"Live theme preview\"]",
    "selector": "h1",
    "captionSv": "Klicka i förhandsvisningen för att markera innehållswidgeten innan du väljer ett textelement.",
    "scene": 6,
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
    "scene": 7
  },
  {
    "type": "click",
    "role": "button",
    "name": "Edit Heading 1",
    "captionSv": "Välj Heading 1 i elementlistan för att se rubrikens egna typografivärden.",
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "scene": 8
  },
  {
    "type": "assertVisible",
    "text": "Size",
    "captionSv": "Ändra en typografisk egenskap i taget och kontrollera resultatet i förhandsvisningen.",
    "scene": 9,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  }
]
```
