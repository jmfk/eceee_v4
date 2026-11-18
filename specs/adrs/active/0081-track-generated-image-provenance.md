---
id: ADR-0081
title: Separera tillfälliga AI-bildförslag från sparade media
status: accepted
date: 2026-11-18
related_prds: [PRD-0064]
supersedes: []
superseded_by: []
---

# Separera tillfälliga AI-bildförslag från sparade media

## Beslut

Använd tenantens konfigurerade AI-koppling med stöd för bildgenerering. Ge modellen relevant utdragsinnehåll och redaktörens eventuella prompt. Koppla varje färdig kandidat till tenant, innehållspost och källrevision så att den kan visas igen från redigeraren. Lagra kandidater privat med en tydlig giltighetstid. Vid städning tas bara utgångna, temporära filer bort.

När en kandidat används eller sparas uttryckligen skapar det ordinarie medieflödet en beständig resurs och validerar taggarna. Sparning av samma kandidat ska tåla omförsök. En artikel eller sida refererar det beständiga mediaobjektet.

Registrera AI-ursprung som systemmetadata och sätt den särskilda AI-taggen via termens stabila ID. Etiketten kan då visas tillsammans med övriga taggar, medan filtret använder registrerat ursprung. Redigerbara motivtaggar påverkar inte AI-klassningen. AI-genererade taggförslag och AI-genererad bild är olika egenskaper. Befintliga filer kräver ingen gissad klassning.

## Konsekvenser

Redaktören kan prova om utan att fylla Media Manager med varianter. AI-ursprunget förblir sökbart även om de övriga taggarna ändras. Sparade bilder lever vidare när kandidaterna städas bort.

## Relaterade dokument

- [PRD-0064](../../prds/0064-editorial-ai-images.md)
- [ADR-0080 – Använd befintliga AI-kopplingar för redaktionella förslag](0080-use-existing-ai-for-editorial-suggestions.md)
