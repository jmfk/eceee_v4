---
id: ADR-0050
title: Klassificeringens aktivering och medieintegritet
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0031
  - PRD-0035
supersedes: []
superseded_by: []
---

# ADR-0050: Klassificeringens aktivering och medieintegritet

## Context

Ägaren kräver en färdig övergång och bekräftar obligatorisk taxonomistyrd mediataggning. Två oberoende väljare och osynkroniserade relationer är inte en slutlösning.

## Decision

De ordnade klassificeringsrelationerna är den gemensamma tilldelningsmodellen. Äldre media-taggar, canonical M2M och versionsfält är kompatibilitetsprojektioner som uppdateras inom samma databastransaktion. Äldre skrivningar passerar samma tilldelnings- och rättighetskontroll. Explicit aktör kontextualiserar HTTP-anrop och bakgrundsimport; projektionerna har ett avgränsat rekursionsskydd.

Aktivering sker per namespace med en databaslagrad fas, ett verifierat återupptagbart migreringsjobb och en ny avstämning under namespace-lås. Additiva schemamigreringar aktiverar inte läsbytet automatiskt. Tomma, ogiltiga och osynkroniserade medier stoppar aktiveringen utan att förses med påhittade standardtaggar.

Godkända mediafiler och samlingar kräver minst en giltig klassificering. Pending-filer är förstadiet där taggning ännu får saknas. Servervalidering ger handlingsbara fel; efter aktivering ger PostgreSQL:s uppskjutna integritetskontroll även skydd mot bulk/ORM-skrivningar som kringgår applikationslagret. Uppskjutningen tillåter atomiskt byte av tilldelningar och skapande av fil med tilldelningar i samma transaktion. Arkiverade befintliga tilldelningar räknas fortsatt som bevarad klassificering; nya tilldelningar och samlingsuppladdningar kräver godkända termer.

Gamla identiteter raderas inte. När lika namn finns i olika typer får en gammal medierad bara fungera som tekniskt adapter-ID; den kan inte tvinga semantisk sammanslagning. API-visning och nya filter läser den kanoniska termen. Föreslagna/avslagna termer exporteras inte som godkända.

## Consequences

- Migrering, verifiering, aktivering och driftsättning är separata steg.
- Representativa uppgraderings- och avbrottstester behövs; SQLite räcker inte för integritetskontrollen.
- Befintliga otaggade medier måste klassificeras av redaktör före aktivering.
- Bakgrundsimport måste ange sin verkliga användare; klassificeringsrättigheter ersätter aldrig innehållsrättigheter.
- Produktion kräver fortfarande fresh owner gates enligt AGENTS.md.

## Links

- [PRD-0035](../../prds/0035-classification-cutover-and-required-media.md)
- [ADR-0043](0043-classification-governance.md)

### Gräns mellan nya och historiska arkiverade kopplingar

Nya media- och samlingskopplingar kräver en godkänd slutterm, även när det ursprungliga ID:t är en sammanslagningshänvisning. Omordning av befintliga kopplingar behåller historiken. Checkpoint-återställning får återskapa en granskad arkiverad koppling först efter befintlig `restore`-behörighetskontroll. Hjälparen sätter då ett transaktionslokalt PostgreSQL-kontext med exakt relationstabell, resurs-ID och granskade term-ID:n; triggerundantaget gäller endast dessa kopplingar och kontextet återställs direkt efter skrivningen. Termens arkivstatus och revisionshistorik ändras inte. Vanliga ORM-, bulk- och SQL-skrivningar saknar detta återställningskontext och avvisas.

Vid hash-/slug-återanvändning av medier och samlingar kompletterar paketimport destinationens befintliga klassificeringar i bevarad ordning. Versionsbundna tilldelningar ersätts fortsatt exakt med paketets urval.
