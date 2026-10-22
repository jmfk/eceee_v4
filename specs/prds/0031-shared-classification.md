---
id: PRD-0031
title: Gemensamt klassificeringssystem
status: in-progress
locked: true
created: 2026-10-22
related_adrs:
  - ADR-0043
  - ADR-0046
---

# PRD-0031: Gemensamt klassificeringssystem

## Problem

Sidor, objekt och media behöver samma tenant- och namespace-avgränsade register med hierarki, behörigheter och moderering. PRD-0004 är avslutad och bevaras oförändrad.

## Requirements

# Gemensamt klassificeringssystem för ECEEE v4

## Mål och beslut

Bygg vidare på befintliga `taxonomy` så att nyheter, andra innehållsobjekt, sidor, mediafiler och mediasamlingar använder samma klassificeringsregister. Första kompletta leveransen omfattar hierarki, rättigheter, moderering, flytt, sammanslagning, arkivering och övergång från befintliga taggsystem.

Följande är beslutat:

- Första nivån är klassificeringstyp; under den finns hierarkiska termer.
- Registret delas inom samma tenant och namespace. Varje klassificeringstyp anger vilka innehållstyper den får användas för.
- Rättigheter avgör vem som får genomföra en ändring direkt och vem som måste lämna förslag.
- Godkända namn och hierarkier gäller direkt även för publicerat innehåll. Tilldelningar följer sidans eller objektets version.
- Föreslagna nya termer får kopplas till utkast men måste godkännas eller tas bort före publicering.

Detta genomförs inom befintlig Django/React-arkitektur. Ingen separat tjänst behövs.

## Gemensam modell och regler

**Klassificeringstyper och termer**

- Inför en definition för klassificeringstyp med stabil identitet, namn, beskrivning, sorteringsordning och tillåtna användningsområden: sidor, mediafiler, mediasamlingar och valda objekttyper.
- Utöka befintliga UUID-baserade `taxonomy.Tag` med klassificeringstyp, förälder, status, alternativa namn och revisionsnummer. Behåll befintliga UUID:n.
- Varje term har högst en förälder, inom samma typ, tenant och namespace. Förhindra cirklar. Flytt mellan klassificeringstyper ingår inte i första versionen.
- Behåll unik slug inom tenant, namespace och klassificeringstyp. Namn och plats kan ändras utan att identiteten ändras.
- Alla klassificeringstyper tillåter flera tilldelningar i första versionen. Föräldrar tilldelas inte automatiskt.
- Sökning matchar namn och alternativa namn. Filtrering kan inkludera underordnade termer; detta är standard för hierarkiska filter och kan stängas av.
- Behåll nyhetsklassificeringens fem betydelser som separata typer vid överföringen: typ, kategori, källa, ämne och nyckelord. Befintliga vanliga taggar hamnar under *Allmänt*. Ingen automatisk semantisk sammanslagning.

**Tilldelningar**

- Använd explicita databasrelationer till sidversioner, objektversioner, mediafiler och mediasamlingar. Bevara tilldelningsordning och förhindra dubbletter.
- Publicering och kopiering av versioner hanterar klassificering tillsammans med övrigt versionsinnehåll.
- En terms användning på en artikel och på dess bilder är oberoende.
- Arkiverade termer visas på befintligt innehåll men kan inte väljas för nya tilldelningar. Oförändrade äldre tilldelningar får följa med när innehåll uppdateras.
- AI-förslag och widgetarnas interna sökord blir inte automatiskt godkända klassificeringar.

**Flytt, sammanslagning och arkivering**

- Flytt behåller termens identitet och tilldelningar; underträdet följer med.
- Sammanslagning sker endast inom samma typ och namespace. Källtermen behålls med hänvisning till måltermen; läsning och filtrering löser hänvisningen och visar inga dubbletter.
- Källtermens barn flyttas till måltermen. Sammanslagning till en egen underordnad term avvisas.
- Äldre namn och legacy-identiteter förblir sökbara och spårbara. Befintliga versionsrelationer behöver inte skrivas om.
- Förhindra arkivering av en term med aktiva barn tills barnen flyttats eller arkiverats.
- Ingen fysisk radering i första versionen. Registrera före/efter-läge för återställning; återställning avvisas med tydlig konflikt om berörda uppgifter har ändrats sedan operationen.

## Behörighet, moderering och gränssnitt

**Rättigheter**

Inför rättigheter per klassificeringstyp för att använda, föreslå, skapa, redigera, flytta, slå ihop, arkivera/återställa, godkänna/avslå och administrera.

- Rättigheter tilldelas namngivna användare inom tenant och namespace. Gränssnittet erbjuder rollmallarna användare, förslagsställare, förvaltare och administratör; rättigheterna är det som styr.
- Befintliga tenantmedlemmar får använda och föreslå. Tenantägare och superuser får administrera; ingen annan får automatiskt strukturändringsrättigheter.
- Godkännande kräver både godkännanderättighet och rättighet för den föreslagna åtgärden.
- Klassificeringsrättigheter ger aldrig rätt att redigera själva innehållet.
- Alla kontroller sker på servern, även vid import, bulkåtgärder och äldre API-anrop.

**Moderering**

- Förslag kan gälla ny term, ändrade uppgifter, flytt, sammanslagning eller arkivering.
- Förslag har status väntande, godkänt, avslaget eller återkallat. Befintliga termer ändras först när förslaget godkänts.
- Godkännande kontrollerar aktuella rättigheter och revisioner på nytt och genomför ändringen atomiskt. Föråldrade förslag kräver omprövning.
- En föreslagen ny term får en stabil identitet som utkast kan referera till. Publicering blockeras med ett konkret fel om tilldelningen fortfarande är föreslagen eller har avslagits.
- Media saknar motsvarande publiceringsflöde: där får användaren föreslå termer separat, men endast godkända termer får bli aktiva tilldelningar.
- Historiken visar aktör, tid, åtgärd, före/efter, förslagsställare och eventuell beslutsmotivering. Moderering sker i en kö i appen; mejlnotifieringar ingår inte.

