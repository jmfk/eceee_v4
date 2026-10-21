---
id: PLAN-0002
title: Utredning om att avveckla Django
status: investigated
date: 2026-10-21
source_commit: 9da0eb18451db16f5b8406f1c0c6c5a4f108483d
related_prds:
  - PRD-0027
---

# PLAN-0002: Utredning om att avveckla Django

## Rekommendation

Avveckla Django områdesvis och behåll PostgreSQL, lagrade ID:n, innehåll och den befintliga React-redigeraren. Den publika renderaren är redan fristående. Återstående arbete gäller framför allt CMS-backenden och dess implicita beteende i modeller, signaler och jobb.

**Nästa konkreta batch är en Django-fri renderkatalog med en begränsad pilot för widgetscheman och validering.** Flytta den auktoritativa renderinformationen till ett språkoberoende kontrakt som både Python och TypeScript konsumerar. Därefter provas ett komplett sidflöde i en ny backend: läsa arbetskopia, spara med revisionskontroll och publicera en uttryckligen granskad version.

Detta är en utredning och ett implementeringsförslag. Inget nytt backendramverk, databasformat eller ersättande ADR är antaget. [PRD-0027](../prds/0027-framework-independent-content-contract.md) är ett redigerbart utkast för den första batchen.

## Underlag och avgränsning

- Separat worktree: `/Users/jmfk/.codex/worktrees/django-exit-investigation/eceee_v4_2`.
- Lokal branch: `codex/django-exit-investigation`.
- Bas: den lokalt tillgängliga `origin/main`, commit `9da0eb18451db16f5b8406f1c0c6c5a4f108483d`.
- Källkod, anropande frontend, tester, deployskript och aktiva projekt-ADR:er har undersökts statiskt. Ingen produktionsåtkomst, databasinspektion eller kontroll av vilka taggar som körs live har gjorts.
- Statisk AST-inventering av Git-spårade Pythonfiler under `backend/`: 270 filer importerar `django`, 86 `rest_framework`, 12 `celery` och 5 `channels`. Katalogerna `migrations` och `tests` samt filnamn som börjar med `test` är undantagna från importsiffrorna. Managementkommandon, admin och exempelvis `conftest.py` ingår; siffrorna är beroendeindikatorer, inte en uppskattning av antalet funktioner som ska porteras.
- Det finns 182 spårade Pythonfiler under migrationskatalogerna, exklusive `__init__.py`, och 29 syntaktiskt task-dekorerade funktioner, inklusive debug-/felhanteringsuppgifter. Före faktisk avveckling behöver aktiva jobb skiljas från historiska och oanvända.

## Vad som redan fungerar utan en Django-webbprocess

[`publisher/README.md`](../../publisher/README.md), [`publisher/src/db.ts`](../../publisher/src/db.ts) och [`publisher/src/model.ts`](../../publisher/src/model.ts) beskriver och implementerar en Next/React-server som läser PostgreSQL direkt. Sidförfrågningar använder en skrivskyddad repeatable-read-transaktion. Den delar React-renderare med frontend.

Publika formulär har också en fristående väg i [`publisher/app/api/forms/[pageId]/[widgetId]/route.ts`](../../publisher/app/api/forms/%5BpageId%5D/%5BwidgetId%5D/route.ts) och [`publisher/src/form-db.ts`](../../publisher/src/form-db.ts). Den använder en separat databasroll med begränsad insättningsrätt. Den rollen ska fortsätta vara skild från både läsrollen och framtida CMS-skrivrättigheter.

[ADR-0019](../adrs/active/0019-public-host-next-publisher.md) och den incheckade Caddy-konfigurationen anger Next som mål för vanliga publika sidförfrågningar på två befintliga innehållshostnamn. Det bevisar repositoryarkitekturen; det bevisar inte vilken release som är driftsatt. [PRD-0017](../prds/0017-public-publisher-cutover.md) står fortfarande som `in-progress`.

**Konsekvens:** bygg vidare på befintlig publisher. En ny publik renderare eller ett Django-API framför den skulle tillföra ett onödigt migrationssteg.

