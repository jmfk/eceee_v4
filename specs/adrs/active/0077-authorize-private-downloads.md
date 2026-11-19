---
id: ADR-0077
title: Kontrollera åtkomst före privat leverans
status: accepted
date: 2026-11-18
related_prds: [PRD-0060]
supersedes: []
superseded_by: []
---

# Kontrollera åtkomst före privat leverans

## Beslut

Håll skyddade original i privat objektlagring och referera till filen med v4:s stabila fil-ID. En serverväg verifierar identitet, tenant, publiceringsstatus och resursens åtkomstregel före utfärdande av en kortlivad signerad nedladdningslänk. Återanvänd befintliga medie- och lagringsfunktioner där de uppfyller gränsen. Skyddade API-svar och sidor får inte hamna i delad publik cache. Publik katalogmetadata väljs uttryckligen.

## Konsekvenser

Indraget medlemskap hindrar nya länkar. En redan utfärdad länk kan användas under sin återstående giltighetstid. Vid krav på omedelbart stopp även för tidigare utfärdade länkar behöver varje filbegäran auktoriseras via servern. Den första leveransen använder kort giltighetstid så att normal filtrafik kan hanteras av objektlagringen.

Befintliga publika länkar och cachekopior måste hanteras innan en tidigare publik fil klassas som skyddad. Testa filens alternativa vägar, inklusive sök, förhandsvisning och derivat.

## Relaterad PRD

- [PRD-0060](../../prds/0060-eceee-protected-downloads.md)
