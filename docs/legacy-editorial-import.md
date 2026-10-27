# Redaktionell legacyimport: site 2

Importen omfattar `news`, `columns`, `columnists`, `events` och `organizations`. De ger Artikel, Krönikör, Evenemang och Organisation. `publications` och `ReportPage` ingår inte; måltypen `library_item` finns kvar. Alla importerade objekt är utkast.

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
| Organisation | Publikt namn, land | Land, internationell ja/nej, skapad; organisationskategori, organisationstillhörighet, nyckelord |

`library_item` behålls utan importanpassade förval. Sök- och filterinställningarna kan
ändras i webben utan att importprofilen eller källtermkartan ändras.
En exporterad definitionsbundle tar med valda listfält och använder klassificeringens
stabila nyckel för taggfilter; målmiljön löser nyckeln till sitt eget termtyps-ID.

## Granskad termkarta

`backend/content_migration/legacy_content/site2_terms.json` innehåller de 698 använda källidentiteterna med originalnamn och användningsantal. `site2_decisions.json` innehåller de beslutade grenarna, barnrelationerna, namnen och sammanslagningarna. `term_plan.py` validerar täckning, identiteter, sammanslagningar och föräldragraf och kompilerar ett portabelt paket med 703 måltermer inklusive de tre innehållsslagen. Källidentitet är site, dimension, modell och ID; evenemangens textval använder site, fältnamn och exakt värde. En ny, omdöpt eller omföräldrad källterm stoppar den berörda stage-körningen. Källorna med tomt namn respektive `external-resource` är uttryckligen mappade till Okänd källa.

```sh
python3 scripts/compile_legacy_terms.py --bundle /secure/path/site2-bundle.json --mapping /secure/path/site2-map.json --review /secure/path/site2-review.json
python3 scripts/eceee_content_definitions.py diff --bundle /secure/path/site2-bundle.json --tenant TARGET_TENANT
python3 scripts/eceee_content_definitions.py apply --bundle /secure/path/site2-bundle.json --tenant TARGET_TENANT --confirm-digest BUNDLE_DIGEST
```

Termberedningen använder CMS-API:ts taxonomirättigheter. Den vägrar ersätta en befintlig term med motstridigt namn, förälder, status eller alias. Läs tillbaka diff efter apply. API-profilen ligger i en skyddad lokal env-fil och ska inte skrivas i Git eller terminalutdata. För produktionsmiljö gäller separat ägargate enligt `AGENTS.md`.

## Lokal import

Den isolerade tenantens identitet är `legacy-import-dev`, namespace `default`, i databasen `q6n9v2_dev_import` på delad PostgreSQL. Databasen och dess tjänst ägs inte av importprojektet. Innan lokal rensning 2026-10-27 togs en läsbar, skyddad pg_dump till `/tmp/eceee-legacy-import-dev-preclean-20261027.dump` (mode 0600). Rensningen tog exakt 2 äldre site-0-körningar, 105 importposter, 100 bindningar, 100 utkast med 100 versioner och 78 testtermer. Tenant, definitioner och de tre grundtermerna behölls. Inga mediafiler fanns då för denna tenant. Den gamla utvecklingsworktreen och dess `.env` hade redan försvunnit; den gamla containerkonfigurationen används inte som kodkälla.

Ett nytt, lokalt prov från site 2 frystes mot den granskade kartan: körning `7139671d-0e72-4092-b273-ff2417b77fd6`, manifest `6bc6f10082dea4ae1d9d1ed1b90169bdf4f2dc1c67991430a4cf4e06b60d4bf2`. Två verkliga poster från var och en av de fem resurserna importerades: 10 utkast, 10 versioner, 19 termtilldelningar och 4 mediafiler. Krönikorna fick varsin författarrelation; inga poster blockerades eller fick bildplatshållare. Återkörning skapade inga extra versioner. **Provet är inte accepterat**: redaktionell kontroll av innehåll, media, relationer och publiceringslämplighet återstår.

För kommande prov används samma mappning vid stage och apply:

```sh
python manage.py migrate_legacy_editorial preflight --tenant TARGET_TENANT --inventory
python manage.py migrate_legacy_editorial stage --tenant TARGET_TENANT --preset dev --mapping /secure/path/site2-map.json --limit 2
python manage.py migrate_legacy_editorial apply --tenant TARGET_TENANT --run RUN_ID
python manage.py migrate_legacy_editorial report --tenant TARGET_TENANT --run RUN_ID
```

`stage` fryser källposter, kartans hash, uppslagna mål-UUID:n och måltermrevisioner i manifestet. `apply` kontrollerar dem igen, använder ett importlås per tenant/namespace och arbetar per post. Ändrade eller saknade måltermer blockerar körningen. Beständiga källbindningar gör återkörning idempotent; redaktionellt ändrade målobjekt skrivs inte över. Pressmeddelande styrs bara av NewsType modell+ID 4 på site 2. Evenemangens val mappas med exakt fältbundet värde. Ingen term skapas under importen.

Efter manuell granskning kan ett komplett devprov accepteras med `accept-sample --run RUN_ID --confirm-manifest EXACT_MANIFEST_HASH`. En ändrad karta, definition eller målterm ogiltigförklarar acceptansen för en full körning. Full import och produktion ingår inte i denna fas; de kräver färsk källavstämning, eget prov och separata miljö-/ägargates.

## Verifiering

Termkompilatorn kontrollerar exakt 698 identiteter och den beslutade ämnesplaceringen utan cirklar. Riktade Python- och Django-tester täcker mappning, alias/okänd källa, identitetsbundna evenemangsval, nyckelord på alla fyra måltyper, återkörning och konflikter. Lokalt prov ovan är ett litet innehållsurval; det visar inte att alla 19 718 publicerade källposter kan importeras utan avvikelser. Källans ID-paginering är inte en transaktionssnapshot. Kör därför ny inventering och granska blockerade poster före varje större körning.
