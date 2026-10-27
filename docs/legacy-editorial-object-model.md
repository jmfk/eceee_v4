# Objektmodell för ECEEE:s redaktionella legacyimport

Detta är en fristående målbeskrivning att ge ett annat projekt. Skapa **fyra objekttyper** för den aktuella importen: `article`, `columnist`, `event` och `organization`. De fem källresurserna är `news`, `columns`, `columnists`, `events` och `organizations`. Både nyheter och krönikor blir `article`. Den befintliga typen `library_item` får finnas kvar i ECEEE v4, men ingen publikation eller `ReportPage` ska skapas/importeras inom detta uppdrag.

Visa alla fyra importerade objekttyper på huvudnivån i objektöversikten. `columnist` är en egen huvudtyp även om artiklar refererar till krönikörer som författare.

| Källresurs | Måltyp | Redaktionell benämning |
| --- | --- | --- |
| `news` | `article` | Nyhet eller Pressmeddelande |
| `columns` | `article` | Krönika |
| `columnists` | `columnist` | Krönikör |
| `events` | `event` | Evenemang |
| `organizations` | `organization` | Organisation |

## Gemensam objektstruktur

Varje objekt har en beständig objektidentitet, tenant/namespace, `title`, `slug`, skapare, status och versioner. Det redaktionella brödtextinnehållet ligger i en ordnad `main`-yta med innehålls- och tabellwidgetar, inte i ett separat objekttypsfält. Versionen bär strukturerade fält, klassificeringstilldelningar, media och publiceringsmetadata. Importen skapar **utkast**; publicering är ett separat beslut.

För importerade objekt sparas källsystem, site, resurs, original-ID och original-URL som proveniens. En separat beständig källbindning knyter denna identitet till målobjektet. Slug eller rubrik är aldrig ensam importidentitet. Källans publicerings- och utgångstid bevaras skilda från objektets skapandetid och artikelns visningsdatum. Upprepad import får inte skriva över ett målobjekt som redigerats manuellt.

Fältnamnen nedan är profilens portabla `camelCase`-namn. Ett annat projekt kan översätta lagringsnamnen, men bör behålla betydelse, typ och relationers kardinalitet.

## `article` – Artikel

| Fält | Typ | Betydelse |
| --- | --- | --- |
| `summary` | flerradig text | Ingress. |
| `presentationalPublishingDate` | datum och tid | Historiskt visningsdatum; används för redaktionell datumordning. |
| `sourceDate` | datum och tid, valfritt | Ursprunglig källdatering, separat från visningsdatum. |
| `externalUrl` | URL, valfri | Extern ursprungs-/vidareläsningslänk. |
| `featuredImage` | mediareferens, valfri | Huvudbild. |
| `authors` | lista av referenser till `columnist` | Krönikörer; kan innehålla flera. |
| `main` | ordnat innehåll | Artikeltext och eventuella tabeller/media. |

**Innehållsslag** är en klassificering, inte ett extra `type`-fält på artikeln. Termerna är `Nyhet` (`news`), `Krönika` (`column`) och `Pressmeddelande` (`press-release`); Pressmeddelande är barn till Nyhet. En publicerad artikel måste ha **exakt ett** godkänt innehållsslag. En Krönika måste dessutom ha minst en refererad krönikör som redan är publicerad. Importen skapar aldrig en påhittad krönikör. Legacy `NewsType` modell+ID 4 ger Pressmeddelande; ursprunglig nyhetstyp bevaras också i klassificeringen Nyhetstyp.

## `columnist` – Krönikör

| Fält | Typ | Betydelse |
| --- | --- | --- |
| `firstName`, `lastName` | text | Publikt namn. |
| `prefix` | text, valfri | Titel eller namnled. |
| `affiliation` | text, valfri | Beskriven tillhörighet; ingen automatisk organisationsrelation. |
| `homePage` | URL, valfri | Publik webbplats. |
| `photo` | mediareferens, valfri | Valt porträtt. |
| `main` | ordnat innehåll | Biografi. |

Krönikörer är innehållsobjekt, inte användarkonton. Importens porträttval föredrar kvadratiskt, sedan horisontellt och sist vertikalt porträtt.

## `event` – Evenemang

