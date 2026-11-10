# Instruktionsvideor: manus och produktionsskärmbilder

Varje videomapp innehåller `manus.md` och `screenshots/README.md`. `manus.md` är nu källan för filmens scenordning, berättarröst, undertext och Playwright-handlingar. Skärmbildsregistren beskriver tidigare produktionsbilder och används inte som filmens körschema.

## Skapa manus i Codex

Öppna ECEEE-projektet i Codex och aktivera `$eceee-instructional-video-scripts`. Ange ämne eller arbetsflöde, målgrupp och önskad längd om du har preferenser. Skillen granskar aktuell implementation och tar fram svenskt manus, scenvisa undertexter och verifierbara Playwright-handlingar. Engelska kan läggas till som ett separat valfritt språkspår.

## Status för skärmbilder

20 faktiska Chrome-skärmbilder från `app.eceee.org` är sparade i respektive videomapp. De visar äldre produktionsvyer och deras register kan ha andra scennummer och formuleringar än de nya lokala filmerna. Proposals var tom i prod och Designer-arbetsytan fastnade vid “Loading Designer workspace…”. De nya Playwright-filmerna visar därför de fungerande flödena med lokala demodata.

Se [nattlistan för kompletterande vyer](shot-list-for-nattcapture.md) för menyer, dialoger, Designer-inställningar och staging-flöden som behöver fångas innan animering.

## Videor

- [Designer: hitta rätt tema och förstå arbetsytan](designer-introduktion/manus.md) — [scenregister och bildtexter](designer-introduktion/screenshots/README.md).
- [Designer: undersöka och ändra marginaler och padding](designer-marginaler-och-padding/manus.md) — [scenregister och bildtexter](designer-marginaler-och-padding/screenshots/README.md).
- [Designer: ändra typsnitt och typografi](designer-typsnitt-och-typografi/manus.md) — [scenregister och bildtexter](designer-typsnitt-och-typografi/screenshots/README.md).
- [Designer: spara utkast, publicera och ångra](designer-utkast-publicera-och-angra/manus.md) — [scenregister och bildtexter](designer-utkast-publicera-och-angra/screenshots/README.md).
- [Publisher: arbeta med objekt](publisher-arbeta-med-objekt/manus.md) — [scenregister och bildtexter](publisher-arbeta-med-objekt/screenshots/README.md).
- [Taggar: förslag och godkännande](taggar-forslag-och-godkannande/manus.md) — [scenregister och bildtexter](taggar-forslag-och-godkannande/screenshots/README.md).
- [Taggar: den gemensamma taggstrukturen](taggar-gemensam-taggstruktur/manus.md) — [scenregister och bildtexter](taggar-gemensam-taggstruktur/screenshots/README.md).
- [Bilder: välja fokuspunkt och förstå beskärningen](bilders-fokuspunkter/manus.md) — [äldre scenregister och bilder](bilders-fokuspunkter/screenshots/README.md). Den nya filmen visar fokusdialogens tre beskärningar med en lokal bild.

## Lokala demodata och inspelningsstatus

De åtta manusen har scenvisa `video-script`-handlingar för den faktiska React-appen. Kör dem med Vite och `--mock-api`: alla API-svar finns då i Playwright-sessionens minne. Förslag, beslut, temaändringar och bildfokus återställs mellan simulering och inspelning. Inga produktionsposter ändras. Den lokala bilden `frontend/public/howto-focal-demo.svg` visar tydligt hur fokuspunkt påverkar olika beskärningar.

Starta frontend på en ledig projektport och simulera ett manus innan ElevenLabs används:

```sh
cd frontend
npm run dev -- --host 127.0.0.1 --port 11602 --strictPort
HOWTO_AUTH_STATE= HOWTO_TRANSLATION_PROVIDER= node scripts/generate-howto-video.mjs \
  --docs-dir ../docs/manus/instruktionsvideos/bilders-fokuspunkter --guide bilders-fokuspunkter \
  --base-url http://127.0.0.1:11602 --mock-api --simulate-only --language sv --no-context
```

Byt sista mappnamnet för övriga manus. `--mock-api` är avsett för lokala övningsfilmer och ska aldrig användas som bevis för att ett produktionsflöde fungerar. De äldre Chrome-bilderna visar prod vid en tidigare tidpunkt; de nya manusen följer lokal demodata.

När simuleringen passerar, skapa en svensk förhandsfilm med samma lokala URL och guide-ID:

```sh
cd frontend
VIDEO_SLUG=bilders-fokuspunkter
VIDEO_DIR="../docs/manus/instruktionsvideos/${VIDEO_SLUG}/video"
HOWTO_AUTH_STATE= HOWTO_TRANSLATION_PROVIDER= node scripts/generate-howto-video.mjs \
  --docs-dir "../docs/manus/instruktionsvideos/${VIDEO_SLUG}" --guide "${VIDEO_SLUG}" \
  --base-url http://127.0.0.1:11602 --mock-api \
  --output-dir "${VIDEO_DIR}" --public-dir "${VIDEO_DIR}" \
  --work-dir "/private/tmp/eceee-video-work/${VIDEO_SLUG}/sv" \
  --audio-cache-dir howto-audio-cache \
  --language sv --language-suffix --preview --voice elevenlabs --voice-id bIHbv24MWmeRgasZH58o --require-voice \
  --format mp4 --cursor --no-context --post-narration-pause-ms 1500
```

