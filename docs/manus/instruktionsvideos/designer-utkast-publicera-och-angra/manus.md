---
id: designer-utkast-publicera-och-angra
helpGuideId: settings-themes
title: "Designer: spara utkast, publicera och ångra"
summary: "Visa utkast, publicering och ångra i ett isolerat lokalt tema."
sectionId: designer
sectionTitle: Designer
language: sv
sourceLanguage: sv
---

# Designer: spara utkast, publicera och ångra

**Miljö:** Lokalt CMS med `--mock-api`. Demotemat och dess revisioner finns bara i inspelningssessionens minne.

**Mål:** Visa att sparat utkast, publicering och återställning är skilda steg.

## Scener

### 1. goto

**Berättarröst och undertext:** Öppna demotemat. Ändringar görs först i ett utkast.

### 2. click

**Berättarröst och undertext:** Öppna Theme palette och välj en tydlig liten demoändring.

### 3. fill

**Berättarröst och undertext:** Ändra färgvärdet i den lokala demon och granska resultatet innan du sparar.

### 4. click

**Berättarröst och undertext:** Save draft bevarar ändringen i utkastet. Live-temat påverkas inte.

### 5. assertVisible

**Berättarröst och undertext:** Bekräftelsen visar att utkastet är sparat. Publicering görs i nästa steg.

### 6. click

**Berättarröst och undertext:** Efter granskning väljer du Publish changes och bekräftar den lokala publiceringen.

### 7. click

**Berättarröst och undertext:** Undo publish återställer den senaste publiceringen i demotemat.

```video-script
[
  {
    "type": "goto",
    "path": "/designer/themes/1",
    "captionSv": "Öppna demotemat. Ändringar görs först i ett utkast.",
    "scene": 1,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Theme palette",
    "captionSv": "Öppna Theme palette och välj en tydlig liten demoändring.",
    "scene": 2,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "fill",
    "label": "brand palette value",
    "value": "#345678",
    "captionSv": "Ändra färgvärdet i den lokala demon och granska resultatet innan du sparar.",
    "scene": 3,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Save draft",
    "captionSv": "Save draft bevarar ändringen i utkastet. Live-temat påverkas inte.",
    "scene": 4,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "assertVisible",
    "text": "Draft saved",
    "captionSv": "Bekräftelsen visar att utkastet är sparat. Publicering görs i nästa steg.",
    "scene": 5,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Publish changes",
    "acceptDialog": true,
    "captionSv": "Efter granskning väljer du Publish changes och bekräftar den lokala publiceringen.",
    "scene": 6,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  },
  {
    "type": "click",
    "role": "button",
    "name": "Undo publish",
    "acceptDialog": true,
    "captionSv": "Undo publish återställer den senaste publiceringen i demotemat.",
    "scene": 7,
    "captureStatus": "ready",
    "postNarrationPauseMs": 1500
  }
]
```