### Parallellt arbete som påverkar fortsatt implementation

Under utredningen observerades nya, ocommittade ändringar för temabundna widgettyper i huvudcheckouten. `specs/prds/0026-theme-widget-types.md`, `specs/adrs/active/0034-theme-widget-revisions.md` och `backend/webpages/theme_widgets.py` där beskriver schema/template/CSS i `PageTheme.widget_types`, publicering via Designer och instanser bundna till en oföränderlig typrevision. De ändringarna ingår inte i utredningens bascommit och har inte verifierats här.

Förslaget behöver därför skilja på **inbyggda kodwidgetars statiska katalog** och **temabundna definitioner i tenantens databas**. Flytta inte temadefinitioner till ett globalt byggmanifest. Nästa API-/valideringsprov måste kunna lösa effektivt tema, typ-ID och explicit revision samt bevara serverns HTML-/CSS-validering och sanering. Ett tyst fallback till senaste typversion vore ett kompatibilitetsbrott.

Vid integration behöver också dokumentnumren samordnas: huvudcheckoutens pågående PRD-0026/ADR-0034 har andra betydelser än dokument med samma nummer i denna `origin/main`-snapshot. Rapporten kopierar eller ändrar inte dessa parallella dokument.

## Kvarvarande Djangoansvar

| Område | Konkret beroende | Vad som behöver ersätta det |
| --- | --- | --- |
| Inloggning och identitet | Sessionscookies/CSRF i `frontend/src/api/client.js`, auth-endpoints i `backend/config/api_urls.py`, allauth i `backend/config/urls.py` | Inloggning, utloggning, sessionsåterkallelse, användaridentitet och de återställningsflöden som faktiskt används. En ny frontendtoken ensam ersätter inte detta. |
| Tenant och maskinåtkomst | `core/middleware.py`, `core/permissions.py`, `core/models.py`, `core/machine_api_keys.py` | Serverkontrollerat medlemskap, workspaceval, tilldelade Designer-rättigheter och scope/revokering för maskinnycklar. `X-Tenant-ID` är ett önskemål om tenant, aldrig bevis på behörighet. |
| Sidor och publicering | `webpages/services/page_version_workflow.py`, `views/page_version_views.py`, modellernas `save()` och `webpages/signals.py` | Samma arbetskopia, historik, låsordning, revisioner, konflikter, slug-/hostnamekontroller, publicering och schemalagd aktivering. |
| Widgets, scheman och metadata | `webpages/widget_registry.py`, `webpages/views/widget_type_views.py`, Python/Pydantic-klasser i `easy_widgets/widgets/` | Gemensam deklarativ katalog, UI-schema, defaults och explicit validering. Renderkatalogen ensam innehåller inte redigerarscheman. |
| Designer, teman och layouts | `webpages/services/designer_theme.py`, `theme_versions.py`, Designer-/layoutvyer | Utkast, versionshistorik, preview, tilldelningar och atomisk publicering av referenser. |
| Objekt, taxonomi och namnrymder | `object_storage/`, `content/`, `taxonomy/` | Relationsregler, versionsurval, query-/filterkontrakt och tenantbegränsningar. Objektträd använder också MPTT-relaterade fält; generisk CRUD räcker inte. |
| Media och dokument | `file_manager/`, Django storage-adaptrar och tasks | Uppladdning, behörig nedladdning, metadata, dokumenttext och thumbnails. S3/MinIO och imgproxy kan behållas. Pythonverktyg kan finnas kvar utan Django om de görs till fristående workers. |
| Import/export och fjärröverföring | `content_migration/`, `webpages/tasks.py`, `object_storage/tasks.py` | Befintliga checkpoint-, återställnings-, retry- och tenantkontrakt; inte enbart nya HTTP-endpoints. |
| Bakgrund och realtid | Celery tasks, schemalagd publicering, `config/asgi.py`, `utils/consumers.py` | Jobbägande, scheman, återförsök och uppdateringar efter commit. Närvaro får försvinna vid avbrott; sparsäkerhet får inte göra det. |
| Migrationer och drift | `deploy/scripts/deploy.sh`, `Makefile`, Django migrations | Ägare till framtida schemaändringar, installation från tom databas, uppgradering, rollprovisionering, healthchecks och kompatibilitetsrutter. |
| Hjälpflöden | `data_connections/`, `site_statistics/`, `ai_tracking/`, `theme-sync/` | För varje funktion: behåll och portera, isolera som verktyg eller avveckla efter bekräftad användningsinventering. |

