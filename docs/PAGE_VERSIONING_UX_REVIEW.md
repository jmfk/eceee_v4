# Versionshantering för Pages och individuella sidor

**Status:** uppdaterad efter implementation av PRD 0001
**Datum:** 2026-09-22
**Kravkälla:** [PRD 0001 – Simplified Page Versioning](../specs/prds/0001-simplified-page-versioning.md)

> Se [kortöversikten](PAGE_VERSIONING_QUICK_OVERVIEW.md) för en snabb beskrivning av användarprocesserna.

## Tidigare arbetssätt

Versionshanteringen var både teknisk lagringsmodell och redaktörens synliga arbetsmodell:

- Pages-rader kunde visa status, flera versionsnummer och överlappande badges.
- Statusikonen kunde publicera eller avpublicera direkt i vissa tillstånd.
- Sidredigeraren kunde öppna senast visad eller högsta version, skriva till vald version, skapa nya versioner och byta manuellt.
- Publiceringsarbete fanns i Pages, editorn, Version Timeline och Settings.
- Bulkpublicering valde “senaste version” utan att först låsa exakt versionsval.

Det gjorde orden aktuell, senaste, vald, live och publicerad svåra att skilja åt. Den största risken var att redaktören inte säkert kunde förutse om Spara påverkade liveinnehållet.

## Ny standardmodell

`PageVersion` finns kvar som tekniskt säkerhets-, historik- och publiceringslager. Redaktören arbetar i stället med:

| Begrepp | Betydelse |
|---|---|
| Arbetsversion | Den enda version som får redigeras |
| Live | Den skrivskyddade version som besökare ser |
| Schemalagd | Arbetsversionen med framtida publiceringsdatum |
| Historik | Äldre skrivskyddade utkast och publicerade versioner |

Den kanoniska arbetsversionen är den högsta redigerbara utkast- eller schemaversionen. Äldre utkast bevaras som skrivskyddad historik. Historiska och publicerade versioner får inte uppdateras eller raderas.

## Pages-vyn

Varje sida visar ett sammanlagt läge:

- **Inte publicerad**
- **Live**
- **Live med opublicerade ändringar**
- **Schemalagd**
- **Live med schemalagd ändring**
- **Publicering avslutad**

Samma lägen används som filter. Versionsnummer och versionsbadges är borttagna ur normalvyn. Statusindikatorn är inte klickbar och kan därför inte orsaka en publicering av misstag.

Sidans meny leder till **Publishing & history**, där publicering, schema, avpublicering och historik har tydliga separata åtgärder och bekräftelser.

### Bulkpublicering

Före publicering hämtas varje sidas workflow och användaren får granska sidans titel och den explicita arbetsversion som ska publiceras. Anropet skickar `pageId`, `versionId` och förväntad ändringstid. Inaktuella poster stoppas och partiella fel redovisas per sida.

Bulkpublicering är fortsatt icke-atomisk. Det är inte ett Packet och gränssnittet varnar om detta.

## Sidredigeraren

Editorn öppnar den kanoniska arbetsversionen. Finns endast en liveversion visas dess innehåll, men en arbetsversion skapas idempotent först när användaren sparar.

### Spara

**Spara** uppdaterar samma arbetsversion i en atomisk request för siddata, widgets och metadata. Liveinnehållet ändras inte.

Klienten skickar den `updatedAt` som lästes in. Om arbetsversionen har ändrats sedan dess returnerar backend en konflikt och skriver inte över nyare arbete.

### Publicera ändringar

Publicering riktas mot exakt den öppna arbetsversionens ID. Inget nytt standardflöde tolkar “latest” som publiceringsmål.

### Schemalägg

Arbetsversionen får ett framtida startdatum och är fortsatt redigerbar fram till publiceringen. En sida får ha högst en normal framtida schemaläggning.

Äldre data med flera framtida schemaläggningar raderas inte. Konflikten visas i Historik och ny schemaläggning blockeras tills den hanterats.

### Avpublicera

Avpublicering avslutar den uttryckligen valda liveversionen. Innehåll och historik bevaras och liveversionen görs inte redigerbar.

## Historik

Historikpanelen samlar:

- förhandsgranskning;
- val av två versioner för jämförelse;
- tekniska versionsnummer och tidsstämplar;
- återställning som arbetsversion;
- information om äldre utkast och extra schemaläggningar.

Återställning kopierar valt innehåll till den kanoniska arbetsversionen. Den publicerar aldrig automatiskt. Gamla Version Timeline-URL:er omdirigeras till editorns historikyta och Settings pekar användaren till samma flöde.

## Avancerad publicering med undersidor

Funktionen finns kvar under Avancerat. Den varnar tydligt för att varje sida behandlas separat och att körningen saknar atomisk garanti. För en samordnad strukturrelease krävs en framtida Packet-modell som sparar exakt vilka sidversioner som ingår.

## Varför versioner inte stängs av

Sidans innehåll, widgets, layout, tema, metadata och publiceringsdatum ligger på `PageVersion`. Att stänga av modellen vore därför en ny lagrings- och renderingsarkitektur, inte en enkel UX-inställning.

PRD 0001 döljer den tekniska komplexiteten i standardflödet men behåller versionerna för säker publicering, historik, återställning och framtida Packet-stöd.

## Avgränsningar och nästa steg

Följande ingår inte:

- Site-väljare och site-fokuserad navigation;
- Packet som persistent arbetsyta;
- atomisk publicering av en hel struktur;
- val av versionsläge per site eller struktur.

De bör beskrivas i en separat framtida PRD. Workflow-kontraktets explicita version-ID:n är avsiktligt utformade så att Packet senare kan referera till exakta sidversioner.
