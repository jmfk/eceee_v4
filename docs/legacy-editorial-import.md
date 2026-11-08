# Redaktionell legacyimport: site 2

Det kommande lokala helprovet omfattar `news`, `columns`, `columnists`, `events`, `organizations`, `publications` och `reports` (`ReportPage`). De ger Artikel, Krönikör, Evenemang, Organisation och Publikation. Importkommandot skapar utkast; publicering sker genom objektens befintliga versionsarbetsflöde efter kontroll.

Detta utökar det tidigare femresursurvalet enligt ADR-0067. Legacy-API:t måste exponera `reports` innan en sju-resursinventering och ett komplett prov kan köras. Den äldre site-2-inventeringen gav noll `publications`; det antalet kontrolleras på nytt. Nya källtermer och möjliga dubbletter mellan de två publikationsresurserna granskas innan importen accepteras.

Den fristående [objektmodellen](legacy-editorial-object-model.md) beskriver exakt vilka typer, fält, relationer och klassificeringar ett annat projekt behöver bygga för denna import.

## Sökning och filter efter import

Objekttypens flik **Search and filters** i webbgränssnittet styr vilka schemafält som
söks och filtreras i både typlistan och Objects-översikten. Startprofilen föreslår
följande. Taggfilter väljs i webben efter att klassificeringstyperna skapats, så att
de alltid kopplas till rätt tenant och tillåten objekttyp.

| Objekttyp | Extra sökfält | Föreslagna filter |
| --- | --- | --- |
| Artikel | Ingress | Publiceringsdatum, skapad, avpubliceringsdatum, krönikör, källdatum; innehållsslag, nyhetstyp, nyhetskategori, källa, ämne, nyckelord |
| Krönikör | Förnamn, efternamn, organisationstillhörighet | Skapad, organisationstillhörighet, nyckelord |
| Evenemang | Arrangör, plats, fokusområde | Start- och slutdatum, publiceringsdatum, arrangör; evenemangstyp, evenemangskategori, ämne, nyckelord |
| Publikation | Sammanfattning | Skapad, avpubliceringsdatum; publikationskategori, ämne |
| Organisation | Publikt namn, land | Land, internationell ja/nej, skapad; organisationskategori, organisationstillhörighet, nyckelord |

`library_item` har ännu inga importanpassade förval i startprofilen. Sök- och filterinställningarna kan
ändras i webben utan att importprofilen eller källtermkartan ändras.
En exporterad definitionsbundle tar med valda listfält och använder klassificeringens
stabila nyckel för taggfilter; målmiljön löser nyckeln till sitt eget termtyps-ID.

## Granskad termkarta

`backend/content_migration/legacy_content/site2_terms.json` innehåller de 698 använda källidentiteterna med originalnamn och användningsantal. `site2_decisions.json` innehåller de beslutade grenarna, barnrelationerna, namnen och sammanslagningarna. `term_plan.py` validerar täckning, identiteter, sammanslagningar och föräldragraf och kompilerar ett portabelt paket med 703 måltermer inklusive de tre innehållsslagen. Källidentitet är site, dimension, modell och ID; evenemangens textval använder site, fältnamn och exakt värde. En ny, omdöpt eller omföräldrad källterm stoppar den berörda stage-körningen. Källorna med tomt namn respektive `external-resource` är uttryckligen mappade till Okänd källa.

Denna karta granskades för det tidigare femresursurvalet. Innan `publications` och
`reports` får ingå i ett fullständigt manifest måste deras faktiska kategorier
inventeras och eventuella nya termer mappas uttryckligen. Saknade termer stoppar
stage-körningen; importen hittar inte på en klassificering.

Efter att legacy-API:t exponerar båda resurserna ger följande läsande kontroll
antal och en termlista med identitet, namn, användning och förekomster utan att
exportera innehållsposternas text:

```sh
python manage.py migrate_legacy_editorial preflight --tenant eceee-production-copy --inventory --term-inventory
```

