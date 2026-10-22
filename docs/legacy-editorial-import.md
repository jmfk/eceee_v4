# Redaktionell legacyimport — isolerad dev

Den nya importen använder Artikel (`article`), Krönikör (`columnist`), Evenemang (`event`), Publikation (`library_item`) och Organisation (`organization`). Nyhet, Krönika och Pressmeddelande är termer under Innehållsslag, inte separata artikelmodeller. Den äldre `migrate_legacy_news` finns kvar för sitt tidigare kontrakt.

## Workspace och verifierat innehåll

- Worktree: `/Users/jmfk/.codex/worktrees/legacy-import-dev/eceee_v4`, branch `codex/legacy-import-dev`, baserad på dokumentations-PR #268.
- UI: <http://localhost:12700/objects>. Backend: <http://localhost:12701>. Imgproxy: port 12706. Portintervallet 12700–12799 är registrerat för denna workspace.
- Välj **Profile → Workspace → ECEEE import dev → Switch workspace** om listorna är tomma. Webbläsarens aktuella workspace har företräde framför Vite-fallbacken.
- Tenant: `legacy-import-dev`, namespace: `default`. Importaktör: `codex-content-import`, ett konto utan användbart lösenord.
- Egen databas `q6n9v2_dev_import` och testdatabas `test_q6n9v2_dev_import` på befintlig delad PostgreSQL. Separat runtime-roll, Redis-prefix och tenant-/namespace-scope i medielagringen. Ändra eller återställ inte providercontainern.
- 100 verkliga nyheter finns som **utkast**. Körning `b83852f9-efc9-4c97-bd16-0f3e53811328` gav 95 importerade och 5 oförändrade efter ett inledande fempostersprov. Ingen publicering eller provacceptans har utförts.
- Manifest: `50a1b1fdf763cc54fa9fec00185bd62081fa1065542d57918535da0b28aeb617`. Omkörning av samma körning skapade inga nya objekt/versioner.

De andra typerna har definitioner men inga verkliga provposter ännu. Källans driftsatta API saknar det nya `contentContract: "1"`. Det nya API:t finns i separat legacy-worktree `/Users/jmfk/.codex/worktrees/legacy-import-dev/eceee-legacy`, branch `codex/legacy-content-resources`. Det är lokalt testat men **inte driftsatt**. Krönikeblandning kan därför inte betraktas som verifierad med riktiga data ännu.

Devcontainrarna heter `eceee-legacy-import-dev-backend`, `eceee-legacy-import-dev-frontend` och `eceee-legacy-import-dev-imgproxy` i Docker-context `orbstack`. Stoppa/starta bara dessa containrar. Backendcontainerns basprocess är en hållprocess; efter containerstart startas utvecklingsservern med:

```sh
docker --context orbstack exec -d eceee-legacy-import-dev-backend sh -c 'uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload > /app/.dev-server.log 2>&1'
```

Starta inte en andra uvicorn-process om porten redan svarar. Frontendcontainern kör sin Vite-server automatiskt. Worktree och databas är beständiga; att ta bort worktreen eller containrarna är inte en dokumenterad återställningsmetod.

## Definitioner: installera, exportera och synka

Källprofilen finns i `backend/content_migration/legacy_content/profile.py`. Efter installation är **live-definitionerna i dev** underlaget för synkning, så att schemaändringar i CMS följer med. Export innehåller de fem definitionerna, klassificeringstyper och de tre grundtermerna för Innehållsslag. Importerade ämnestermer exporteras inte som definitioner.

```sh
python3 scripts/eceee_content_definitions.py initial --output artifacts/legacy-content-import/initial.json
python3 scripts/eceee_content_definitions.py diff --bundle artifacts/legacy-content-import/initial.json
# Apply kräver exakt bundleDigest från diff-resultatet:
python3 scripts/eceee_content_definitions.py apply --bundle artifacts/legacy-content-import/initial.json --confirm-digest REVIEWED_DIGEST
python3 scripts/eceee_content_definitions.py export --output artifacts/legacy-content-import/dev-definitions.json
python3 scripts/eceee_content_definitions.py diff --bundle artifacts/legacy-content-import/dev-definitions.json
```

De installerade definitionerna är exporterade och senaste diff gav `changes: []`. Verktyget använder CMS-API:t med `X-Tenant-ID`; lokala numeriska ID:n ersätts av namn/slug i paketet. Det raderar inga definitioner. Avvikande befintliga grundtermer kräver manuell avstämning.

