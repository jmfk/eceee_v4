---
id: PRD-0060
title: Behörigheter och skyddade nedladdningar
status: draft
locked: false
created: 2026-11-18
related_adrs: [ADR-0076, ADR-0077]
---

# Behörigheter och skyddade nedladdningar

## Mål

En aktiv medlem kan ladda ned en skyddad rapport från publikationsbiblioteket. En besökare kan läsa den publicerade rapportsidan och får en tydlig väg till inloggning eller medlemsinformation.

## Första leveransen

- Redaktören kan välja publik eller medlemsbegränsad åtkomst för en fil och för skyddat innehåll där det behövs. Befintliga publika filer behåller sin åtkomst.
- Samma medlemsregel tillämpas på servern för sidrendering, API och nedladdning. Tenant, publiceringsstatus och resursens åtkomstkrav kontrolleras vid varje skyddat anrop.
- Originalfiler lagras privat. Efter godkänd kontroll får användaren en kortlivad nedladdningslänk. Skyddade svar får inte delas via publik cache. Sök, förhandsvisningar och miniatyrer får bara visa uttryckligen publikt innehåll.
- Första resan är en publicerad rapportsida och en medlemslåst PDF. Gruppregler och engångsköp ingår i senare leveranser.

## Acceptans

- En utloggad besökare kan se rapportsidan men får ingen fil vid direkt anrop. Efter inloggning kan en aktiv medlem hämta filen. En annan tenant, ett utgånget medlemskap och en opublicerad rapport nekas.
- När åtkomsten återkallas utfärdas inga nya länkar. Redan utfärdade länkar upphör efter en dokumenterad kort giltighetstid. Objektlagringens adress erbjuder ingen publik reservväg.
- Testa HTML, API, fillänk, cache och eventuella derivat i samma flöde. En läsare med behörighet får samma resultat efter omladdning och en läsare utan behörighet får inga privata uppgifter.
- En medlem som behöver logga in återvänder till den aktuella rapportsidan. En inloggad användare med utgånget eller avslutat medlemskap kan se sin status och nå kontaktvägen från meddelandet vid filen.

## Relaterade dokument

- [PRD-0054 – Bibliotek för proceedings och rapporter](0054-eceee-publication-library.md)
- [PRD-0059 – Medlemskonton och Mina sidor](0059-eceee-member-accounts.md)
- [PLAN-0007 – Verifiering av medlemsgrundpaketet](../plans/0007-eceee-member-foundation-verification.md)
- [ADR-0076 – Skilj konto, medlemskap och åtkomsträtt](../adrs/active/0076-separate-member-access.md)
- [ADR-0077 – Kontrollera åtkomst före privat leverans](../adrs/active/0077-authorize-private-downloads.md)