```sh
python3 scripts/compile_legacy_terms.py --bundle /secure/path/site2-bundle.json --mapping /secure/path/site2-map.json --review /secure/path/site2-review.json
python3 scripts/eceee_content_definitions.py diff --bundle /secure/path/site2-bundle.json --tenant TARGET_TENANT
python3 scripts/eceee_content_definitions.py apply --bundle /secure/path/site2-bundle.json --tenant TARGET_TENANT --confirm-digest BUNDLE_DIGEST
```

Termberedningen använder CMS-API:ts taxonomirättigheter. Den vägrar ersätta en befintlig term med motstridigt namn, förälder, status eller alias. Läs tillbaka diff efter apply. API-profilen ligger i en skyddad lokal env-fil och ska inte skrivas i Git eller terminalutdata. För produktionsmiljö gäller separat ägargate enligt `AGENTS.md`.

När paketet installeras i en tenant med befintliga klassificeringstyper läggs paketets tillåtna användningar till utan att ta bort de befintliga. Diffen accepterar därför extra användningar som redan finns i måltenanten.

## Lokal import

Den tidigare isolerade tenanten `legacy-import-dev` låg i databasen `q6n9v2_dev_import` på delad PostgreSQL. Den används inte längre; se avsnittet om byte till vanlig devtenant nedan. Innan lokal rensning 2026-10-27 togs en läsbar, skyddad pg_dump till `/tmp/eceee-legacy-import-dev-preclean-20261027.dump` (mode 0600). Rensningen tog exakt 2 äldre site-0-körningar, 105 importposter, 100 bindningar, 100 utkast med 100 versioner och 78 testtermer. Tenant, definitioner och de tre grundtermerna behölls då. Inga mediafiler fanns då för denna tenant. Den gamla utvecklingsworktreen och dess `.env` hade redan försvunnit; den gamla containerkonfigurationen används inte som kodkälla.

Ett första lokalt prov från site 2 frystes mot den granskade kartan: körning `7139671d-0e72-4092-b273-ff2417b77fd6`, manifest `6bc6f10082dea4ae1d9d1ed1b90169bdf4f2dc1c67991430a4cf4e06b60d4bf2`. Två verkliga poster från var och en av de fem resurserna importerades: 10 utkast, 10 versioner, 19 termtilldelningar och 4 mediafiler. Krönikorna fick varsin författarrelation; inga poster blockerades eller fick bildplatshållare. Återkörning skapade inga extra versioner. **Provet är inte accepterat**: redaktionell kontroll av innehåll, media, relationer och publiceringslämplighet återstår.

### Större lokala prov

En tidigare devkörning 2026-10-27 (`89c10746-bf02-4fbd-ab32-846ba6533925`) omfattade 419 poster: 405 importerade, 10 oförändrade och 4 blockerade. Den var inte redaktionellt accepterad. Den 2026-11-02 uppdaterades den isolerade databasen med fem väntande migrationer efter en skyddad backup till `/private/tmp/eceee-editorial-import-pre200-20261102.dump` (mode 0600). En färsk inventering av site 2 gav 19 729 publicerade poster i de fem inkluderade resurserna.

Två devmanifest kördes 2026-11-02 med samma granskade termkarta:

| Körning | Urval | Utfall |
| --- | --- | --- |
| `fd400f04-2742-4558-96b5-96addf9acd53` | 40 per resurs, plus 5 krönikörsberoenden; 205 poster | 12 importerade, 190 oförändrade, 2 blockerade, 1 konflikt. Krönika 271 saknar krönikörsberoende, evenemang 1329 har ogiltigt datumintervall och krönika 262 har ändrats i målet och skyddas från överskrivning. |
| `a42cad75-8c63-4c1a-b24e-14da45098bd3` | 150 nyheter efter de 100 senaste och 50 evenemang efter de 100 senaste; 200 poster | 189 importerade, 10 oförändrade, 1 blockerat. Evenemang 1224 saknar fullständigt datum. Alla 189 nya utkast fick kanoniska klassificeringar, totalt 966 termlänkar. Evenemang 1184 har en bildplatshållare. |

