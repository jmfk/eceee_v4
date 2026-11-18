---
id: ADR-0071
title: Återanvänd publicerade redaktionella objekt
status: accepted
date: 2026-11-18
related_prds: [PRD-0052, PRD-0055]
supersedes: []
superseded_by: []
---

# Återanvänd publicerade redaktionella objekt

## Beslut

Kalendern, seminariesidan och den kompakta listan använder samma publicerade Event-versioner. Typ, kategori, gruppering och slug styr urval och länkar. Kommande-listan har ett eget tidsurval. Ämneslistor använder publicerade Artikel-objekt och organisationswidgeten använder publicerade Organisationsobjekt.

## Följder

En publicering kan uppdatera flera vyer. Delning över subsajter måste behålla arbetsytans behörighetsgräns. Publicerare och förhandsvisning delar urvalsreglerna. Separata kopior skulle kräva synkronisering av datum, klassificering och länkar.

## Relaterade krav

- [PRD-0052](../../prds/0052-eceee-seminars.md)
- [PRD-0055](../../prds/0055-eceee-editorial-widgets.md)
