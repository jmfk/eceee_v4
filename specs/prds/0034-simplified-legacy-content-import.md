---
id: PRD-0034
title: Förenklad innehållsmodell och legacyimport
status: in-progress
locked: true
created: 2026-10-22
related_adrs:
  - ADR-0049
  - ADR-0047
  - ADR-0046
  - ADR-0043
  - ADR-0025
---

# PRD-0034: Förenklad innehållsmodell och legacyimport

## Problem

ECEEE behöver föra över sitt redaktionella innehåll utan att återskapa alla legacy-modeller, klassificeringssystem och arbetsflöden. Nyheter och krönikor ska kunna blandas i samma listor och sökning. Klassificeringen förutsätts hanteras av det gemensamma hierarkiska systemet i PRD-0031.

## Goals

- Hantera de sex överenskomna innehållsslagen med fem tekniska objekttyper: Artikel, Krönikör, Evenemang, Publikation och Organisation.
- Använda en gemensam artikeltyp för nyheter, krönikor och pressmeddelanden, med innehållsslag i klassificeringen.
- Importera publicerat legacy-innehåll inklusive äldre arkivmaterial med spårbara relationer, filer och URL:er.
- Skilja mellan automatisk mappning, redaktionellt beslutad förenkling, manuell hantering och uttryckligen exkluderade uppgifter.
- Kunna avbryta, återuppta och upprepa import utan dubbletter eller överskrivning av manuellt arbete.

## Non-Goals

- Proceedings, konferens-/panel-/paper-modeller, FileMaker och vetenskapliga plattformar. Proceedings-material undantas oavsett om det även förekommer i bibliotek eller som sidbilaga.
- Medlemskonton, externa användare, registrering, inloggning och externa inskickningsflöden. Publika organisationspresentationer ingår, medlemsbehörigheter gör det inte.
- Jobb och upphandlingar, medlemsaktiviteter, Ecodesign-produkter och annan ej överenskommen funktionalitet.
- Generell migrering av sidträd, menyer, teman, mallar och widgetplaceringar.
- Automatisk import av utkast, avpublicerat innehåll eller äldre versionshistorik.
- Produktionsimport eller driftsättning som en del av att implementera importverktygen.

## Users and Use Cases

- Redaktören publicerar en nyhet eller krönika med samma grundläggande redigeringsflöde och kan välja gemensamma eller separata listor.
- Importansvarig granskar källinventering, mappning och avvikelser innan data skrivs till målmiljön.
- Klassificeringsförvaltaren godkänner termmappning och förenklingar innan importen använder dem.
- Webbansvarig verifierar att arkiv, bilder, filer och gamla länkar fortfarande går att hitta efter övergången.

## Requirements

### Innehållsmodell

- Tekniska objekttyper är `article`, `columnist`, `event`, `library_item` och `organization`. Publikation är den redaktionella benämningen på `library_item`.
- Nyheter och krönikor använder samma `article`-definition och samma gemensamma läsning, listning, paginering och sortering. De får inte dubbleras för att kunna visas tillsammans.
- Publicerade artiklar har exakt en uttryckligt tilldelad term i den avsedda klassificeringen Innehållsslag: Nyhet, Krönika eller Pressmeddelande. Pressmeddelande ligger under Nyhet. Ingen separat konkurrerande `articleKind`-egenskap lagras.
- Kravet på ett innehållsslag är en regel för artikelkonsumenten; det ändrar inte klassificeringssystemets generella stöd för flera termer.
- Gemensamma artikeluppgifter är rubrik, slug, ingress, innehåll, visningsdatum, valfri huvudbild, källa/länk, valfritt källdatum och författarreferenser. Krönikörer är publika innehållsobjekt, inte användarkonton.
- Artikel med innehållsslag Krönika kräver minst en krönikör för publicering. Saknad relation rapporteras för manuell åtgärd, aldrig med en påhittad skribent.
- Evenemang behåller datum, arrangör, plats, fokusområde, typ/kategori, beskrivning och extern länk. Arrangör får vara text; importen skapar inte automatiskt organisationer av fria textfält.
- Publikationer har beskrivning och ordnade bilagor med fil och/eller extern referens. Organisationer har publikt namn, presentation, logotyp och webblänk samt befintliga relevanta klassificeringar.
- Strukturerade uppgifter ligger i objektschema/relationer. Brödtext, biografi och beskrivning använder befintliga innehållswidgetar och mediahantering.

