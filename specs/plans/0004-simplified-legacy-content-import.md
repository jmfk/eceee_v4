---
id: PLAN-0004
title: Import av förenklat ECEEE-innehåll från legacy
status: in-progress
created: 2026-10-22
related_prds:
  - PRD-0034
  - PRD-0031
  - PRD-0012
  - PRD-0021
related_adrs:
  - ADR-0046
  - ADR-0043
  - ADR-0025
---

# PLAN-0004: Import av förenklat ECEEE-innehåll från legacy

## Mål och kunskapsläge

För över det inkluderade publicerade ECEEE-innehållet till Artikel, Krönikör, Evenemang och Organisation i ett gemensamt hierarkiskt klassificeringssystem. Den femte befintliga objekttypen Publikation behålls i profilen men används inte av denna legacyimport enligt ADR-0056. Nyheter och krönikor blir Artikel och kan visas tillsammans. Proceedings och medlems-/externanvändarfunktioner ligger helt utanför arbetet.

Ägaren har valt gemensam Artikel samt publicerat innehåll inklusive arkiv. Utkast och avpublicerat material inventeras men importeras inte automatiskt. Genomförandet har startat; avsnittet nedan skiljer verifierad devimport från återstående arbete.

Mappningskandidaterna nedan bygger på dokumentkraven och modellfilerna i `extracted_models/`. Inga aktuella legacy-data har räknats eller hämtats för denna plan. Befintligt legacy-API exponerar nyheter; ytterligare resurser och uppgifter måste införas och verifieras. Klassificeringsarbetet i PRD-0031 pågår och är ett uttryckligt beroende.

## 1 Målmodell och blandning av artiklar

| Redaktionellt innehåll | Teknisk måltyp | Grunduppgifter och relationer |
| --- | --- | --- |
| Nyhet, krönika, pressmeddelande | `article` | Rubrik, slug, ingress, brödtext, visningsdatum, valfri källa/länk och källdatum, huvudbild, krönikörer och klassificering |
| Krönikör | `columnist` | Publikt namn, biografi, porträtt, organisationstillhörighet som text och webblänk |
| Evenemang | `event` | Start/slut, tidstext, arrangör som text, plats, fokusområde, typ/kategori, beskrivning och länk |
| Publikation | `library_item` | Befintlig objekttyp; ingen legacykälla importeras till den i denna omgång |
| Organisation | `organization` | Publikt namn, eventuellt publikt kortnamn, presentation, logotyp, webblänk, land och granskad klassificering |

Definiera och granska schemafälten före implementation av importerare. Använd befintliga objektversioner, innehållswidgetar, objektreferenser och media. Bevara Python-namn i `snake_case` och frontend-/schemafält enligt det befintliga explicita `camelCase`-kontraktet. Skapa ingen ny generell innehållsplattform.

### Artikelns innehållsslag

Använd en klassificering med stabil nyckel `article_kind` och trädet:

```text
Innehållsslag
  Nyhet
    Pressmeddelande
  Krönika
```

- En publicerad artikel har en uttrycklig tilldelning i denna dimension. Tilldelning av Pressmeddelande räknas som Nyhet vid sökning med underordnade termer, utan en extra Nyhet-tilldelning.
- Artikelkonsumenten validerar regeln. Lagra inget separat typfält med samma betydelse. Övriga klassificeringstyper tillåter flera termer som tidigare beslutat.
- Legacy-modellen ger Nyhet respektive Krönika. Endast en godkänd mappning av verkliga legacy-värden får ge Pressmeddelande; rubrik eller brödtext används inte som heuristik.
- Samma artikel kan visas i blandat flöde, ämnesflöde och krönikörens lista utan kopior. En gemensam fråga filtreras och sorteras före paginering.
- Gemensam standardordning är fallande `presentationalPublishingDate`, sedan stabilt objekt-ID som skiljekriterium. Datumet är ett visningsdatum, inte importens skapandetid eller publiceringsaktivering.
- Krönikor har minst en krönikörsreferens för publicering. Nyheter behöver ingen påhittad skribent. Bevara alla verkliga skribentrelationer utan godtycklig fempersonsgräns.
- Återanvänd befintliga list-/detaljwidgetar och bygg till den gemensamma artikelhanteringen i Django, React och publisher. Temats utseende kräver ingen separat importmodell.
- Nya artiklar får kanonisk detaljväg `/articles/<slug>/`. Tidigare nyhets-/krönikevägar och importerade legacy-URL:er registreras som verifierade alias/redirects. Listornas placering på exempelvis News kan behållas oberoende av teknisk detaljväg.