Alla åtta lokala scenflöden har passerat Playwright-simulering och svenska förhandsfilmer skapades 2026-11-10. Rösten är ElevenLabs standardröst **Will**, med verifierat stöd för svenska, vald med `--voice-id bIHbv24MWmeRgasZH58o --language sv`. Den tidigare biblioteksrösten kunde inte användas med kontots plan. Oförändrade ljudklipp cachas i `frontend/howto-audio-cache/`.

Varje MP4 har kontrollerat ljudspår. VTT-filerna har samma repliker som manus och ljudmanifest, med tider som matchar respektive ljudklipp. De äldre `<slug>.vtt`-filerna är uppdaterade till samma innehåll som `<slug>-preview-sv.vtt`; de matchar de nya förhandsfilmerna. Äldre VTT-filer är säkerhetskopierade i `/private/tmp/eceee-video-vtt-backup-20261110/`. Slutversioner väntar på användarens granskning. Inspelningarna har uppdaterats med källfingeravtryck; `npm run howto:check -- --require-previews` avvisar äldre filmer om manusets handlingar eller berättartext ändras.

| Film | Längd | Undertexter |
|---|---:|---|
| [Bilder: välja fokuspunkt och förstå beskärningen](bilders-fokuspunkter/video/bilders-fokuspunkter-preview-sv.mp4) | 69.2 s | [VTT](bilders-fokuspunkter/video/bilders-fokuspunkter-preview-sv.vtt) |
| [Designer: hitta temat och förstå arbetsytan](designer-introduktion/video/designer-introduktion-preview-sv.mp4) | 30.2 s | [VTT](designer-introduktion/video/designer-introduktion-preview-sv.vtt) |
| [Designer: marginaler och padding](designer-marginaler-och-padding/video/designer-marginaler-och-padding-preview-sv.mp4) | 73.2 s | [VTT](designer-marginaler-och-padding/video/designer-marginaler-och-padding-preview-sv.vtt) |
| [Designer: typsnitt och typografi](designer-typsnitt-och-typografi/video/designer-typsnitt-och-typografi-preview-sv.mp4) | 55.2 s | [VTT](designer-typsnitt-och-typografi/video/designer-typsnitt-och-typografi-preview-sv.vtt) |
| [Designer: spara utkast, publicera och ångra](designer-utkast-publicera-och-angra/video/designer-utkast-publicera-och-angra-preview-sv.mp4) | 43.2 s | [VTT](designer-utkast-publicera-och-angra/video/designer-utkast-publicera-och-angra-preview-sv.vtt) |
| [Publisher: arbeta med objekt](publisher-arbeta-med-objekt/video/publisher-arbeta-med-objekt-preview-sv.mp4) | 64.2 s | [VTT](publisher-arbeta-med-objekt/video/publisher-arbeta-med-objekt-preview-sv.vtt) |
| [Taggar: lämna och granska ett förslag](taggar-forslag-och-godkannande/video/taggar-forslag-och-godkannande-preview-sv.mp4) | 64.2 s | [VTT](taggar-forslag-och-godkannande/video/taggar-forslag-och-godkannande-preview-sv.vtt) |
| [Taggar: den gemensamma taggstrukturen](taggar-gemensam-taggstruktur/video/taggar-gemensam-taggstruktur-preview-sv.mp4) | 49.2 s | [VTT](taggar-gemensam-taggstruktur/video/taggar-gemensam-taggstruktur-preview-sv.vtt) |


Banner-widgeten använder ännu inte sparad fokusmetadata. Fokalpunktsmanuset visar därför mediabibliotekets tre fungerande beskärningar och sparad position, medan bannerjämförelse väntar på en verifierad koppling i renderaren.

## Skapa och godkänn videor

Produktionsflödet simulerar först hela Playwright-sekvensen mot den riktiga webbappen och stoppar om en handling eller förväntad vy misslyckas. Sedan spelas sajten in med muspekare och klickmarkering samtidigt som ElevenLabs-berättarrösten och textningen synkroniseras. Varje moment får en tyst paus på 1–3 sekunder innan nästa berättarröst börjar.

Läs [produktionsstegen](../../../.agents/skills/eceee-instructional-video-scripts/references/production.md) för kommandon och granskning. Previewfiler namnges `video/<slug>-preview-sv.mp4` och `video/<slug>-preview-en.mp4`. Efter att användaren granskat och godkänt dem skapas `video/<slug>-sv.mp4` och `video/<slug>-en.mp4`. Uppladdning till prod är separat.

Den äldre `python3 render_videos.py` skapar stillbildsbaserade prototyper. Befintliga MP4-filer från den renderaren är inte riktiga sajtsinspelningar eller godkända slutvideor.
