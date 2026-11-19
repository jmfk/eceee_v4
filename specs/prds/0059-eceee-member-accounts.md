---
id: PRD-0059
title: Medlemskonton och Mina sidor
status: draft
locked: false
created: 2026-11-18
related_adrs: [ADR-0076]
---

# Medlemskonton och Mina sidor

## Mål

En ECEEE-medlem ska kunna ta emot en inbjudan, verifiera sin e-postadress, logga in på den publika webbplatsen och se sin medlemsstatus på Mina sidor. Redaktörer och administratörer fortsätter använda CMS:ets behörigheter.

## Första leveransen

- En behörig medlemsadministratör kan söka efter medlemmar, bjuda in, ange giltighet och avsluta ett medlemskap i rätt tenant. Privilegierade ändringar loggas med aktör, tid och åtgärd.
- Inbjudningar är mottagarbundna, tidsbegränsade och kan återkallas. Ett verifierat befintligt konto kan ta emot inbjudan utan dubblettkonto.
- Piloten börjar med inbjudan. Medlemmen kan använda e-post och lösenord, Google eller Apple för att logga in. Vid anslutning av en inloggningsmetod till ett befintligt konto måste medlemmen bekräfta att båda identiteterna tillhör dem.
- Flödet för glömt lösenord ger samma bekräftelse oavsett om adressen finns. Återställnings- och verifieringslänkar är tidsbegränsade och löses in en gång. Medlemmen kan begära en ny länk om den tidigare har löpt ut.
- Mina sidor visar profil, medlemsstatus, giltighet och en väg till hjälp med kontot. Kontoflödet omfattar verifiering, återställning och utloggning.
- Återanvänd befintlig identitet, session och transaktionsmejl där de stödjer flödet. Medlemskap via organisation införs när ECEEE:s regler för det är fastställda.
- För piloten används uttryckligen verifierade medlemskap. Innan ett ordinarie register kopplas in ska ansvarig för medlemsdata besluta om FileMaker förblir källa för medlemsstatus, ersätts av v4 eller får en tidsbegränsad övergångsroll. Beslutet ska omfatta ägarskap, avstämning och återkallelser. Piloten kräver ingen FileMaker-integration.

## Acceptans

- En inbjuden person kan logga in och se sitt eget medlemskap. Fel mottagare och utgångna eller återkallade inbjudningar kan inte aktivera det.
- Samma medlem kan använda alla tre anslutna metoderna. Apple med dold e-post kan anslutas efter separat bekräftelse av den inbjudna adressen. En matchande e-postadress hos en leverantör ger i sig ingen åtkomst till ett befintligt konto.
- Efter inloggning för en skyddad rapport återvänder medlemmen till rapporten. Vid avbruten inloggning, utgången länk eller nätverksfel finns ett tydligt nästa steg. Mobil, tangentbord, skärmläsare och lösenordshanterare stöds genom hela flödet.
- Medlemsinloggning ger ingen redaktörsbehörighet. En administratör i en tenant kan inte läsa eller ändra en annan tenants medlemskap.
- När medlemskapet löper ut eller avslutas visar Mina sidor ändringen och nästa skyddade anrop nekas. Kontot kan fortfarande användas för att se status och kontakta support.

## Relaterade dokument

- [Övergripande åtkomstkrav och öppna integrationsfrågor](0056-eceee-access-and-integrations.md)
- [PRD-0060 – Behörigheter och skyddade nedladdningar](0060-eceee-protected-downloads.md)
- [PRD-0065 – Medlemsmejl och kontaktformulär](0065-member-email-and-contact.md)
- [PLAN-0007 – Verifiering av medlemsgrundpaketet](../plans/0007-eceee-member-foundation-verification.md)
- [ADR-0076 – Skilj konto, medlemskap och åtkomsträtt](../adrs/active/0076-separate-member-access.md)