**Gränssnitt**

Ersätt den befintliga tagghanteringssidan med *Klassificering*:

- Träd med klassificeringstyper överst, gemensam sökning och detaljvy för vald term.
- Användningsöversikt med antal och länkar begränsade till innehåll användaren får se.
- Modereringskö med tydlig jämförelse av föreslagen ändring.
- Återanvändbar väljare i sidredigerare, objektredigerare och mediahantering. Visa namn och sökväg samt skilj väntande förslag från godkända termer.
- Flytt och sammanslagning visar konsekvenser före genomförandet; lyckade ändringar erbjuder Ångra när återställning fortfarande är möjlig.
- Följ befintligt tema och dina UI/UX-principer: vanliga navigerbara vyer, tangentbordsstöd och fel vid den berörda handlingen.

## API, integration och införande

**API**

- Inför `/api/v1/taxonomy/` för klassificeringstyper, termer, förslag, rättigheter och historik.
- Listor är paginerade och sökbara. Separata åtgärder hanterar flytt, sammanslagning, arkivering, återställning och modereringsbeslut.
- API:t använder stabila UUID:n och explicita revisioner för ändringar. Konflikter returneras utan delvis genomförda ändringar.
- Lägg till `classificationIds` i befintliga sid-, objekt- och media-API:er, med uttrycklig mappning till Python-fält.
- Gamla API-kontrakt behålls genom adaptrar under övergången. Gamla skrivvägar måste använda samma behörighets- och modereringsregler; de får inte kringgå dem.

**Arbetsordning**

1. Skapa en ny PRD och tillhörande ADR:er i `/specs`. Bevara den avslutade PRD-0004 oförändrad och komplettera tidigare taxonomibeslut med det nya slutläget.
2. Implementera modell, regler, behörighet och moderering med fokuserade backendtester.
3. Implementera administration och gemensam väljare; anslut sidor, objekt och media.
4. Anpassa nyhetsimport, filter, listwidgetar, versionskopiering och överföring mellan miljöer.
5. Kör överföring och avstämning lokalt, därefter i staging. Byt till gemensamma läsningar först när avstämningen godkänts.

Överföringen ska vara idempotent och återupptagbar, med databaslagrade kontrollpunkter, stabila arbetsenheter och kontroller av källunderlag och konfiguration. Bevara gamla data och mappningar. Under övergången gäller en uttrycklig källa per fas: först befintliga fält med atomisk spegling, sedan taxonomin med kompatibilitetsadaptrar.

Gamla tabeller och de fem nyhetsklassificeringarnas definitioner tas inte bort i denna leverans. Produktionskörningar och driftsättning kräver repositoryts separata ägargodkännanden.

## Verifiering och acceptans

- Testa hierarkier, cirkelskydd, namnbyten, flytt, sammanslagning, arkivering och återställningskonflikter.
- Testa varje rättighet och nekad åtkomst över tenant-, namespace- och typgränser, inklusive äldre API:er och bulkvägar.
- Testa förslag, revisionskonflikter och publiceringsspärr samt att utkast inte ändrar publicerade tilldelningar.
- Testa samma term på nyhet, annan objekttyp, sida, mediafil och mediasamling; verifiera oberoende tilldelningar och korrekta filter.
- Testa nyinstallation, uppgradering, avbrott/återupptagning, upprepad överföring och oförändrade legacy-kontrakt.
- Kör fokuserade Django- och Vitesttester under utvecklingen. Samla integrationskontroll och granskning av migrationerna till en gemensam slutkontroll.
- Leveransen är klar när redaktörer kan klassificera alla fem innehållsslagen, förslagsställare kan följa sina förslag, behöriga kan förvalta trädet och avstämningen visar att befintliga taggkopplingar har bevarats.

## Implementation Notes

- 2026-10-22: Implementation started in separate local work on the existing taxonomy expansion. Legacy storage remains authoritative until a separately verified reconciliation and cutover.
- 2026-10-22: [PRD-0034](0034-simplified-legacy-content-import.md), [ADR-0046](../adrs/active/0046-unified-articles-and-bounded-legacy-import.md) och [PLAN-0004](../plans/0004-simplified-legacy-content-import.md) beskriver den förenklade innehållsimporten som konsument av klassificeringen. Nyhet och Krönika blir gemensam Artikel; en obligatorisk innehållsslagstilldelning valideras av artikelkonsumenten. De fem befintliga nyhetsdimensionernas betydelser bevaras enligt denna PRD, och redaktionella förenklingar kräver granskad mappning. Kraven ovan ändras inte.

## Linked ADRs

- [ADR-0043](../adrs/active/0043-classification-governance.md)
- [ADR-0046](../adrs/active/0046-unified-articles-and-bounded-legacy-import.md)

## Completion Evidence

- Klassificeringens implementation pågår i separat lokalt arbete. Denna dokumentations-PR innehåller ingen applikationskod och gör inga påståenden om genomförd rollout. Verifierad läsarövergång och stagingacceptans återstår.

## Import integration evidence — 2026-10-22

The isolated editorial-import workspace includes the classification service, ordered object assignments, publication checks and compatibility adapters needed by PRD-0034. See [ADR-0047](../adrs/active/0047-portable-editorial-definitions-and-draft-import.md) and [dev operator guide](../../docs/legacy-editorial-import.md). Focused assignment, governance and legacy-adapter tests pass. This is not evidence that production taxonomy backfill or the complete media/page UI rollout has been accepted.
