---
id: PLAN-0006
title: Django-fri HTTP-pilot för widgetkontrakt
status: proposed
date: 2026-10-27
related_prds:
  - PRD-0028
---

# PLAN-0006: Django-fri HTTP-pilot för widgetkontrakt

## Mål och nuläge

Nästa leverans ska visa att de gemensamma widgetkontrakten fungerar genom ett riktigt HTTP-gränssnitt och den befintliga React-klientens kontraktsanrop. Samma scenario ska ge samma observerbara resultat i Django och kandidaten. Detta är en föreslagen implementationsplan; denna PR innehåller inga runtimeändringar och redovisar ingen ny körd paritetsverifiering.

[PR #263](https://github.com/jmfk/eceee_v4/pull/263) etablerade den gemensamma katalogen och modellerna. Node kan generera manifestet utan Django och jämföra schema, defaults, UI-metadata och validering för Headline, Banner, TwoColumns och Forms, inklusive FormField. Den befintliga transportadaptern är en direkt funktionsjämförelse, inte en HTTP-server. Dess anonyma fixtures bevisar inte autentisering.

Utgå från [PRD-0028](../prds/0028-framework-independent-content-contract.md), [PLAN-0003](0003-django-parity-verification.md), [ADR-0041](../adrs/active/0041-shared-widget-contract-source.md) och [paketets avgränsningar](../../backend/widget_contracts/README.md). PRD:ns låsta krav ändras inte. Planen föreslår en isolerad jämförelsekandidat inom dessa gränser, inte byte av det publika API:t eller auktoritativ validator.

## Leverans och ägande

Bygg en liten HTTP-adapter runt `backend/widget_contracts`, med Node:s befintliga standardbibliotek som förstahandsval. Återanvänd deklarationerna och utvärderaren; kopiera inte referenssvar till servern. Ett större backendramverk, ny identitetsplattform eller generell proxy ingår inte. Dokumentera det slutliga transport-/säkerhetsbeslutet i en länkad ADR när implementationen beslutas.

| Yta | Kandidatens omfattning | Ägare efter piloten |
| --- | --- | --- |
| `GET /api/v1/webpages/widget-types/{type}/schema/` | Fyra pilottyper, etablerade identifierare och alias | Django i ordinarie drift |
| `GET /api/v1/webpages/widget-types/{type}/configuration-defaults/` | Samma defaults och schema | Django i ordinarie drift |
| `GET /api/v1/webpages/widget-types/{type}/config-ui-schema/` | Samma UI-metadata och fältordning där ordningen är betydelsefull | Django i ordinarie drift |
| `POST /api/v1/webpages/widget-types/{type}/validate/` | Samma parsning, normalisering och valideringsfel för pilotens typer | Pydantic auktoritativ i ordinarie drift |
| Rendermanifest | Befintlig Node-generering och bytejämförelse; inget nytt publikt endpoint krävs | Gemensam statisk katalog |
| Övriga typer och temabundna widgets | Ingen ersättning; inventera klientberoenden och behåll befintliga anrop | Befintlig Django-/temaimplementation |
| Inloggning, tenantval, behörighet, lagring och publicering | Oförändrade verkliga flöden | Django |

Formulärdefinitioner omfattas; mottagning av formulärsvar, notifieringar och externa anrop gör det inte. Ingen databasmigration, ändring av persistenta data eller driftsättning ingår.

## Säker testgräns

Kandidaten ska endast vara åtkomlig i den isolerade testmiljön och sakna produktionskoppling. Använd det befintliga pilotverktygets privata nätverk utan publicerade hostportar; om en lokal hostport behövs ska den reserveras via `port-space-registry`. Provisionera inga tjänster i denna planerings-PR.

HTTP-fallen behöver en explicit syntetisk testidentitet för accepterade anrop och separata fall utan eller med ogiltig testidentitet. Den mekanismen ska hållas i testharnessen, neka som standard och aldrig aktiveras genom en klientstyrd `anonymous: false`-flagga eller påstådd tenantheader. Den ersätter inte Django-sessioner, CSRF eller tenantbehörigheter. Exakt mekanism och nätverksisolering ska granskas före implementationens första HTTP-körning.

Testa verklig session, CSRF och tenantavslag separat genom Django. Hela klientresan ska fortsätta gå genom Django för dessa gränser. Flytta inga skyddade metadataanrop i ordinarie drift innan riktig autentisering och auktorisering har implementerats och verifierats i en separat etapp. Ett avslag från testharnessen får aldrig redovisas som bevis för produktionssäkerhet.

## Arbetsordning

1. **Lås referensen.** Börja från aktuell `main`, notera exakt commit och jämför med de befintliga frysta fallen. Inventera frontendens kontraktsanrop, nästlade modelluppslag och typalias. Föreslå inga tysta fixtureuppdateringar vid drift: redovisa orsaken och granska varje ändrad förväntning innan referensen uppdateras.
2. **Implementera HTTP-gränsen.** Lägg till adaptern och fokuserade tester för JSON-parsning, status, svar, metod- och routningsfel, innehållstyp och avslagsbeteende. Sätt explicita gränser för requeststorlek och tid samt kontrollerad avstängning. Okända och ej stödda typer ska ha dokumenterat utfall; de får inte tyst använda en annan modell.
3. **Utöka jämföraren.** Återspela samma scenarioindata via riktiga HTTP-anrop mot en isolerad Django-referens och Node-kandidat. Återanvänd fallformat och strikt jämförelse, men observera faktiska serversvar. Rapportera testidentitetens avgränsning separat. Kör manifestkontrollen och direktjämförelsen som kompletterande bevis.
4. **Koppla klientens testharness.** Låt endast de inventerade pilotkontraktsanropen gå till kandidaten i testmiljön. Övriga anrop använder Django. Routing ska vara explicit och observerbar; ett kandidatfel får inte döljas genom automatisk fallback. Ingen ändring av ordinarie frontendkonfiguration eller publika rutter ingår.
5. **Verifiera och rapportera.** Kör fokuserade tester under arbetet, därefter en samlad pilotkörning med HTTP-jämförelse och berörd React-/webbläsarresa. Dokumentera varje kvarvarande skillnad och lucka. Samla adapter, runner, klientkoppling, tester och nödvändig dokumentation i en implementations-PR.

## Testmatris och acceptans

Alla rader nedan är planerade, inte redan godkända. Behåll baslinjens oberoende förväntningar så att två adaptrar med samma fel inte räcker för att få grönt.

| Område | Obligatoriska fall och bevis |
| --- | --- |
| Befintliga kontrakt | Återspela de 51 frysta API-fallen över HTTP där de gäller och kontrollera hela manifestet separat. Inget fall får tappas; markera uttryckligen vilka avslagsfall som bara prövar testharnessen. |
| Modellvärden | Samma schema, defaults, UI-metadata, alias, saknat/null/tomt, extra fält, nästlade FormField och giltiga/ogiltiga värden. Återanvänd den direkta 714-konfigurationsmatrisen som komplement; den är inte ensam HTTP-bevis. |
| HTTP och klientfel | Okänd typ/rutt, fel metod, tom eller trasig JSON, fel innehållstyp, för stor kropp, avbrutet anrop och timeout. Jämför relevanta statuskoder, JSON-fel och headers mot referensen; dokumentera säkerhetsgränser som medvetet avviker. |
| Identitet och gränser | Kandidaten nekar saknad/ogiltig testidentitet och kan inte nås utanför testnätet. Verkliga Django-sessioner, CSRF och tenantfall körs separat. Blanda inte deras resultat med kandidatens säkerhetsbevis. |
| React och webbläsare | Hämta schema/defaults/UI-data, ändra och validera samtliga fyra typer, visa och återhämta valideringsfel. Observera att anropen faktiskt når kandidaten; inga mockade kontraktssvar får ersätta detta bevis. |
| Spara och rendering | I samma testresa: spara via Django, ladda om och fortsätt redigera; kontrollera korrekt sparad preview och oförändrad publicerad snapshot på desktop/mobil. Detta verifierar hybridresan, inte Django-fri lagring. |
| Omfattning och drift | Övriga widgettyper och temabundna revisioner fortsätter använda befintliga ägare. Inga oavsiktliga API-, lagrings-, revisions- eller publiceringsändringar. |

**Godkännande kräver inga oförklarade skillnader och inga överhoppade, blockerade eller instabila obligatoriska scenarier.** Kända brister ska namnges, inte normaliseras bort. Headline-API:ts befintliga `headerLevel`-avvikelse ska fortsatt karakteriseras; en rättning kräver separat granskad beteendeändring och baslinjerevision. En säkerhetsbrist får inte kopieras enbart för paritet.

Jämför JSON semantiskt men behåll betydelsefull listordning, saknade fält, casing och fel. Tillåt endast den befintliga dokumenterade normaliseringen samt uttryckligen granskade miljöfält, exempelvis test-origin; lägg inte till generell bortfiltrering. Jämför inte transportens slumpmässiga eller tidsberoende headers som produktdata.

## Körning, rapport och CI

Utöka befintliga `scripts/pilot_baseline.py` och dess tester i stället för att bygga ett separat testplattformssystem. Bestäm och dokumentera det nya HTTP-lägets faktiska kommando i implementations-PR:n; dagens `--candidate-contracts` är fortfarande en direkt kontraktsjämförelse och ska inte beskrivas som HTTP-paritet.

Rapporten ska ange referens-/kandidatcommit, testdataversion, runtimeversioner, kommandon, faktiska HTTP-mål, scenarioidentiteter och antal godkända/misslyckade/överhoppade. Redovisa HTTP-diffar, klientspår vid fel, testidentitetens begränsningar och återstående Djangoägda flöden. Inga autentiseringsvärden eller verkliga kunddata får hamna i rapporterna.

Använd en separat delstatus för HTTP-kontrakt och för hybridklientresan. Behåll `candidateParity: not_supplied` för en komplett ersättningsbackend. Gröna kontrakts- eller hybridtester innebär inte att Django kan stängas av.

Fokuserade adapter-/runner-/klienttester hör hemma i snabb lokal återkoppling. Den samlade HTTP-/PostgreSQL-/webbläsarpiloten ska ingå i befintlig explicit Full CI inför implementations-PR:ns merge enligt [CI-reglerna](../../docs/ci.md). Denna dokumentations-PR behöver bara specs-/länkkontroll och diffkontroll lokalt; inga applikationstester bevisar något nytt här. Full CI krävs fortfarande enligt repositoryts mergegate innan ägarens mergebeslut efterfrågas.

## Stoppvillkor och följande etapp

Stoppa byte av berörd runtime vid okartlagda klientberoenden, förlorade funktioner, säkerhetsluckor eller oförklarade diffar. Avbryt kandidaten och återställ testharnessens routing till Django för att återgå; ordinarie drift har inte ändrats och ingen datarollback behövs.

Efter verifierad HTTP-pilot: planera ett separat komplett spara–ladda-flöde med riktig identitet, tenantkontroll, revisionskonflikter och separata syntetiska databaser enligt PLAN-0003. Den etappen kräver egen granskad plan och riskbedömning. Denna PR varken implementerar eller godkänner en sådan överflyttning.
