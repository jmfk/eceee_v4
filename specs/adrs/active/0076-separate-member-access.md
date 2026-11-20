---
id: ADR-0076
title: Skilj konto, medlemskap och åtkomsträtt
status: accepted
date: 2026-11-18
related_prds: [PRD-0059, PRD-0060]
supersedes: []
superseded_by: []
---

# Skilj konto, medlemskap och åtkomsträtt

## Bakgrund

ECEEE behöver låta webbplatsmedlemmar nå skyddat innehåll. CMS-redaktörer har redan en egen behörighetsmodell. Det ska gå att införa medlemsgången medan frågan om FileMaker förblir öppen.

## Beslut

Återanvänd v4:s kontoidentitet där den stöder verifierad inloggning. Modellera webbplatsmedlemskap som ett separat tenantbundet tillstånd med status och giltighet. CMS-roller tilldelas separat. Åtkomst till en resurs härleds i v4 från den aktuella medlemsstatusen och resursens åtkomstregel.

Piloten får använda medlemskap som en behörig administratör verifierar. Håll registerkällans identitet och synkronisering utanför åtkomstkontrollen. Valet av FileMaker som fortsatt källa, övergångskälla eller system som senare ersätts dokumenteras i ett separat beslut när ECEEE har valt registerägare.

## Konsekvenser

Ett konto kan finnas kvar när ett medlemskap upphör. En framtida registerintegration kan uppdatera medlemsstatus utan att bli ett direkt beroende för varje nedladdning. Före eventuell synk behövs regler för externa identiteter, fördröjd uppdatering och konflikt mellan källor.

## Relaterade PRD:er

- [PRD-0059](../../prds/0059-eceee-member-accounts.md)
- [PRD-0060](../../prds/0060-eceee-protected-downloads.md)
