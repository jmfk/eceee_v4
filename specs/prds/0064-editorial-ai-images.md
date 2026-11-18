---
id: PRD-0064
title: AI-bilder för artiklar och sidor
status: started
locked: true
created: 2026-11-18
related_adrs: [ADR-0081]
---

# AI-bilder för artiklar och sidor

## Mål

En redaktör kan generera bilder utifrån en artikel eller sidas innehåll, vid behov ge egna instruktioner och prova flera varianter innan en bild används.

## Redaktörsflöde

1. Välj **Generera AI-bild** i artikelns eller sidans bildväljare. Genereringen använder relevant innehåll från det aktuella utkastet. En egen prompt är valfri och kan justeras inför nästa försök.
2. Varje färdig bild sparas tillfälligt med artikeln eller sidan. Redaktören kan jämföra varianter, ladda om redigeraren och fortsätta där arbetet slutade. Ett nytt försök behåller tidigare varianter. Visa hur länge tillfälliga bilder finns kvar.
3. När redaktören väljer **Använd bild** sparas bilden i Media Manager och infogas på vald plats i utkastet. Varje förslag har också en separat åtgärd **Spara i Media Manager**, så att valfria varianter kan sparas utan att infogas.
4. Föreslå relevanta befintliga medietaggar automatiskt. Redaktören kan justera förslagen och komplettera obligatoriska taggar. Varje genererad bild som sparas i Media Manager får alltid den särskilda taggen **AI**.
5. I Media Manager kan redaktören filtrera på **AI**, **Ej AI** och **Alla**. Filtret fungerar tillsammans med sökning och andra mediefilter.

## Acceptans

- Generera flera varianter från både en artikel och en sida, med och utan egen prompt. Efter omladdning syns förslagen på rätt innehåll. En misslyckad generering lämnar tidigare varianter tillgängliga.
- En använd bild sparas och visas i utkastet. En annan variant kan sparas separat. Om infogningen behöver upprepas efter en lyckad sparning återanvänds samma mediaobjekt.
- En genererad bild får taggförslag och den obligatoriska AI-taggen. De tre filtren ger rätt resultat även i kombination med övriga taggar. Befintliga bilder utan registrerat AI-ursprung ingår i **Ej AI**.
- Tillfälliga bilder är åtkomliga endast för behöriga redaktörer i rätt tenant. När de löper ut påverkas inga bilder som sparats i Media Manager. Infogning följer ordinarie arbetsflöde för utkast och publicering.

## Öppet inför implementation

Fastställ giltighetstiden för osparade varianter och vilka befintliga AI-kopplingar som stöder bildgenerering. Om bildgenerering saknas för tenanten visar redigeraren vad som saknas.

## Relaterade dokument

- [PRD-0063 – AI-stöd för sammanfattningar och redaktionella texter](0063-editorial-ai-from-sources.md)
- [ADR-0081 – Separera tillfälliga AI-bildförslag från sparade media](../adrs/active/0081-track-generated-image-provenance.md)

## Implementationsnoteringar

Första ändringen inför registrerat AI-ursprung och filtret i Media Manager. Bildgenerering, temporära varianter och automatisk märkning följer därefter.
AI-ursprung följer bildens version och förs vidare när paketimport skapar ett nytt mediaobjekt. Vid återanvändning av en redan befintlig fil med samma innehåll gäller mottagarens befintliga klassning.

Artikelpiloten kan generera och jämföra privata varianter från sparat utkast. Sparning i Media Manager, märkning, infogning och stöd för sidor följer separat.

I nästa artikelleverans kan en kandidat sparas eller väljas som artikelbild. Taggförslagen matchar källtext och bildinstruktioner mot godkända termer i artikelns medianamnrymd. AI-taggen sätts på servern.
