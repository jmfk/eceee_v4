---
id: PLAN-0003
title: Verifiera bibehållen funktion vid avveckling av Django
status: proposed
date: 2026-10-21
related_prds:
  - PRD-0027
---

# PLAN-0003: Verifiera bibehållen funktion vid avveckling av Django

## Kravet

**Ingen del av Django får tas bort från ett stött flöde förrän ersättaren har verifierats mot en dokumenterad funktionsbaslinje för hela den delen.** Samma sidor ska inte bara kunna visas: redigering, felhantering, rättigheter, sparat innehåll, samtidighet, versionshistorik och bakgrundseffekter ska bevaras.

Detta preciserar ägarens krav från 2026-10-21 på att kunna testa och verifiera att funktionalitet inte försvinner. Det flyttar första arbetet i [PLAN-0002](0002-django-exit-investigation.md) till att etablera verifieringen **innan** implementation flyttas. Planen är ingen körd verifiering eller garanti om oupptäckta fel.

## Första leveransen: en körbar baslinje

1. Frys en referenscommit, versionssatta testdata och förväntade resultat för de fyra pilotwidgetarna. Utgå från denna utrednings bascommit, men uppdatera referensen mot den granskade version som faktiskt ska ersättas innan kodflytten börjar. Samordna då det parallella arbetet med temabundna widgets.
2. Gör en funktionsmatris för den berörda delen: funktion, användarroll/tenant, indata/tillstånd, förväntat resultat, automatiskt scenario, eventuell manuell kontroll och senaste verifieringsstatus. Börja med pilotens hela kontrakt; inventera övriga områden innan respektive etapp flyttas.
3. Kör de relevanta befintliga testerna mot referensen och komplettera luckorna. Dokumentera befintliga fel i stället för att anta att alla tester redan passerar. Klassificera förväntat beteende utifrån accepterade produktkrav, inte genom att okritiskt kopiera varje historisk bugg.
4. Skapa ett gemensamt testfallformat för indata och förväntat utfall, med små adaptrar för referens och kandidat. De adapteroberoende scenarierna ska kunna köras mot båda implementationerna. Undvik ett nytt generiskt testplattformssystem.
5. Visa en första rapport från referenskörningen, inklusive vilka jämförelser som ännu saknar en kandidat. **Referens godkänd** är inte samma status som **ersättare verifierad**.

Först därefter flyttas katalogen och pilotens schemaimplementation enligt PRD-0027. Den större API-porten följer samma metod.

## Vilka jämförelser som krävs

### Samma scenario, separata skrivmiljöer

Referens och kandidat ska få samma syntetiska startdata i två isolerade PostgreSQL-databaser. Återspela samma steg mot var och en och jämför efter varje relevant steg. Kör aldrig samma muterande scenario mot en gemensam databas: det kan påverka den andra implementationen och ge falsk paritet. Använd isolerade lagringsprefix och testdubblar för externa mejl, webhooks och leverantörsanrop.

Återanvänd projektets testinfrastruktur där den passar. Om databaser, roller eller lokala hostportar behöver läggas till gäller instruktionerna för shared-local-services och port-space-registry; den här planen provisionerar inget. Produktionsdump, verkliga formulärsvar och autentiseringshemligheter ska inte vara testfixturer.

### Jämför både kontrakt och effekter

- **API:** status, svarsschema, fältnamn/casing, defaults, validering, konfliktpayload och autentisering/auktorisering. Felformatet måste fungera för den verkliga klienten.
- **Lagring:** värden, relationer, widgetidentiteter, ordning, versioner/revisioner och relevanta auditfält. Kontrollera även att inga oavsiktliga rader i berört aggregat eller annan tenant ändras.
- **Sidoeffekter:** vilka jobb, lagringsoperationer och notifieringar som skapas, när de blir synliga och hur de beter sig vid rollback och omkörning. Jobb får återförsökas utan dubblerad avsedd effekt; anta inte att de exekveras exakt en gång.
- **Webbläsare:** samma användarresa i befintlig React-klient, inklusive fel och återhämtning. Ett lyckat API-svar räcker inte om klienten inte kan läsa eller fortsätta redigera resultatet.
- **Rendering:** meningsfull DOM, innehåll, länkar, media, layout, tillgänglighet och interaktioner på desktop och mobil.

Använd kontrollerad tid i tidsberoende tester, inklusive precis före/på/efter publicerings- och utgångsgränsen samt tidszonsfall. Knyt genererade test-ID:n till logiska fixtureidentiteter om de måste jämföras över databaser. Behåll beviset för alla referensrelationer och versionsval.

All normalisering ska ha en liten explicit tillåtelselista. Exempel är olika test-origin och request-ID. Filtrera inte bort saknade fält, behörighetsfel, revisioner, listordning, brutna tillgångar eller okända widgettyper för att få grönt resultat. Normalisering av signerade test-URL:er måste kompletteras med separata kontroller av signering och giltighet.