Båda körningarna har status `needs_attention` och är **inte accepterade**. Avvikelserna, bildplatshållaren och ett representativt urval av innehåll, media och relationer behöver granskas före ett godkänt prov eller en större import. De importerade objekten är fortsatt utkast.

### Byte till vanlig devtenant 2026-11-02

Testsidornas tenant i den vanliga devdatabasen `eceee_v4_2` är `eceee-production-copy`, med namespace med samma namn. Den valdes som fortsatt mål för importprov. Databasen hade 54 testsidor och 341 objekt före importen. En skyddad, verifierad pg_dump finns på `/private/tmp/eceee-v4-2-before-editorial-import-20261102.dump` (mode 0600). Preflight med den granskade site-2-kartan passerade.

Två manifest från samma källurval kördes mot `eceee-production-copy`:

| Körning | Urval | Utfall |
| --- | --- | --- |
| `8f4088d4-47b6-4fc4-8976-880a205dd90d` | 419 poster: 79 krönikörer, 40 organisationer, 100 nyheter, 100 krönikor och 100 evenemang | 415 importerade, 4 blockerade. Krönika 271 saknar krönikörsberoende; evenemang 1329 har ogiltigt datumintervall och 1295 samt 1286 har ofullständiga datum. |
| `ae5a6cf4-1793-4dae-b4da-f230546f8b5f` | 150 ytterligare nyheter och 50 ytterligare evenemang | 199 importerade, 1 blockerat. Evenemang 1224 har ofullständigt datum. En bildplatshållare skapades före senare rensning. |

Detta första prov gav 614 importerade utkast med beständiga källbindningar i den vanliga devtenanten, som då hade 955 objekt. Av de importerade objektversionerna hade 576 kanoniska taggtilldelningar, med totalt 2 181 termlänkar. Körningarna fick status `needs_attention` och accepterades inte redaktionellt. Objekten och bindningarna togs senare bort vid nystarten nedan.

Importerade bilder sparas som MediaFile och infogade bilder länkas med media-ID i innehållswidgeten. I dessa körningar skapades 142 medieposter, varav en var en platshållare för en källbild som svarar 404 (`events:1184`). Bilderna visas genom den projektägda ImgProxy-tjänsten på port 11606; starta hela devstacken med `make dev` så att även den tjänsten kör.

Pipelineversion 4 filtrerar noll- och enpixelsbilder i källans HTML och utelämnar bilder som inte går att hämta. En sådan annonsbeacon i `news:22224` togs bort genom riktad återimport i körning `2e09aaae-ab4c-4cc7-9624-4b9651ad8049`; objektets tidigare version finns kvar.

Mediegranskningen 2026-11-02 bekräftade att samtliga 186 verkliga legacybilder i devtenanten finns i lagringen och svarar HTTP 200. Efter verifierad backup till `/private/tmp/eceee-v4-2-before-placeholder-cleanup-20261102.dump` (mode 0600) fick 59 äldre publicerade `News`-objekt nya publicerade versioner utan sammanlagt 72 bildnoder vars källfiler inte kunde hämtas. De 83 platshållarposterna i mediebiblioteket togs bort mjukt; inga aktuella objektversioner refererar dem. Historiska objektversioner och filbinärer finns kvar för återställning. En riktad kontroll av objekt 344 visar nu innehåll utan trasig bild.

Den nya redaktionella importen lägger källans `news` och `columns` i objekttypen `article` (Artikel) och använder taggar för klassificering. Före nystarten fanns 204 publicerade `news`-objekt och 137 `news_*`-klassificeringsobjekt från den äldre, separata `legacy_news`-importen. Käll-ID-jämförelsen visade att 100 av de 204 äldre News redan hade motsvarande Artikel-utkast; 104 saknade det. Dessa äldre objekt togs bort vid nystarten nedan.

### Ren nystart och nytt prov med 250 objekt