## 2 Källor och fältmappning

### Gemensam importregel

Rubrik och slug förs till objektets stödda identitets-/versionsfält enligt det kanoniska publiceringsflödet. Innehåll förs till `main`-slotens widgetar. Legacy-ID, källmodell, källscope, ursprunglig URL, källrevision och mappningsversion registreras separat som importproveniens.

Visningsdatum mappas från `presentational_publishing_date` där det finns. För artiklar används annars i ordning källdatum, verkligt publiceringsdatum och källans skapandetid, med rapporterad fallback. Om allt saknas blir posten en manuell avvikelse; dagens datum används aldrig. Bevara original precision och tidszon; källdatum får inte tyst trunkeras eller sammanblandas med visningsdatum. Publicerings-/utgångsdatum förs separat till versionsflödet.

| Legacy-källa | Till mål | Automatisk mappning efter kontraktskontroll | Redaktionell/manuell hantering |
| --- | --- | --- | --- |
| `eceeenews.eceeeNews` | Artikel / Nyhet | Rubrik, ingress/description, content, visningsdatum, source_date, external_url, publish_on_front_page, klassificeringar, media i innehållet | Pressmeddelande kräver termmappning; huvudbild utan uttrycklig källa väljs manuellt; publiceringsundantag och HTML-avvikelser granskas |
| `eceeecolumnists.EceeeColumn` | Artikel / Krönika | Rubrik, content, visningsdatum, priority, columnists-relationer, ämnen/kategorier och bilder | Saknad/opublicerad skribent, ej återfunna relationer och avvikande innehåll blockerar godkännande |
| `eceeecolumnists.EceeeColumnist` | Krönikör | first_name, last_name, prefix, affiliation som text, home_page, biografi och porträtt | Dubbletter och oklara namn bedöms manuellt; ingen automatisk organisationskoppling från affiliation |
| `eceeecalendar.EceeeCalenderEvent` | Evenemang | Publicerad content, event_date/event_end_date när entydiga, event_time som text, organiser, venue, focus_areas, url, typ/kategori, priority | Ofullständiga/flexibla datum, oklar tidszon och motsägande datum går till åtgärdslistan; draft/draft_title används aldrig som publicerad text |
| `eceeelibrary.EceeeLibraryItem` | Ingår inte i denna import | Källresursen gav 0 poster för site 2; ägaren valde 2026-10-27 att ignorera den i denna import | Den befintliga måltypen `library_item` ändras inte |
| Bilagor till inkluderade objekt | Bilagor/media på ägarobjekt | Fil, extern URL, titel, beskrivning och ursprunglig ordning | Saknade filer, skyddad nedladdning, oklara rättigheter och felaktig filtyp kräver åtgärd; `EceeeLibraryFileItem` ingår inte |
| `eceeememberforum.EceeeMemberOrganization` | Organisation | organizations_full_name eller verifierat offentligt visningsnamn, text, homepage, logo, country, is_international och relevanta publika kategorier | Fältet organization är märkt internt i modellen och importeras inte som publikt kortnamn utan kontroll; aktuellt medlemskap härleds inte från gammal post |
| `eceeebase.ReportPage` | Ingår inte i denna import | Ingen inventering eller automatisk import | Sidlayout och sidträd importeras inte |

För krönikörsportätt används legacy-valets ordning: kvadratiskt, annars horisontellt, annars vertikalt porträtt. Bevara övriga befintliga porträtt som media, utan att skapa fler obligatoriska profilfält. Uppgifter som senaste krönikedatum beräknas från importerade artiklar, inte som en separat redaktionell sanning.

`focus_areas` och andra fria textfält behålls som text om ingen godkänd termmappning finns. Skapa inte organisationer, datum eller tagghierarkier genom fri gissning eller AI.