### Urval och mappning

- Urvalet begränsas till rätt ECEEE-källa, tenant och överenskomna webbplatser. Andra webbplatsers data får inte följa med bara för att de delar legacy-databas.
- Källans publicerade poster inventeras inklusive arkiv. Publicerings-, åtkomst- och utgångsregler kontrolleras separat; publicerad status får aldrig tolkas som att allt är offentligt nu.
- Utkast och avpublicerat innehåll räknas och undantas med orsak. En opublicerad person som refereras från en publicerad krönika rapporteras som en beroendeavvikelse och publiceras inte automatiskt.
- En granskningsbar mappningsmatris anger per fält och relation vad som importeras, omformas, hanteras manuellt eller lämnas utanför. Källantal och faktiska värden verifieras innan matrisen låses för en körning.
- Legacy-klassificering ersätts av tilldelningar i PRD-0031. Identiska namn i olika källkategorier är inte bevis på samma betydelse. Varje sammanslagning eller semantisk omklassificering måste ingå i en granskad mappning.
- Generella ämnen kan delas mellan artiklar, evenemang och publikationer efter granskad mappning. Källrelationen `RelatedNews` behandlas som ämnesklassificering, inte automatiskt som en länk till en annan artikel.
- Befintlig taxonomis bevaranderegler gäller: de fem tidigare nyhetsdimensionernas betydelser försvinner inte genom en automatisk sammanslagning. En förenklad redaktionell vy kan dölja bevarade detaljer.
- Publikationer i äldre `ReportPage` inventeras som kandidater för manuell bedömning; samma rapport får inte automatiskt importeras både från sida och bibliotek.
- Partnerlogotyper som saknar fullständig organisationspost hanteras manuellt. Proceedings-källor hämtas inte i denna import.

### Import och granskning

- Återanvänd det avgränsade läsande legacy-API:t och befintlig import-/widget-/mediapipeline. Ytterligare innehåll kräver uttryckliga API-resurser, inte SQL, godtyckliga modellfrågor eller en ny generell integrationsplattform.
- Objektsdefinitioner och godkänd taxonomi förbereds separat genom stödda arbetsflöden. Importen validerar kontrakten men skapar eller reparerar inte definitioner i smyg.
- Beständig källidentitet omfattar källsystem, webbplats/tenant, modell och original-ID. Slug eller titel används inte ensamt som importidentitet.
- Bevara separat visningsdatum, källdatum och verkliga publicerings-/utgångstider. Importdatum får inte ersätta historiskt visningsdatum. Befintliga utgångna poster återpubliceras inte.
- Publicerad innehållsversion importeras; inskickade ändringar i exempelvis evenemangens `draft` får inte ersätta den. Aktivering sker separat efter granskning och med bevarade tidsgränser.
- Bevara källhänvisning och mappning för HTML, media, bilagor, klassificering och gamla URL:er. Saknade filer och otolkbara datum rapporteras; de får inte försvinna eller ersättas med påhittade värden.
- Kontaktuppgifter för handläggning, interna organisationsnamn, kontouppgifter och medlemsbehörigheter blir inte publika objektfält genom importen. Bild-/licensinformation bevaras där den finns.
- Säker HTML omformas till befintliga widgetar med bevarad semantisk ordning. Temakod, navigation, gamla sidospalter, skript och layoutinställningar överförs inte som innehåll.
- Import skrivs först till granskning i målmiljön. Befintliga redaktionellt ändrade v4-objekt flaggas som konflikter vid omkörning i stället för att skrivas över.
- Varje körning har fryst urval, mappningsversion, kodversion och beständiga kontrollpunkter. Källändring under en körning ger avvikelse eller ny körning, inte en tyst blandning av olika underlag.
- Slutrapporten redovisar varje inventerad post som importerad, manuell/blockerad eller exkluderad med orsak. Inget innehåll raderas från legacy.

