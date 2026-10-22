---
id: ADR-0046
title: Gemensam Artikel och avgränsad legacyimport
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0034
  - PRD-0012
  - PRD-0031
supersedes: []
superseded_by: []
---

# ADR-0046: Gemensam Artikel och avgränsad legacyimport

## Context

Ägaren vill förenkla ECEEE:s innehållsmodell utifrån sex innehållsslag: nyhet, krönika, krönikör, evenemang, publikation och organisation. Nyheter och krönikor ska kunna blandas som samma sorts objekt. Hierarkisk klassificering enligt PRD-0031 förutsätts. Proceedings och medlems-/externanvändarfunktioner hanteras separat.

PRD-0012 beskriver en redan startad importerare med måltypen `news` och fem klassificeringsobjekt. ADR-0025 bestämmer ett avgränsat läsande legacy-API. Dessa befintliga kontrakt får inte ändras implicit bara för att nästa målmodell blir enklare.

## Decision

### Fem tekniska objekttyper

Använd `article`, `columnist`, `event`, `library_item` och `organization`. Nyheter och krönikor är inte separata nya objekttyper. Publikation använder det befintliga tekniska namnet `library_item`.

`article` har gemensamma fält och rendering. Innehållsslag ligger enbart i det gemensamma klassificeringssystemet: Nyhet, Krönika eller Pressmeddelande, där Pressmeddelande ligger under Nyhet. En publicerad artikel ska ha exakt en uttrycklig tilldelning i denna avsedda dimension. Ingen parallell `articleKind` lagras. Detta är artikelns konsumentvalidering, inte en global ändring av PRD-0031:s stöd för flera termer. Krönikor kräver en eller flera publika krönikörsreferenser; en krönikör är inte ett konto.

Listor och sökning arbetar mot en gemensam artikelmängd före filtrering, sortering och paginering. En sammanslagning av två redan paginerade listor är inte en korrekt ersättning.

### Begränsat importurval

Importera publicerade legacy-poster inklusive arkiv, inom den uttryckligt valda ECEEE-källan och webbplatsmängden. Inventera utkast och avpublicerade poster men importera dem inte automatiskt. Behåll utgångstider och åtkomstgränser; publicerad källstatus är inte ett godkännande av offentlig v4-publicering.

Proceedings, användarkonton, medlemsbehörigheter och externa inskickningsflöden är utanför. Publika organisationspresentationer ingår. Sidträd, teman och sidlayout migreras inte generellt i denna leverans.

### Kontrollerad övergång

Återanvänd transporten i ADR-0025 och gemensam klassificering i ADR-0043. Lägg till granskade källresurser för de ytterligare innehållstyperna; öppna inte en generell databas-/modellfrågefunktion.

PRD-0034 är den nya målbilden för artikelimporten. Den ersätter vid denna imports verifierade övergång PRD-0012:s krav på måltypen `news` och separata klassificeringsobjekt med `article` och kanoniska klassificeringstilldelningar. PRD-0012:s provgranskning, innehålls-/media-/länkkvalitet och återupptagbarhet återanvänds. Den gamla importeraren ändras eller avvecklas inte genom detta dokumentationsbeslut.

Behåll de fem gamla nyhetsdimensionernas betydelse enligt PRD-0031. Gemensamt innehållsslag tillför en redaktionell dimension; det medför ingen automatisk sammanslagning av äldre nyhetstyper, kategorier eller nyckelord. Redaktionell förenkling görs med granskad mappning.

Beständig importidentitet utgörs av källsystem, källscope, modell och original-ID. Slug och titel är presentation, inte identitet. Kollisioner mellan nyheter och krönikor löses deterministiskt och gamla URL:er behålls i en separat mappning.

Importerade objekt förbereds för granskning. Automatisk återimport får inte skriva över redaktionella ändringar i v4. Befintliga redan importerade `news`-/`column`-objekt kräver en separat avstämd övergång till måltypen, inte blind nyimport eller automatisk radering.

## Rationale

En artikeltyp ger en gemensam redigerings- och publiceringsgrund och korrekt blandad listning. Klassificering skiljer innehållsslagen utan dubbla kroppsfält, separata arkivmotorer eller konkurrerande typfält. Fem tekniska objekttyper täcker det överenskomna behovet utan att dra in proceedings eller medlemsplattformen.

En explicit importmatris och avvikelselista gör förenkling möjlig utan att okända källfält tyst tappas bort eller återuppstår som onödiga redigeringsfält.

## Consequences

- Målobjekt, widgetar, listfilter och käll-API behöver anpassas och verifieras innan den nya importen kan användas.
- Sammanslagningen kan ge slugkollisioner och kräver separata source-to-target- och URL-mappningar.
- Källantal, verklig datakvalitet, relationer och filåtkomst återstår att inventera. Exporterade modellfiler bevisar strukturkandidater, inte aktuellt databasinnehåll.
- Klassificering, import och aktivering har separata verifieringssteg. Inga produktionsåtgärder är godkända genom detta ADR.
- PRD-0012, ADR-0025 och ADR-0043 förblir aktiva för sina befintliga tillämpningar; detta ADR anger den avgränsade nya målmodellen och övergången.

## Alternatives Considered

- Separata `news` och `column` med gemensam listning: möjligt, men valt bort av ägaren för att få en enklare gemensam artikelmodell.
- Separat fast artikeltypfält och motsvarande tagg: valt bort för att undvika två källor till samma innehållsslag.
- Importera alla legacy-modeller och utkast: valt bort eftersom målet är förenkling och ett granskningsbart publicerat urval.
- Automatisk rekonstruktion av konferensorganisationer, medlemskonton och relationer ur fritext: valt bort eftersom källan inte ger säker identitet och delarna ligger utanför omfattningen.

## Links

- [PRD-0034](../../prds/0034-simplified-legacy-content-import.md)
- [PLAN-0004](../../plans/0004-simplified-legacy-content-import.md)
- [PRD-0012](../../prds/0012-legacy-news-migration.md)
- [PRD-0031](../../prds/0031-shared-classification.md)
- [ADR-0025](0025-authenticated-legacy-migration-api.md)
- [ADR-0043](0043-classification-governance.md)