För en **första komplett installation** ska nyckelns principal vara destinationens tenantägare, med `object.read`, `object.definition.write`, `content.read` och `content.write`. Skapa den uttryckligen via maskinnyckelhanteringen för den avsedda tenanten och lagra den i den skyddade profilfilen innan `apply`. Ägarskap krävs för att skapa klassificeringstyper; skapande/konfiguration av termer kräver också taxonomins egna rättigheter. En nyckels scopes ersätter inte principalens rättigheter.

`provision_local_machine_access --object-definition-write` skapar en vanlig tenantmedlem och är därför **inte en credential för första komplett profilinstallation**. Den kan hantera objektdefinitioner inom tenanten, men ger ingen automatisk rätt att skapa klassificeringstyper eller godkänna termer. Återanvänd inte ett medlemskonto som ägare för att kringgå detta. Befintliga typer kan underhållas av en behörig principal med uttryckliga klassificeringsgrants. Nyckeln får inte radera definitioner eller ändra andra tenants. Nyckelvärden finns endast i ignorerade filer med mode 0600, inte i exporten.

Senare används `--profile production --env-file PROTECTED_PROFILE` med destinationens egna credentials. **Innan mutation:** exportera destinationens definitioner till ett separat skyddat underlag, jämför paketet, pausa samtidig definitionsredigering och följ aktuell produktionsgate i AGENTS.md. Digesten låser indata, inte destinationens samtidiga ändringar. Apply är inte en atomisk överföring av hela paketet: vid avbrott läs tillbaka och kör diff före fortsatt arbete. En schemaexport överför inte objektinnehåll, media, layout eller medlemskonton.

## Importflöde

Kör inifrån backendcontainern. `--source-env .env.legacy` läses internt av importeraren; visa aldrig filen i terminal eller editorverktyg. Exemplen nedan använder devtenant, aldrig produktion.

```sh
docker --context orbstack exec eceee-legacy-import-dev-backend python manage.py migrate_legacy_editorial preflight --tenant legacy-import-dev
# Tillgängligt nu: den gamla News-resursen, uttryckligen bara för dev.
docker --context orbstack exec eceee-legacy-import-dev-backend python manage.py migrate_legacy_editorial stage --tenant legacy-import-dev --resources news --preset dev --limit 100 --legacy-news-compatible
docker --context orbstack exec eceee-legacy-import-dev-backend python manage.py migrate_legacy_editorial apply --tenant legacy-import-dev --run RUN_ID
docker --context orbstack exec eceee-legacy-import-dev-backend python manage.py migrate_legacy_editorial report --tenant legacy-import-dev --run RUN_ID
```

`stage` fryser källposter, urval, mappning och definitionshash i databasen innan några målobjekt skrivs. `apply` har ett importlås per tenant/namespace och en transaktion per post. Samma `RUN_ID` återupptar ett avbrott. Ett nytt uttag ger en ny körning men samma beständiga källbindningar. Ändrade målobjekt rapporteras som konflikter; importen skriver inte över redaktionellt arbete. Källposternas original-ID:n skiljs åt mellan nyheter och krönikor. Lediga slugs behålls; kollisioner får ett stabilt källsuffix.

Den gamla News-resursen saknar bestyrkt site-scope och ursprungliga term-ID:n. Kompatibilitetskörningen märks därför dev-only och använder separat källscope samt syntetiska, dimensionsbundna termnycklar. Använd inte dess sample, bindningar eller klassificeringsmappning som produktionsunderlag.

## Efter driftsättning av det utökade käll-API:t

Resurserna är `columnists,organizations,news,columns,events,publications`. Default devtak är 40/25/100/40/30/25; saknade refererade krönikörer hämtas dessutom som beroenden. Ange `--limit` för mindre prov. Använd samma granskade mappningsfil vid prov och fullimport:

```sh
python manage.py migrate_legacy_editorial preflight --tenant TARGET_TENANT --inventory
python manage.py migrate_legacy_editorial stage --tenant TARGET_TENANT --preset dev --mapping REVIEWED_MAPPING.json
python manage.py migrate_legacy_editorial apply --tenant TARGET_TENANT --run SAMPLE_RUN_ID
python manage.py migrate_legacy_editorial report --tenant TARGET_TENANT --run SAMPLE_RUN_ID
# Först efter innehålls-, media-, relations- och avvikelsegranskning:
python manage.py migrate_legacy_editorial accept-sample --tenant TARGET_TENANT --run SAMPLE_RUN_ID --confirm-manifest EXACT_MANIFEST_HASH
# Förberedelse för senare all-import; inte en instruktion att köra i produktion nu:
python manage.py migrate_legacy_editorial stage --tenant TARGET_TENANT --preset all --mapping REVIEWED_MAPPING.json --accepted-sample-run SAMPLE_RUN_ID
python manage.py migrate_legacy_editorial apply --tenant TARGET_TENANT --run FULL_RUN_ID
```

