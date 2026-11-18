---
id: PRD-0053
title: Externa evenemangsförslag
status: draft
locked: false
created: 2026-11-18
related_adrs: [ADR-0072]
---

# Externa evenemangsförslag

## Krav

- Låt inloggade arrangörer skicka in titel, datum, arrangör, plats, fokusområde, typ, kategori och beskrivning samt öppna och ändra egna förslag.
- Ge redaktörer en kö för nya och ändrade förslag, stöd att begära ändringar och möjlighet att godkänna den granskade versionen för publicering.
- Skicka ett mejl vid inlämning och ändring med en länk som kräver redaktörsbehörighet. Utred SMS som inloggningsalternativ.

## Acceptans

En arrangör kan ändra sina egna förslag. Försök att läsa andra arrangörers utkast eller publicera själv nekas. Ett godkänt förslag visas i kalendern och öppnar rätt detaljsida. Efter ändring krävs nytt godkännande och den tidigare publicerade versionen ligger kvar under granskningen. Ett omförsök av samma inskick skapar ett granskningsärende och ett mejl totalt.

## Källa

ECEEE:s webbplatsspecifikation från september (eceee_web_specifications_sep26.docx).

## Relaterade beslut

- [ADR-0072](../adrs/active/0072-moderate-event-versions.md)