Evenemang med endast år/månad eller annan otillräcklig datumprecision får behålla ursprunglig datumtext i importunderlaget men aktiveras inte med ett påhittat exakt kalenderdatum. Inventeringsrapporten ska avgöra omfattningen av denna manuella kö innan full import planeras.

Generiska bilagor måste inventeras via sina verkliga ägarrelationer; att kopiera bara dokumentlänkar ur HTML är inte tillräckligt. Bilagor till undantagna proceedings-objekt följer inte med. Proceedings-material som även ligger i biblioteket eller bland rapportsidor undantas också. Urvalet avgörs av den granskade innehållsmappningen, inte enbart av vilken tabell materialet ligger i; oklara blandposter hålls för manuell bedömning.

### Publika organisationer och partners

Importera fullständiga publika medlemsorganisationspresentationer utan att skapa konton eller medlemsbehörigheter. Importen får inte påstå att organisationen fortfarande är medlem; historiska roller och aktualitet granskas inför publik listning.

Partnerlogotyper i sidinnehåll får kopieras som media där innehållet ingår, men ger inte automatiskt en organisationspost. Om en viktig partner bara finns i konferens-/proceedingsmaterial läggs den i en manuell insamlingslista. Denna import hämtar inte `ConferencePage`, `ConferenceLogo`, paneler eller papers.

## 3 Klassificering med förenklad redaktionell användning

Återanvänd PRD-0031 och ADR-0043, inklusive behörighetskontroll för importkontot. Förbered godkända termer innan innehållet kan aktiveras. Importen kringgår inte moderering och godkänner inte godtyckliga nya termer.

| Legacy-dimension | Hantering |
| --- | --- |
| NewsType | Bevarad nyhetstyp i gemensam klassificering. Explicit godkänd mappning kan dessutom bestämma Artikelns innehållsslag Pressmeddelande |
| NewsCategory | Bevarad kategoridimension; redaktionellt urval kan visas utan att alla äldre termer visas i standardväljaren |
| NewsSource | Källklassificering; håll isär källa som klassificering och artikelns konkreta externa URL |
| RelatedNews | Ämnen för relaterat innehåll, inte en automatisk artikel-till-artikel-relation |
| Keywords/keywords_sub och generella kategorier | Mappas enligt ursprung och granskad betydelse, med bevarade källidentiteter |
| Event type/event categories | Evenemangstyp och evenemangskategori i samma klassificeringssystem |
| LibraryCategory | Ingår inte i den aktuella importens termmappning |
| Organisationskategorier/tillhörigheter | Endast publika kategorier, med rätt källrelation verifierad; inte kontobehörigheter |

För varje använd källterm behövs en mappningsrad med källscope, modell och ID, ursprunglig förälder, måltyp/term-ID, åtgärd och motivering. Åtgärder är bevara, slå ihop genom uttrycklig mappning, manuell eller utelämna med orsak. Termer som inte används av urvalet, och inte behövs som föräldrar, behöver inte importeras.

Enklare redigering uppnås genom synliga innehållsslag, en kuraterad gemensam ämneshierarki och relevanta val per objekttyp. Bevara gamla dimensioner under övergången enligt PRD-0031; dölj dem vid behov i standardvyn. Samma stavning är inte tillräcklig grund för att slå ihop källtermer. Om en slutlig förenkling skulle ta bort betydelser som PRD-0031 kräver ska ett nytt uttryckligt beslut dokumenteras före sådan ändring.

## 4 Vad som inte överförs automatiskt