`preflight --inventory` hämtar endast sammanfattningar för de resurser som källan erbjuder: totalt antal, publicerad källstatus och exkluderat opublicerat innehåll, med verifierat gemensamt site-scope. Om tillägget inte är driftsatt är inventeringen tom och resurserna anges som saknade. Publicerad källstatus innebär inte i sig att posten får publiceras i v4. Felaktiga eller motsägande antal stoppas.

Källadaptern kontrollerar att pagineringen behåller samma site och ID-ordning, utan dubbletter eller utökning av begärt krönikörsurval. Felaktiga provgränser stoppas före nätverksanrop.

Provacceptansen är tenant-/namespace-bunden. Ett godkänt devprov kopieras inte automatiskt till produktion; destinationsmiljön behöver sitt eget granskade prov och separat ägargate för dataskrivning. Fullimporten kräver matchande källscope, resurser, mappning, definitioner och pipeline. `--preset all` har inget provtak, men skapar fortfarande endast utkast. Källans ändringar måste frysas under slututtaget; ID-paginering är inte en transaktionssnapshot. Även en fullimport behöver operativ volym-/prestandagranskning och stagingrepetition före produktion.

Mappningsfilen är JSON med:

- `excludedSources`: granskade identiteter som `"publications:123"`. Exkludera proceedings även inne i biblioteket. Importen kan inte avgöra detta säkert från rubriken. Bilagor som innehåller undantaget material kräver uttrycklig manuell bedömning innan deras ägarpost importeras.
- `approvedTermMap`: `"legacy_app.model:ID"` till en godkänd term-UUID i **målmiljön**, i samma avsedda klassificeringstyp. Förbered och godkänn termerna separat i klassificeringsgränssnittet/API:t innan importen körs. Hierarkiska källtermer kräver uttrycklig mappning; etiketter slås inte ihop automatiskt. Befintliga identitetsbundna termer kan återanvändas utan ny mappning. Importen skapar aldrig nya godkända termer; saknad taxonomi ger `unprepared_taxonomy_term`. Evenemangstyp/-kategori kräver förberedda termer med motsvarande slug.
- `mediaClassificationIds`: ordnad lista av godkända term-UUID:n i målmiljön, tillåtna för `media_files`. Krävs för poster med bilder eller hämtade bilagor när namespace har aktiverat canonical-läget. Förbered termerna separat före import; valet valideras före hämtning och används för både bilder och bilagor. Befintliga klassificeringar på återanvända filer behålls. En ändrad lista gör att samma källpost behandlas igen.
- `pressReleaseSourceTerms`: ursprungliga NewsType-ID:n som bestyrkt betyder pressmeddelande. Ingen textbaserad gissning görs.

Tom/okänd mappning är inte bevis för en granskad inventering. Ansvarig behöver dokumentera täckning, undantag och återstående manuella åtgärder i importunderlaget.

## Bevarande och återstående granskning

Historiska visnings-/källdatum bevaras separat från v4:s skapandedatum. Krönikor utan verklig krönikör, organisationer utan publikt namn och ofullständiga evenemangsdatum blockeras. Inga konton skapas. Källans utkast/avpublicerade innehåll räknas i sammanfattnings-API:t men importeras inte.

Bilder använder befintlig mediaimport; misslyckade hämtningar kan ge tydligt markerade platshållare för utkast och rapporteras i versionsmetadata. Filbilagor hämtas med storleksgräns och validering, bevaras i ordning och visas som redigerbara nedladdningslänkar. Misslyckade dokumenthämtningar blockerar posten. Original-URL och käll-/målbindningar sparas; länkar skrivs inte om till ännu opublicerade mål. Redirectaktivering och slutlig länkavstämning återstår.

Ingen befintlig v4-nyhetsimport raderas eller byter typ automatiskt. En sådan övergång kräver separat avstämning. Alla definitioner/importkörningar ligger i den nya devdatabasen; produktion har inte ändrats.

## Lokal verifiering