Django admin är ingen produkt som behöver återskapas. Däremot pekar frontendens inloggningskontrakt i dag på `/admin/login/`; själva inloggningsresan måste få en ersättare. Oanvända demos och gamla mallvyer kan tas bort först när referenser och användning har kontrollerats.

## Första batchen: fristående renderkatalog och schemapilot

### Varför denna gräns

[`webpages/publisher_manifest.py`](../../backend/webpages/publisher_manifest.py) importerar Django settings och Python-registret för att generera [`render-manifest.json`](../../frontend/src/rendering/generated/render-manifest.json). `make publisher-manifest` och `make publisher-manifest-check` startar därför backendverktyget. En incheckad export gör publika förfrågningar fristående, men lämnar fortfarande Python som källa vid underhåll och regenerering.

Redigeraren behöver dessutom `schema`, `config-ui-schema`, `configuration-defaults` och `validate` via [`frontend/src/api/widgetSchemas.js`](../../frontend/src/api/widgetSchemas.js). Dessa data kommer från Pydantic. Att bara läsa det nuvarande rendermanifestet löser inte den delen.

### Föreslagen leverans

1. Skapa en liten katalog för inbyggda widgetdefinitioner, exempelvis `packages/content-contract/`, med språkoberoende JSON och dokumenterade versionsfält. Temabundna definitioner stannar i databasens versionssatta temadokument. Inget nytt runtime-API krävs för detta steg.
2. Flytta samtliga befintliga manifestfält, inklusive CSS, CSS-variabler, layout parts, variants och default special pages, till den kanoniska katalogen. Behåll format version 2 om utdata är oförändrade. Pythonadapter och Node-generator ska läsa samma källa; redigera inte både Pythondefinitioner och JSON manuellt.
3. Lägg till schema, defaults och UI-metadata för fyra representativa widgettyper: Headline, Banner, TwoColumns och Forms. De täcker enkla värden, innehålls-/mediakonfiguration, containrar och nästlade formulärfält. Återstående widgetscheman ligger kvar tydligt avgränsade i Python tills de migreras.
4. Frys kontraktsfixturer för giltigt, ogiltigt och normaliserat resultat: utelämnat värde, `null`, tom sträng, okända fält, alias, coercion, listor och nästling. Jämför även faktiskt renderat beteende för pilottyperna.
5. Låt befintliga autentiserade Django-endpoints läsa den gemensamma pilotmetadatan. Behåll deras åtkomstskydd och wire-format. Valideringsporten körs först i jämförelseläge; nya resultat får inte tyst ändra vad ett sparande accepterar eller lagrar.
6. Generera och kontrollera hela rendermanifestet med Node utan Django, databas eller miljöhemligheter. Gamla Pythondefinitioner för just flyttad renderinformation tas bort/ersätts av adapteråtkomst i samma batch.

