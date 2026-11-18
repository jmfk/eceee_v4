---
id: ADR-0079
title: Lagra länkfångster som vanligt media
status: accepted
date: 2026-11-18
related_prds: [PRD-0062]
supersedes: []
superseded_by: []
---

# Lagra länkfångster som vanligt media

## Beslut

Återanvänd den befintliga Playwright-renderingen om den uppfyller kraven för att fånga externa sidor. Fångsten är tillfällig tills redaktören bekräftar. Vid bekräftelse sparas bildfil och metadata via ordinarie medieflöde i rätt tenant, med befintlig validering av godkända och obligatoriska termer. Artikeln eller sidan refererar det sparade mediaobjektet på samma sätt som vid ett vanligt bildval.

Kör fångsten i ett isolerat webbläsarsammanhang utan CMS-session eller åtkomst till interna tjänster. Publika HTTP- och HTTPS-mål är tillåtna. Nätverksgränsen måste gälla även om sidan omdirigerar eller laddar egna resurser. Begränsa fångsttid och storlek, och verifiera att färdig fil har en stödd bildtyp innan den lämnas vidare till medieflödet. Spara en sanerad källadress och fångsttid som metadata.

## Konsekvenser

Mediefilen kan återanvändas, klassificeras och ändras med samma verktyg som övriga bilder. En förändring på källsidan påverkar inte redan publicerat material. Om den befintliga renderingen behöver härdas görs det innan externa länkar aktiveras för redaktörer.

## Relaterad PRD

- [PRD-0062 – Skärmbilder från länkar i artiklar och sidor](../../prds/0062-screenshots-from-links.md)