| Del | Åtgärd och skäl |
| --- | --- |
| Proceedings, konferenser, paneler, papers och FileMaker | Utanför hela denna import, även konferensbundna organisationsextrakt |
| Medlemskonton, användare, lösenord, externa ägare och behörigheter | Senare separat medlemsfunktion; publika profiler och organisationer blir inga konton |
| Eventens inskickade utkast, dirty/approved och handläggningshistorik | Inventeras men återskapas inte som nytt användarflöde. Importera enbart verifierad publicerad innehållsversion |
| Utkast, avpublicerade poster och gamla versionskedjor | Exkluderas med antal och orsak. Beroenden från publicerade poster rapporteras för manuell lösning |
| Skyddat innehåll och filer | Inventeras separat och får inte göras publika innan motsvarande åtkomstskydd finns; inga privata nedladdnings-URL:er i publikt innehåll |
| Interna kontaktfält och organisationens interna kortnamn | Inte publika fält. Bevara endast nödvändigt skyddat underlag för migreringsbedömning, inte hela persondatakopior i vanlig objektsmetadata |
| Äldre teman, mallar, CSS, scripts, sidospalter och widgetpositioner | Återskapas med v4:s sidor/widgetar där det behövs; kopieras inte som redaktionellt innehåll |
| Jobs & tenders, medlemsaktiviteter, Ecodesign-produkter och övriga äldre modeller | Utanför överenskomna innehållstyper |
| Rapport som bara finns som vanlig sida eller medlemsaktivitet | Manuell inventeringskandidat; ingen generell sid-/aktivitetsimport eller automatisk dubbelimport |
| Omärkta partnerlogotyper, dubbletter och organisationskopplingar i fritext | Manuell komplettering utan gissad organisationsidentitet |
| Trasiga bilder, filer, osäker HTML, oklar källåtkomst och otolkbara datum | Teknisk eller redaktionell åtgärd; inte tyst bortfall. Granskningsläge kan visa märkt bildplatshållare, aldrig en påhittad PDF |
| Genererade månads-/årsindex, usage counters och sista-krönika-datum | Beräknas på nytt vid behov. Nya redigeringsfält skapas inte för gamla hjälpfält |

Orden exkludera och utelämna betyder att uppgiften inte förs in i v4:s aktiva modell. De innebär inte radering av legacy. Licens-/rättighetsmetadata får inte förväxlas med medlemsbehörigheter och kastas bort.

## 5 Importflöde och avstämning

### A Inventering utan skrivning

Använd det befintliga avgränsade legacy-API:t för nyheter, krönikor, krönikörer, evenemang och organisationer med tillhörande klassificering. API:t kan exponera biblioteksresursen av kompatibilitetsskäl, men denna import väljer den inte. Källans manifest innehåller stabil identitet, faktiskt publik/utgången/skyddad status, relationer, filer och genererade original-URL:er. Sammanställ counts även för exkluderat material inom det valda urvalet utan att exportera onödiga personuppgifter.

Ingen direkt SQL, databasport eller ny SSH-tunnel införs. Befintlig API-version/News-kontrakt behålls för befintliga anrop; nya resurser annonseras uttryckligt i health/capabilities och valideras per resurs. Gamla klienter ska fortsatt fungera. Källändringar som inte är additiva kräver ett nytt versionskontrakt.

Leverera mappningsmatris, klassificeringsmappning och avvikelserapport. Varje inventerad post ska kunna räknas exakt en gång som importkandidat, manuell/blockerad eller exkluderad. Granska källans verkliga urval/relationsregler; modellnamn och `status=2` ensamt räcker inte för offentlig åtkomst.

### B Förbered målet

Granska och konfigurera de fem definitionerna genom stödda v4-arbetsflöden. Förbered och godkänn nödvändiga klassificeringar. Importens preflight är läsande och avvisar fel schema, namespace, termstatus eller behörighet.

Inventera även tidigare importerade v4-objekt. Återanvänd målidentitet när en bestyrkt källmappning finns. `news`-/`column`-objekt som redan redigerats i v4 får en manuell övergångsplan; de får inte dupliceras eller byta typ blint. Ingen radering av gamla typer/klassificeringsobjekt ingår.

### C Provimport i lokal granskningsmiljö

Välj högst 20 verkliga poster totalt från de inkluderade källorna, med minst följande täckning där verkliga exempel finns: vanlig nyhet, krönika med flera skribenter, pressmeddelande, delad slug mellan två modeller, publicerat evenemang med väntande ändring, ofullständigt datum, organisationsnamn som skiljer sig internt/publikt och ett faktiskt filfel. Saknade kantfall kompletteras med tydligt syntetiska testfixturer. Publikationer och rapportsidor ingår inte i detta importprov enligt [ADR-0056](../adrs/active/0056-exclude-legacy-publications-from-editorial-import.md).