Fokuserad backendkörning: 72 tester passerade för import, klassificeringsrättigheter/tilldelningar, legacy-adaptrar, objektflöde och maskinnyckelscope. Frontend: 9 klassificerings-/persistenstester passerade och produktionsbuild passerade med befintliga bundlestorleksvarningar. `manage.py check` och `makemigrations --check --dry-run` passerade. Migrationerna har körts på den nya devdatabasen. Definitionsexportens 4 tester och API-hjälparens 9 tester passerade med Python 3.12. Legacy-källans 16 kontrakts-/API-tester passerade lokalt. Artikelns text, strukturerade datum och läsbara klassificeringar har kontrollerats i webbläsaren.

Inte verifierat ännu: uppgradering av en kopia av produktionsdata, hela den befintliga testsviten, verkliga sexresursprov, full datavolym, publicerad blandad artikelvy och produktionsövergång. Dessa luckor gör PRD-0034 fortsatt `in-progress`.

### Fortsatt v4-verifiering 2026-10-22

23 fokuserade import-/källkontraktstester passerar efter inventeringsstödet. Ett isolerat databastest importerar samtliga sex källresurser till fem måltyper, med gemensam Artikel, verkliga testrelationer till krönikör, ordnade externa bilagor och oförändrad omkörning. Transporttesterna mockar käll-API:t; testposterna har inte lagts i den användbara devmiljön. Detta ersätter inte den kommande provimporten av verkliga legacy-poster. Acceptans av gamla News-kompatibilitetsprov stoppas uttryckligen; fullimport kräver fortfarande ett komplett granskat prov. Inga käll-/produktionsanrop ingick i denna verifiering.

### Samlad PR-verifiering

Inför uppdatering av PR #268 passerade 90 fokuserade backendtester: editorial source/import, klassificering, object workflow, maskinbehörigheter samt berörda mediemodeller/API. Black, isort och flake8 passerade för samtliga ändrade backend-Pythonfiler utom genererade migrationer. Frontendlint gav 0 fel (befintliga varningar kvarstår). Formatering och oanvända importer rättades i samma batch. Tidigare godkänd frontendbuild och 9 klassificerings-/persistenstester gäller oförändrad frontendkod. Hela testsviten och produktionsuppgradering är fortfarande inte verifierade.

### Review fixes

Objektsparning utelämnar klassificeringsfältet om anroparen inte har skickat det; en uttrycklig tom lista rensar fortfarande. Mediesamlingars vanliga uppladdning och ZIP använder samma rättighetskontrollerade, ordnade urval. Författarreferenser i den nya profilens `field_type` synkroniseras till objektrelationer. Legacy-aliaser får inte använda en annan tenants privata definition.

Återimport tar författarflödets tenant-/objektlås och läser därefter aktuell målversion. Konfliktfingeravtrycket omfattar även relationer, metadata och slug. Bindningar skapade av den tidigare experimentella implementationen har ett äldre fingeravtryck och stoppar därför en ny återimport som konflikt; skriv inte om dem automatiskt. Befintliga devutkast och redan avslutade körningar kan fortfarande granskas. Nya fullständiga prov efter legacy-API-övergången kräver nya granskade bindningar inom sitt bestyrkta källscope.

Tilldelning av importtermer kräver förberedd godkänd taxonomi enligt PRD-0034. De 100 tidiga devposterna skapades före denna skärpning; deras existens är inte ett godkännande av taxonomin för produktion. Exportpaketet för definitioner innehåller fortsatt enbart grundtermerna för Innehållsslag, inte hela källans ämnestaxonomi. Den senare förbereds och mappas separat i målmiljön.

Reviewverifiering: en bred backendkörning gav 344 godkända tester. Fem migrations-/barriärtester som inte kan köras med `--nomigrations` kördes separat på `test_q6n9v2_review268` med verkliga migrationer: alla fem passerade, inklusive uppgradering med legacydata, avbrott/omstart av backfill och databasens tenantbarriärer. Typnamnet visas nu först i klassificeringens sökväg; 14 governance-tester passerade efter ändringen. Den lokala granskningsdatabasen är isolerad från devinnehållet.

Frontendens breda körning omfattade 1859 tester. Lokal parallell belastning gav timeouts i fyra Designer/renderingssviter; deras 207 tester passerade vid avgränsad omkörning med `--maxWorkers=1`. De tidigare tre miljöberoende felen (två saknade JSON-fixturmounts samt `VITE_TENANT_ID`) verifierades separat efter rättad lokal testmiljö. Klassificerings-/objekt-API-regressionerna passerade med 12 tester. Inga testtimeoutgränser eller produktionsinställningar ändrades för att få testerna godkända. CI måste fortfarande bekräfta den pushade headen.

