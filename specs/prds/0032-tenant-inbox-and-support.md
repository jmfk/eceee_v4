---
id: PRD-0032
title: Tenantens instruktionsfilmer, inbox och support
status: in-progress
locked: true
created: 2026-10-22
related_adrs:
  - ADR-0044
---

# PRD-0032: Tenantens instruktionsfilmer, inbox och support

## Problem

En operatör behöver dela en specifik instruktionsfilm med en tenant, behålla filmen över tid och nå användarna när nytt innehåll finns. Användarna behöver kunna skicka frågor och buggrapporter med kort video och få svar inne i CMS:et.

## Goals

- En personlig inbox för instruktioner och support, med senaste inkomna aktivitet först.
- Bestående tenantbibliotek med senaste publicerade instruktionsfilmen först.
- Privata supporttrådar med text, fellänk och valfri bugginspelning på högst fem sekunder.
- Kort e-postavisering för varje nytt inkommande meddelande, med länk till systemet.

## Non-Goals

- Publik videosajt, direktsändning, fullständigt ärendehanteringssystem eller externa e-postsvar.
- Automatisk radering av filmer som beskrivs som tillfälliga.
- Produktionsändringar, uppladdningar eller utskick under denna skissfas.

## Users and Use Cases

- Antagande för utkastet: mottagare är befintliga inloggade CMS-användare med tenantmedlemskap, inte den publika webbplatsens besökare. Externa användare kräver ett separat klargörande av identitet och åtkomst.
- Behörig operatör publicerar en instruktion för en uttryckligen vald tenant.
- Användare hittar instruktionen i sin inbox, spelar filmen och hittar den senare i biblioteket.
- Användare skickar en fråga eller rapporterar ett fel från aktuell vy; behörig support svarar i samma tråd.
- Support arbetar inom en explicit vald tenant och ser endast ärenden rollen tillåter.

## Requirements

### Instruktionsfilmer

- Titel, kort beskrivning, video och uttryckligen vald tenant. Publicering visar mottagarantal innan den genomförs.
- Första versionen riktar publiceringen till alla aktiva medlemmar i vald tenant. Mottagare och tidpunkt sparas; samma publicering får inte skapa dubbletter vid återförsök.
- Biblioteket sorteras efter publiceringstid fallande. Nya medlemmar kan se tidigare publicerade filmer i biblioteket utan retroaktiva e-postutskick.
- Filmen bevaras tills den uttryckligen tas bort enligt beslutad lagringspolicy. Arkivering flyttar den till arkiv, behåller åtkomst för behöriga och skickar ingen ny avisering. Avpublicering måste kunna dra tillbaka åtkomst separat.
- Publicera, arkivera och hantera instruktioner kräver särskild behörighet. Vanliga mottagare får läsa och spela upp.
- Fråga om en film öppnar en privat supporttråd med filmreferens, inte ett kommentarsfält synligt för hela tenanten.
- Femsekundersgränsen gäller bara buggbilagor. Instruktionsfilmer kan vara längre och behöver en separat storleksgräns.

### Personlig inbox

- Huvudtabbarna förblir synliga i alla vyer, inklusive Fråga eller rapportera fel, även vid scrollning. Inbox nås via tabben; ingen separat Till inbox-knapp visas.
- En ingång i CMS-navigationen med antal olästa. Filter för Alla, Instruktioner och Support; senaste mottagna aktivitet först och tydlig avsändare/tidpunkt.
- Nya destinationer och handlingar registreras i CMS:ets gemensamma sök-/kommandopalett vid implementation.
- Varje användare har eget läsläge. Öppnad instruktion betyder läst meddelande, inte bevis på att filmen är sedd eller uppgiften utförd.
- Nytt svar gör tråden oläst för mottagaren. Egna meddelanden skapar inte en avisering till avsändaren själv.
- Arkivering hos en person påverkar inte andra mottagare, supporttrådens innehåll eller originalfilmen. Nytt inkommande svar återför tråden till inboxen.
- Direktlänk efter inloggning återgår till rätt tenant och meddelande endast efter behörighetskontroll; indraget medlemskap ger ingen åtkomst.

### Frågor och felrapporter

- Separata val för Fråga och Felrapport. Kort beskrivning krävs för båda; fellänk krävs för felrapport och förifylls från aktuell CMS-vy när flödet startas därifrån. Användaren kan ändra länken.
- En valfri videobilaga per felrapport, högst 5,000 sekunder. Textbaserad rapport måste fungera utan video.
- Klienten visar längd och förhandsvisning och stoppar filer över gränsen. Servern validerar faktisk avkodningsbar längd och filinnehåll; okänd, manipulerad eller för lång video avvisas. Klientens metadata är aldrig auktoritativ.
- Utkast visar validering/pågående kontroll/fel i vyn och behåller texten vid misslyckad uppladdning. Ärendet får inte skickas innan bilagan är godkänd eller borttagen.
- Separat bytegräns, tillåtna format, uppladdningskvot och begränsad bearbetning krävs också; fem sekunder begränsar inte filstorlek eller resursåtgång. Exakta gränser är öppna nedan.
- Supporttråd är privat för avsändaren och explicit behörig support inom tenanten. Tenantmedlemskap ensamt ger inte rätt att läsa andras ärenden eller bilagor.
- Svar kan skickas åt båda håll i systemet. Enkel status: Öppen, Väntar på användaren, Löst. Ny användarfråga i en löst tråd återöppnar den.
- Länkar behandlas som användarinnehåll: ingen automatisk serverhämtning och inga körbara URL-scheman. Ta bort känsliga frågeparametrar/fragment vid automatisk infångning, och låt användaren granska länken före sändning.