## Funktionsmatrisens minsta omfattning

Varje rad nedan är ett område som behöver brytas ned i konkreta scenarier. Tabellen beskriver krav och befintliga startpunkter; inga körningar redovisas som godkända här. Separata, uttryckligen beslutade produktändringar kan få nya förväntningar. En funktion som saknar en motsvarande implementation får inte försvinna tyst.

| Område | Scenarier och observerbara bevis | Befintlig startpunkt |
| --- | --- | --- |
| Widgetkontrakt, första piloten | Alla inbyggda manifesttyper finns kvar. För Headline/Banner/TwoColumns/Forms: giltigt/ogiltigt, saknat/null/tomt, defaults, okända fält, alias, normalisering och nästling ger samma förväntade utfall. | [Manifesttest](../../backend/webpages/tests/test_publisher_manifest.py), [registryparitet](../../frontend/src/rendering/__tests__/registryParity.test.ts), `frontend/src/api/widgetSchemas.js` |
| Render- och redigerartillstånd | Tomt/populerat, gömt/inaktivt där det stöds, barn/slots, arv och ordning, interna/externa länkar, media, lokal interaktion, desktop/mobil. Unsaved editor preview, senast sparad preview och publicerad sida ska använda rätt skilda snapshots. | [PageRenderer](../../frontend/src/rendering/__tests__/PageRenderer.test.tsx), [preview-iframe](../../frontend/src/components/__tests__/PagePreview.iframe.test.jsx), [frame-runtime](../../frontend/src/rendering/__tests__/RenderFrameRuntime.test.tsx) |
| Identitet och tenant | Oinloggad, behörig/obehörig, fel tenant, rätt roll, återkallad/utgången session eller maskinnyckel, scopebegränsningar och tilldelad Designer. Förfalskade tenant-/relations-ID:n får varken läcka data eller skriva. | [Coretester](../../backend/core/tests.py), [auth-/sidresa](../../frontend/e2e/auth-and-pages.regression.spec.js) |
| Arbetskopia och samtidighet | Första Save är atomisk, live ändras inte, revision ökar korrekt, stale write ger konflikt/current snapshot, två samtidiga första Save skapar inte dubbla arbetskopior och oberoende/överlappande ändringar hanteras rätt. | [Kanoniskt sidworkflow](../../backend/webpages/tests/test_page_version_workflow.py), `frontend/src/api/__tests__/versions.test.js` |
| Publicering och historia | Explicit granskad version publiceras. Schemalägg/avbryt/utgå/återställ, slug-/hostnamekonflikt och misslyckad aktivering behåller korrekt liveversion, historia och återhämtningsmöjlighet. | [Sidworkflow](../../backend/webpages/tests/test_page_version_workflow.py), [datumpublicering](../../backend/webpages/tests/test_date_based_publishing.py) |
| Teman, layouts och temawidgets | Designerutkast hålls skilt från publicerat tema; atomisk publicering och restore bevaras. Äldre pinnade typrevisioner fungerar efter ny release, kopiering, arv och överföring. Ingen fallback till senaste typrevision. | [Designer-kontrakt](../../backend/webpages/tests/test_designer_theme_contract.py), [temaversioner](../../backend/webpages/tests/test_theme_versions.py); temawidgettester kartläggs efter integration av parallellt arbete |
| Objektrelationer och navigering | List/detail, filtrering/sortering, tomt/fel/saknat objekt, versionseffektivitet, trädflytt och tenantgränser. Länkar och ärvda widgets fortsätter peka rätt. | [Språkparitet för arv](../../backend/webpages/tests/test_cross_language_parity.py), [publishermodell](../../publisher/tests/model.test.ts), [render-supertest](../../publisher/e2e/renderer-supertest.spec.ts) |
| Media och formulär | Uppladdning, nekad privat åtkomst, ersättning och referenser; säker media-URL. Formulärvalidering, honeypot, rate limit, fel/success-redirect och isolerad lagring. | [Media-API](../../backend/file_manager/tests/test_api.py), [filersättning](../../backend/file_manager/tests/test_replace_file.py), [formulär](../../publisher/tests/forms.test.ts), [formroll mot PostgreSQL](../../publisher/tests/form-db-postgres.test.ts) |
| Import/export och bakgrund | Export/import tur och retur bevarar innehåll och referenser. Avbrott/retry/checkpoint, rollback och dubblerat jobb ger rätt slutresultat. Inget notifieras före commit eller efter avvisad mutation. | `backend/content_migration/tests/`, `backend/webpages/tasks.py`, `backend/object_storage/tasks.py`; täckningen behöver inventeras per jobb |
| Installation och uppgradering | Tom installation och uppgradering av syntetisk äldre databas ger användbart system med bibehållet innehåll, rätt rollgrants och publisherkompatibilitet. Återgång provas utan destruktiv nedmigrering. | `deploy/scripts/tests/`, `publisher/tests/db-postgres.test.ts`; Django-fri migrationskedja återstår att implementera |

