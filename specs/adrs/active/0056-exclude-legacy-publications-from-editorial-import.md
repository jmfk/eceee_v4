---
id: ADR-0056
title: Uteslut legacybibliotek och rapportsidor från aktuell innehållsimport
status: accepted
date: 2026-10-27
related_prds:
  - PRD-0034
supersedes: []
superseded_by: []
---

# ADR-0056: Uteslut legacybibliotek och rapportsidor från aktuell innehållsimport

## Context

PRD-0034 och ADR-0046 beskriver fem tekniska måltyper, inklusive `library_item`. Legacy-API:ts läsande inventering 2026-10-27 för `sourceSite: 2` gav noll `EceeeLibraryItem`-poster. Ägaren bedömer att sådana poster saknas och har beslutat att ignorera dem. `ReportPage` var en möjlig manuell kandidat, men ägaren vill ignorera även dessa i den aktuella importen.

## Decision

Den aktuella legacyimporten väljer inte `publications`/`EceeeLibraryItem`, `EceeeLibraryFileItem` eller `ReportPage`. Ingen fortsatt inventering, termmappning, provimport, syntetiskt publikationsprov eller bilageutveckling görs enbart för dessa källor. Import och prov fokuserar på nyheter, krönikor, krönikörer, evenemang och organisationer.

Den redan implementerade måltypen `library_item` och dess befintliga profil lämnas orörda. Detta beslut raderar inte legacydata och avgör inte hur framtida publikationer ska redigeras i v4. Om konkreta publikationsposter senare behöver migreras krävs nytt urvals- och mappningsbeslut före import.

## Consequences

- Denna imports avstämning räknar inte uteslutna publikations- eller rapportsidor som väntande poster.
- Provacceptans kräver inga verkliga eller syntetiska biblioteksposter.
- Övriga bilagor till inkluderade objekt hanteras fortfarande enligt PLAN-0004.

## Links

- [PRD-0034](../../prds/0034-simplified-legacy-content-import.md)
- [PLAN-0004](../../plans/0004-simplified-legacy-content-import.md)
- [PLAN-0005](../../plans/0005-legacy-import-remapping.md)
- [ADR-0046](0046-unified-articles-and-bounded-legacy-import.md)
