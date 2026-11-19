---
id: PRD-0065
title: Gemensamma webbplatsfunktioner
status: completed
locked: true
created: 2026-11-18
related_adrs: [ADR-0082]
---

# PRD-0065: Gemensamma webbplatsfunktioner

## Problem

Besökare och redaktörer behöver sökbara arkiv, hållbara länkar, språkstöd, integritet och ett granskat inskicksflöde i v4.

## Requirements

- Publik sökning och arkiv för nyheter, publikationer och evenemang med text-, datum- och typfilter och paginering, enbart publicerade tenantavgränsade objekt.
- Sitemap, canonical, metadata, delningsbild och säkra omdirigeringar vid ändrade sid-adresser.
- Valfritt sidspråk och länkar till publicerade översättningar; tangentbordsstöd, synligt fokus och tillgängliga formulär.
- Valbar besöksstatistik med uttryckligt samtycke före insamling när samtycke är aktiverat, återkallelse och inga personidentifierare i nya besökshändelser.
- Kontoexport och en spårbar rutin för raderingsbegäran utan automatisk radering av redaktionellt material.
- Inskick ska bekräftas och kunna modereras med status av behöriga redaktörer; godkännande publicerar aldrig automatiskt.
- Befintliga formulär är första inskicksvägen; särskilda medlemsbundna evenemangsförslag kan följa efter medlemsgrunden.

## Acceptance Criteria

- Publicerade data filtreras före paginering, och privata data lämnar inte servern.
- SEO och översättningar använder publicerade versioner; gamla adresser leder till aktuell publicerad sida inom samma sajt.
- Nekat/återkallat samtycke hindrar nya statistik-anrop.
- CMS har nåbara verktyg för inställningar, inskick och kontoexport/raderingsbegäran.
- Riktade automatiska kontroller dokumenteras; inga produktionsändringar ingår.

## Constraints

Använd befintlig TypeScript-publicerare, React och tenantavgränsade databaskontrakt. Django-tillägg begränsas till befintligt schema och autentiserade CMS-gränser.

## Implementation Notes

- Eget worktree på `codex/website-functions`, baserat på sparad HEAD. Pågående osparade funktioner och medlems-PRD:er i ursprungscheckouten ingår inte.

## Linked ADRs

- [ADR-0082](../adrs/active/0082-website-functions-on-existing-boundaries.md)

## Completion Evidence

- `npm --prefix publisher test`: 179 passerade, 3 befintliga integrationsfall överhoppade; `typecheck`, `lint` och produktionsbygge passerade.
- Frontend: 173 renderer-/register-/funktionstester samt senare 9 riktade UI-/navigationsregressioner passerade; Vite-bygge passerade.
- Isolerad PostgreSQL: nya funktions-/exporttester, ren schemainstallation, rå formulär-INSERT med modereringsstandardvärden och befintliga rollkontroller. Två PG14-förutsättningsfel för PUBLIC CREATE rättades i den isolerade testdatabasens ACL och testerna passerade därefter.
- Verifierade publicerarens faktiska SQL mot samma isolerade PostgreSQL: vinnande typ/slug före textfilter, dynamisk alias-suffix, tenantgräns och sidtraversering.
- Visuell panelkontroll 1280/390 px, fokus, Reduce Motion och ingen horisontell overflow. Inga autentiserade helsajtsvyer kördes.
- [Drift-, användnings- och verifieringsguide](../../docs/common-website-functions.md).
- Ingen PR, push, merge eller deployment ingår. Next.js uppdaterad från 16.4.2 till säkerhetspatchen 16.4.6; produktionsberoendeaudit utan fynd.

### PR preparation

- Rebased the effective feature patch onto current main plus a separate Next.js security-patch branch; preserved main’s calendar queries and already-merged 0080 fix.
- Publisher verification on this base: 181 passed, 3 optional integration cases skipped; typecheck and lint passed. SQL verified against the isolated cluster with both calendar modes and the new archive parameters.