På ägarens uttryckliga begäran togs först en verifierad fullständig backup av den vanliga devdatabasen till `/private/tmp/eceee-v4-2-before-object-reset-20261102.dump` (mode 0600). En återställd provkörning kontrollerade kaskaden. Därefter togs alla 955 objekt och deras 1 098 versioner bort ur `eceee-production-copy`, tillsammans med tre äldre redaktionella importkörningar, 620 manifestposter och 614 källbindningar. De sex äldre objekttyperna `news` och `news_*` togs mjukt bort från Publisher. En separat kontroll efter commit visade **0 objekt, 0 importkörningar, 0 bindningar och 0 synliga gamla News-typer**, medan alla 54 testsidor fanns kvar. Ingen ny importkörning hade skapats vid denna kontroll.

Ett nytt granskat manifest med exakt 250 källposter stageades därefter som körning `10528a08-b5db-4c10-a3f3-8cace50e8208`: 79 krönikörer, 40 organisationer, 51 nyheter, 39 krönikor och 41 evenemang. En krönika med saknad källförfattare lämnades utanför urvalet. Körningen skapade 248 utkast; två evenemang blockerades av `invalid_event_range` respektive `incomplete_event_date`. Två andra datumgiltiga evenemang stageades och importerades i körning `826e4906-818c-4f3f-b01f-62654e5b0b47`, som fick status `complete`. Det gav **250 objekt**: 90 Artiklar, 79 Krönikörer, 41 Evenemang och 40 Organisationer. De har 608 kanoniska tagglänkar och 250 källbindningar. Den första körningen står kvar som `needs_attention` för att de två felaktiga källposterna ska vara spårbara; de ingår inte i de 250 objekten.

Efter importen misslyckades en manuell publicering av Artikel `1161` med HTTP 400 eftersom dess krönikör fortfarande var ett utkast. En riktad preflight av samtliga 250 objekt hittade inga andra innehålls- eller taggfel; 39 krönikor hade samma författarberoende. Efter verifierad full backup till `/private/tmp/eceee-v4-2-before-publish-250-20261102.dump` (mode 0600) publicerades först samtliga 79 krönikörer och därefter organisationer, evenemang och Artiklar genom `ObjectVersionWorkflow`. Slutkontrollen visade **250 publicerade objekt med aktiva versioner** och fortsatt 54 testsidor. Artikel `1161` och krönikören `1038` verifierades som `live` via dev-API:t; artikelns publiceringspanel i Chrome visar `Current state: Live`. Den lokala maskinnyckeln saknar rättighet till publicerings-API:t (403), så ingen ny nyckel eller utökad behörighet skapades. Framtida redaktionella importkörningar skapar fortfarande utkast tills en separat publicering görs.

De 186 fungerande legacyfilerna i mediebiblioteket behölls och återanvändes vid nyimporten; medieposter och testsidor ingick inte i objektrensningen. Tolv bildinslag i de nya objektens innehåll länkar till elva aktiva mediefiler, och alla elva svarade HTTP 200. Samtliga 116 unika mediefiler som används i de 79 porträttfälten och 40 logotypfälten är också aktiva. Artikel `1161` kontrollerades även i Chrome: bilden laddades och visades i sin naturliga bredd 426 px. Testsidornas sparade widgetdata innehåller inga direkta objekt-ID:n som behöver omkopplas efter rensningen.

Den tidigare isolerade tenanten `legacy-import-dev` togs därefter bort ur `q6n9v2_dev_import`, inklusive dess fyra importkörningar, 834 manifestposter, 615 bindningar och 615 objekt. En verifierad backup togs först till `/private/tmp/eceee-isolated-before-tenant-delete-20261102.dump` (mode 0600). Databasen och dess `default`-tenant behölls. Fortsatta lokala prov ska riktas mot `eceee-production-copy`, inte den isolerade tenanten.

För kommande prov används samma mappning vid stage och apply:

