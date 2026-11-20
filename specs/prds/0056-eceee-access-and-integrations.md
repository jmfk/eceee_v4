---
id: PRD-0056
title: Medlemsåtkomst, externa granskare och integrationer
status: draft
locked: false
created: 2026-11-18
related_adrs: []
---

# Medlemsåtkomst, externa granskare och integrationer

## Beslut som behövs

- Bestäm vilket innehåll som behöver medlemsskydd, hur medlemskap verifieras och vilken roll FileMaker ska ha.
- Bestäm om externa granskare ska kunna bjudas in till en sida eller ett helt sajtutkast. Definiera omfattning, giltighetstid och återkallelse.
- Välj vilka CWP-flöden för registrering och dokumentinlämning som ska bäddas in. Stäm av inloggning och reservlänkar med tjänstens ägare.
- Besluta om Ecodesign ska återstartas och vilka objekt och widgetar sajten i så fall ska dela.

## Acceptans för beslutsfasen

Varje aktiverad funktion har en ansvarig, ett konkret användarflöde och testbara åtkomstregler där det behövs. För skyddat innehåll omfattar kontrollerna sidor, API, filer, cache och återkallad åtkomst. Befintlig intern förhandsvisning används som underlag för granskningsbeslutet.

## Källa

ECEEE:s webbplatsspecifikation från september (eceee_web_specifications_sep26.docx).

## Relaterade specifikationer och beslut

- [PRD-0059 – Medlemskonton och Mina sidor](0059-eceee-member-accounts.md) och [PRD-0060 – Behörigheter och skyddade nedladdningar](0060-eceee-protected-downloads.md) beskriver första leveransen.
- [ADR-0076 – Skilj konto, medlemskap och åtkomsträtt](../adrs/active/0076-separate-member-access.md) anger hur åtkomst fungerar medan valet av registerkälla, inklusive FileMaker, är öppet.