### E-post

- Varje nytt inkommande inboxmeddelande får en personlig e-postavisering: en instruktionspublicering, ny supportfråga eller ett nytt svar. Läskvitton, statusändringar och egna skickade meddelanden skapar inga extra utskick.
- Supportmottagare definieras uttryckligen per tenant; en vanlig tenantadministratör är inte automatiskt supportmottagare.
- Meddelandet innehåller en kort neutral beskrivning och länk, utan full meddelandetext, video, buggbilaga, känslig fellänk eller åtkomsttoken. Exempel: ”Du har fått ett svar på din felrapport. Läs och svara i ECEEE.”
- Mottagarens inloggning och rättigheter krävs för läsning. E-postlänken ger inte åtkomst i sig. Svar sker i systemet; e-postmallen säger detta tydligt.
- Inbox och utskicksuppdrag sparas tillförlitligt tillsammans. Utskick köas med återförsök och deduplicering per mottagare/meddelande. Permanent leveransfel visas för operatören; innehållet finns kvar i inboxen även om e-post misslyckas.

### Lagring och åtkomst

- Tenant och mottagar-/supportbehörighet kontrolleras för listor, detalj, publicering, svar, uppladdning och uppspelning. Servern bestämmer tenantkontext från verifierad åtkomst.
- Privat objektlagring, isolerad från publik mediepolicy. Ingen publik URL-reservväg och ingen exponering via vanliga medieslugs, allmän sökning, export eller publika widgets.
- Kortlivad uppspelningslänk skapas först efter behörighetskontroll. Länken är en tidsbegränsad åtkomstbiljett; kvarvarande giltighet efter återkallad behörighet måste begränsas och dokumenteras.
- Objektlagringen levererar videobytes; API:t hanterar metadata och åtkomst. Uppspelning och spolning verifieras med avsedda format och byte-range-stöd.
- Instruktionsfilmer och ärenden måste ingå i beslutad backup och återställning, inklusive privata filer. Ingen automatisk permanent radering före beslutad retention.

## Acceptance Criteria

- Publicering i tenant A skapar en personlig inboxpost och ett utskicksuppdrag per aktuell mottagare. Tenant B ser varken instruktion, metadata eller video, även med känt ID.
- Senaste publicerade filmen visas först i biblioteket; inboxen visar senaste inkommande aktivitet först. Att arkivera en post hos en mottagare tar inte bort filmen.
- En korrekt video på exakt 5 sekunder kan godkännas; en på 5,01 sekunder avvisas på servern även om klientkontrollen kringgås. Okänd längd och filformat som inte stämmer med innehållet avvisas.
- Användare i samma tenant kan inte läsa varandras supportärenden. Behörig support kan svara och användaren får ett oläst meddelande med kort e-postavisering.
- Dubbelklick eller jobbåterförsök skapar inte dubbla meddelanden eller avsiktliga dubbla utskick. Leveransfel tar inte bort inboxinnehåll.
- En utloggad mottagare kommer efter inloggning till rätt innehåll om behörigheten kvarstår. En borttagen medlem får inte ny uppspelningsåtkomst.
- Långa instruktionsfilmer påverkas inte av buggbilagans femsekundersregel.

## Constraints

- Återanvänd projektets Django/DRF-, React- och tenantmönster. Detta utkast inför inget nytt generellt dokument-/eventramverk.
- Produktionskapacitet, faktisk mediepolicy, e-postleverans, backup och releaseversion är inte verifierade i denna lokala kartläggning.
- Befintliga publika hjälpvideor får fortsätta fungera; privat tenantinnehåll måste ha en separat skyddad åtkomstväg.

## Implementation Notes

### Implementation started 2026-10-22

- Owner requested implementation on the dedicated workspace/PR after reviewing the sketch. Requirements are now locked. Historical sketch-phase notes below describe the initial proposal.
- Batch includes backend models/API, private video validation/storage, durable email queue, persistent inbox UI/navigation, targeted tests and operator setup documentation.

### Kartlagt lokalt 2026-10-22