```sh
python manage.py migrate_legacy_editorial preflight --tenant TARGET_TENANT --inventory
python manage.py migrate_legacy_editorial stage --tenant TARGET_TENANT --preset dev --mapping /secure/path/site2-map.json --limit 2
python manage.py migrate_legacy_editorial apply --tenant TARGET_TENANT --run RUN_ID
python manage.py migrate_legacy_editorial report --tenant TARGET_TENANT --run RUN_ID
```

`apply` kan köras igen med **samma** `RUN_ID` efter avbrott. Varje färdig post
committas separat och behåller sin status; väntande och felade poster provas igen.
Kör `report` när som helst, även om processen dog mitt i körningen. En sådan
körning kan fortfarande stå som `running` i databasen, men rapportens `pending`
visar det återstående arbetet. Manifestet måste ha stageats färdigt innan `apply`
startar. Om själva källhämtningen under `stage` avbryts skapas ingen partiell
körning; starta då om `stage` med ett färskt källurval.

För ett **fullständigt lokalt prov** efter att ett komplett devprov har granskats
och accepterats med `accept-sample`, använd den granskade site-2-kartan och
`--preset all`. Gör en ny källinventering först och jämför antalen med det
stageade manifestet. `stage` kontrollerar också att antal publicerade poster per
resurs stämmer med inventeringen både före och efter hämtningen; en ändring eller
ofullständig hämtning stoppar körningen innan manifestet sparas. Den lokala
måltenanten är `eceee-production-copy`.

```sh
python manage.py migrate_legacy_editorial preflight --tenant eceee-production-copy --inventory
python manage.py migrate_legacy_editorial stage --tenant eceee-production-copy --preset all --mapping /secure/path/site2-map.json --accepted-sample-run ACCEPTED_RUN_ID
python manage.py migrate_legacy_editorial apply --tenant eceee-production-copy --run FULL_RUN_ID --report-file /secure/path/full-import-report.json
python manage.py migrate_legacy_editorial report --tenant eceee-production-copy --run FULL_RUN_ID --report-file /secure/path/full-import-report.json
```

Rapportfilen skrivs atomärt med läsrättighet enbart för ägaren. JSON-rapporten
innehåller totalt antal, behandlade, lyckade och uppmärksamhetskrävande poster,
status per resurs, antal per felorsak samt käll-ID för varje blockerad, misslyckad
eller konfliktande post. Väntande poster räknas men listas inte individuellt.
`--include-items` lägger till samtliga manifestposter när en fullständig
avstämningslista behövs. Ett misslyckande i
`apply` behöver ingen ny stage-körning: åtgärda orsaken och kör samma `apply`
igen. Importen skapar utkast och publicerar inte objekten.

`stage` fryser källposter, kartans hash, uppslagna mål-UUID:n och måltermrevisioner i manifestet. `apply` kontrollerar dem igen, använder ett importlås per tenant/namespace och arbetar per post. Ändrade eller saknade måltermer blockerar körningen. Beständiga källbindningar gör återkörning idempotent; redaktionellt ändrade målobjekt skrivs inte över. Pressmeddelande styrs bara av NewsType modell+ID 4 på site 2. Evenemangens val mappas med exakt fältbundet värde. Ingen term skapas under importen.

Efter manuell granskning kan ett komplett devprov accepteras med `accept-sample --run RUN_ID --confirm-manifest EXACT_MANIFEST_HASH`. En ändrad karta, definition eller målterm ogiltigförklarar acceptansen för en full körning. Det fullständiga lokala provet är förberett men ännu inte genomfört. Produktionsimport kräver en separat miljö- och ägarprövning.

## Verifiering

Termkompilatorn kontrollerar exakt 698 identiteter och den beslutade ämnesplaceringen utan cirklar. Riktade Python- och Django-tester täcker mappning, alias/okänd källa, identitetsbundna evenemangsval, nyckelord på alla fyra måltyper, återkörning och konflikter. De lokala proven visar inte att alla 19 729 publicerade källposter enligt inventeringen 2026-11-02 kan importeras utan avvikelser. Källans ID-paginering är inte en transaktionssnapshot. Kör därför ny inventering och granska blockerade poster före varje större körning.