Importera godkända termer och medieresurser som beroenden, därefter krönikörer/organisationer och slutligen artiklar och evenemang. Relationskopplingar och interna länkar avstäms efter att målidentiteterna är kända.

Granska innehåll, blandad lista, profilrelationer, datum, filer och detaljer i stödda renderingsytor. Använd befintlig provgranskningsmekanism från nyhetsimporten. Godkännande knyts till det faktiska målkontraktet och mappningsversionen; en ändring i dessa ogiltigförklarar tidigare importacceptans.

### D Återupptagbar fullimport

Återanvänd `PluginImportJob` och befintliga importtjänster, med beständiga kontrollpunkter per källobjekt och separat spårning av media/länkar. Skapa ingen ny parallell jobbmotor. Fryst körningsmanifest omfattar urval, källfingerprint, mappningsversion och kodversion. Källexport/underlag lagras skyddat utanför Git. Om källan ändras används nytt manifest eller uttrycklig avvikelse, inte tyst återanvändning av samma körning.

- Beständig source-to-target-mappning avgränsas av källsystem, källscope, modell och original-ID samt måltenant/namespace. Samma numeriska ID i Nyhet och Krönika är två olika identiteter.
- Skriv objekt, version, relationer och checkpoint atomiskt per arbetsenhet. Nytt försök efter medieuppladdning återanvänder samma deterministiska medieidentitet inom rätt tenant/namespace.
- Oförändrat underlag hoppas över. Om underlaget ändrats och målobjektet inte redigerats manuellt skapas en ny granskningsversion. Har målet ändrats manuellt registreras konflikt. Manuell redigering skrivs inte över.
- Håll ett skrivjobb åt gången för samma källurval/målscope. Fingerprintavvikelse vid resume avvisas. Fel på enskilda poster dokumenteras; fel scope, schema, auktorisering eller källkontrakt stoppar körningen.
- Spara framsteg i databasen och rapportera färdiga, återstående, fel, manuella och exkluderade poster. En avslutad körning är inte samma sak som godkänd avstämning eller publicering.
- Saknade filer och blockerade innehållsrelationer hindrar aktivering av berörda poster tills felet lösts eller en specifik avvikelse uttryckligen accepterats.

Fullimport och omkörningar skapar granskningsversioner; gamla publiceringsdatum får inte i sig publicera innehållet omedelbart. Vid separat aktivering förs granskade publicerings-/utgångstider över genom v4:s kanoniska arbetsflöde. Utgångna objekt får historiskt innehåll men blir inte aktuellt publika genom importen.

### E Länkar, URL:er och avstämning

Bevara slug om den är ledig inom måltypen. Vid kollision prioriteras befintlig bestyrkt målbindning; annars används stabil manifestordning och ett deterministiskt suffix med källmodell och original-ID. Rapportera varje ändrad slug. Dubbletter identifieras aldrig enbart genom samma titel eller slug.

Bygg URL-mappning från källans verkliga host/sökväg till målidentitet och kanonisk detaljväg. Bevara relevanta fragment och query-parametrar där de har betydelse. Kollision mellan två olika målsidor för samma gamla URL måste lösas före publicering av redirecten. Aktivera permanenta redirects först när målobjektet är publikt och godkänt; historiska/utgångna objekt får inte redirectas till en opublicerad v4-detalj.

Skriv om interna länkar först när mål kan verifieras. Länkar till proceedings och annat undantaget material behåller originaldestinationen om den fungerar; de får inte styras till en ny generell startsida. Olösta och felande länkar får en reparerbar avvikelse enligt befintlig länkrutin, med bevarad målproveniens. Ett misslyckat HEAD-anrop är inte tillräckligt bevis för att automatiskt radera en länk.

Slutrapporten avstämmer alla poster, skribentrelationer, tilldelningar, bilagor och gamla URL:er. Inga hemligheter, privata källfält eller exporter läggs i Git. Tekniskt omöjlig filåtkomst, saknade uppgifter och innehåll som vi medvetet väljer bort redovisas som skilda orsaker.

### F Staging och separat produktionsövergång

