---
id: PRD-0055
title: Nyhetsplacering och redaktionella widgetar
status: draft
locked: false
created: 2026-11-18
related_adrs: [ADR-0071]
---

# Nyhetsplacering och redaktionella widgetar

## Krav

- Verifiera listan med senaste nyheter på startsidan och septemberkravet om elva nyheter längst ned på News. Stäm av om antalet avser första visningen, en separat sektion eller hela listan före ändring av den progressiva laddningen.
- Placera ämnesfiltrerade nyhetslistor på de policysidor och subsajter redaktionen väljer. Stäm av behovet av textlistor över nyheter och krönikor i sidhuvud och redaktionella genvägar.
- Ge redaktören en widget som väljer en publicerad medlemsorganisation vid sidladdning. Verifiera slumpad logotypordning med befintliga bildsamlingar.

## Acceptans

Startsidan och News visar avstämda urval med fungerande länkar. En policysida och en subsajt visar endast valda ämnen. Organisationswidgeten väljer ur rätt arbetsytas publicerade objekt och hanterar tomt urval. Slumpad logotypordning visar varje vald logotyp en gång.

Bygger vidare på [PRD-0047](0047-news-page-and-related-stories.md).

## Källa

ECEEE:s webbplatsspecifikation från september (eceee_web_specifications_sep26.docx).

## Relaterade beslut

- [ADR-0071](../adrs/active/0071-reuse-published-editorial-objects.md)

## Gemensamt krav för listor

Se [PRD-0058 om automatisk laddning](0058-seamless-public-lists.md).