En JSON Schema-export ersätter inte automatiskt all Pydanticlogik. Koden har egna validators, exempelvis widgettypkontroller i `webpages/json_models.py` och objektspecifika kontroller i `object_storage/widgets.py`. Pydantics dokumentation beskriver också separata before-/after-/wrap-validerare och särskild hantering av JSON Schema. Dessa beteenden måste inventeras och jämföras uttryckligen, inte antas följa med exporten. Se [Pydantic validators](https://docs.pydantic.dev/latest/concepts/validators/).

### Klart när

- Hela befintliga rendermanifestet går att återskapa deterministiskt i en Node-miljö utan installerad Django.
- Befintliga renderfält har en enda redigerbar källa, och samtliga registrerade renderwidgettyper finns kvar.
- Pilotens schema/defaults/UI-data och godkända valideringsutfall matchar referensfixturerna, inklusive avsiktliga casingundantag.
- Redigeraren kan öppna, ändra, spara och förhandsvisa pilottyperna genom befintligt API med bibehållen publicerad version.
- En lista anger vilka validators och widgetscheman som fortfarande är Pythonägda. Ingen generell valideringsparitet påstås för dem.

Detta tar bort ett verkligt byggberoende och gör nästa backend enklare att prova. Det stänger ännu inte av Django för CMS, databasändringar eller jobb.

## Nästa större prov: ett helt sidflöde

När kontraktspiloten fungerar ska nästa backend bevisa följande på en isolerad utvecklingsdatabas med syntetiska fixturer och två tenants:

`logga in → välj behörig tenant → läs sida/arbetskopia → spara → hantera revisionskonflikt → publicera granskad version → läs resultatet i befintlig Next-publisher`.

Provets API ska täcka läsning av sidsnapshot/workflow, komplett working-copy-save och explicit publish. Det är inte en generell CRUD-port. `working-copy`-relaterade endpoints får inte klassificeras som rena läsningar efter namn: dagens `get_or_create_working_copy()` kan skriva en ny version.

I det isolerade provet får Python skapa referensfixturer och förväntade resultat. När provets flöde verifieras ska Django-webbprocessen och Djangoarbetarna vara stoppade. Annars mäts bara en proxy eller hybrid. Provisionering av testanvändare är heller inte bevis på att en fullständig inloggnings-/återställningslösning finns; ett accepterat identitetskontrakt behövs innan redaktörer kan flyttas.

Viktiga bevis är att Save lämnar liveversionen orörd, att fel revision avvisas med aktuell snapshot och att två samtidiga första sparanden inte skapar dubbla kanoniska arbetskopior. Publicering ska använda explicit version/revision, hantera slug-/hostnamekonflikter och utföra nödvändiga signal-/cacheeffekter. Schemaläggning och återställning måste därefter ingå innan det befintliga sidaggregatets skrivrätt flyttas i drift.

## Teknikval som behöver avgöras före API-implementation

| Alternativ | Bedömning för ECEEE |
| --- | --- |
| TypeScript/Node för CMS-domänen | Förstahandskandidat om målet är minsta förändring i befintlig kodbas. TypeScript, `pg`, React-renderare och publisher finns redan. Återanvänd kontrakt och rena funktioner, men håll publik läsbehörighet och CMS-skrivbehörighet i separata processer/roller. HTTP-ramverk och eventuell SQL-generator väljs först vid provet. |
| Go för CMS-domänen | Rimligt om fristående binärer och användarens multitenant-dokumentramverk är det önskade målet. Behåll då befintliga tabeller/ID:n först och använd språkoberoende kontraktsfixturer. Delad TypeScriptvalidering kan inte direkt vara Go-serverns auktoritativa implementation. |
| FastAPI eller annat Python-webbramverk | Möjlig brygga om Python behöver behållas, men befintligt Django ORM, modeller, signaler, auth och migreringar måste ändå ersättas för full avveckling. Ett nytt HTTP-lager runt Django-modellerna uppnår inte målet. |
| Nytt headless CMS | Kräver en separat gap-analys mot sidversionering, Designer, arv, objekt, fjärröverföring och tenantregler. Det är ett större produktbyte än vad ett ramverksbyte kräver. |

Detta är en projektspecifik kostnadsbedömning, inte ett prestandamätresultat. Inget alternativ har benchmarkats i utredningen.

Skillen `multitenant-doc-framework` föreskriver Go/statiska binärer i sin ADR-0012 och en annan dokument-/eventarkitektur. ECEEE har inte antagit det ramverket i sina projekt-ADR:er. Ett val av TypeScript för en ny CMS-server i avvikelse från skillens serverregel behöver dokumenteras i en projektspecifik ADR före implementation; ett val att införa hela ramverket behöver också en uttrycklig projekt-ADR. Rapporten gör ingetdera beslutet.

Inför inte samtidigt ett nytt generiskt dokumentlager, event sourcing, CRDT, nya ID:n, en ny databas eller en ny köplattform. [ECEEE ADR-0015](../adrs/active/0015-revision-based-page-collaboration.md) väljer uttryckligen fulla snapshots, revisioner och klientmerge; eventlogg/CRDT ska inte smygas in som del av att ta bort Django.

## Föreslagen ordning fram till avstängning

| Etapp | Leverans och ägarskap | Kontroll före nästa steg |
| --- | --- | --- |
| 1. Gemensamma kontrakt | Fristående renderkatalog och schemapilot enligt PRD-0027. Django äger fortfarande produktskrivningar och schema. | Node kan regenerera hela manifestet; pilotens normalisering, validering och rendering matchar. |
| 2. Isolerat sidprov | Ny CMS-domän/API med verklig identitet, tenantkontroll och läsa/spara/publicera. Endast syntetisk separat databas. | Fullt provflöde fungerar med Django stoppat; negativ tenant- och konflikttestning på PostgreSQL. |
| 3. Komplett sidägande | Flytta hela sidaggregatet, inklusive scheman, restore, struktur, publiceringsjobb och post-commit-notifiering. | En enda skrivägare för dessa operationer; in-flight requests/jobb dräneras vid byte. Ingen Django-worker får skriva vidare bakom API:t. |
| 4. Teman, objekt och media | Flytta sammanhängande områden med befintliga relationer, versioner och behörigheter. | Både mänskliga klienter, maskinklienter och framtida agentverktyg använder samma domänoperationer. |
| 5. Resterande jobb och kompatibilitet | Ersätt import/export, statistik, dataanslutningar, aktiva AI-/mediajobb, websocketvägen och kvarvarande tillgångsrutter. | Varje kötyp och schemalagd uppgift har en verifierad ägare, retry-/återhämtningsplan och observabilitet. |
| 6. Schema och drift utan Django | Ny migrationsägare från en verifierad baseline, rollprovisionering och uppdaterad taggbaserad deploy. | Både tom installation och uppgradering från befintlig kopia fungerar utan Django. Alla resterande anrop/importer kartlagda. |
| 7. Avveckling | Ta bort Django-webb, Djangoarbetare, gamla rutter, managementberoenden och installationen av Django. | Det kompletta stödda systemet kan byggas, installeras, uppgraderas och köras med Django frånvarande. |

Ordningen mellan teman, objekt och media ska styras av det sidprov som faktiskt blockerar, inte av en förutbestämd omskrivning av varje app. Behåll befintliga Redis-/Celery-/Channelskomponenter tills deras konsumenter flyttats; ett köbyte är ett eget beslut.

## Regler som behöver överleva bytet

**En skrivägare.** Delad PostgreSQL under övergången är praktisk, men bara en implementation ska äga varje migrerat aggregats skrivningar. HTTP-routning räcker inte som lås när imports, fjärrpublicering och schemalagda jobb också skriver. Börja med separat testdatabas, bevisa reglerna och flytta sedan samtliga skrivvägar tillsammans. Ingen dual-write.

**Bevara databas- och wirekontrakt.** Publisherns SQL är kopplad till tabeller som `webpages_webpage` och `webpages_pageversion`. Behåll dem och deras bigint-ID:n initialt; byt inte till UUID bara för att en ny backend föredrar det. Bevara skillnaden mellan databasens `snake_case`, frontendens `camelCase` och dokumenterade JSON-undantag. Lägg en explicit adapter vid gränsen.

**Explicit domänlogik.** `PageVersion.save()`, `WebPage.save()` och `webpages/signals.py` har beteende utöver lagring. Flytta nödvändiga effekter till tydliga transaktioner/domänoperationer. Att ersätta ORM med SQL utan dem kan ge till synes lyckade skrivningar men fel publicerad metadata och cache.

**Transaktioner och revision.** Bevara page-then-version-låsning, rätt namespace-/tenantlås där det krävs, `expected_revision`, en revisionsökning per avsedd mutation och notifiering efter commit. Med `pg` måste hela transaktionen använda samma utlånade klient, inte fristående poolanrop; se [node-postgres transactions](https://node-postgres.com/features/transactions).

**Tenantisolering.** Den befintliga helpern `core/rls.py` gör sessionsbaserad `SET app.current_tenant_id`. Det är inte bevis för att alla tabeller/roller har effektiv RLS. Ingen aktiv databaskatalog har undersökts här. Före en ny CMS-skrivroll krävs en separat kontroll av policies, ägarskap, grants och faktisk isolering. En framtida adapter ska sätta befintligt rätt kontextnamn transaktionslokalt och alltid auktorisera medlemskap server-side; ändra inte GUC-namnet mekaniskt till skillens exempel. PostgreSQLs dokumentation anger bland annat att tabellägare normalt kan kringgå RLS: se [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

**Migrationer.** Två migrationsmotorer får inte oberoende ändra samma schema. Låt Django fortsätta äga DDL under API-provet. Gör sedan en verifierad baseline med nya, additiva SQL-migrationer och en enda ägare. Granska även historiska datamigreringar, seedad taxonomi och externa provisioningsteg; en schemasnapshot ensam återskapar inte dessa. Django använder även historiskt modelltillstånd i migrationskedjan, se [Django migrations](https://docs.djangoproject.com/en/4.2/topics/migrations/).

**Återgång utan dataförlust.** Börja varje driftetapp med kompatibla tabeller och payloads. Stoppa/dränera den nya skrivaren före återgång och kontrollera att den gamla kan läsa alla nya skrivningar. Backa routning/kod när kompatibiliteten är bevisad. Destruktiv nedmigrering och återställning av äldre databasbackup är inte en rutinmässig rollbackplan.

## Vad som återstår att undersöka

- Vilka auth-/återställnings-/allauthflöden används av verkliga redaktörer och vilka är enbart kvarvarande kod? Ingen användningsinventering har gjorts.
- Vilka endpoints och externa integrationer anropas aktivt? Frontendens statiska anrop är endast en del av svaret.
- Vilka tenants, schemalagda uppgifter och importjobb behöver flyttas tillsammans? Det kräver separat godkänd miljöinventering.
- Vilka RLS-policies och rollrättigheter är faktiskt aktiverade i respektive miljö?
- Vilka Pydanticbeteenden kan representeras deklarativt och vilka måste porteras explicit?
- Hur ser de temabundna widgetarnas slutliga kontrakt ut efter att det parallella arbetet har integrerats? Basera nästa kodbatch på den då granskade implementationen.
- Är minskad Pythonförvaltning eller ett statiskt kompilerat CMS viktigast? Kontraktsetappen fungerar för båda; API-provet behöver ett dokumenterat val.

Ingen tillförlitlig totaltidsuppskattning kan göras från antal filer. Använd första kontraktsetappen och det kompletta sidprovet för att mäta portningsarbete, kompatibilitetsgap och återstående omfattning. Full avveckling är flera sammanhängande etapper, inte ett paketbyte.

## Lokal verifiering och handoff

- Batchmål: evidensbaserad avvecklingsordning och ett genomförbart nästa steg.
- Ändringar: denna utredning, PRD-0027 och respektive index. Ingen runtimekod, databas, miljökonfiguration eller deploy har ändrats.
- Statisk inventering genomförd mot den angivna bascommiten.
- Dokumentverifiering: `git diff --check`, specs-validatorn och kontroll av lokala Markdown-länkar.
- Applikationstester har inte körts: inga applikationsändringar har gjorts. Befintliga testfiler har lästs som kontraktsunderlag; det räknas inte som ett nytt godkänt testresultat.
- Ingen push, PR, CI-körning eller produktionsoperation ingår. Worktree och utkast behålls för fortsatt arbete.