Repetera samma prov-, resume- och avstämningsflöde i staging. Prova en liten representativ omkörning och skyddet för manuellt redigerade mål. Före produktionsövergång behövs ett avgränsat stopp för ändringar i inkluderat legacy-innehåll medan slutunderlaget tas ut, importeras och avstäms; omfattning och underhållstid rapporteras inför ägargaten. Om det inte går att frysa ändringarna måste planen revideras för en verifierad deltahämtning före körning, inte improviseras under importen.

Produktion kräver egna godkännanden för käll-API/driftsättning, import och aktivering enligt AGENTS.md. Kontrollerad import får inte radera gammal data. Vid fel stoppas fortsatt aktivering, och nya granskningsversioner kan lämnas opublicerade. Efter produktionsmutation kräver en konkret återgång/återställning en ny gate; ingen automatisk databasrestaurering eller bred rensning ingår.

## 6 Genomförandebatcher och verifiering

| Batch | Sammanhängande resultat | Nödvändig lokal evidens |
| --- | --- | --- |
| 1 Inventering och kontrakt | Källresurser, counts, slutlig fält-/term-/undantagsmatris och verifierat urval | Kontraktstester för tillåtna resurser, scope, status/åtkomst, paginering, relationer och bilagor |
| 2 Gemensam Artikel och måltyper | Gemensam redigering, innehållsslag, blandad listning, detalj och klassificeringsvalidering | Fokuserade API-/widget-/renderingstester för sortering före paginering, Nyhet med underordnad Pressmeddelande, författare och datum |
| 3 Import av inkluderade måltyper | Dry-run, källidentiteter, provimport, media, relationer och konfliktrapport | Fältmappning, publicerad text trots eventutkast, porträtt, publik/intern organisation, filer och ofullständiga datum |
| 4 Avstämning och övergång | Resume, URL-mappning, gammal v4-import och stagingrepetition | Avbrott efter DB-/mediegränser, dubbla körningar, ändrat underlag, skyddade manuella ändringar, slugkollision och återhämtning |

Klassificeringens PRD-0031 färdigställs och verifieras för nödvändiga delar innan batch 2–3 godkänns. Batcherna är arbetsenheter; de innebär inte en PR per deländring. Kör fokuserade tester under utveckling och en sammanhållen migrations-/integrationsgranskning före staging/produktionsförberedelse.

Importen är godkänd först när varje inventerad post har en förklarad disposition, alla accepterade beroenden kan avstämmas och en blandad artikelvy visar rätt innehåll med korrekt global ordning. Manuella avvikelser ska ha ägare och åtgärd; en tom fellogg utan avstämning är inte bevis på komplett import.

## Referenser

- [PRD-0034](../prds/0034-simplified-legacy-content-import.md) och [ADR-0046](../adrs/active/0046-unified-articles-and-bounded-legacy-import.md).
- [PRD-0031](../prds/0031-shared-classification.md), [ADR-0043](../adrs/active/0043-classification-governance.md) och [ADR-0025](../adrs/active/0025-authenticated-legacy-migration-api.md).
- [Befintlig nyhetsimport](../../docs/legacy-news-migration.md) och [exporterade legacy-modeller](../../extracted_models/README.md).
- Funktionsunderlag: `eceee_web_specifications_sep26.docx`, ägarens avgränsningar och uttryckliga val i denna planering. Fältmappningen bygger dessutom på legacy-modeller och ska verifieras mot verkliga data; dokumentkraven ensamma fastställer inte dessa tekniska fältnamn.

## Genomförandestatus 2026-10-22

Fem måltyper och klassificeringsdefinitioner finns i en isolerad devmiljö. 100 verkliga legacy-nyheter finns som artikelutkast; samma import kan återupptas utan nya objekt/versioner. Definitioner kan exporteras och jämföras inför senare synkning. [Körinstruktioner och kvarvarande begränsningar](../../docs/legacy-editorial-import.md).

Det nya källkontraktet är implementerat separat men inte driftsatt. Därför återstår riktiga prov för krönikor och övriga typer, fullständig inventering/undantagsmatris, gammal v4-import, länkavstämning, publik rendering och stagingrepetition. Produktionsimport och aktivering har inte utförts. Den kompatibla gamla News-importen är uttryckligen dev-only och får inte godkännas som fullimportens prov.