- `frontend/src/pages/HowToHelpPage.jsx`, `components/help/HelpVideoPlayer.jsx` och `utils/howToHelp.js`: befintlig hjälpsida och videospelare, inklusive statiska manuella/genererade filmer. Ingen tenantpublicering eller mottagarinbox hittad.
- `backend/file_manager/models.py` och `storage.py`: tenantkopplade medier och MP4/WebM-stöd. Flera publika läsvägar i `views/utils.py` använder `AllowAny`; `views/media_file.py` har även publik reservlänk vid nedladdning. Kan inte förutsättas skydda intern video.
- `backend/utils/notifications.py`: realtidsuppdateringar för AI-jobb; ingen bestående användarinbox/supportdialog hittad.
- Django-mailanrop finns i `backend/ai_tracking/services/price_updater.py`; detta verifierar inte att produktionens e-post fungerar för användaraviseringar.

### Förslag att ta ställning till före implementation

- En liten dedikerad Django-modul för instruktioner, supporttrådar, meddelanden, personligt läsläge, privata bilagor och utskicksjobb; återanvänd ordinarie inloggning och tenantmedlemskap.
- Ingen realtid krävs i första versionen. Uppdatering vid navigation och enkel periodisk hämtning räcker; e-post leder tillbaka till innehållet.
- Börja med en komplett kedja: tenantfilm → publicering → inbox/e-post → uppspelning → fråga/felrapport → supportsvar.
- Öppna beslut: vilka personer är supportmottagare/publicerare; filstorlek, format (inklusive mobilernas MOV), kvoter och eventuell konvertering; retention för ärenden/bilagor; tillgänglig text/transkript för instruktioner.
- Beteendeskiss: [klickbar lokal HTML](../../docs/wireframes/tenant-inbox-support.html). Engångsdata i webbläsarminnet; ingen riktig uppladdning, e-post eller backendvalidering.
- Skissen begränsas till list-/detaljnavigation och centrala flöden. Kommandopalett, inspelning, verklig servervalidering och fullständig produktions-UI/accessibility ingår inte i demonstrationen. Bytegränsen 25 MB är endast ett exempel i skissen.

## Linked ADRs

- [ADR-0044: Tenant inbox and private support](../adrs/active/0044-tenant-inbox-and-private-support.md) — implementation decisions, limits and mail-delivery semantics.

- Vid den första kartläggningen användes befintlig [ADR-0003](../adrs/active/0003-tenant-membership-authorization.md) gäller som tenantgrund, med striktare deltagaråtkomst för privata supportärenden.

## Completion Evidence

### Implementation batch

- Backend: additiv migration för core/auth-kopplade supportmodeller; tenant- och deltagarstyrda API:er; request-id-deduplicering; privat videolagring och kortlivade uppspelningslänkar; serveravkodning av buggbilagor; bestående e-postkö och operatörsvy för leveransproblem.
- Frontend: inkopplad CMS-navigation, bestående inboxflikar, bibliotek/publicering, frågor/felrapporter, trådsvar, rollhantering och tenantbevarande inloggningslänkar.
- 23 riktade backendtester på PostgreSQL 16 och 11 frontendtester godkända. PostgreSQL-kontrollen omfattar uppgradering från befintlig core, upprepad migrationskörning utan nya operationer och två samtidiga e-postarbetare för samma utskick. Riktigt femsekundersmaterial godkänns och 5,01 sekunder avvisas; även avkodad längd som överskrider metadata avvisas.
- Full Django-systemkontroll och migrationskontroll godkända. Frontendens produktionsbygge godkänt med befintliga chunk-/importvarningar.
- Webbläsarkontroll av byggd produkt med mockade API:er: rapport med validerad video, svar, publicering, bibliotek, mobilflikar och ljus/mörk visning. Backendåtkomst testas separat med riktig isolerad testdatabas och mockade leverantörer.
- Kvar före produktionsaktivering: separat privat bucket, faktisk e-postkonfiguration/leverans, byte-range-uppspelning mot objektlagringen, objektbackup/återställningsprov samt miljöspecifik verifiering på produktionsversionen av PostgreSQL. Inget produktionsarbete ingår i denna batch. Se [driftsguiden](../../docs/tenant-inbox-support.md).

### Historical sketch evidence

- Den ursprungliga leveransen var kartläggning och lokal beteendeskiss före implementation.
- Lokal Playwright-kontroll (fristående Playwright-kontroll av HTML-filen): navigation, simulerat avslag för sexsekundersbilaga, rapport utan video, supportsvar, e-postexempel, publicering och senaste film först. Ingen backend- eller e-postverifiering.
- Mobilbredd utan horisontell overflow; skärmbilder granskade i ljust och mörkt läge. Specs-validator och avgränsad `git diff --check` godkända. Ingen bred produkttestsvit behövdes för dokument/skiss.
- Skissbatchen omfattade denna PRD, dess indexrad och HTML-skissen i separat workspace/branch `codex/tenant-inbox-support`. Produktimplementationen har därefter lagts till på samma PR efter ägarens instruktion.