## Acceptance Criteria

- En gemensam lista blandar nyheter och krönikor med korrekt global datumordning och paginering. Filter för Nyhet omfattar Pressmeddelande och kan utesluta Krönika.
- De fem måltyperna går att importera från ett representativt granskat urval med korrekta filer och relationer.
- Saknade skribenter, oklara datum, privata uppgifter, dubblettkandidater och filfel finns i åtgärdsrapporten och orsakar ingen tyst publicering eller informationsförlust.
- Gamla URL:er mappas till rätt mål trots slugkollisioner mellan nyheter och krönikor. Importerade interna länkar kan avstämmas även mot innehåll utanför denna import.
- Avbrott/återupptagning och upprepade körningar skapar inte dubbla objekt, versioner, termer, tilldelningar eller media. Manuella ändringar i v4 skyddas.
- Avstämningen visar bevarade källidentiteter, antal, författarkopplingar, klassificeringstilldelningar och filreferenser för varje godkänd post.
- Proceedings och framtida medlems-/externanvändarfunktioner har inte blivit beroenden för denna leverans.

## Constraints

- PRD-0031 måste vara verifierad för de klassificeringsfunktioner importen använder; pågående kod är inte bevis på färdig funktion.
- PRD-0012 och PRD-0021 är låsta. Den nya artikelinriktningen dokumenteras här och i ADR-0046 utan att deras historiska krav skrivs om.
- Först lokalt och staging. Produktionsåtkomst, API-driftsättning, import och publicering följer separata ägargater enligt AGENTS.md.
- Källvärden och personuppgifter hör inte hemma i Git; dokumentationen innehåller regler och sammanställda resultat, inte databasexporter.

## Implementation Notes

- 2026-10-22: Ägaren valde gemensam Artikel med innehållsslag via klassificering samt import av publicerat innehåll inklusive arkiv. Utkast och avpublicerat innehåll inventeras men undantas från automatisk import. Implementation av denna PRD har inte startat.
- Detaljerad fältmappning, undantag och leveransordning finns i [PLAN-0004](../plans/0004-simplified-legacy-content-import.md).

## Linked ADRs

- [ADR-0046](../adrs/active/0046-unified-articles-and-bounded-legacy-import.md)
- [ADR-0043](../adrs/active/0043-classification-governance.md)
- [ADR-0025](../adrs/active/0025-authenticated-legacy-migration-api.md)

## Completion Evidence

- Planering och dokumentation finns. Inga nya importverktyg eller datakörningar har genomförts för denna PRD.

## Implementation notes — 2026-10-22

Implementation started in the isolated `codex/legacy-import-dev` workspace. The five definitions are installed in tenant `legacy-import-dev`; 100 real public legacy News records are imported as draft Articles. Definition export/diff is repeatable, and per-item import checkpoints protect manual destination edits. See [operator guide](../../docs/legacy-editorial-import.md) and [ADR-0047](../adrs/active/0047-portable-editorial-definitions-and-draft-import.md).

Status remains in-progress: the deployed source exposes only the old News API. The six-resource source extension is implemented and tested in the separate legacy repository but not deployed. Real mixed News/Column samples, remaining object types, inventory reconciliation, proceedings exclusions, staging rehearsal, public rendering/URL cutover and production execution are not accepted by this dev exercise.

### Source-contract preparation

The v4 preflight now supports read-only inventory counts (`--inventory`) for all declared source resources. The adapter rejects duplicate/out-of-order IDs, site drift and unrequested columnist dependencies. A focused isolated database test covers all six source resources mapping to the five destination types, ordered external attachments and idempotent reimport. Old News compatibility samples cannot approve a full import. These are fixture-based checks; real multi-type acceptance still depends on the separately owned legacy extension and deployment.

## Additional implementation decision

[ADR-0049](../adrs/active/0049-transaction-safe-legacy-media-repairs.md) supersedes ADR-0022: repaired placeholders retain their media ID and adopt a content-addressed file path, preserving old bytes if the import transaction rolls back. Existing literal URLs require explicit refresh; old blobs are retained.
