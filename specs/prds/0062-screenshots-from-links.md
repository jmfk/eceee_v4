---
id: PRD-0062
title: Skärmbilder från länkar i artiklar och sidor
status: started
locked: true
created: 2026-11-18
related_adrs: [ADR-0079]
---

# Skärmbilder från länkar i artiklar och sidor

## Mål

En redaktör kan klistra in en länk, förhandsgranska en skärmbild och lägga in den i en artikel eller på en sida. Bilden sparas som återanvändbart media med rätt taggar.

## Redaktörsflöde

1. Välj **Skapa skärmbild från länk** där en bild kan väljas i en artikel eller på en sida.
2. Klistra in en publik webbadress och granska bilden. Vid fel visas en förklaring och möjlighet att försöka igen.
3. Kontrollera föreslagna taggar, välj bland befintliga termer och fyll i obligatoriska taggar och bildens alternativa text där den används. Om projektet har en godkänd tagg för skärmbilder kan den förväljas.
4. Spara bilden i Media Manager och infoga den på den valda platsen i utkastet. Bilden kan även väljas i andra texter via den vanliga medieväljaren.

## Acceptans

- Testa hela flödet från både en artikel och en sida. Den sparade bilden hittas i Media Manager under de bekräftade taggarna, och samma mediaobjekt kan återanvändas utan en ny skärmbild.
- Befintliga krav på medietaggar och behörigheter gäller. Taggförslag skapar inga nya taxonomitermer. Källa och fångsttid sparas som metadata så att redaktören kan se varifrån bilden kommer.
- Avbruten eller misslyckad fångst lämnar inget mediaobjekt. Om infogning misslyckas efter bekräftad sparning kan redaktören välja den redan sparade bilden igen.
- Bilden är en ögonblicksbild. Den ändras först när redaktören gör en ny fångst. Funktionen är avsedd för publika webbsidor. Sidor som kräver inloggning och schemalagd uppdatering ligger utanför första leveransen.

## Relaterade beslut

- [ADR-0079 – Lagra länkfångster som vanligt media](../adrs/active/0079-store-link-captures-as-media.md)
- [PRD-0035 – Klassificeringens läsbyte och obligatorisk mediataggning](0035-classification-cutover-and-required-media.md)

## Implementationsnoteringar

Den första fångsten använder en separat väg för publikt HTML-innehåll som går att visa utan JavaScript.
