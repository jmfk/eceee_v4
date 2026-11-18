---
id: ADR-0080
title: Använd befintliga AI-kopplingar för redaktionella förslag
status: accepted
date: 2026-11-18
related_prds: [PRD-0063]
supersedes: []
superseded_by: []
---

# Använd befintliga AI-kopplingar för redaktionella förslag

## Beslut

Använd tenantens befintliga AI-konfiguration och leverantörsadaptrar. Matcha uppgiften mot modellens text- eller bildstöd. Återanvänd Media Managers befintliga väg för AI-förslag där den passar. Skicka bara det innehåll som behövs för den begärda uppgiften.

För länkar hämtar en serverdel den läsbara huvudtexten och källans metadata från en publik sida. Återanvänd nätverksgränsen för externa länkar från ADR-0079 där det är möjligt, med begränsad storlek och tid. Länkat innehåll behandlas som källmaterial. Instruktioner i en webbsida eller bild får inte ge modellen åtkomst till verktyg, hemligheter eller CMS-åtgärder.

Förslag bär källreferens och kontext för fält, revision eller vald bild. Spara först när redaktören godkänner ett förslag, genom det ordinarie utkast- eller metaflödet. Vid revisionskonflikt får redaktören granska förslaget mot aktuellt innehåll. Följ befintliga behörigheter och publiceringsflöden.

## Konsekvenser

Redaktören kan granska förslag nära det fält där de används. Ett avbrott i AI-tjänsten lämnar utkastet redigerbart. Källhänvisningen ger redaktören underlag för faktagranskning och attribution.

## Relaterade dokument

- [PRD-0063](../../prds/0063-editorial-ai-from-sources.md)
- [ADR-0030 – Tenant BYOK through capability-aware provider adapters](0030-tenant-byok-provider-adapters.md)
- [ADR-0031 – Human-controlled publication and recoverable mutations](0031-human-controlled-publication.md)
- [ADR-0079 – Lagra länkfångster som vanligt media](0079-store-link-captures-as-media.md)
