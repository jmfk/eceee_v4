---
id: PRD-0028
title: Framework-independent render catalog and widget schema pilot
status: in-progress
locked: true
created: 2026-10-21
related_adrs:
  - ADR-0039
  - ADR-0041
---

# PRD-0028: Framework-Independent Render Catalog and Widget Schema Pilot

## Problem

Den befintliga Next-publishern renderar utan Django vid förfrågningar, men regenerering av den delade renderkatalogen kräver fortfarande Django och Pythonregistret. Redigerarens widgetscheman, defaults och validering ägs också av Python. Detta försvårar en stegvis avveckling av Django och riskerar dubblerade definitioner i nästa backend.

## Goals

- Göra hela befintliga rendermanifestet reproducerbart utan Django eller databas.
- Ge Python och TypeScript samma deklarativa källa för flyttad metadata.
- Bevisa schema- och valideringskompatibilitet för ett litet representativt urval innan fler widgets flyttas.
- Behålla redigerarens beteende, renderresultat, åtkomstskydd och befintliga spar-/publiceringsregler.
- Göra bibehållen funktion verifierbar med en körbar referensbaslinje före kodflytten och samma scenarier mot ersättaren.

## Non-Goals

- Byta CMS-backend, identitetssystem, databas, tabellnamn eller ID-format.
- Flytta sidors skrivrätt eller ändra samtidighets-/publiceringslogik.
- Portera alla Pydanticmodeller, dynamiska datakällor, teman eller layoutredigering.
- Ändra publika HTTP-rutter, ge anonym tillgång till skyddad metadata eller driftsätta något.
- Införa ett generiskt pluginramverk eller ett nytt dokument-/eventlager.

## Users and Use Cases

- En utvecklare ändrar widgetens renderinformation i en källa och regenererar manifestet med Node.
- En redaktör använder Headline, Banner, TwoColumns och Forms genom befintligt skyddat API med samma defaults, fält och valideringsutfall.
- En framtida backend kan konsumera språkoberoende kontrakt och fixturer.

## Requirements

1. Samtliga nuvarande manifestfält ska ha en kanonisk språkoberoende källa. Befintliga widgettyper och nycklar bevaras.
2. Regenerering och stale-check av hela manifestet ska fungera med Node utan installerad Django, backendprocess, databas eller miljöhemligheter.
3. Django och Node ska konsumera samma renderinformation. Manuellt underhållna parallella definitioner för flyttade fält får inte finnas kvar.
4. Piloten ska omfatta schema, defaults och UI-metadata för Headline, Banner, TwoColumns och Forms. Pythonägda kontrakt utanför piloten ska framgå explicit.
5. Referensfixturer ska dokumentera både acceptans/avvisning och normaliserade utdata, inklusive utelämnade värden, `null`, tomma värden, extra fält, alias/coercion och nästlade strukturer.
6. JSON Schema och egna Pydanticvaliderare ska inventeras var för sig. Avvikelser ska lösas eller uttryckligen blockera byte av auktoritativ validator.
7. Befintliga metadata-endpoints ska behålla autentisering, felkoder, datacasing och payloadsemantik. Piloten ska använda explicita adaptrar där Python- och frontendnamn skiljer sig.
8. Manifestets befintliga format ska bevaras om utdata är kompatibla. Nya kontrakt ska ha ett dokumenterat versionsfält och ett enda schemaägande.
9. Befintlig Django/Pydanticvalidering får vara auktoritativ under jämförelsefasen, men pilotens nya validator får inte kallas likvärdig innan fixturerna överensstämmer. Undvik permanent dubbelvalidering med konkurrerande resultat.
10. Den statiska katalogen ska omfatta inbyggda kodwidgetar. Eventuella temabundna widgetdefinitioner ska behålla tenant-/temaägande och pinnade revisioner i databasens temadokument; de får inte läggas i ett globalt byggmanifest. Samordna med det parallella arbetets slutliga kontrakt före implementation.
11. Före kodflytten ska pilotens funktioner och relevanta fel-/rättighets-/återhämtningsfall kartläggas och referensfallen köras mot en fixerad, granskad baslinje enligt [PLAN-0003](../plans/0003-django-parity-verification.md). Befintliga fel och täckningsluckor ska dokumenteras.
12. Samma scenarioindata ska kunna köras mot referens och kandidat. Jämför API-kontrakt, normalisering, lagrat resultat och relevanta sidoeffekter samt redigerar-/preview-/publikt beteende. Muterande jämförelser ska använda separata testdatabaser med samma syntetiska startdata.
13. En jämförelse får normalisera endast dokumenterade, förväntade miljöskillnader. Saknade funktioner, oväntade fält, ordning, revisioner, rättighetsavslag och fel får inte maskeras bort.
14. Pilotens verifiering ska rapportera referens-/kandidatcommit, testdataversion, körkommandon, resultat, skillnader och överhoppade/blockerade scenarier. Inga obligatoriska luckor eller oförklarade skillnader får kvarstå när den berörda Djangoimplementationen tas bort.
15. Godkänd pilot gäller endast pilotens scope. Full avveckling kräver motsvarande funktionsmatris och aktuell verifiering för alla andra stödda områden; en avsiktlig funktionsändring behöver ett separat dokumenterat produktbeslut.

## Acceptance Criteria

