---
id: ADR-0073
title: Håll det lokala biblioteket oberoende av framtida källval
status: accepted
date: 2026-11-18
related_prds: [PRD-0054]
supersedes: []
superseded_by: []
---

# Håll det lokala biblioteket oberoende av framtida källval

## Beslut

Äldre proceedings och egna rapporter som förs in i CMS använder den befintliga publikationsmodellen library_item. Importen bevarar källidentiteten och skapar granskningsbart innehåll för ordinarie publicering.

## Följder

Framtida proceedings kan anslutas separat när innehåll, rättigheter och drift har verifierats. Plattform och presentationssätt avgörs efter den utredningen. Den lokala arkivdelen förblir tillgänglig om den framtida källan är otillgänglig.

## Relaterade krav

- [PRD-0054](../../prds/0054-eceee-publication-library.md)