| Fält | Typ | Betydelse |
| --- | --- | --- |
| `eventStartDate` | datum | Entydigt startdatum för kalendern. |
| `eventEndDate` | datum, valfritt | Slutdatum, inte före startdatum. |
| `eventTime` | text, valfri | Källans tidstext när exakt tidsmodell saknas. |
| `organiser` | text, valfri | Arrangörsnamn; skapar ingen organisationsrelation. |
| `venue` | text, valfri | Plats. |
| `focusAreas` | flerradig text, valfri | Fokusområden i källans fria text. |
| `externalUrl` | URL, valfri | Evenemangets webbplats. |
| `main` | ordnat innehåll | Beskrivning. |

Ofullständiga eller motsägande datum blockeras i importen; den hittar inte på dag eller tid. `eventType` och `eventCategories` i legacy blir klassificeringar med identitet baserad på **site + fältnamn + exakt valvärde**.

## `organization` – Organisation

| Fält | Typ | Betydelse |
| --- | --- | --- |
| `fullName` | text | Publikt organisationsnamn; krävs för en importerad post. |
| `homePage` | URL, valfri | Publik webbplats. |
| `logo` | mediareferens, valfri | Logotyp. |
| `country` | text, valfri | Land enligt källan. |
| `isInternational` | boolesk, valfri | Källans internationell-markering. |
| `main` | ordnat innehåll | Publik presentation. |

Interna organisationsnamn, medlemskap, behörigheter och kontouppgifter är inte publika objektfält. Krönikörens fria `affiliation` kopplas inte automatiskt till ett organisationsobjekt.

## Klassificeringar som ska finnas

Klassificeringarna är **typade, flervärda tilldelningar med hierarkiska termer**. Samma termnamn i två typer innebär inte samma term. Förbered och godkänn termerna separat innan import; importen skapar inga termer.

| Klassificering (`key`) | Namn | Används på |
| --- | --- | --- |
| `article_kind` | Innehållsslag | Artikel; exakt en vid publicering |
| `news_type` | Nyhetstyp | Artikel |
| `news_category` | Nyhetskategori | Artikel |
| `news_source` | Källa | Artikel |
| `news_topic` | Ämne | Artikel och Evenemang i denna import |
| `news_keyword` | Nyckelord | Artikel, Krönikör, Evenemang, Organisation |
| `general` | Allmänt | Alla fyra; används bland annat för grenen Legacy navigation |
| `event_type` | Evenemangstyp | Evenemang |
| `event_category` | Evenemangskategori | Evenemang |
| `organization_affiliation` | Organisationstillhörighet | Organisation |
| `organization_category` | Organisationskategori | Definitionen finns, men inga använda källtermer ingår i den granskade site-2-kartan |

Ämne har sex temagrenar: Climate & environment, Energy, Buildings, Transport, Policy & society samt Industry & technology. Ett fåtal ämnen ligger i roten; COP24–COP31 ligger under UN climate conferences. Nyckelord och Källa är i huvudsak platta. Nyhetstyp, Nyhetskategori, Evenemangstyp, Evenemangskategori och Organisationstillhörighet har de uttryckligt beslutade grenarna. Allmänt innehåller Legacy navigation för fem äldre navigationskategorier. Den **fullständiga** termförteckningen, alla föräldrar, alias och beslutade sammanslagningar ska hämtas ur `site2_terms.json` + `site2_decisions.json` via `scripts/compile_legacy_terms.py --review ...`; dessa grupperingsrubriker ersätter inte termkartan.

ECEEE v4:s befintliga profil innehåller även `library_item` och `publication_category`. Ett annat projekt behöver inte skapa dem för denna import. Om det projektet redan har sådana definitioner ska de lämnas orörda.

## Portabelt underlag

`backend/content_migration/legacy_content/profile.py` är den exakta v4-definitionen för fält, grundtermer, slot och tillåtna klassificeringar. `site2_terms.json` och `site2_decisions.json` är versionsstyrt käll- och beslutsunderlag. Kompilatorn ger ett portabelt definitions-/termpaket, en importkarta och en radvis granskningsvy:

```sh
python3 scripts/compile_legacy_terms.py --bundle /secure/path/site2-bundle.json --mapping /secure/path/site2-map.json --review /secure/path/site2-review.json
```

Det andra projektet bör behandla profilens fyra aktiva typer och relationer som målkontraktet och använda den radvisa granskningsvyn för termmappningen. Råa legacyinnehållsposter, målmiljöns UUID:n och hemligheter ingår inte i detta dokument.