- Ett dokumenterat Node-kommando genererar hela rendermanifestet deterministiskt i en miljö utan Django; checkläget upptäcker drift.
- Pythonadaptern och Node-generatorn producerar samma renderdata från samma källa. Alla widgettyper som omfattas av dagens manifest finns kvar.
- Pilotens schema/defaults/UI-data och valideringsutfall matchar fastlagda referensfixturer. Varje oförklarad avvikelse blockerar byte av den berörda implementationen.
- Befintliga registry-/rendererparitetstester och fokuserade kontraktstester passerar. Desktop-/mobilrendering kontrolleras för pilottyperna när renderdata flyttas.
- En redaktör kan öppna, ändra, spara och förhandsvisa pilottyperna. Save påverkar fortfarande inte den publicerade versionen.
- Dokumentationen anger vad som är Django-fritt och vilka runtime-/byggberoenden som återstår.
- Den körbara referensbaslinjen har etablerats före kodflytten. Samma kritiska pilotfall är därefter godkända mot kandidaten och dokumenterade per scenario; inget obligatoriskt fall är överhoppat eller dolt av normalisering.
- Sparade pilotdata kan laddas och redigeras igen, och rätt preview-/publicerad snapshot används. Inga oavsiktliga ändringar av relationer, ordning eller revisions-/publiceringsdata har tillkommit.

## Constraints

- [ADR-0002](../adrs/active/0002-single-page-workflow-mutation-boundary.md), [ADR-0003](../adrs/active/0003-tenant-membership-authorization.md), [ADR-0015](../adrs/active/0015-revision-based-page-collaboration.md) och [ADR-0033](../adrs/active/0033-widget-editor-session-and-field-ownership.md) fortsätter gälla.
- Behåll rena kontrakt och tydliga adaptrar; inför ingen spekulativ plattform.
- Dokumentera det antagna källägandet och valideringsansvaret i en projekt-ADR när implementationen beslutas. Denna draft antar inget nytt backendserverspråk.

## Implementation Notes

- 2026-10-21: Utkast från [PLAN-0002](../plans/0002-django-exit-investigation.md). Implementation har inte påbörjats.
- 2026-10-21: Utkastet kompletterat med ägarens krav på verifierat bibehållen funktion. [PLAN-0003](../plans/0003-django-parity-verification.md) beskriver baslinje, jämförelsemodell och villkor för avveckling. Ingen verifieringskod har implementerats eller körts.
- 2026-10-21: Implementation av enbart testbaslinjen påbörjad i separat worktree `django-pilot-baseline`, branch `codex/django-pilot-baseline`. Kraven är nu låsta; katalog-/validatorflytten ingår inte i denna batch.
- 2026-10-21: Testbaslinjen implementerad och lokalt körd med 51 frysta DRF-fall, katalogdigest, 6 backendtester på PostgreSQL 17, 11 React-tester och 6 Chromium-fall på desktop/mobil. Fristående jämförare och 4 tester av regressions-/rapportspärrar tillagda. Se [körinstruktionerna](../../backend/webpages/tests/fixtures/pilot_baseline/README.md).

- 2026-10-21: Shared widget contract pilot implementation started in `codex/widget-contract-pilot`. [ADR-0041](../adrs/active/0041-shared-widget-contract-source.md) records source ownership and comparison-only Node validation.

## Linked ADRs

- [ADR-0039](../adrs/active/0039-frozen-pilot-behavior-baseline.md): frysta kontrakt, isolerad referenskörning och separat kandidatstatus.

- [ADR-0041](../adrs/active/0041-shared-widget-contract-source.md): shared render/model declarations, Node generation and Pydantic-authoritative runtime adapter.

## Completion Evidence

- 2026-10-21: `python3 scripts/pilot_baseline.py run --output /tmp/eceee-pilot-baseline-verified` passerade alla obligatoriska baslinjekontroller; inga överhoppade eller flaky fall. Status `passed_with_known_reference_issues`: befintlig Headline-casingavvikelse är dokumenterad, inte korrigerad eller godkänd för en ersättare.
- 2026-10-21: `python3 -m unittest discover -s scripts/tests -p test_pilot_baseline.py -v` passerade 4 tester. Black, isort, flake8 för berörda backendfiler, fokuserad frontend-ESLint, CI-YAML, specs-validering och lokala dokumentlänkar passerade.
- Baslinjen kördes lokalt på implementationsarbetskatalogen före commit; rapporten redovisar föräldra-HEAD och `workingTreeDirty: true`. Referensproduktkoden är oförändrad från `9da0eb18451db16f5b8406f1c0c6c5a4f108483d`. Katalog-/validatorflytt och verifiering av en Django-fri kandidat återstår.
- Inför merge uppdaterades referensen uttryckligen till `e80248dc4588ef90bcb6c7ef5b2d84759de9d16a` för redan mergade Banner-outline-kontrakt. Fixture-README dokumenterar skillnaderna. Dokumentidentiteterna blev PRD-0028 / ADR-0039 för att undvika kollision med mains PRD-0027 / ADR-0036; kravtexten är i övrigt oförändrad.

- 2026-10-21: Shared contract pilot verified: Node reproduced all 25 manifest entries byte-for-byte and matched 51 frozen API cases plus catalog with zero differences. Django consumes the same model declarations; the expanded 129-test PostgreSQL/widget/theme/error-page gate, 714 direct Node/Pydantic configurations, 11 React tests, 6 Chromium tests and 9 Node / 9 runner tests passed without mandatory skips. See [package evidence and boundaries](../../backend/widget_contracts/README.md). Node remains comparison-only; no replacement backend, authoritative validator cutover or production deployment is claimed.
