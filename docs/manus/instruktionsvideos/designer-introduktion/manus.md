---
id: designer-introduktion
helpGuideId: settings-themes
title: "Designer: hitta temat och förstå arbetsytan"
summary: "Öppna ett lokalt demotema och hitta utkastets kontroller."
sectionId: designer
sectionTitle: Designer
language: sv
sourceLanguage: sv
---

# Designer: hitta temat och förstå arbetsytan

**Miljö:** Lokalt CMS med `--mock-api` och ett isolerat Demo Theme. Filmen ändrar inte ett skarpt tema.

**Mål:** Hitta ett tema, öppna arbetsytan och skilja utkast från publicering.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna Designer themes. I den lokala demon finns temat Demo Theme.

### 2. assertVisible

**Berättarröst och undertext:** Temalistan visar de teman som är tillgängliga för ditt konto.

### 3. click

**Berättarröst och undertext:** Öppna Demo Theme för att se Designer-arbetsytan.

### 4. assertVisible

**Berättarröst och undertext:** I arbetsytan ser du temat och dess aktuella utkastsversion.

### 5. assertVisible

**Berättarröst och undertext:** Save draft sparar utkastet. Publicering är ett separat steg som du gör efter granskning.

```video-script
[
  {
    "type": "goto",
    "path": "/designer/themes",
    "captionSv": "Öppna Designer themes. I den lokala demon finns temat Demo Theme.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "role": "heading",
    "name": "Designer themes",
    "captionSv": "Temalistan visar de teman som är tillgängliga för ditt konto.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "link",
    "name": "Open Demo Theme",
    "captionSv": "Öppna Demo Theme för att se Designer-arbetsytan.",
    "scene": 3,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "captionSv": "I arbetsytan ser du temat och dess aktuella utkastsversion.",
    "scene": 4,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500,
    "text": "Designer draft"
  },
  {
    "type": "assertVisible",
    "role": "button",
    "name": "Save draft",
    "captionSv": "Save draft sparar utkastet. Publicering är ett separat steg som du gör efter granskning.",
    "scene": 5,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  }
]
```