Slutgranskningens exportkontroll begränsar paketet till de tre godkända grundtermerna och verifierar deras hierarki; levande visningsnamn bevaras. Återimport jämför även granskad termmappning, pressmeddelandemappning och profil/pipeline innan en källpost räknas som oförändrad. Sex export-/difftester och 21 importtester passerade efter dessa rättningar.

Full CI upptäckte att de nya interna mediafunktionerna ärvde PostgreSQLs standardbehörighet EXECUTE för PUBLIC och därför stoppade publisherns least-privilege-kontroll. Migration 0005 begränsar nu funktionerna direkt vid skapandet; additiv migration 0006 rättar redan uppgraderade devdatabaser. Ingen PUBLIC-behörighet återinförs vid rollback av 0006. Ett databastest verifierar ACL och fortsatt åtkomst för funktionsägaren.

Den breda backendkörningen identifierade även att publicering av en sida utan taggar försökte initiera klassificeringsregistret och därmed nekade vanliga redaktörer. Legacy-synkroniseringen initierar nu en definition först när en verklig saknad term behöver skapas. Integrationstesterna använder uttryckligen en medlem som inte är tenantägare. Rättigheter för nya termer och borttagning av befintliga tilldelningar behålls.

Integrationen med Kanban kontrollerar nu deduplicering och åtkomst före taggvalidering. Återanvändning av en befintlig fil ska inte initiera en oanvänd klassificering; en otillgänglig dubblett returnerar fortsatt en generell konflikt. Vid skapande av en ny mediafil krävs samma granskade klassificering och behörigheter som tidigare.

### Ytterligare regressionskontroll inför merge

36 fokuserade PostgreSQL-tester passerar för redaktionell import, äldre bildimport, maskinnyckelns definitionsscope och frivilliga mediasamlingar. Proven inkluderar canonical-klassificering av hämtad PDF och bild, bevarande av manuella medieklassificeringar, stopp före filhämtning vid saknat granskat val samt POST/PATCH som avvisar främmande eller globala undertyper utan mutation. Nio klassificeringstester och frontendbuild passerar efter att isolerade OS-styrda mörka färger tagits bort. Visuell webbläsarkontroll av dessa färgändringar har inte körts.

Nästa granskningspass kompletterade PostgreSQL-proven med historiska sammanslagna termer, återimport efter sammanslagning, granskade undantag och krönikörsberoenden. 83 tester passerade direkt; efter att HTTP-testadaptern rättats att läsa den faktiska JSON-responsen passerade även installationsprovet och ett fokuserat prov för nyheters frivilliga skribentreferens. Provinstallationen använder en tenantägare utan superuser och de fyra dokumenterade maskinscopes: fem objektdefinitioner, samtliga klassificeringstyper, tre grundtermer samt tom efterföljande diff verifieras via API:t. En vanlig definitionsskrivare får fortfarande 403 när den försöker skapa klassificeringstyper.

Granskade undantag redovisas före återimportens konflikt-/oförändrad-kontroll och tar inte bort tidigare utkast. Krönikor kräver att skribentberoenden har behandlats framgångsrikt i samma manifest. Vid publicering/schemaläggning kräver artikelns eventuella skribentreferenser en publik krönikörsversion vid starttidpunkten. Historiska term-ID:n bevaras vid läs-/sparrundor efter merge och används i konfliktfingerprint, så en taxonomisk sammanslagning ensam räknas inte som redaktionell måländring.

### Transaktionssäker reparation av bildplatshållare

En lyckad bildreparation behåller media-ID men använder en ny deterministisk filadress baserad på källa och bildinnehåll. Den gamla filens bytes skrivs inte över. Om senare postarbete misslyckas pekar den återställda databasposten därför fortfarande på den oförändrade platshållaren; ett återförsök återanvänder samma nya nyckel. Äldre sparad HTML med den gamla URL:en måste uttryckligen uppdateras vid återimport, och gamla filer tas inte bort automatiskt. Se [ADR-0049](../specs/adrs/active/0049-transaction-safe-legacy-media-repairs.md).

Bildreparationens rollback-/återförsöksprov och hela berörda importpaketet passerar: 37 PostgreSQL-tester. Provet använder en lagringsdubbel med verkligt bevarade bytes och verifierar oförändrad gammal fil, återställd databasmetadata, stabilt media-ID och samma nya nyckel vid återförsök. Black/isort/flake8 och specs-validering passerar.
