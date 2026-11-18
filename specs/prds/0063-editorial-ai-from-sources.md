---
id: PRD-0063
title: AI-stöd för sammanfattningar och redaktionella texter
status: draft
locked: false
created: 2026-11-18
related_adrs: [ADR-0080]
---

# AI-stöd för sammanfattningar och redaktionella texter

## Mål

En redaktör kan utgå från en publik länk, ett befintligt utkast eller en vald bild och få ett redigerbart textförslag via sajtens befintliga AI-kopplingar.

## Redaktörsflöden

- **Från en länk.** Klistra in exempelvis en nyhetslänk och välj **Sammanfattning** eller **Längre omskrivning**. Sammanfattningen återger huvudpunkterna. Omskrivningen ger ett längre utkast med egen struktur och formulering, byggt på källans sakuppgifter. Visa källans titel och länk bredvid förslaget och låt redaktören ta med källhänvisningen i texten.
- **Från ett artikel- eller sidutkast.** Föreslå en titel, en ingress eller en puff från aktuellt innehåll. En ingress introducerar själva artikeln. En puff är en fristående korttext för en lista eller startsida. Använd respektive fälts befintliga längdkrav.
- **Från en vald bild.** Föreslå en bildtitel i Media Manager utifrån bilden där AI-kopplingen har bildstöd. Bildtitel har ett eget fält. Alternativtext och bildtext hanteras i sina respektive fält.
- Visa förslaget innan redaktören väljer att använda, redigera, generera på nytt eller avstå. Användning uppdaterar det valda fältet eller infogar text på vald plats i utkastet. Publicering följer ordinarie arbetsflöde.

## Acceptans

- En redaktör kan skapa och jämföra en kort sammanfattning och en längre omskrivning från samma nyhetslänk. Båda har spårbar källa. Testfallen täcker bevarade fakta, uteblivna påhittade citat och en omskrivning som undviker långa ordagranna partier.
- Titel, ingress, puff och bildtitel kan skapas och godkännas var för sig. Testa att övriga fält och publicerad text behåller sina värden när ett förslag används.
- Sidor som är otillgängliga, kräver inloggning eller har för lite läsbar text ger en tydlig status. Detsamma gäller när rätt AI-koppling eller bildstöd saknas. Redaktören kan fortsätta redigera sina utkast under tiden.
- Testa att förslag från en äldre artikelrevision eller en tidigare vald bild inte kan skriva över den aktuella texten utan förnyad granskning.

## Relaterade dokument

- [PRD-0062 – Skärmbilder från länkar i artiklar och sidor](0062-screenshots-from-links.md)
- [PRD-0024 – CMS Content Agent](0024-cms-content-agent.md)
- [ADR-0080 – Använd befintliga AI-kopplingar för redaktionella förslag](../adrs/active/0080-use-existing-ai-for-editorial-suggestions.md)