De fyra pilotwidgetarna är ett första avgränsat steg. Godkänd pilot bevisar inte att resterande widgettyper eller CMS-områden kan avvecklas.

## Återanvänd tester, men kontrollera vad de bevisar

Det finns redan värdefulla paritetstester. [Summer Study-sviten](../../publisher/e2e/summerstudy-parity.spec.ts) jämför i denna bascommit publishern med den fristående **React-previewn** över 16 rutter, i desktop-/mobilprojekt. [Render-supertestet](../../publisher/e2e/renderer-supertest.spec.ts) använder även Django som jämförelse för deterministiskt innehåll och objekt.

Två ytor som delar samma felaktiga normalisering kan ge samma resultat. Därför behövs också oberoende förväntningar från produktkrav och kända fixtures: exakt innehåll och ordning, rätt versionsval, korrekt rättighetsavslag och frånvaro av otillåtna skrivningar. Gemensam kod eller pixelmatchning ensam bevisar inte funktionell paritet.

De befintliga npm-kommandona är startpunkter för framtida körningar, inte resultat från denna dokumentationsändring:

```sh
# I frontend/; komplettera med den berörda edit-komponentens tester.
npm run test:run -- src/rendering/__tests__/registryParity.test.ts src/rendering/__tests__/PageRenderer.test.tsx
npm run test:run -- src/components/__tests__/PagePreview.iframe.test.jsx src/rendering/__tests__/RenderFrameRuntime.test.tsx

# I publisher/; kräver rätt startade jämförelseservrar och fullständiga testdata.
npm run test:parity
npm run test:supertest
```

Välj fokuserade backendtester för respektive kontrakt. Låsning, SQL, revisioner och isolering måste dessutom provas mot verklig PostgreSQL, inklusive riktiga samtidiga transaktioner; en mock eller SQLite bevisar inte dessa regler. Kör små relevanta kontroller under utvecklingen och en samlad gate för hela den del vars ägarskap ska flyttas.

## Rapport och villkor för att koppla bort en Django-del

Varje verifieringsrapport ska innehålla referenscommit, kandidatcommit, testdataversion, runtime-/databasversioner, exakta kommandon, scenarier, antal godkända/misslyckade/överhoppade, jämförelsediffar och kvarvarande luckor. För webbläsarfel sparas spår och vid visuell skillnad jämförelsebilder. Bevara även första felet vid flaky omkörningar; ett lyckat omförsök får inte dölja instabiliteten.

Matrisens status per konkret scenario är `saknas`, `planerat`, `blockerat`, `godkänt` eller `avsiktlig ändring beslutad`. `Godkänt` kräver aktuell körning för kandidatcommiten; `avsiktlig ändring beslutad` kräver länk till den separata produktändringen och dess nya tester. Kodtäckningsprocent eller ett totalt grönt antal tester ersätter inte denna spårbarhet.

En Django-del får kopplas bort först när:

1. Alla stödda funktioner och deras kritiska normal-, fel-, rättighets- och återhämtningsfall i den berörda delen är kartlagda och verifierade. Även gamla klienter/integrationer som fortfarande stöds ingår.
2. Inga oförklarade skillnader återstår i kontrakt, lagring, rendering eller sidoeffekter. Kända säkerhetsfel får en separat granskad korrigering; osäkert beteende ska inte kopieras enbart för paritet.
3. Inga obligatoriska scenarier är överhoppade, instabila, blockerade eller saknar testdata. Ett undantag innebär att motsvarande funktion och dess Djangoägare får ligga kvar tills luckan är löst.
4. Hela den migrerade resan fungerar med **Django-webb och berörda Django-workers stoppade**. I slutet av avvecklingen ska även bygg, installation, migration och uppgradering fungera med Django frånvarande. Tillfälligt Pythonstöd för fixtures får inte dölja detta.
5. Dränage av gamla requests/jobb, en enda skrivägare och en provad återgång med kompatibla nya skrivningar är verifierade i en disponibel testmiljö. Gå igenom och koppla bort även importer och schemalagda uppgifter som annars kan skriva bakom den nya API-vägen.
6. Verifieringsresultatet gäller samma kandidatcommit som föreslås för övergången. Senare relevanta ändringar kräver ny berörd verifiering. Befintliga separata merge- och produktionsgater fortsätter gälla.

Detta ger konkreta bevis för bevarat beteende inom kartlagt scope. Det gör inte alla tänkbara framtida fel omöjliga; nya upptäckter ska läggas till i matrisen och regressionstestas.

## Status vid upprättande

- Funktionskravet och verifieringsmetoden är dokumenterade; baslinjekörning och jämförelseharness är **inte implementerade eller körda**.
- Befintliga testkällor har undersökts. Inga applikationsresultat hävdas från läsningen.
- Nästa implementationsbatch börjar med den körbara pilotbaslinjen. Kodflytten och byte av auktoritativ validator följer först när den baslinjen går att köra och bedöma.
