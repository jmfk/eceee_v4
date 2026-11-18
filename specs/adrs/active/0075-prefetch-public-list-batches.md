---
id: ADR-0075
title: Förhämta nästa omgång i publika listor
status: accepted
date: 2026-11-18
related_prds: [PRD-0058]
supersedes: []
superseded_by: []
---

# Förhämta nästa omgång i publika listor

## Bakgrund

News Flash har en scrollobservatör med 200 px marginal. Kalendern och Columnists har manuell laddning. De använder redan sidindelade flöden och kan behålla sina egna urvalsregler.

## Beslut

Återanvänd befintlig sidindelning och samordna beteendet för tidig laddning i TypeScript-publiceraren och dess förhandsvisning. Observera en markör efter aktuella poster relativt vyns scrollområde. Börja med cirka två synliga vyhöjder framför slutet. Justera tröskeln efter mätning på mobil och dator.

Hämta högst en omgång per lista åt gången. Lägg till inkommande poster med befintliga stabila ID:n, ignorera svar från tidigare sökningar eller filter och avsluta vid tom serveromgång eller konfigurerad maxgräns. Manuell laddning och omförsök använder samma sidindelning.

## Följder

Tidig hämtning använder viss bandbredd för innehåll som besökaren kanske lämnar innan det syns. Begränsningen till nästa omgång håller detta avgränsat. Listor behåller sin sortering och sina filter. Samma strategi går att tillämpa på biblioteket när det får ett eget sidindelat flöde.

## Relaterade krav

[PRD-0058](../../prds/0058-seamless-public-lists.md).
